<?php

namespace App\Console\Commands;

use App\Models\MediaArticle;
use App\Services\MediaMentionIngestionService;
use Illuminate\Console\Command;

class ReindexMediaArticles extends Command
{
    protected $signature = 'media:reindex';

    protected $description = 'Retroactively refetch all existing media articles to improve body excerpts using the new Readability engine.';

    public function handle(MediaMentionIngestionService $service): int
    {
        $this->info('Starting media re-indexing process...');

        $query = MediaArticle::query();
        $total = $query->count();

        if ($total === 0) {
            $this->info('No articles found to reindex.');
            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $successCount = 0;
        $failCount = 0;

        foreach ($query->lazyById(50, 'id') as $article) {
            try {
                if ($service->refetchArticle($article)) {
                    $successCount++;
                } else {
                    $failCount++;
                }
            } catch (\Throwable $e) {
                // Log and continue
                $this->error("\nFailed to reindex article {$article->id} ({$article->url}): {$e->getMessage()}");
                $failCount++;
            }

            $bar->advance();
            // Sleep for 500ms to avoid hammering domains
            usleep(500000);
        }

        $bar->finish();
        
        $this->newLine(2);
        $this->info("Re-indexing complete!");
        $this->line("Successfully refreshed: <fg=green>{$successCount}</>");
        $this->line("Failed/Skipped: <fg=red>{$failCount}</>");

        return self::SUCCESS;
    }
}
