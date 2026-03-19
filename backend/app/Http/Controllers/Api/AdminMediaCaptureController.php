<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use App\Services\MediaMentionIngestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Process;

class AdminMediaCaptureController extends Controller
{
    public function __invoke(MediaMentionIngestionService $service): JsonResponse
    {
        /** @var User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        $projectId = request()->integer('project_id');
        $sourceKey = trim((string) request()->input('source_key', ''));
        $lookbackDays = max(1, request()->integer('days', (int) config('media_sources.archive_lookback_days', 90)));
        $force = request()->boolean('force', true);

        abort_if(
            $sourceKey !== '' && ! $service->hasConfiguredSource($sourceKey),
            422,
            'Unknown source key.',
        );

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->get();

        $processedProjects = 0;

        $commands = [];
        $mediaCommand = ['php', 'artisan', $sourceKey !== '' ? 'media:ingest' : 'media:discover'];

        if ($projectId && $sourceKey !== '') {
            $mediaCommand[] = "--project={$projectId}";
        }

        if ($sourceKey !== '') {
            $mediaCommand[] = "--source={$sourceKey}";
        }

        if ($force) {
            $mediaCommand[] = '--force';
        }

        $mediaCommand[] = "--days={$lookbackDays}";
        $commands[] = $mediaCommand;

        if ($sourceKey === '') {
            $redditCommand = ['php', 'artisan', 'reddit:ingest'];
            $xCommand = ['php', 'artisan', 'x:ingest'];

            if ($projectId) {
                $redditCommand[] = "--project={$projectId}";
                $xCommand[] = "--project={$projectId}";
            }

            if ($force) {
                $redditCommand[] = '--force';
                $xCommand[] = '--force';
            }

            $redditCommand[] = "--days={$lookbackDays}";
            $xCommand[] = '--days='.min(7, $lookbackDays);

            $commands[] = $redditCommand;
            $commands[] = $xCommand;
        }

        foreach ($commands as $command) {
            Process::path(base_path())->start($command);
        }
        $processedProjects = $projects->count();

        return response()->json([
            'data' => [
                'projects_processed' => $processedProjects,
                'capture_started' => $processedProjects > 0,
                'source_key' => $sourceKey !== '' ? $sourceKey : null,
            ],
            'message' => $processedProjects === 0
                ? 'No matching projects were found for capture refresh.'
                : ($sourceKey !== ''
                    ? "Source indexing started for {$sourceKey} across {$processedProjects} project(s). Refresh shortly to see that source update."
                    : "Capture refresh started for news, Reddit, and X across {$processedProjects} project(s). X refresh is limited to the last ".min(7, $lookbackDays).' days. Refresh shortly to see new mentions.'),
        ], 202);
    }
}
