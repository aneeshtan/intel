<?php

namespace Tests\Feature;

use App\Models\MediaArticle;
use App\Models\User;
use Database\Seeders\ConnectRelationshipsSeeder;
use Database\Seeders\PermissionsTableSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RolesTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMediaArticleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_captured_articles(): void
    {
        $this->seedBase();

        $admin = User::factory()->create();
        $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();
        $admin->attachRole($adminRole);

        MediaArticle::query()->create([
            'source_key' => 'alpha',
            'source_name' => 'Alpha Maritime',
            'source_url' => 'https://alpha.example.test',
            'external_id' => 'alpha-1',
            'url' => 'https://alpha.example.test/articles/1',
            'author_name' => 'Alpha Desk',
            'title' => 'Port congestion update',
            'body' => 'Congestion is easing across key terminals.',
            'published_at' => now()->subHours(4),
        ]);

        MediaArticle::query()->create([
            'source_key' => 'beta',
            'source_name' => 'Beta Shipping',
            'source_url' => 'https://beta.example.test',
            'external_id' => 'beta-1',
            'url' => 'https://beta.example.test/articles/1',
            'author_name' => 'Beta Desk',
            'title' => 'Suez Canal disruption briefing',
            'body' => 'Rerouting risk remains elevated.',
            'published_at' => now()->subHours(2),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/media-articles?q=Suez')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.items.0.source_name', 'Beta Shipping')
            ->assertJsonPath('data.items.0.title', 'Suez Canal disruption briefing');
    }

    public function test_non_admin_cannot_view_captured_articles(): void
    {
        $this->seedBase();

        $user = User::factory()->create();
        $userRole = config('roles.models.role')::query()->where('slug', 'user')->first();
        $user->attachRole($userRole);

        Sanctum::actingAs($user);

        $this->getJson('/api/admin/media-articles')->assertForbidden();
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
