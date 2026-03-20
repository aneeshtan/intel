<?php

namespace App\Console\Commands;

use App\Models\MediaArticle;
use App\Models\Mention;
use App\Services\MediaMentionIngestionService;
use Illuminate\Console\Command;

class CleanupInvalidMediaArticles extends Command
{
    protected $signature = 'media:cleanup-invalid {--source=} {--dry-run}';

    protected $description = 'Remove stored media rows that no longer qualify as article URLs under the current source rules.';

    public function handle(MediaMentionIngestionService $service): int
    {
        $sourceKey = $this->option('source') ? (string) $this->option('source') : null;
        $dryRun = (bool) $this->option('dry-run');

        $invalidArticleIds = [];
        $invalidArticleRows = [];

        MediaArticle::query()
            ->when($sourceKey, fn ($query) => $query->where('source_key', $sourceKey))
            ->orderBy('id')
            ->chunkById(200, function ($articles) use ($service, &$invalidArticleIds, &$invalidArticleRows): void {
                foreach ($articles as $article) {
                    if ($service->shouldRetainStoredArticle($article)) {
                        continue;
                    }

                    $invalidArticleIds[] = $article->id;
                    $invalidArticleRows[] = [
                        'id' => $article->id,
                        'source_key' => $article->source_key,
                        'url' => $article->url,
                        'title' => $article->title,
                    ];
                }
            });

        if ($invalidArticleRows === []) {
            $this->info('No invalid media articles found.');

            return self::SUCCESS;
        }

        foreach (array_slice($invalidArticleRows, 0, 25) as $row) {
            $this->line(sprintf(
                '[%d] %s | %s | %s',
                $row['id'],
                $row['source_key'],
                $row['url'],
                $row['title'] ?? 'Untitled article',
            ));
        }

        if (count($invalidArticleRows) > 25) {
            $this->line(sprintf('...and %d more.', count($invalidArticleRows) - 25));
        }

        $linkedMentionsCount = Mention::query()
            ->where('source', 'media')
            ->whereIn('metadata->article_id', $invalidArticleIds)
            ->count();

        if ($dryRun) {
            $this->warn(sprintf(
                'Dry run: %d invalid media article(s) and %d linked mention(s) would be removed.',
                count($invalidArticleIds),
                $linkedMentionsCount,
            ));

            return self::SUCCESS;
        }

        $deletedMentions = Mention::query()
            ->where('source', 'media')
            ->whereIn('metadata->article_id', $invalidArticleIds)
            ->delete();

        $deletedArticles = MediaArticle::query()
            ->whereIn('id', $invalidArticleIds)
            ->delete();

        $this->info(sprintf(
            'Removed %d invalid media article(s) and %d linked mention(s).',
            $deletedArticles,
            $deletedMentions,
        ));

        return self::SUCCESS;
    }
}
