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
use Tests\TestCase;

class CleanupInvalidMediaArticlesTest extends TestCase
{
    use RefreshDatabase;

    public function test_cleanup_command_removes_invalid_archive_rows_and_linked_mentions(): void
    {
        $this->seedBase();

        config()->set('media_sources.sources', [
            [
                'key' => 'container-news',
                'name' => 'Container News',
                'homepage' => 'https://container-news.com/',
                'feed_url' => 'https://container-news.com/feed/',
                'sitemap_paths' => ['/post-sitemap.xml'],
                'include_url_patterns' => ['~^https://container-news\.com/[^/?#]+/?$~i'],
                'exclude_url_patterns' => [
                    '#^https://container-news\.com/(?:top-right|cn-index|scfi|ccfi|ningbo-containerized-freight-index)(?:/|$)#i',
                ],
            ],
        ]);

        $user = User::factory()->create();
        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        $project = $user->projects()->create([
            'name' => 'Container Watch',
            'slug' => 'container-watch',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'Container',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $invalidArticle = MediaArticle::query()->create([
            'source_key' => 'container-news',
            'source_name' => 'Container News',
            'source_url' => 'https://container-news.com/',
            'external_id' => sha1('https://container-news.com/top-right/'),
            'url' => 'https://container-news.com/top-right/',
            'title' => 'Top Right Archives - Container News',
            'body' => 'Archive landing page.',
            'published_at' => now()->subDay(),
        ]);

        $validArticle = MediaArticle::query()->create([
            'source_key' => 'container-news',
            'source_name' => 'Container News',
            'source_url' => 'https://container-news.com/',
            'external_id' => sha1('https://container-news.com/port-of-virginia-completes-deep-shipping-channel/'),
            'url' => 'https://container-news.com/port-of-virginia-completes-deep-shipping-channel/',
            'title' => 'Port of Virginia completes deep shipping channel',
            'body' => 'Real article body.',
            'published_at' => now()->subHours(3),
        ]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => sha1('invalid-mention'),
            'title' => $invalidArticle->title,
            'body' => $invalidArticle->body,
            'sentiment' => 'neutral',
            'published_at' => $invalidArticle->published_at,
            'metadata' => [
                'source_key' => 'container-news',
                'article_id' => $invalidArticle->id,
                'demo' => false,
            ],
        ]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => sha1('valid-mention'),
            'title' => $validArticle->title,
            'body' => $validArticle->body,
            'sentiment' => 'neutral',
            'published_at' => $validArticle->published_at,
            'metadata' => [
                'source_key' => 'container-news',
                'article_id' => $validArticle->id,
                'demo' => false,
            ],
        ]);

        $this->artisan('media:cleanup-invalid')
            ->expectsOutputToContain('container-news | https://container-news.com/top-right/')
            ->expectsOutputToContain('Removed 1 invalid media article(s) and 1 linked mention(s).')
            ->assertSuccessful();

        $this->assertDatabaseMissing('media_articles', [
            'id' => $invalidArticle->id,
        ]);

        $this->assertDatabaseHas('media_articles', [
            'id' => $validArticle->id,
        ]);

        $this->assertDatabaseMissing('mentions', [
            'external_id' => sha1('invalid-mention'),
        ]);

        $this->assertDatabaseHas('mentions', [
            'external_id' => sha1('valid-mention'),
        ]);
    }

    public function test_cleanup_command_supports_dry_run(): void
    {
        $this->seedBase();

        config()->set('media_sources.sources', [
            [
                'key' => 'container-news',
                'name' => 'Container News',
                'homepage' => 'https://container-news.com/',
                'include_url_patterns' => ['~^https://container-news\.com/[^/?#]+/?$~i'],
                'exclude_url_patterns' => [
                    '#^https://container-news\.com/(?:top-right)(?:/|$)#i',
                ],
            ],
        ]);

        $article = MediaArticle::query()->create([
            'source_key' => 'container-news',
            'source_name' => 'Container News',
            'source_url' => 'https://container-news.com/',
            'external_id' => sha1('https://container-news.com/top-right/'),
            'url' => 'https://container-news.com/top-right/',
            'title' => 'Top Right Archives - Container News',
            'body' => 'Archive landing page.',
            'published_at' => now()->subDay(),
        ]);

        $this->artisan('media:cleanup-invalid --dry-run')
            ->expectsOutputToContain('Dry run: 1 invalid media article(s) and 0 linked mention(s) would be removed.')
            ->assertSuccessful();

        $this->assertDatabaseHas('media_articles', [
            'id' => $article->id,
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
}
