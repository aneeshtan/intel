<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use App\Models\Project;
use App\Models\TrackedKeyword;
use App\Models\User;
use App\Services\AutoIndexingControlService;
use Illuminate\Http\JsonResponse;

class AdminWorkspaceController extends Controller
{
    public function __invoke(AutoIndexingControlService $controlService): JsonResponse
    {
        /** @var User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        $projects = Project::query()
            ->with(['user:id,name,email'])
            ->withCount(['trackedKeywords', 'mentions'])
            ->latest('updated_at')
            ->get();

        $users = User::query()
            ->withCount('projects')
            ->latest('created_at')
            ->get();

        $keywords = TrackedKeyword::query()
            ->with(['project.user:id,name,email'])
            ->withCount('mentions')
            ->latest('updated_at')
            ->get();

        $keywordCountsByUser = TrackedKeyword::query()
            ->selectRaw('projects.user_id, count(*) as aggregate')
            ->join('projects', 'projects.id', '=', 'tracked_keywords.project_id')
            ->groupBy('projects.user_id')
            ->pluck('aggregate', 'projects.user_id');

        $mentionCountsByUser = Mention::query()
            ->selectRaw('projects.user_id, count(*) as aggregate')
            ->join('projects', 'projects.id', '=', 'mentions.project_id')
            ->groupBy('projects.user_id')
            ->pluck('aggregate', 'projects.user_id');

        return response()->json([
            'data' => [
                'summary' => [
                    'users' => $users->count(),
                    'projects' => $projects->count(),
                    'keywords' => $keywords->count(),
                    'mentions' => Mention::query()->count(),
                ],
                'automation' => [
                    'auto_indexing_paused' => $controlService->isPaused(),
                ],
                'projects' => $projects->map(fn (Project $project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'slug' => $project->slug,
                    'status' => $project->status,
                    'description' => $project->description,
                    'tracked_keywords_count' => $project->tracked_keywords_count,
                    'mentions_count' => $project->mentions_count,
                    'updated_at' => $project->updated_at?->toIso8601String(),
                    'created_at' => $project->created_at?->toIso8601String(),
                    'user' => [
                        'id' => $project->user?->id,
                        'name' => $project->user?->name,
                        'email' => $project->user?->email,
                    ],
                ])->values()->all(),
                'users' => $users->map(fn (User $account) => [
                    'id' => $account->id,
                    'name' => $account->name,
                    'email' => $account->email,
                    'roles' => $account->roles->pluck('slug')->values()->all(),
                    'plan_name' => $account->activePlan()?->name,
                    'projects_count' => $account->projects_count,
                    'keywords_count' => (int) ($keywordCountsByUser[$account->id] ?? 0),
                    'mentions_count' => (int) ($mentionCountsByUser[$account->id] ?? 0),
                    'created_at' => $account->created_at?->toIso8601String(),
                ])->values()->all(),
                'keywords' => $keywords->map(fn (TrackedKeyword $keyword) => [
                    'id' => $keyword->id,
                    'keyword' => $keyword->keyword,
                    'platform' => $keyword->platform,
                    'match_type' => $keyword->match_type,
                    'is_active' => $keyword->is_active,
                    'mentions_count' => $keyword->mentions_count,
                    'created_at' => $keyword->created_at?->toIso8601String(),
                    'updated_at' => $keyword->updated_at?->toIso8601String(),
                    'project' => [
                        'id' => $keyword->project?->id,
                        'name' => $keyword->project?->name,
                        'status' => $keyword->project?->status,
                    ],
                    'user' => [
                        'id' => $keyword->project?->user?->id,
                        'name' => $keyword->project?->user?->name,
                        'email' => $keyword->project?->user?->email,
                    ],
                ])->values()->all(),
            ],
        ]);
    }
}
