<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Keyword\StoreTrackedKeywordRequest;
use App\Models\Mention;
use App\Http\Requests\Keyword\UpdateTrackedKeywordRequest;
use App\Models\Project;
use App\Models\TrackedKeyword;
use App\Services\MediaMentionIngestionService;
use App\Services\RedditMentionIngestionService;
use App\Services\XMentionIngestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class TrackedKeywordController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        return response()->json([
            'data' => $project->trackedKeywords()->latest()->get(),
        ]);
    }

    public function store(
        StoreTrackedKeywordRequest $request,
        Project $project,
        MediaMentionIngestionService $mediaMentionIngestionService,
        RedditMentionIngestionService $redditMentionIngestionService,
        XMentionIngestionService $xMentionIngestionService
    ): JsonResponse
    {
        $this->ensureOwnership($project);

        abort_if(
            $request->user()->keywordLimitReached(),
            422,
            'Your current plan keyword limit has been reached.',
        );

        $keyword = $project->trackedKeywords()->create([
            ...$request->validated(),
            'platform' => $request->input('platform', 'all'),
            'match_type' => $request->input('match_type', 'phrase'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        if (in_array($keyword->platform, ['all', 'media'], true)) {
            $mediaMentionIngestionService->syncProjectMentionsFromArchive($project, $keyword, true);
        }

        if (in_array($keyword->platform, ['all', 'reddit'], true)) {
            $redditMentionIngestionService->ingestProject($project, $keyword, true);
        }

        if (in_array($keyword->platform, ['all', 'x'], true)) {
            $xMentionIngestionService->ingestProject($project, $keyword, true);
        }

        if (! in_array($keyword->platform, ['all', 'media', 'reddit', 'x'], true)) {
            $this->seedDemoMentions($project, $keyword);
        }

        return response()->json([
            'data' => $keyword,
        ], 201);
    }

    public function show(Project $project, TrackedKeyword $trackedKeyword): JsonResponse
    {
        $this->ensureKeywordOwnership($project, $trackedKeyword);

        return response()->json([
            'data' => $trackedKeyword,
        ]);
    }

    public function update(
        UpdateTrackedKeywordRequest $request,
        Project $project,
        TrackedKeyword $trackedKeyword
    ): JsonResponse {
        $this->ensureKeywordOwnership($project, $trackedKeyword);
        $trackedKeyword->update($request->validated());

        return response()->json([
            'data' => $trackedKeyword->fresh(),
        ]);
    }

    public function destroy(Project $project, TrackedKeyword $trackedKeyword): JsonResponse
    {
        $this->ensureKeywordOwnership($project, $trackedKeyword);
        $project->mentions()->where('tracked_keyword_id', $trackedKeyword->id)->delete();
        $trackedKeyword->delete();

        return response()->json([
            'message' => 'Tracked keyword deleted successfully.',
        ]);
    }

    private function ensureOwnership(Project $project): void
    {
        abort_unless($project->user_id === request()->user()->id, 404);
    }

    private function ensureKeywordOwnership(Project $project, TrackedKeyword $trackedKeyword): void
    {
        $this->ensureOwnership($project);

        abort_unless($trackedKeyword->project_id === $project->id, 404);
    }

    private function seedDemoMentions(Project $project, TrackedKeyword $trackedKeyword): void
    {
        $platform = $trackedKeyword->platform === 'all' ? 'media' : $trackedKeyword->platform;
        $audience = $project->audience ?? 'maritime stakeholders';
        $keyword = $trackedKeyword->keyword;

        $demoMentions = [
            [
                'source' => $platform,
                'author_name' => 'IQX Monitor Desk',
                'title' => "{$keyword} conversation rises among {$audience}",
                'body' => "Early monitoring shows new activity around {$keyword} for project {$project->name}. This is a demo result stream until live collectors are connected.",
                'sentiment' => 'neutral',
                'published_at' => now()->subMinutes(18),
            ],
            [
                'source' => $platform,
                'author_name' => 'Operations Watch',
                'title' => "{$keyword} spike triggers watch status",
                'body' => "The monitoring workspace flagged unusual attention velocity around {$keyword}. Use this panel as the target layout for real search results.",
                'sentiment' => 'negative',
                'published_at' => now()->subMinutes(44),
            ],
            [
                'source' => 'media',
                'author_name' => 'Market Briefing',
                'title' => "{$keyword} enters the executive digest",
                'body' => "This placeholder result represents where normalized articles, posts, and summaries will appear after Reddit and media collectors are enabled.",
                'sentiment' => 'positive',
                'published_at' => now()->subHours(2),
            ],
        ];

        foreach ($demoMentions as $index => $mention) {
            Mention::query()->create([
                'project_id' => $project->id,
                'tracked_keyword_id' => $trackedKeyword->id,
                'external_id' => (string) Str::uuid(),
                'url' => "https://example.com/iqx-demo/{$trackedKeyword->id}/{$index}",
                'metadata' => [
                    'demo' => true,
                ],
                ...$mention,
            ]);
        }
    }
}
