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

    public function test_media_discovery_ignores_source_urls_marked_as_non_article_pages(): void
    {
        Bus::fake();

        config()->set('media_sources.sources', [
            [
                'key' => 'seatrade-maritime',
                'name' => 'Seatrade Maritime',
                'homepage' => 'https://www.seatrade-maritime.com/',
                'feed_url' => 'https://feeds.example.test/rss.xml',
                'exclude_url_patterns' => [
                    '#/recent-(webinars|podcasts|documents|videos|publications|industry-events)(?:/|$)#i',
                ],
            ],
        ]);

        Http::fake([
            'https://feeds.example.test/rss.xml' => Http::response(
                <<<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Seatrade Maritime</title>
                    <item>
                      <title>Recent webinars | page 1 of 1 | Seatrade Maritime News</title>
                      <link>https://www.seatrade-maritime.com/recent-webinars</link>
                      <description>Section index page.</description>
                      <pubDate>Wed, 18 Mar 2026 13:00:21 GMT</pubDate>
                    </item>
                    <item>
                      <title>Container port congestion eases after initial Iran shock</title>
                      <link>https://www.seatrade-maritime.com/containers/container-port-congestion-eases-after-initial-iran-shock</link>
                      <description>Real article page.</description>
                      <pubDate>Wed, 18 Mar 2026 09:00:00 GMT</pubDate>
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
            return ($job->candidate['url'] ?? null) === 'https://www.seatrade-maritime.com/containers/container-port-congestion-eases-after-initial-iran-shock';
        });

        Bus::assertNotDispatched(FetchMediaArticleJob::class, function (FetchMediaArticleJob $job): bool {
            return ($job->candidate['url'] ?? null) === 'https://www.seatrade-maritime.com/recent-webinars';
        });
    }

    public function test_media_discovery_discovers_sitemaps_from_the_site_root_for_path_based_sources(): void
    {
        Bus::fake();

        config()->set('media_sources.sources', [
            [
                'key' => 'dp-world-news',
                'name' => 'DP World News',
                'homepage' => 'https://feeds.example.test/en/news',
                'include_url_patterns' => [
                    '#^https://feeds\.example\.test/en/news/.+#i',
                ],
            ],
        ]);

        Http::fake([
            'https://feeds.example.test/en/news' => Http::response('<html><head><title>DP World News</title></head><body></body></html>', 200),
            'https://feeds.example.test/robots.txt' => Http::response(
                "User-agent: *\nSitemap: https://feeds.example.test/sitemap.xml\n",
                200,
                ['Content-Type' => 'text/plain']
            ),
            'https://feeds.example.test/en/news/robots.txt' => Http::response('', 404),
            'https://feeds.example.test/sitemap.xml' => Http::response(
                <<<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                  <url>
                    <loc>https://feeds.example.test/en/news/sealead-expands-gulf-coverage</loc>
                    <lastmod>2026-03-18T09:00:00Z</lastmod>
                  </url>
                </urlset>
                XML,
                200,
                ['Content-Type' => 'application/xml']
            ),
            '*' => Http::response('', 404),
        ]);

        $this->artisan('media:discover --days=7')
            ->expectsOutputToContain('Media discovery queued 1 article fetch job(s).')
            ->assertSuccessful();

        Bus::assertDispatched(FetchMediaArticleJob::class, function (FetchMediaArticleJob $job): bool {
            return ($job->source['key'] ?? null) === 'dp-world-news'
                && ($job->candidate['url'] ?? null) === 'https://feeds.example.test/en/news/sealead-expands-gulf-coverage';
        });
    }

    public function test_source_title_filters_ignore_feed_items_with_excluded_titles(): void
    {
        $service = app(MediaMentionIngestionService::class);
        $parseFeed = new \ReflectionMethod($service, 'parseFeed');
        $parseFeed->setAccessible(true);
        $looksLikeArticleCandidate = new \ReflectionMethod($service, 'looksLikeArticleCandidate');
        $looksLikeArticleCandidate->setAccessible(true);

        $items = $parseFeed->invoke(
            $service,
            <<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
              <channel>
                <title>MPA Media Releases</title>
                <item>
                  <title>PORT MARINE NOTICE NO. 45 OF 2026 - SOIL INVESTIGATION WORKS</title>
                  <link>https://feeds.example.test/media-centre/details/port-marine-notice-no-45</link>
                  <description>Operational notice.</description>
                  <pubDate>Wed, 18 Mar 2026 09:00:00 GMT</pubDate>
                </item>
                <item>
                  <title>Strengthening maritime competitiveness and operational excellence</title>
                  <link>https://feeds.example.test/media-centre/details/strengthening-maritime-competitiveness</link>
                  <description>Policy update.</description>
                  <pubDate>Wed, 18 Mar 2026 10:00:00 GMT</pubDate>
                </item>
              </channel>
            </rss>
            XML
        );

        $source = [
            'include_url_patterns' => [
                '#^https://feeds\.example\.test/media-centre/details/.+#i',
            ],
            'exclude_title_patterns' => [
                '#^PORT MARINE NOTICE\b#i',
            ],
        ];

        $allowedUrls = $items
            ->filter(fn (array $candidate): bool => $looksLikeArticleCandidate->invoke($service, $candidate, $source))
            ->pluck('url')
            ->values()
            ->all();

        $this->assertSame([
            'https://feeds.example.test/media-centre/details/strengthening-maritime-competitiveness',
        ], $allowedUrls);
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
