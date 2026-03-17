<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Admin',
                'slug' => 'admin',
                'description' => 'Internal unrestricted admin access for IQX workspace management.',
                'stripe_price_id' => null,
                'price_cents' => 0,
                'interval' => 'internal',
                'projects_limit' => null,
                'keywords_limit' => null,
                'mentions_retention_days' => 3650,
                'features' => [
                    'Unlimited projects and keywords',
                    'Archive diagnostics and capture controls',
                    'Internal operations access',
                ],
                'is_active' => false,
            ],
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'Best for one small maritime team validating keyword monitoring.',
                'stripe_price_id' => env('STRIPE_STARTER_PRICE_ID'),
                'price_cents' => 9900,
                'interval' => 'month',
                'projects_limit' => 3,
                'keywords_limit' => 25,
                'mentions_retention_days' => 30,
                'features' => [
                    'LinkedIn, Reddit, and media watchlists',
                    '3 active projects',
                    'Daily email briefing',
                ],
            ],
            [
                'name' => 'Professional',
                'slug' => 'professional',
                'description' => 'For operators tracking multiple brands, routes, or competitors.',
                'stripe_price_id' => env('STRIPE_PROFESSIONAL_PRICE_ID'),
                'price_cents' => 29900,
                'interval' => 'month',
                'projects_limit' => 10,
                'keywords_limit' => 200,
                'mentions_retention_days' => 90,
                'features' => [
                    'Priority alerts and executive summaries',
                    '10 active projects',
                    'Slack delivery and API access',
                ],
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'description' => 'For larger maritime groups with broad monitoring coverage and team access.',
                'stripe_price_id' => env('STRIPE_ENTERPRISE_PRICE_ID'),
                'price_cents' => 79900,
                'interval' => 'month',
                'projects_limit' => 100,
                'keywords_limit' => 5000,
                'mentions_retention_days' => 365,
                'features' => [
                    'Unlimited stakeholder seats',
                    'Large-scale competitor monitoring',
                    'Long retention and bespoke reporting',
                ],
            ],
        ];

        foreach ($plans as $plan) {
            Plan::query()->updateOrCreate(
                ['slug' => $plan['slug']],
                [...$plan, 'is_active' => $plan['is_active'] ?? true],
            );
        }
    }
}
