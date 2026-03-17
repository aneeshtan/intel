<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\TrackedKeyword;
use App\Services\RedditMentionIngestionService;
use Illuminate\Console\Command;

class ImportRedditMentions extends Command
{
    protected $signature = 'reddit:ingest {--project=} {--keyword=} {--force} {--days=}';

    protected $description = 'Import Reddit mentions for tracked keywords using the official Reddit API.';

    public function handle(RedditMentionIngestionService $service): int
    {
        $projectId = $this->option('project');
        $keywordId = $this->option('keyword');
        $force = (bool) $this->option('force');
        $lookbackDays = max(1, (int) ($this->option('days') ?: config('reddit.lookback_days', 90)));

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->with(['trackedKeywords' => function ($query) use ($keywordId) {
                $query->where('is_active', true)
                    ->whereIn('platform', ['all', 'reddit'])
                    ->when($keywordId, fn ($keywordQuery) => $keywordQuery->whereKey($keywordId));
            }])
            ->get();

        if ($projects->isEmpty()) {
            $this->warn('No matching projects found.');

            return self::SUCCESS;
        }

        $inserted = 0;

        foreach ($projects as $project) {
            /** @var TrackedKeyword|null $keyword */
            $keyword = $keywordId ? $project->trackedKeywords->first() : null;
            $projectInserted = $service->ingestProject($project, $keyword, $force, $lookbackDays);
            $inserted += $projectInserted;

            $this->line("Project {$project->id} {$project->name}: {$projectInserted} Reddit mentions imported.");
        }

        $this->info("Reddit ingestion completed. {$inserted} new mentions imported.");

        return self::SUCCESS;
    }
}
