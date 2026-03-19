<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AutoIndexingControlService;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminIndexingStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_and_update_auto_indexing_status(): void
    {
        $this->seedBase();

        app(AutoIndexingControlService::class)->setPaused(false);

        $admin = User::factory()->create([
            'email' => 'admin@example.test',
        ]);
        $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();
        $admin->attachRole($adminRole);

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/indexing-status')
            ->assertOk()
            ->assertJsonPath('data.auto_indexing_paused', false);

        $this->patchJson('/api/admin/indexing-status', [
            'auto_indexing_paused' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.auto_indexing_paused', true);

        $this->getJson('/api/admin/workspace')
            ->assertOk()
            ->assertJsonPath('data.automation.auto_indexing_paused', true);
    }

    public function test_non_admin_cannot_view_or_update_auto_indexing_status(): void
    {
        $this->seedBase();

        $user = User::factory()->create();
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($userRole);

        Sanctum::actingAs($user);

        $this->getJson('/api/admin/indexing-status')->assertForbidden();
        $this->patchJson('/api/admin/indexing-status', [
            'auto_indexing_paused' => true,
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
