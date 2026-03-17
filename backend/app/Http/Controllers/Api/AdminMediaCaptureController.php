<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Process;

class AdminMediaCaptureController extends Controller
{
    public function __invoke(): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        $projectId = request()->integer('project_id');
        $lookbackDays = max(1, request()->integer('days', (int) config('media_sources.archive_lookback_days', 90)));
        $force = request()->boolean('force', true);

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->get();

        $processedProjects = 0;

        $commands = [];
        $mediaCommand = ['php', 'artisan', 'media:ingest'];
        $redditCommand = ['php', 'artisan', 'reddit:ingest'];
        $xCommand = ['php', 'artisan', 'x:ingest'];

        if ($projectId) {
            $mediaCommand[] = "--project={$projectId}";
            $redditCommand[] = "--project={$projectId}";
            $xCommand[] = "--project={$projectId}";
        }

        if ($force) {
            $mediaCommand[] = '--force';
            $redditCommand[] = '--force';
            $xCommand[] = '--force';
        }

        $mediaCommand[] = "--days={$lookbackDays}";
        $redditCommand[] = "--days={$lookbackDays}";
        $xCommand[] = '--days='.min(7, $lookbackDays);

        $commands[] = $mediaCommand;
        $commands[] = $redditCommand;
        $commands[] = $xCommand;

        foreach ($commands as $command) {
            Process::path(base_path())->start($command);
        }
        $processedProjects = $projects->count();

        return response()->json([
            'data' => [
                'projects_processed' => $processedProjects,
                'capture_started' => $processedProjects > 0,
            ],
            'message' => $processedProjects === 0
                ? 'No matching projects were found for capture refresh.'
                : "Capture refresh started for news, Reddit, and X across {$processedProjects} project(s). X refresh is limited to the last ".min(7, $lookbackDays).' days. Refresh shortly to see new mentions.',
        ], 202);
    }
}
