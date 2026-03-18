<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertChannel;
use App\Models\AlertDelivery;
use App\Models\TrackedKeyword;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->loadMissing('roles');

        return response()->json([
            'data' => $this->serializeUser($user),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->loadMissing('roles');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }

        $user->save();

        return response()->json([
            'data' => $this->serializeUser($user->fresh()->loadMissing('roles')),
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
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
                'keywords' => TrackedKeyword::query()
                    ->whereHas('project', fn ($query) => $query->where('user_id', $user->id))
                    ->count(),
                'unread_alerts' => AlertDelivery::query()
                    ->where('user_id', $user->id)
                    ->whereNull('read_at')
                    ->where('status', 'sent')
                    ->whereHas('alertChannel', fn ($query) => $query->where('type', AlertChannel::TYPE_IN_APP))
                    ->count(),
            ],
        ];
    }
}
