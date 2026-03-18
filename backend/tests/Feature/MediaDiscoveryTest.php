<?php

namespace Tests\Feature;

use App\Jobs\FetchMediaArticleJob;
use App\Models\User;
use App\Services\MediaMentionIngestionService;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MediaDiscoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_media_discovery_command_queues_fetch_jobs_for_new_candidates(): void
    {
        Bus::fake();

        $this->configureTestSource();

        Http::fake([
            'https://feeds.example.test/rss.xml' => Http::response(
                <<<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Test Maritime Feed</title>
                    <item>
                      <title>SeaLead launches a new route</title>
                      <link>https://feeds.example.test/articles/sealead-route</link>
                      <description>SeaLead expands its service footprint.</description>
                      <pubDate>Mon, 17 Mar 2026 09:00:00 GMT</pubDate>
                      <guid>test-sealead-route</guid>
                    </item>
                  </channel>
                </rss>
                XML,
                200,
                ['Content-Type' => 'application/rss+xml']
            ),
        ]);

        $this->artisan('media:discover --days=7')
            ->expectsOutputToContain('Media discovery queued 1 article fetch job(s).')
            ->assertSuccessful();

        Bus::assertDispatched(FetchMediaArticleJob::class, function (FetchMediaArticleJob $job): bool {
            return ($job->source['key'] ?? null) === 'test-maritime-feed'
                && ($job->candidate['url'] ?? null) === 'https://feeds.example.test/articles/sealead-route';
        });
    }

    public function test_fetch_media_article_job_stores_article_and_creates_mentions(): void
    {
        $this->seedBase();
        $this->configureTestSource();

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

        Http::fake([
            'https://feeds.example.test/articles/sealead-route' => Http::response(
                <<<'HTML'
                <html>
                  <head>
                    <title>SeaLead launches a new route</title>
                    <meta property="article:published_time" content="2026-03-17T09:00:00Z" />
                  </head>
                  <body>
                    <article>
                      <h1>SeaLead launches a new route</h1>
                      <p>SeaLead announced a new Asia-Europe connection for late March sailings.</p>
                      <p>The carrier said the route will improve reliability and equipment availability.</p>
                    </article>
                  </body>
                </html>
                HTML,
                200,
                ['Content-Type' => 'text/html']
            ),
        ]);

        $job = new FetchMediaArticleJob(
            [
                'key' => 'test-maritime-feed',
                'name' => 'Test Maritime Feed',
                'homepage' => 'https://feeds.example.test/',
            ],
            [
                'url' => 'https://feeds.example.test/articles/sealead-route',
                'feed_url' => 'https://feeds.example.test/rss.xml',
                'published_at' => '2026-03-17T09:00:00Z',
            ],
            90,
            true,
        );

        $job->handle(app(MediaMentionIngestionService::class));

        $this->assertDatabaseHas('media_articles', [
            'source_key' => 'test-maritime-feed',
            'title' => 'SeaLead launches a new route',
        ]);

        $this->assertDatabaseHas('mentions', [
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'title' => 'SeaLead launches a new route',
        ]);
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

    private function configureTestSource(): void
    {
        config()->set('media_sources.sources', [
            [
                'key' => 'test-maritime-feed',
                'name' => 'Test Maritime Feed',
                'homepage' => 'https://feeds.example.test/',
                'feed_url' => 'https://feeds.example.test/rss.xml',
            ],
        ]);
    }
}
