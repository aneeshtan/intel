<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_view_profile(): void
    {
        $this->seedBase();

        $user = $this->createUser();
        Sanctum::actingAs($user);

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.name', 'Harbor Ops')
            ->assertJsonPath('data.email', 'ops@example.com')
            ->assertJsonPath('data.plan.slug', 'starter');
    }

    public function test_authenticated_user_can_update_profile_details_and_password(): void
    {
        $this->seedBase();

        $user = $this->createUser();
        Sanctum::actingAs($user);

        $this->patchJson('/api/me', [
            'name' => 'Port Strategy',
            'email' => 'strategy@example.com',
            'password' => 'NewStrongPass123',
            'password_confirmation' => 'NewStrongPass123',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Port Strategy')
            ->assertJsonPath('data.email', 'strategy@example.com');

        $user->refresh();

        $this->assertSame('Port Strategy', $user->name);
        $this->assertSame('strategy@example.com', $user->email);
        $this->assertTrue(Hash::check('NewStrongPass123', $user->password));
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

    private function createUser(): User
    {
        $user = User::factory()->create([
            'name' => 'Harbor Ops',
            'email' => 'ops@example.com',
            'password' => 'StrongPass123',
        ]);

        $role = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($role);

        return $user;
    }
}
