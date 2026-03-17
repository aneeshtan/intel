<?php

namespace App\Http\Controllers\Api;

use App\Models\Plan;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Plan::query()
                ->active()
                ->orderBy('price_cents')
                ->get()
                ->map(fn (Plan $plan) => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'description' => $plan->description,
                    'price_cents' => $plan->price_cents,
                    'interval' => $plan->interval,
                    'projects_limit' => $plan->projects_limit,
                    'keywords_limit' => $plan->keywords_limit,
                    'mentions_retention_days' => $plan->mentions_retention_days,
                    'features' => $plan->features,
                ]),
        ]);
    }
}
