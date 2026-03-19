<?php

namespace Tests\Feature;

use App\Models\MediaArticle;
use App\Models\Mention;
use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMediaCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_media_coverage(): void
    {
        $this->seedBase();

        config()->set('media_sources.sources', [
            [
                'key' => 'alpha',
                'name' => 'Alpha Maritime',
                'homepage' => 'https://alpha.example.test',
            ],
            [
                'key' => 'beta',
                'name' => 'Beta Shipping',
                'homepage' => 'https://beta.example.test',
            ],
        ]);

        $admin = User::factory()->create();
        $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();
        $admin->attachRole($adminRole);

        $project = $admin->projects()->create([
            'name' => 'Signals',
            'slug' => 'signals',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'Suez Canal',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $article = MediaArticle::query()->create([
            'source_key' => 'alpha',
            'source_name' => 'Alpha Maritime',
            'source_url' => 'https://alpha.example.test',
            'external_id' => 'alpha-1',
            'url' => 'https://alpha.example.test/articles/1',
            'title' => 'Suez Canal operations update',
            'body' => 'Traffic and routing conditions continue to shift.',
            'published_at' => now()->subDay(),
        ]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => 'mention-alpha-1',
            'title' => $article->title,
            'body' => $article->body,
            'sentiment' => 'neutral',
            'published_at' => now()->subDay(),
            'metadata' => [
                'source_key' => 'alpha',
                'source_name' => 'Alpha Maritime',
                'demo' => false,
            ],
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/media-coverage')
            ->assertOk()
            ->assertJsonPath('data.summary.configured_sources', 2)
            ->assertJsonPath('data.summary.indexed_sources', 1)
            ->assertJsonPath('data.summary.archive_articles', 1)
            ->assertJsonPath('data.summary.matched_mentions', 1)
            ->assertJsonPath('data.summary.working_sources', 1)
            ->assertJsonPath('data.summary.unindexed_sources', 1);

        $sources = collect($response->json('data.sources'))->keyBy('key');

        $this->assertSame('working', $sources['alpha']['status']);
        $this->assertSame('Indexed', $sources['alpha']['status_label']);
        $this->assertSame(1, $sources['alpha']['article_count']);
        $this->assertSame(1, $sources['alpha']['matched_mentions_count']);
        $this->assertTrue($sources['alpha']['discovery_enabled']);

        $this->assertSame('unindexed', $sources['beta']['status']);
        $this->assertSame('Unindexed', $sources['beta']['status_label']);
        $this->assertSame(0, $sources['beta']['article_count']);
    }

    public function test_non_admin_cannot_view_media_coverage(): void
    {
        $this->seedBase();

        $user = User::factory()->create();
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($userRole);

        Sanctum::actingAs($user);

        $this->getJson('/api/admin/media-coverage')->assertForbidden();
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
