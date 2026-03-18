<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertChannel;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AlertChannelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => $user->alertChannels()->latest()->get()->map(
                fn (AlertChannel $channel): array => $this->serializeChannel($channel)
            )->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $this->validatePayload($request);

        $channel = $user->alertChannels()->create([
            'type' => $validated['type'],
            'name' => $validated['name'],
            'destination' => $validated['destination'] ?? null,
            'config' => $validated['config'] ?? [],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'data' => $this->serializeChannel($channel),
        ], 201);
    }

    public function update(Request $request, AlertChannel $alertChannel): JsonResponse
    {
        $this->ensureOwnership($alertChannel);
        $validated = $this->validatePayload($request, true);

        $alertChannel->update([
            'type' => $validated['type'] ?? $alertChannel->type,
            'name' => $validated['name'] ?? $alertChannel->name,
            'destination' => array_key_exists('destination', $validated)
                ? $validated['destination']
                : $alertChannel->destination,
            'config' => $validated['config'] ?? $alertChannel->config,
            'is_active' => $validated['is_active'] ?? $alertChannel->is_active,
        ]);

        return response()->json([
            'data' => $this->serializeChannel($alertChannel->fresh()),
        ]);
    }

    public function destroy(AlertChannel $alertChannel): JsonResponse
    {
        $this->ensureOwnership($alertChannel);
        $alertChannel->delete();

        return response()->json([
            'message' => 'Alert channel deleted successfully.',
        ]);
    }

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];

        return $request->validate([
            'type' => [...$required, 'string', Rule::in(AlertChannel::supportedTypes())],
            'name' => [...$required, 'string', 'max:255'],
            'destination' => ['nullable', 'string', 'max:1000'],
            'config' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function ensureOwnership(AlertChannel $alertChannel): void
    {
        abort_unless($alertChannel->user_id === request()->user()->id, 404);
    }

    private function serializeChannel(AlertChannel $channel): array
    {
        return [
            'id' => $channel->id,
            'type' => $channel->type,
            'name' => $channel->name,
            'destination' => $channel->destination,
            'config' => $channel->config ?? [],
            'is_active' => $channel->is_active,
            'created_at' => optional($channel->created_at)?->toIso8601String(),
        ];
    }
}
