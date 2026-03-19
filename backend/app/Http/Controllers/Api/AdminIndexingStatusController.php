<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AutoIndexingControlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminIndexingStatusController extends Controller
{
    public function show(AutoIndexingControlService $controlService): JsonResponse
    {
        $this->authorizeAdmin(request()->user());

        return response()->json([
            'data' => [
                'auto_indexing_paused' => $controlService->isPaused(),
            ],
        ]);
    }

    public function update(Request $request, AutoIndexingControlService $controlService): JsonResponse
    {
        $this->authorizeAdmin($request->user());

        $validated = $request->validate([
            'auto_indexing_paused' => ['required', 'boolean'],
        ]);

        $controlService->setPaused((bool) $validated['auto_indexing_paused']);

        return response()->json([
            'data' => [
                'auto_indexing_paused' => $controlService->isPaused(),
            ],
        ]);
    }

    private function authorizeAdmin(?User $user): void
    {
        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');
    }
}
