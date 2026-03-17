<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            PermissionsTableSeeder::class,
            RolesTableSeeder::class,
            ConnectRelationshipsSeeder::class,
            PlanSeeder::class,
        ]);

        if (app()->environment(['local', 'testing'])) {
            $adminRole = config('roles.models.role')::query()->where('slug', 'admin')->first();

            $admin = User::query()->firstOrCreate(
                ['email' => 'admin@iqxintel.local'],
                ['name' => 'IQX Admin', 'password' => 'Password123'],
            );

            if ($adminRole && ! $admin->hasRole('admin')) {
                $admin->attachRole($adminRole);
            }
        }
    }
}
