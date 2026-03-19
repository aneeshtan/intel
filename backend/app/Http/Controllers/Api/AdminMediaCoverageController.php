<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MediaSourceAuditService;
use Illuminate\Http\JsonResponse;

class AdminMediaCoverageController extends Controller
{
    public function __invoke(MediaSourceAuditService $auditService): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        return response()->json([
            'data' => $auditService->buildAudit(request()->integer('days', 7)),
        ]);
    }
}
