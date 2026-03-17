<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    public function show(): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = request()->user()->loadMissing('roles');

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->roles->pluck('slug')->values(),
                'plan' => $user->activePlan()?->only([
                    'id',
                    'name',
                    'slug',
                    'projects_limit',
                    'keywords_limit',
                    'mentions_retention_days',
                ]),
                'counts' => [
                    'projects' => $user->projects()->count(),
                    'keywords' => \App\Models\TrackedKeyword::query()
                        ->whereHas('project', fn ($query) => $query->where('user_id', $user->id))
                        ->count(),
                ],
            ],
        ]);
    }
}
