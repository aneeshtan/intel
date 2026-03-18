<?php

namespace Tests\Feature;

use App\Models\AlertChannel;
use App\Models\AlertDelivery;
use App\Models\Mention;
use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AlertingTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_manage_alert_channels_and_project_rules(): void
    {
        $user = $this->makeUserWithProject($project);
        Sanctum::actingAs($user);

        $channelResponse = $this->postJson('/api/alerts/channels', [
            'type' => 'email',
            'name' => 'Ops email',
            'destination' => 'alerts@example.com',
        ]);

        $channelResponse
            ->assertCreated()
            ->assertJsonPath('data.type', 'email')
            ->assertJsonPath('data.destination', 'alerts@example.com');

        $channelId = $channelResponse->json('data.id');

        $ruleResponse = $this->postJson("/api/projects/{$project->id}/alerts", [
            'name' => 'High reach watch',
            'frequency' => 'instant',
            'min_reach' => 10000,
            'source_filters' => ['media', 'reddit'],
            'channel_ids' => [$channelId],
        ]);

        $ruleResponse
            ->assertCreated()
            ->assertJsonPath('data.name', 'High reach watch')
            ->assertJsonPath('data.channels.0.id', $channelId);

        $this->getJson('/api/alerts/channels')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/projects/{$project->id}/alerts")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_recent_mentions_trigger_in_app_and_slack_alerts(): void
    {
        Http::fake([
            'https://hooks.slack.test/*' => Http::response(['ok' => true], 200),
        ]);

        $user = $this->makeUserWithProject($project, $keyword);

        $inAppChannel = $user->alertChannels()->create([
            'type' => AlertChannel::TYPE_IN_APP,
            'name' => 'Workspace inbox',
            'is_active' => true,
        ]);

        $slackChannel = $user->alertChannels()->create([
            'type' => AlertChannel::TYPE_SLACK,
            'name' => 'Slack ops',
            'destination' => 'https://hooks.slack.test/alerts',
            'is_active' => true,
        ]);

        $rule = $project->alertRules()->create([
            'user_id' => $user->id,
            'name' => 'All fresh mentions',
            'is_active' => true,
            'frequency' => 'instant',
        ]);

        $rule->channels()->sync([$inAppChannel->id, $slackChannel->id]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => sha1('instant-alert-1'),
            'author_name' => 'Ops Desk',
            'url' => 'https://example.test/articles/1',
            'title' => 'SeaLead expands fresh service',
            'body' => 'SeaLead announced a new service this afternoon.',
            'sentiment' => 'neutral',
            'published_at' => now()->subMinutes(15),
            'metadata' => [
                'source_name' => 'Example Maritime',
                'source_domain' => 'example.test',
                'demo' => false,
            ],
        ]);

        $this->assertDatabaseCount('alert_deliveries', 2);
        $this->assertSame(2, AlertDelivery::query()->where('status', 'sent')->count());

        Http::assertSentCount(1);

        Sanctum::actingAs($user);

        $this->getJson('/api/alerts/inbox')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_hourly_digest_groups_pending_alerts_into_one_webhook_call(): void
    {
        Http::fake([
            'https://hooks.example.test/digest' => Http::response(['ok' => true], 200),
        ]);

        $user = $this->makeUserWithProject($project, $keyword);

        $webhookChannel = $user->alertChannels()->create([
            'type' => AlertChannel::TYPE_WEBHOOK,
            'name' => 'Digest webhook',
            'destination' => 'https://hooks.example.test/digest',
            'is_active' => true,
        ]);

        $rule = $project->alertRules()->create([
            'user_id' => $user->id,
            'name' => 'Hourly digest',
            'is_active' => true,
            'frequency' => 'hourly',
        ]);

        $rule->channels()->sync([$webhookChannel->id]);

        foreach ([1, 2] as $index) {
            Mention::query()->create([
                'project_id' => $project->id,
                'tracked_keyword_id' => $keyword->id,
                'source' => 'media',
                'external_id' => sha1("digest-alert-{$index}"),
                'author_name' => 'Digest Desk',
                'url' => "https://example.test/articles/{$index}",
                'title' => "Hourly mention {$index}",
                'body' => 'Fresh article captured for hourly digest processing.',
                'sentiment' => 'neutral',
                'published_at' => now()->subMinutes(10 + $index),
                'metadata' => [
                    'source_name' => 'Example Maritime',
                    'source_domain' => 'example.test',
                    'demo' => false,
                ],
            ]);
        }

        $this->assertSame(2, AlertDelivery::query()->where('status', 'pending')->count());

        $this->artisan('alerts:send-digests hourly')
            ->expectsOutputToContain('Alert digests processed: 1 group(s) sent.')
            ->assertSuccessful();

        $this->assertSame(0, AlertDelivery::query()->where('status', 'pending')->count());
        $this->assertSame(2, AlertDelivery::query()->where('status', 'sent')->count());

        Http::assertSentCount(1);
    }

    private function makeUserWithProject(?object &$project, ?object &$keyword = null): User
    {
        $this->seedBase();

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Alert Watch',
            'slug' => 'alert-watch',
            'status' => 'active',
            'monitored_platforms' => ['media', 'reddit', 'x'],
        ]);

        if (func_num_args() > 1) {
            $keyword = $project->trackedKeywords()->create([
                'keyword' => 'SeaLead',
                'platform' => 'all',
                'match_type' => 'phrase',
                'is_active' => true,
            ]);
        }

        return $user;
    }

    private function seedBase(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);
    }
}
