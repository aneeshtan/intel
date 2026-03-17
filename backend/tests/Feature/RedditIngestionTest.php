<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RedditIngestionTest extends TestCase
{
    use RefreshDatabase;

    public function test_reddit_ingest_command_imports_matching_mentions(): void
    {
        config()->set('reddit.client_id', 'reddit-client');
        config()->set('reddit.client_secret', 'reddit-secret');
        config()->set('reddit.user_agent', 'IQX Test Agent');
        config()->set('reddit.max_pages', 1);
        config()->set('reddit.results_per_page', 25);

        Http::fake([
            'https://www.reddit.com/api/v1/access_token' => Http::response([
                'access_token' => 'reddit-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://oauth.reddit.com/search*' => Http::response([
                'data' => [
                    'after' => null,
                    'children' => [
                        [
                            'data' => [
                                'id' => 'abc123',
                                'title' => 'BlueWave expands Asia service',
                                'selftext' => 'BlueWave is adding capacity on new lanes.',
                                'author' => 'opswatch',
                                'subreddit' => 'shipping',
                                'score' => 54,
                                'num_comments' => 18,
                                'permalink' => '/r/shipping/comments/abc123/bluewave_expands_asia_service/',
                                'created_utc' => now()->subDay()->timestamp,
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

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
            'description' => 'Tracks BlueWave mentions.',
            'audience' => 'Operators',
            'status' => 'active',
            'monitored_platforms' => ['reddit'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'BlueWave',
            'platform' => 'reddit',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $this->artisan("reddit:ingest --project={$project->id} --force --days=90")
            ->expectsOutputToContain("Project {$project->id} {$project->name}: 1 Reddit mentions imported.")
            ->assertSuccessful();

        $this->assertDatabaseHas('mentions', [
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'reddit',
            'title' => 'BlueWave expands Asia service',
            'author_name' => 'opswatch',
        ]);
    }
}
