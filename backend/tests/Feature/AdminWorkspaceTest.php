<?php

namespace Tests\Feature;

use App\Models\Mention;
use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_workspace_inventory(): void
    {
        $this->seedBase();

        $admin = User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin@example.test',
        ]);
        $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();
        $admin->attachRole($adminRole);

        $member = User::factory()->create([
            'name' => 'Member User',
            'email' => 'member@example.test',
        ]);
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $member->attachRole($userRole);

        $project = $member->projects()->create([
            'name' => 'SeaLead',
            'slug' => 'sealead',
            'status' => 'active',
            'monitored_platforms' => ['media'],
        ]);

        $keyword = $project->trackedKeywords()->create([
            'keyword' => 'SeaLead',
            'platform' => 'media',
            'match_type' => 'phrase',
            'is_active' => true,
        ]);

        Mention::query()->create([
            'project_id' => $project->id,
            'tracked_keyword_id' => $keyword->id,
            'source' => 'media',
            'external_id' => 'mention-1',
            'title' => 'SeaLead update',
            'body' => 'SeaLead appears in a media article.',
            'sentiment' => 'neutral',
            'published_at' => now()->subHour(),
            'metadata' => [
                'source_key' => 'alpha',
                'source_name' => 'Alpha Maritime',
                'demo' => false,
            ],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/workspace')
            ->assertOk()
            ->assertJsonPath('data.summary.users', 2)
            ->assertJsonPath('data.summary.projects', 1)
            ->assertJsonPath('data.summary.keywords', 1)
            ->assertJsonPath('data.summary.mentions', 1)
            ->assertJsonPath('data.projects.0.name', 'SeaLead')
            ->assertJsonPath('data.projects.0.user.email', 'member@example.test')
            ->assertJsonPath('data.keywords.0.keyword', 'SeaLead')
            ->assertJsonPath('data.keywords.0.project.name', 'SeaLead')
            ->assertJsonPath('data.keywords.0.user.email', 'member@example.test')
            ->assertJsonFragment([
                'email' => 'member@example.test',
                'name' => 'Member User',
            ]);
    }

    public function test_non_admin_cannot_view_workspace_inventory(): void
    {
        $this->seedBase();

        $user = User::factory()->create();
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($userRole);

        Sanctum::actingAs($user);

        $this->getJson('/api/admin/workspace')->assertForbidden();
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
