<?php

namespace App\Jobs;

use App\Services\MediaMentionIngestionService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class FetchMediaArticleJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 1800;

    public function __construct(
        public array $source,
        public array $candidate,
        public int $lookbackDays = 90,
        public bool $force = false,
    ) {}

    public function handle(MediaMentionIngestionService $service): void
    {
        $article = $service->fetchAndStoreArticleCandidate(
            $this->source,
            $this->candidate,
            $this->lookbackDays,
            $this->force,
        );

        if (! $article) {
            return;
        }

        $service->syncMentionsForArticle($article);
    }

    public function uniqueId(): string
    {
        return sha1(($this->source['key'] ?? 'source').'|'.($this->candidate['url'] ?? ''));
    }
}
