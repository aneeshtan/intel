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
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_a_project_and_keyword_without_fake_media_mentions(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        Sanctum::actingAs($user);

        $projectResponse = $this->postJson('/api/projects', [
            'name' => 'Red Sea Watch',
            'description' => 'Monitors routing and congestion narratives.',
            'audience' => 'Shipowners',
            'monitored_platforms' => ['linkedin', 'reddit', 'media'],
        ]);

        $projectResponse
            ->assertCreated()
            ->assertJsonPath('data.name', 'Red Sea Watch');

        $projectId = $projectResponse->json('data.id');

        $keywordResponse = $this->postJson("/api/projects/{$projectId}/keywords", [
            'keyword' => '"Port congestion"',
            'platform' => 'media',
            'match_type' => 'phrase',
        ]);

        $keywordResponse
            ->assertCreated()
            ->assertJsonPath('data.keyword', 'Port congestion');

        $this->assertDatabaseHas('projects', ['id' => $projectId, 'user_id' => $user->id]);
        $this->assertDatabaseHas('tracked_keywords', ['project_id' => $projectId, 'keyword' => 'Port congestion']);
        $this->assertDatabaseCount('mentions', 0);
    }

    public function test_authenticated_user_can_delete_a_keyword_and_its_mentions(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        Sanctum::actingAs($user);

        $projectId = $this->postJson('/api/projects', [
            'name' => 'Port Risk Watch',
            'description' => 'Tracks congestion and disruption themes.',
            'audience' => 'Port operators',
            'monitored_platforms' => ['linkedin', 'reddit', 'media'],
        ])->json('data.id');

        $keywordId = $this->postJson("/api/projects/{$projectId}/keywords", [
            'keyword' => 'Port congestion',
            'platform' => 'media',
            'match_type' => 'phrase',
        ])->json('data.id');

        Mention::query()->create([
            'project_id' => $projectId,
            'tracked_keyword_id' => $keywordId,
            'source' => 'media',
            'external_id' => 'test-port-congestion',
            'title' => 'Port congestion eases in Asia',
            'body' => 'Port congestion measures improved this week.',
            'sentiment' => 'neutral',
            'published_at' => now(),
            'metadata' => ['demo' => false],
        ]);

        $this->assertDatabaseHas('mentions', [
            'project_id' => $projectId,
            'tracked_keyword_id' => $keywordId,
        ]);

        $this->deleteJson("/api/projects/{$projectId}/keywords/{$keywordId}")
            ->assertOk()
            ->assertJsonPath('message', 'Tracked keyword deleted successfully.');

        $this->assertDatabaseMissing('tracked_keywords', ['id' => $keywordId]);
        $this->assertDatabaseMissing('mentions', [
            'project_id' => $projectId,
            'tracked_keyword_id' => $keywordId,
        ]);
    }

    public function test_authenticated_user_can_update_a_project(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Old Watch',
            'slug' => 'old-watch',
            'description' => 'Old description.',
            'audience' => 'Shipowners',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        Sanctum::actingAs($user);

        $this->patchJson("/api/projects/{$project->id}", [
            'name' => 'Updated Watch',
            'description' => 'Updated project context.',
            'audience' => 'Ports and operators',
            'status' => 'paused',
            'monitored_platforms' => ['linkedin', 'media'],
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated Watch')
            ->assertJsonPath('data.slug', 'updated-watch')
            ->assertJsonPath('data.status', 'paused');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'name' => 'Updated Watch',
            'slug' => 'updated-watch',
            'status' => 'paused',
            'audience' => 'Ports and operators',
        ]);
    }

    public function test_authenticated_user_can_delete_a_project(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Delete Me',
            'slug' => 'delete-me',
            'description' => 'To be removed.',
            'audience' => 'Operators',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Project deleted successfully.');

        $this->assertDatabaseMissing('projects', [
            'id' => $project->id,
        ]);
    }

    public function test_authenticated_user_can_mute_a_source_and_hide_its_mentions(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'BlueWave Watch',
            'slug' => 'bluewave-watch',
            'description' => 'Tracks BlueWave coverage.',
            'audience' => 'Operators',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'BlueWave',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => 'source-a',
            'author_name' => 'Editorial Desk',
            'url' => 'https://theloadstar.com/sample-story',
            'title' => 'BlueWave expands network',
            'body' => 'BlueWave has expanded its service coverage.',
            'sentiment' => 'neutral',
            'published_at' => now(),
            'metadata' => [
                'source_name' => 'The Loadstar',
                'source_domain' => 'theloadstar.com',
                'demo' => false,
            ],
        ]);

        Sanctum::actingAs($user);

        $this->getJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.mentions_count', 1)
            ->assertJsonPath('data.source_groups.0.domain', 'theloadstar.com');

        $this->postJson("/api/projects/{$project->id}/sources/mute", [
            'domain' => 'theloadstar.com',
        ])->assertOk();

        $this->assertDatabaseHas('muted_entities', [
            'project_id' => $project->id,
            'kind' => 'source',
            'value' => 'theloadstar.com',
        ]);

        $this->getJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.mentions_count', 0)
            ->assertJsonPath('data.source_groups.0.domain', 'theloadstar.com')
            ->assertJsonPath('data.source_groups.0.muted', true)
            ->assertJsonCount(0, 'data.mentions');
    }

    public function test_authenticated_user_can_override_a_mentions_sentiment(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Sentiment Watch',
            'slug' => 'sentiment-watch',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'SeaLead',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $mention = Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => 'sentiment-override-target',
            'title' => 'SeaLead expands service options',
            'body' => 'SeaLead was mentioned in a neutral operational update.',
            'sentiment' => 'neutral',
            'published_at' => now(),
            'metadata' => ['source_name' => 'The Loadstar'],
        ]);

        Sanctum::actingAs($user);

        $this->patchJson("/api/projects/{$project->id}/mentions/{$mention->id}", [
            'sentiment' => 'negative',
        ])
            ->assertOk()
            ->assertJsonPath('data.sentiment', 'negative')
            ->assertJsonPath('data.metadata.sentiment_source', 'manual')
            ->assertJsonPath('data.metadata.original_sentiment', 'neutral');

        $this->assertDatabaseHas('mentions', [
            'id' => $mention->id,
            'sentiment' => 'negative',
        ]);

        $this->patchJson("/api/projects/{$project->id}/mentions/{$mention->id}", [
            'sentiment' => 'auto',
        ])
            ->assertOk()
            ->assertJsonPath('data.sentiment', 'neutral')
            ->assertJsonPath('data.metadata.sentiment_source', 'system');
    }

    public function test_media_ingest_command_backfills_recent_articles_and_generates_mentions(): void
    {
        $this->fakeMediaFeeds();

        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Red Sea Watch',
            'slug' => 'red-sea-watch',
            'description' => 'Monitors routing and congestion narratives.',
            'audience' => 'Shipowners',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'Port congestion',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $this->artisan("media:ingest --project={$project->id} --force --days=90")
            ->expectsOutputToContain('Archive backfill:')
            ->expectsOutputToContain("Project {$project->id} {$project->name}: 1 mentions imported.")
            ->assertSuccessful();

        $this->assertDatabaseHas('media_articles', [
            'source_key' => 'test-maritime-feed',
            'title' => 'Port congestion eases in Asia',
        ]);

        $this->assertDatabaseHas('mentions', [
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'title' => 'Port congestion eases in Asia',
        ]);
    }

    public function test_media_ingest_matches_keywords_that_appear_late_in_a_long_article_body(): void
    {
        $this->fakeMediaFeedsWithLateKeyword();

        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Carrier Watch',
            'slug' => 'carrier-watch',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'SeaLead',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $this->artisan("media:ingest --project={$project->id} --force --days=90")
            ->expectsOutputToContain("Project {$project->id} {$project->name}: 1 mentions imported.")
            ->assertSuccessful();

        $article = MediaArticle::query()
            ->where('source_key', 'test-maritime-feed')
            ->where('title', 'Carrier pricing softens despite disruption fears')
            ->first();

        $this->assertNotNull($article);
        $this->assertStringContainsString('SeaLead', $article->body);

        $this->assertDatabaseHas('mentions', [
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'title' => 'Carrier pricing softens despite disruption fears',
        ]);
    }

    private function fakeMediaFeeds(): void
    {
        config()->set('media_sources.sources', [
            [
                'key' => 'test-maritime-feed',
                'name' => 'Test Maritime Feed',
                'homepage' => 'https://feeds.example.test/',
                'feed_url' => 'https://feeds.example.test/rss.xml',
            ],
        ]);

        Http::fake([
            'https://feeds.example.test/rss.xml' => Http::response(
                <<<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Test Maritime Feed</title>
                    <item>
                      <title>Suez Canal disruption drives vessel rerouting</title>
                      <link>https://feeds.example.test/articles/suez-canal-disruption</link>
                      <description>Operators are reacting to the latest Suez Canal disruption and rerouting plans.</description>
                      <pubDate>Mon, 17 Mar 2026 08:00:00 GMT</pubDate>
                      <guid>test-suez-canal-disruption</guid>
                    </item>
                    <item>
                      <title>Port congestion eases in Asia</title>
                      <link>https://feeds.example.test/articles/port-congestion-eases</link>
                      <description>Port congestion measures improved this week.</description>
                      <pubDate>Mon, 17 Mar 2026 07:30:00 GMT</pubDate>
                      <guid>test-port-congestion</guid>
                    </item>
                  </channel>
                </rss>
                XML,
                200,
                ['Content-Type' => 'application/rss+xml']
            ),
            'https://feeds.example.test/articles/port-congestion-eases' => Http::response(
                <<<'HTML'
                <html>
                  <head>
                    <title>Port congestion eases in Asia</title>
                    <meta property="article:published_time" content="2026-03-17T07:30:00Z" />
                  </head>
                  <body>
                    <article>
                      <h1>Port congestion eases in Asia</h1>
                      <p>Port congestion measures improved this week across major Asian terminals.</p>
                      <p>Carriers reported that port congestion continues to ease as vessel queues shortened.</p>
                    </article>
                  </body>
                </html>
                HTML,
                200,
                ['Content-Type' => 'text/html']
            ),
            'https://feeds.example.test/articles/suez-canal-disruption' => Http::response(
                <<<'HTML'
                <html>
                  <head>
                    <title>Suez Canal disruption drives vessel rerouting</title>
                    <meta property="article:published_time" content="2026-03-17T08:00:00Z" />
                  </head>
                  <body>
                    <article>
                      <h1>Suez Canal disruption drives vessel rerouting</h1>
                      <p>Operators are reacting to the latest Suez Canal disruption and rerouting plans.</p>
                      <p>Shippers continue to review schedules as services divert around the disruption.</p>
                    </article>
                  </body>
                </html>
                HTML,
                200,
                ['Content-Type' => 'text/html']
            ),
        ]);
    }

    private function fakeMediaFeedsWithLateKeyword(): void
    {
        $leadingParagraph = str_repeat('Freight markets remained steady across major lanes. ', 80);

        config()->set('media_sources.sources', [
            [
                'key' => 'test-maritime-feed',
                'name' => 'Test Maritime Feed',
                'homepage' => 'https://feeds.example.test/',
                'feed_url' => 'https://feeds.example.test/rss.xml',
            ],
        ]);

        Http::fake([
            'https://feeds.example.test/rss.xml' => Http::response(
                <<<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Test Maritime Feed</title>
                    <item>
                      <title>Carrier pricing softens despite disruption fears</title>
                      <link>https://feeds.example.test/articles/carrier-pricing-softens</link>
                      <description>Container rates remain under pressure.</description>
                      <pubDate>Mon, 17 Mar 2026 09:00:00 GMT</pubDate>
                      <guid>test-carrier-pricing-softens</guid>
                    </item>
                  </channel>
                </rss>
                XML,
                200,
                ['Content-Type' => 'application/rss+xml']
            ),
            'https://feeds.example.test/articles/carrier-pricing-softens' => Http::response(
                <<<HTML
                <html>
                  <head>
                    <title>Carrier pricing softens despite disruption fears</title>
                    <meta property="article:published_time" content="2026-03-17T09:00:00Z" />
                  </head>
                  <body>
                    <article>
                      <h1>Carrier pricing softens despite disruption fears</h1>
                      <p>{$leadingParagraph}</p>
                      <p>SeaLead withdrew its last ship from the route after this month&apos;s sailing.</p>
                    </article>
                  </body>
                </html>
                HTML,
                200,
                ['Content-Type' => 'text/html']
            ),
        ]);
    }
}
