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

class XIngestionTest extends TestCase
{
    use RefreshDatabase;

    public function test_x_ingest_command_imports_matching_mentions(): void
    {
        config()->set('x.bearer_token', 'x-bearer-token');
        config()->set('x.max_pages', 1);
        config()->set('x.max_results', 10);

        Http::fake([
            'https://api.x.com/2/tweets/search/recent*' => Http::response([
                'data' => [
                    [
                        'id' => '19001',
                        'text' => 'BlueWave adds extra loaders on the Asia-Europe lane.',
                        'author_id' => 'user-1',
                        'created_at' => now()->subHours(6)->toIso8601String(),
                        'public_metrics' => [
                            'retweet_count' => 8,
                            'reply_count' => 5,
                            'like_count' => 21,
                            'quote_count' => 2,
                        ],
                    ],
                ],
                'includes' => [
                    'users' => [
                        [
                            'id' => 'user-1',
                            'username' => 'portwatch',
                            'name' => 'Port Watch',
                        ],
                    ],
                ],
                'meta' => [
                    'result_count' => 1,
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
            'description' => 'Tracks BlueWave mentions on X.',
            'audience' => 'Operators',
            'status' => 'active',
            'monitored_platforms' => ['x'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'BlueWave',
            'platform' => 'x',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        $this->artisan("x:ingest --project={$project->id} --force --days=7")
            ->expectsOutputToContain("Project {$project->id} {$project->name}: 1 X mentions imported.")
            ->assertSuccessful();

        $this->assertDatabaseHas('mentions', [
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'x',
            'author_name' => '@portwatch',
        ]);
    }
}
