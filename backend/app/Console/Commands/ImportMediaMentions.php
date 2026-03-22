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
        $projectId   = $this->option('project');
        $keywordId   = $this->option('keyword');
        $force       = (bool) $this->option('force');
        $lookbackDays = max(1, (int) ($this->option('days') ?: config('media_sources.archive_lookback_days', 90)));
        $sourceKey   = $this->option('source') ? (string) $this->option('source') : null;

        $this->info('');
        $this->info('  <fg=cyan;options=bold>IQX Media Ingestion</>');
        $this->info('  ──────────────────────────────────────────');
        $this->line("  Lookback : <fg=yellow>{$lookbackDays} days</>");
        $this->line('  Source   : <fg=yellow>' . ($sourceKey ?? 'all') . '</>');
        $this->line('  Force    : <fg=yellow>' . ($force ? 'yes' : 'no') . '</>');
        $this->info('');

        // ── Phase 1: Article discovery & backfill ────────────────────────────
        $this->line('  <options=bold>Phase 1 — Archive Backfill</>');
        $this->line('  ──────────────────────────────────────────');

        $archived = $service->backfillRecentArticles(
            $lookbackDays,
            $force,
            $sourceKey,
            function (string $name, ?int $candidates, ?int $stored, string $status) {
                match ($status) {
                    'skipped'    => $this->line("  <fg=gray>  ↷  {$name} (recently synced, skipped)</>"),
                    'discovering' => $this->line("  <fg=blue>  ◌  {$name} — discovering articles…</>"),
                    'fetching'   => $this->line("  <fg=yellow>  ⟳  {$name} — fetching {$candidates} candidate(s)…</>"),
                    'done'       => $this->line("  <fg=green>  ✓  {$name} — stored {$stored} / {$candidates} article(s)</>"),
                    default      => null,
                };
            }
        );

        $this->info('');
        $this->line("  <fg=green;options=bold>Archive complete:</> {$archived} article(s) stored.");
        $this->info('');

        // ── Phase 2: Keyword matching ────────────────────────────────────────
        $this->line('  <options=bold>Phase 2 — Keyword Matching</>');
        $this->line('  ──────────────────────────────────────────');

        $projects = Project::query()
            ->when($projectId, fn ($query) => $query->whereKey($projectId))
            ->with(['trackedKeywords' => function ($query) use ($keywordId) {
                $query->where('is_active', true)
                    ->whereIn('platform', ['all', 'media'])
                    ->when($keywordId, fn ($keywordQuery) => $keywordQuery->whereKey($keywordId));
            }])
            ->get();

        if ($projects->isEmpty()) {
            $this->warn('  No matching projects found.');
            return self::SUCCESS;
        }

        $inserted = 0;

        foreach ($projects as $project) {
            $this->line("  <fg=blue>  ◌  Project #{$project->id} {$project->name}…</>");

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

            $icon = $projectInserted > 0 ? '<fg=green>  ✓</>' : '<fg=gray>  –</>';
            $this->line("  {$icon}  Project #{$project->id} {$project->name}: <fg=yellow>{$projectInserted}</> new mention(s)");
        }

        $this->info('');
        $this->info("  <fg=green;options=bold>Done!</> {$inserted} new mention(s) imported across " . $projects->count() . ' project(s).');
        $this->info('');

        return self::SUCCESS;
    }
}
