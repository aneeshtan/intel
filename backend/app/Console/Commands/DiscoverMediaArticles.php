<?php

namespace App\Console\Commands;

use App\Services\MediaMentionIngestionService;
use Illuminate\Console\Command;

class DiscoverMediaArticles extends Command
{
    protected $signature = 'media:discover {--force} {--days=} {--source=}';

    protected $description = 'Discover newly published media articles and queue per-article fetch jobs.';

    public function handle(MediaMentionIngestionService $service): int
    {
        $force = (bool) $this->option('force');
        $lookbackDays = max(1, (int) ($this->option('days') ?: config('media_sources.archive_lookback_days', 90)));
        $sourceKey = $this->option('source') ? (string) $this->option('source') : null;
        $queued = $service->queueNewArticleFetches($lookbackDays, $force, $sourceKey);

        $this->info("Media discovery queued {$queued} article fetch job(s).");

        return self::SUCCESS;
    }
}
