<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
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

    public function test_google_callback_creates_user_and_redirects_back_to_frontend_with_token_fragment(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        config()->set('app.frontend_url', 'https://intel.ctrlaltl.com');

        $googleUser = (new SocialiteUser)->map([
            'id' => 'google-user-123',
            'name' => 'Port Analyst',
            'email' => 'analyst@example.com',
            'avatar' => 'https://images.example.com/avatar.png',
        ]);

        Socialite::shouldReceive('driver->stateless->user')
            ->once()
            ->andReturn($googleUser);

        $response = $this->get('/api/auth/google/callback');

        $response->assertRedirect();
        $this->assertStringStartsWith(
            'https://intel.ctrlaltl.com/login#auth_token=',
            $response->headers->get('Location'),
        );
        $this->assertStringContainsString(
            'auth_provider=google',
            (string) $response->headers->get('Location'),
        );

        $this->assertDatabaseHas('users', [
            'email' => 'analyst@example.com',
            'google_id' => 'google-user-123',
            'avatar_url' => 'https://images.example.com/avatar.png',
        ]);
        $this->assertDatabaseHas('role_user', ['user_id' => 1]);
    }

    public function test_google_callback_links_existing_user_by_email(): void
    {
        $this->seed([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        config()->set('app.frontend_url', 'https://intel.ctrlaltl.com');

        $user = User::create([
            'name' => 'Existing User',
            'email' => 'existing@example.com',
            'password' => 'StrongPass123',
        ]);

        $googleUser = (new SocialiteUser)->map([
            'id' => 'google-existing-456',
            'name' => 'Existing User',
            'email' => 'existing@example.com',
            'avatar' => 'https://images.example.com/existing.png',
        ]);

        Socialite::shouldReceive('driver->stateless->user')
            ->once()
            ->andReturn($googleUser);

        $response = $this->get('/api/auth/google/callback');

        $response->assertRedirect();
        $this->assertSame(1, User::query()->count());

        $user->refresh();

        $this->assertSame('google-existing-456', $user->google_id);
        $this->assertSame('https://images.example.com/existing.png', $user->avatar_url);
        $this->assertNotNull($user->email_verified_at);
    }
}
