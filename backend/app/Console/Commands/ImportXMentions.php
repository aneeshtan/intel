<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\TrackedKeyword;
use App\Services\XMentionIngestionService;
use Illuminate\Console\Command;

class ImportXMentions extends Command
{
    protected $signature = 'x:ingest {--project=} {--keyword=} {--force} {--days=}';

    protected $description = 'Import X mentions for tracked keywords using the official X API recent search endpoint.';

    public function handle(XMentionIngestionService $service): int
    {
        $projectId = $this->option('project');
        $keywordId = $this->option('keyword');
        $force = (bool) $this->option('force');
        $lookbackDays = min(7, max(1, (int) ($this->option('days') ?: config('x.lookback_days', 7))));

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->with(['trackedKeywords' => function ($query) use ($keywordId) {
                $query->where('is_active', true)
                    ->whereIn('platform', ['all', 'x'])
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

            $this->line("Project {$project->id} {$project->name}: {$projectInserted} X mentions imported.");
        }

        $this->info("X ingestion completed. {$inserted} new mentions imported.");

        return self::SUCCESS;
    }
}
