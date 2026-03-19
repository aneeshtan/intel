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
                ['email' => 'admin@ctrlaltl.com'],
                ['name' => 'IQX Admin', 'password' => 'admin'],
            );

            if ($adminRole && ! $admin->hasRole('admin')) {
                $admin->attachRole($adminRole);
            }
        }
    }
}
