<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\TrackedKeyword;
use App\Services\MediaMentionIngestionService;
use Illuminate\Console\Command;

class ImportMediaMentions extends Command
{
    protected $signature = 'media:ingest {--project=} {--keyword=} {--force} {--days=} {--source=}';

    protected $description = 'Backfill maritime media archives and generate mentions for tracked keywords.';

    public function handle(MediaMentionIngestionService $service): int
    {
        $projectId = $this->option('project');
        $keywordId = $this->option('keyword');
        $force = (bool) $this->option('force');
        $lookbackDays = max(1, (int) ($this->option('days') ?: config('media_sources.archive_lookback_days', 90)));
        $sourceKey = $this->option('source') ? (string) $this->option('source') : null;

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->with(['trackedKeywords' => function ($query) use ($keywordId) {
                $query->where('is_active', true)
                    ->whereIn('platform', ['all', 'media'])
                    ->when($keywordId, fn ($keywordQuery) => $keywordQuery->whereKey($keywordId));
            }])
            ->get();

        if ($projects->isEmpty()) {
            $this->warn('No matching projects found.');

            return self::SUCCESS;
        }

        $archived = $service->backfillRecentArticles($lookbackDays, $force, $sourceKey);
        $this->line("Archive backfill: {$archived} source articles stored.");

        $inserted = 0;

        foreach ($projects as $project) {
            /** @var TrackedKeyword|null $keyword */
            $keyword = $keywordId ? $project->trackedKeywords->first() : null;
            $projectInserted = $service->syncProjectMentionsFromArchive(
                $project,
                $keyword,
                $force,
                $lookbackDays,
                $sourceKey,
            );
            $inserted += $projectInserted;

            $this->line("Project {$project->id} {$project->name}: {$projectInserted} mentions imported.");
        }

        $this->info("Media ingestion completed. {$inserted} new mentions imported.");

        return self::SUCCESS;
    }
}
