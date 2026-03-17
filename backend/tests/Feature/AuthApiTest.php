<?php

namespace Tests\Feature;

use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receives_a_token(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Harbor Ops',
            'email' => 'ops@example.com',
            'password' => 'StrongPass123',
            'password_confirmation' => 'StrongPass123',
            'device_name' => 'test-suite',
        ]);

        $response
            ->assertCreated()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'roles'],
            ]);

        $this->assertDatabaseHas('users', ['email' => 'ops@example.com']);
        $this->assertDatabaseHas('role_user', ['user_id' => 1]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Harbor Ops',
            'email' => 'ops@example.com',
            'password' => 'StrongPass123',
            'password_confirmation' => 'StrongPass123',
        ])->assertCreated();

        $response = $this->postJson('/api/auth/login', [
            'email' => 'ops@example.com',
            'password' => 'StrongPass123',
            'device_name' => 'browser',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'email'],
            ]);
    }
}
