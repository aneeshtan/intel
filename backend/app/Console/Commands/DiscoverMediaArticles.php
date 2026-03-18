<?php

namespace App\Console\Commands;

use App\Services\MediaMentionIngestionService;
use Illuminate\Console\Command;

class DiscoverMediaArticles extends Command
{
    protected $signature = 'media:discover {--force} {--days=}';

    protected $description = 'Discover newly published media articles and queue per-article fetch jobs.';

    public function handle(MediaMentionIngestionService $service): int
    {
        $force = (bool) $this->option('force');
        $lookbackDays = max(1, (int) ($this->option('days') ?: config('media_sources.archive_lookback_days', 90)));
        $queued = $service->queueNewArticleFetches($lookbackDays, $force);

        $this->info("Media discovery queued {$queued} article fetch job(s).");

        return self::SUCCESS;
    }
}
