<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMediaCaptureTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_trigger_media_capture_from_api(): void
    {
        $this->seedBase();
        Process::fake();

        $admin = User::factory()->create();
        $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();
        $admin->attachRole($adminRole);

        $project = $admin->projects()->create([
            'name' => 'Canal Watch',
            'slug' => 'canal-watch',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $project->trackedKeywords()->create([
            'keyword' => 'Suez Canal',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/media-capture', [
            'project_id' => $project->id,
            'force' => true,
        ]);

        $response
            ->assertAccepted()
            ->assertJsonPath('data.projects_processed', 1)
            ->assertJsonPath('data.capture_started', true);

        Process::assertRan(function ($pendingProcess) use ($project) {
            $command = $pendingProcess->command;

            if (is_array($command)) {
                return $command === [
                    'php',
                    'artisan',
                    'media:ingest',
                    "--project={$project->id}",
                    '--force',
                    '--days=90',
                ];
            }

            return false;
        });

        Process::assertRan(function ($pendingProcess) use ($project) {
            $command = $pendingProcess->command;

            if (is_array($command)) {
                return $command === [
                    'php',
                    'artisan',
                    'reddit:ingest',
                    "--project={$project->id}",
                    '--force',
                    '--days=90',
                ];
            }

            return false;
        });

        Process::assertRan(function ($pendingProcess) use ($project) {
            $command = $pendingProcess->command;

            if (is_array($command)) {
                return $command === [
                    'php',
                    'artisan',
                    'x:ingest',
                    "--project={$project->id}",
                    '--force',
                    '--days=7',
                ];
            }

            return false;
        });
    }

    public function test_non_admin_cannot_trigger_media_capture_from_api(): void
    {
        $this->seedBase();

        $user = User::factory()->create();
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($userRole);

        Sanctum::actingAs($user);

        $this->postJson('/api/admin/media-capture', [
            'force' => true,
        ])->assertForbidden();
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
