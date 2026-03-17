<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\UpdateProjectRequest;
use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

class ProjectController extends Controller
{
    public function index(): JsonResponse
    {
        $projects = request()->user()
            ->projects()
            ->withCount(['trackedKeywords', 'mentions'])
            ->latest()
            ->get();

        return response()->json([
            'data' => $projects,
        ]);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        abort_if($user->projectLimitReached(), 422, 'Your current plan project limit has been reached.');

        $validated = $request->validated();

        $project = $user->projects()->create([
            ...$validated,
            'slug' => Project::uniqueSlugForUser($user->id, $validated['name']),
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json([
            'data' => $project->loadCount(['trackedKeywords', 'mentions']),
        ], 201);
    }

    public function show(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        $project->load('trackedKeywords');
        $listening = ProjectListeningController::summarizeProject($project);

        return response()->json([
            'data' => [
                ...$project->toArray(),
                'tracked_keywords' => $project->trackedKeywords,
                'tracked_keywords_count' => $project->trackedKeywords()->count(),
                'mentions' => $listening['mentions'],
                'mentions_count' => $listening['mentions_count'],
                'source_groups' => $listening['source_groups'],
                'influencer_groups' => $listening['influencer_groups'],
                'muted_sources' => $listening['muted_sources'],
                'muted_authors' => $listening['muted_authors'],
            ],
        ]);
    }

    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        $validated = $request->validated();

        if (array_key_exists('name', $validated)) {
            $validated['slug'] = Project::uniqueSlugForUser(
                $project->user_id,
                $validated['name'],
                $project->id,
            );
        }

        $project->update($validated);

        return response()->json([
            'data' => $project->fresh()->loadCount(['trackedKeywords', 'mentions']),
        ]);
    }

    public function destroy(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);
        $project->delete();

        return response()->json([
            'message' => 'Project deleted successfully.',
        ]);
    }

    private function ensureOwnership(Project $project): void
    {
        abort_unless($project->user_id === request()->user()->id, 404);
    }
}
