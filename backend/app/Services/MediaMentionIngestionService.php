<?php

namespace App\Services;

use App\Jobs\FetchMediaArticleJob;
use App\Models\MediaArticle;
use App\Models\Mention;
use App\Models\MutedEntity;
use App\Models\Project;
use App\Models\TrackedKeyword;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MediaMentionIngestionService
{
    public function ingestProject(
        Project $project,
        ?TrackedKeyword $singleKeyword = null,
        bool $force = false,
        ?int $lookbackDays = null,
        bool $backfillArchive = true
    ): int {
        $lookbackDays ??= (int) config('media_sources.archive_lookback_days', 90);

        if ($backfillArchive) {
            $this->backfillRecentArticles($lookbackDays, $force);
        }

        return $this->syncProjectMentionsFromArchive($project, $singleKeyword, $force, $lookbackDays);
    }

    public function backfillRecentArticles(
        ?int $lookbackDays = null,
        bool $force = false,
        ?string $sourceKey = null
    ): int
    {
        $lookbackDays ??= (int) config('media_sources.archive_lookback_days', 90);
        $since = now()->subDays($lookbackDays)->startOfDay();
        $sources = $this->configuredSources($sourceKey);

        if ($sources->isEmpty()) {
            return 0;
        }

        $stored = 0;

        foreach ($sources as $source) {
            if ($sourceKey === null && ! empty($source['disable_discovery'])) {
                continue;
            }

            if (! $force && $this->sourceRecentlySynced($source['key'])) {
                continue;
            }

            $candidates = $this->discoverArchiveCandidates($source, $since);
            $stored += $this->storeArticlesForSource($source, $candidates, $since, $force);
            $this->markSourceSynced($source['key']);
        }

        return $stored;
    }

    public function queueNewArticleFetches(
        ?int $lookbackDays = null,
        bool $force = false,
        ?string $sourceKey = null
    ): int
    {
        $lookbackDays ??= (int) config('media_sources.archive_lookback_days', 90);
        $since = now()->subDays($lookbackDays)->startOfDay();
        $sources = $this->configuredSources($sourceKey);

        if ($sources->isEmpty()) {
            return 0;
        }

        $queued = 0;
        $limit = (int) config('media_sources.discovery_article_limit_per_source', 20);

        foreach ($sources as $source) {
            if ($sourceKey === null && ! empty($source['disable_discovery'])) {
                continue;
            }

            $candidates = $this->discoverArchiveCandidates($source, $since);

            foreach ($candidates->take($limit) as $candidate) {
                if (! $this->shouldQueueArticleCandidate($source, $candidate, $since, $force)) {
                    continue;
                }

                FetchMediaArticleJob::dispatch(
                    $source,
                    $this->serializeCandidateForQueue($candidate),
                    $lookbackDays,
                    $force,
                );
                $queued++;
            }
        }

        return $queued;
    }

    public function hasConfiguredSource(string $sourceKey): bool
    {
        return $this->configuredSources($sourceKey)->isNotEmpty();
    }

    public function fetchAndStoreArticleCandidate(
        array $source,
        array $candidate,
        ?int $lookbackDays = null,
        bool $force = false
    ): ?MediaArticle {
        $lookbackDays ??= (int) config('media_sources.archive_lookback_days', 90);
        $since = now()->subDays($lookbackDays)->startOfDay();

        return $this->storeArticleForCandidate($source, $candidate, $since, $force);
    }

    public function syncMentionsForArticle(MediaArticle $article): int
    {
        $inserted = 0;
        $articleText = trim($article->title.' '.$article->body);

        TrackedKeyword::query()
            ->where('is_active', true)
            ->whereIn('platform', ['all', 'media'])
            ->with(['project.mutedEntities'])
            ->chunkById(100, function (Collection $keywords) use (&$inserted, $article, $articleText): void {
                foreach ($keywords as $keyword) {
                    $project = $keyword->project;

                    if (! $project) {
                        continue;
                    }

                    if (! $this->matchesKeyword($keyword, $articleText)) {
                        continue;
                    }

                    if ($this->isMutedForProject($project, $article->url, $article->author_name)) {
                        continue;
                    }

                    $this->deleteDemoMentions($project, $keyword);

                    $mention = Mention::query()->firstOrCreate(
                        [
                            'source' => 'media',
                            'external_id' => sha1(implode('|', [
                                $project->id,
                                $keyword->id,
                                $article->source_key,
                                $article->external_id,
                            ])),
                        ],
                        [
                            'project_id' => $project->id,
                            'tracked_keyword_id' => $keyword->id,
                            'author_name' => $article->author_name ?: $article->source_name,
                            'url' => $article->url,
                            'title' => $article->title,
                            'body' => $article->body,
                            'sentiment' => 'neutral',
                            'published_at' => $article->published_at,
                            'metadata' => [
                                'source_key' => $article->source_key,
                                'source_name' => $article->source_name,
                                'source_url' => $article->source_url,
                                'source_domain' => $this->normalizeSourceValue(
                                    parse_url((string) $article->url, PHP_URL_HOST)
                                ),
                                'article_id' => $article->id,
                                'demo' => false,
                                'archived' => true,
                            ],
                        ],
                    );

                    if ($mention->wasRecentlyCreated) {
                        $inserted++;
                    }

                    $this->markProjectKeywordSynced($project, $keyword);
                }
            });

        return $inserted;
    }

    public function syncProjectMentionsFromArchive(
        Project $project,
        ?TrackedKeyword $singleKeyword = null,
        bool $force = false,
        ?int $lookbackDays = null
    ): int {
        $lookbackDays ??= (int) config('media_sources.archive_lookback_days', 90);
        $since = now()->subDays($lookbackDays)->startOfDay();

        $keywords = $singleKeyword
            ? collect([$singleKeyword])
            : $project->trackedKeywords()
                ->where('is_active', true)
                ->whereIn('platform', ['all', 'media'])
                ->get();

        if ($keywords->isEmpty()) {
            return 0;
        }

        $inserted = 0;

        foreach ($keywords as $keyword) {
            if (! $force && $this->projectKeywordRecentlySynced($project, $keyword)) {
                continue;
            }

            $this->deleteDemoMentions($project, $keyword);

            MediaArticle::query()
                ->where(function ($query) use ($since) {
                    $query->whereNull('published_at')
                        ->orWhere('published_at', '>=', $since);
                })
                ->orderByDesc('published_at')
                ->chunk(100, function (Collection $articles) use (&$inserted, $project, $keyword): void {
                    foreach ($articles as $article) {
                        if (! $this->matchesKeyword($keyword, trim($article->title.' '.$article->body))) {
                            continue;
                        }

                        if ($this->isMutedForProject($project, $article->url, $article->author_name)) {
                            continue;
                        }

                        $mention = Mention::query()->firstOrCreate(
                            [
                                'source' => 'media',
                                'external_id' => sha1(implode('|', [
                                    $project->id,
                                    $keyword->id,
                                    $article->source_key,
                                    $article->external_id,
                                ])),
                            ],
                            [
                                'project_id' => $project->id,
                                'tracked_keyword_id' => $keyword->id,
                                'author_name' => $article->author_name ?: $article->source_name,
                                'url' => $article->url,
                                'title' => $article->title,
                                'body' => $article->body,
                                'sentiment' => 'neutral',
                                'published_at' => $article->published_at,
                                'metadata' => [
                                    'source_key' => $article->source_key,
                                    'source_name' => $article->source_name,
                                    'source_url' => $article->source_url,
                                    'source_domain' => $this->normalizeSourceValue(
                                        parse_url((string) $article->url, PHP_URL_HOST)
                                    ),
                                    'article_id' => $article->id,
                                    'demo' => false,
                                    'archived' => true,
                                ],
                            ],
                        );

                        if ($mention->wasRecentlyCreated) {
                            $inserted++;
                        }
                    }
                });

            $this->markProjectKeywordSynced($project, $keyword);
        }

        return $inserted;
    }

    private function storeArticlesForSource(
        array $source,
        Collection $candidates,
        Carbon $since,
        bool $force
    ): int {
        $stored = 0;
        $limit = (int) config('media_sources.archive_article_limit_per_source', 80);

        foreach ($candidates->take($limit) as $candidate) {
            $record = $this->storeArticleForCandidate($source, $candidate, $since, $force);

            if ($record && $record->wasRecentlyCreated) {
                $stored++;
            }
        }

        return $stored;
    }

    private function configuredSources(?string $sourceKey = null): Collection
    {
        $sources = collect(config('media_sources.sources', []));

        if ($sourceKey === null || $sourceKey === '') {
            return $sources->values();
        }

        return $sources
            ->filter(fn (array $source): bool => ($source['key'] ?? null) === $sourceKey)
            ->values();
    }

    private function storeArticleForCandidate(
        array $source,
        array $candidate,
        Carbon $since,
        bool $force
    ): ?MediaArticle {
        $url = trim((string) ($candidate['url'] ?? ''));

        if ($url === '') {
            return null;
        }

        $candidatePublishedAt = $this->candidatePublishedAt($candidate);
        $externalId = sha1($url);

        $existing = MediaArticle::query()
            ->where('source_key', $source['key'])
            ->where('external_id', $externalId)
            ->first();

        if (
            ! $force
            && $existing
            && $existing->updated_at
            && $existing->updated_at->gt(now()->subHours(24))
            && ! ($candidatePublishedAt && (! $existing->published_at || $candidatePublishedAt->gt($existing->published_at)))
        ) {
            return null;
        }

        $article = $this->sourceUsesExcerptOnly($source)
            ? $this->articleFromCandidateExcerpt($candidate, $candidatePublishedAt)
            : $this->fetchArticle($source, $url, $candidatePublishedAt);

        if (! $article) {
            return null;
        }

        $publishedAt = $article['published_at'] ?? $candidatePublishedAt;

        if ($publishedAt && $publishedAt->lt($since)) {
            return null;
        }

        $record = $existing ?: new MediaArticle([
            'source_key' => $source['key'],
            'external_id' => $externalId,
        ]);

        $record->fill([
            'source_name' => $source['name'],
            'source_url' => $source['homepage'],
            'url' => $url,
            'author_name' => $article['author'] ?? null,
            'title' => $article['title'],
            'body' => $article['body'],
            'published_at' => $publishedAt,
            'metadata' => [
                ...((array) $record->metadata),
                'feed_url' => $candidate['feed_url'] ?? null,
                'lastmod' => $candidatePublishedAt?->toIso8601String(),
                'backfilled_at' => now()->toIso8601String(),
                'excerpt_only' => $this->sourceUsesExcerptOnly($source),
                'excerpt_source' => $this->sourceUsesExcerptOnly($source)
                    ? (! empty($candidate['body']) ? 'feed_excerpt' : 'title_only')
                    : null,
            ],
        ]);

        $record->save();

        return $record;
    }

    private function discoverArchiveCandidates(array $source, Carbon $since): Collection
    {
        $feedCandidates = collect();
        $feedUrl = $this->discoverFeedUrl($source);

        if ($feedUrl) {
            $feedCandidates = $this->fetchFeedItems($feedUrl)
                ->map(fn (array $item) => [
                    'url' => $item['url'],
                    'title' => $item['title'] ?? null,
                    'body' => $item['body'] ?? null,
                    'text' => $item['text'] ?? null,
                    'author' => $item['author'] ?? null,
                    'published_at' => $item['published_at'],
                    'feed_url' => $feedUrl,
                ]);
        }

        $sitemapCandidates = $this->discoverSitemapUrls($source)
            ->flatMap(fn (string $sitemapUrl) => $this->fetchSitemapCandidates($sitemapUrl, $source, $since))
            ->filter(fn (array $candidate) => ! empty($candidate['url']));

        return $feedCandidates
            ->merge($sitemapCandidates)
            ->filter(function (array $candidate) use ($source, $since): bool {
                if (! $this->looksLikeArticleCandidate($candidate, $source)) {
                    return false;
                }

                return ! isset($candidate['published_at'])
                    || ! $candidate['published_at']
                    || $candidate['published_at']->gte($since);
            })
            ->unique('url')
            ->sortByDesc(fn (array $candidate) => $candidate['published_at']?->getTimestamp() ?? 0)
            ->values();
    }

    private function discoverSitemapUrls(array $source): Collection
    {
        if (! empty($source['disable_sitemaps'])) {
            return collect();
        }

        $cacheKey = "media-sitemap-discovery:{$source['key']}";

        return Cache::remember(
            $cacheKey,
            now()->addMinutes((int) config('media_sources.discovery_ttl_minutes', 360)),
            function () use ($source): Collection {
                $urls = collect();
                $robotsCandidates = collect();
                $origin = $this->sourceOrigin((string) ($source['homepage'] ?? ''));

                if ($origin) {
                    $robotsCandidates->push($this->joinDiscoveryUrl($origin, '/robots.txt'));
                }

                $robotsCandidates->push($this->joinDiscoveryUrl((string) $source['homepage'], '/robots.txt'));

                foreach ($robotsCandidates->filter()->unique() as $robotsUrl) {
                    try {
                        $robotsResponse = $this->httpClient()->get($robotsUrl);

                        if ($robotsResponse->successful()) {
                            preg_match_all('/^\s*Sitemap:\s*(\S+)/im', $robotsResponse->body(), $matches);

                            foreach ($matches[1] ?? [] as $match) {
                                $urls->push(trim($match));
                            }
                        }
                    } catch (\Throwable $exception) {
                        Log::warning('Media robots discovery failed.', [
                            'source' => $source['key'],
                            'robots_url' => $robotsUrl,
                            'message' => $exception->getMessage(),
                        ]);
                    }
                }

                foreach ($this->sourceDiscoveryBases($source) as $baseUrl) {
                    foreach (($source['sitemap_paths'] ?? $this->commonSitemapPaths()) as $path) {
                        $urls->push($this->joinDiscoveryUrl($baseUrl, $path));
                    }
                }

                return $urls->unique()->values()->take((int) config('media_sources.archive_sitemap_limit_per_source', 12));
            }
        );
    }

    private function fetchSitemapCandidates(
        string $sitemapUrl,
        array $source,
        Carbon $since,
        int $depth = 0
    ): Collection {
        if ($depth > 2) {
            return collect();
        }

        try {
            $response = $this->httpClient()->get($sitemapUrl);
        } catch (\Throwable $exception) {
            Log::warning('Media sitemap fetch failed.', [
                'source' => $source['key'],
                'sitemap_url' => $sitemapUrl,
                'message' => $exception->getMessage(),
            ]);

            return collect();
        }

        if (! $response->successful() || ! str_contains($response->body(), '<')) {
            return collect();
        }

        $xml = $this->loadXml($response->body());

        if (! $xml) {
            return collect();
        }

        $sitemapNodes = $xml->xpath('//*[local-name()="sitemap"]') ?: [];

        if ($sitemapNodes !== []) {
            return collect($sitemapNodes)
                ->flatMap(function (\SimpleXMLElement $node) use ($source, $since, $depth): Collection {
                    $childUrl = $this->xmlChildValue($node, 'loc');
                    $lastmod = $this->parseDate($this->xmlChildValue($node, 'lastmod'));

                    if (! $childUrl || ($lastmod && $lastmod->lt($since) && ! str_contains($childUrl, 'news'))) {
                        return collect();
                    }

                    return $this->fetchSitemapCandidates($childUrl, $source, $since, $depth + 1);
                });
        }

        $urlNodes = $xml->xpath('//*[local-name()="url"]') ?: [];

        return collect($urlNodes)
            ->map(function (\SimpleXMLElement $node): ?array {
                $url = $this->xmlChildValue($node, 'loc');

                if (! $url) {
                    return null;
                }

                return [
                    'url' => trim($url),
                    'published_at' => $this->parseDate($this->xmlChildValue($node, 'lastmod')),
                ];
            })
            ->filter();
    }

    private function fetchArticle(array $source, string $url, ?Carbon $fallbackPublishedAt): ?array
    {
        try {
            $response = $this->httpClient()->get($url);
        } catch (\Throwable $exception) {
            Log::warning('Media article fetch failed.', [
                'source' => $source['key'],
                'url' => $url,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        return $this->extractArticleFromHtml($response->body(), $fallbackPublishedAt);
    }

    private function shouldQueueArticleCandidate(
        array $source,
        array $candidate,
        Carbon $since,
        bool $force
    ): bool {
        $url = trim((string) ($candidate['url'] ?? ''));

        if ($url === '') {
            return false;
        }

        $publishedAt = $this->candidatePublishedAt($candidate);

        if ($publishedAt && $publishedAt->lt($since)) {
            return false;
        }

        if ($force) {
            return true;
        }

        $existing = MediaArticle::query()
            ->where('source_key', $source['key'])
            ->where('external_id', sha1($url))
            ->first(['published_at', 'updated_at']);

        if (! $existing) {
            return true;
        }

        if ($publishedAt && (! $existing->published_at || $publishedAt->gt($existing->published_at))) {
            return true;
        }

        return ! $existing->updated_at || $existing->updated_at->lte(now()->subHours(24));
    }

    private function serializeCandidateForQueue(array $candidate): array
    {
        return [
            'url' => (string) ($candidate['url'] ?? ''),
            'feed_url' => $candidate['feed_url'] ?? null,
            'title' => $candidate['title'] ?? null,
            'body' => $candidate['body'] ?? null,
            'author' => $candidate['author'] ?? null,
            'published_at' => $this->candidatePublishedAt($candidate)?->toIso8601String(),
        ];
    }

    private function sourceUsesExcerptOnly(array $source): bool
    {
        return (bool) ($source['excerpt_only'] ?? false);
    }

    private function articleFromCandidateExcerpt(array $candidate, ?Carbon $fallbackPublishedAt): ?array
    {
        $title = $this->cleanText((string) ($candidate['title'] ?? ''));
        $body = $this->cleanText((string) ($candidate['body'] ?? ''));
        $author = $this->cleanText((string) ($candidate['author'] ?? ''));

        if ($title === '' && $body === '') {
            return null;
        }

        return [
            'title' => $title ?: 'Untitled article',
            'body' => $body ?: $title,
            'author' => $author ?: null,
            'published_at' => $fallbackPublishedAt,
        ];
    }

    private function candidatePublishedAt(array $candidate): ?Carbon
    {
        $publishedAt = $candidate['published_at'] ?? null;

        if ($publishedAt instanceof Carbon) {
            return $publishedAt;
        }

        if (is_string($publishedAt) && $publishedAt !== '') {
            return $this->parseDate($publishedAt);
        }

        return null;
    }

    private function extractArticleFromHtml(string $html, ?Carbon $fallbackPublishedAt): ?array
    {
        if (! str_contains($html, '<html')) {
            return null;
        }

        $previous = libxml_use_internal_errors(true);
        $dom = new \DOMDocument;
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?>'.$html);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            return null;
        }

        $xpath = new \DOMXPath($dom);

        foreach ($xpath->query('//script|//style|//noscript|//svg|//nav|//footer|//header|//form|//aside') ?: [] as $node) {
            $node->parentNode?->removeChild($node);
        }

        $title = $this->firstXPathValue($xpath, [
            '//meta[@property="og:title"]/@content',
            '//meta[@name="twitter:title"]/@content',
            '//title',
            '//h1[1]',
        ]);

        $author = $this->firstXPathValue($xpath, [
            '//meta[@name="author"]/@content',
            '//*[contains(@class, "author")][1]',
        ]);

        $publishedAt = $this->parseDate($this->firstXPathValue($xpath, [
            '//meta[@property="article:published_time"]/@content',
            '//meta[@name="pubdate"]/@content',
            '//time[1]/@datetime',
        ]));

        if (! $publishedAt && preg_match('/"datePublished"\s*:\s*"([^"]+)"/i', $html, $matches)) {
            $publishedAt = $this->parseDate($matches[1]);
        }

        $bodyNode = $xpath->query('//article[1]')->item(0)
            ?: $xpath->query('//main[1]')->item(0)
            ?: $xpath->query('//body[1]')->item(0);

        if (! $bodyNode) {
            return null;
        }

        $body = $this->cleanText($dom->saveHTML($bodyNode) ?: '');

        if ($title === '' || mb_strlen($body) < 120) {
            return null;
        }

        return [
            'title' => $title,
            'body' => $body,
            'author' => $author ?: null,
            'published_at' => $publishedAt ?: $fallbackPublishedAt,
        ];
    }

    private function sourceRecentlySynced(string $sourceKey): bool
    {
        $syncedAt = Cache::get($this->sourceSyncKey($sourceKey));

        if (! $syncedAt) {
            return false;
        }

        return Carbon::parse($syncedAt)->gt(
            now()->subMinutes((int) config('media_sources.archive_sync_ttl_minutes', 360))
        );
    }

    private function markSourceSynced(string $sourceKey): void
    {
        Cache::put(
            $this->sourceSyncKey($sourceKey),
            now()->toIso8601String(),
            now()->addMinutes((int) config('media_sources.archive_sync_ttl_minutes', 360)),
        );
    }

    private function sourceSyncKey(string $sourceKey): string
    {
        return "media-source-sync:{$sourceKey}";
    }

    private function projectKeywordRecentlySynced(Project $project, TrackedKeyword $keyword): bool
    {
        $hasLiveMentions = $project->mentions()
            ->where('tracked_keyword_id', $keyword->id)
            ->where(function ($query) {
                $query->whereNull('metadata')
                    ->orWhereJsonContains('metadata->demo', false);
            })
            ->exists();

        if (! $hasLiveMentions) {
            return false;
        }

        $ttlMinutes = (int) config('media_sources.sync_ttl_minutes', 15);
        $syncedAt = Cache::get($this->projectKeywordSyncKey($project, $keyword));

        if (! $syncedAt) {
            return false;
        }

        return Carbon::parse($syncedAt)->gt(now()->subMinutes($ttlMinutes));
    }

    private function markProjectKeywordSynced(Project $project, TrackedKeyword $keyword): void
    {
        Cache::put(
            $this->projectKeywordSyncKey($project, $keyword),
            now()->toIso8601String(),
            now()->addMinutes((int) config('media_sources.sync_ttl_minutes', 15)),
        );
    }

    private function projectKeywordSyncKey(Project $project, TrackedKeyword $keyword): string
    {
        return "media-sync:project:{$project->id}:keyword:{$keyword->id}";
    }

    private function deleteDemoMentions(Project $project, TrackedKeyword $keyword): void
    {
        $project->mentions()
            ->where('tracked_keyword_id', $keyword->id)
            ->whereJsonContains('metadata->demo', true)
            ->delete();
    }

    private function discoverFeedUrl(array $source): ?string
    {
        $cacheKey = "media-feed-discovery:{$source['key']}";

        return Cache::remember(
            $cacheKey,
            now()->addMinutes((int) config('media_sources.discovery_ttl_minutes', 360)),
            function () use ($source): ?string {
                if (! empty($source['feed_url'])) {
                    return $source['feed_url'];
                }

                try {
                    $response = $this->httpClient()->get($source['homepage']);
                } catch (\Throwable $exception) {
                    Log::warning('Media feed discovery failed.', [
                        'source' => $source['key'],
                        'homepage' => $source['homepage'],
                        'message' => $exception->getMessage(),
                    ]);

                    return null;
                }

                if (! $response->successful()) {
                    return null;
                }

                $html = $response->body();
                $feedLink = $this->extractFeedUrlFromHtml($html, $source['homepage']);

                if ($feedLink) {
                    return $feedLink;
                }

                foreach ($this->sourceDiscoveryBases($source) as $baseUrl) {
                    foreach ($this->commonFeedPaths() as $path) {
                        $candidate = $this->joinDiscoveryUrl($baseUrl, $path);

                        try {
                            $candidateResponse = $this->httpClient()->get($candidate);
                        } catch (\Throwable) {
                            continue;
                        }

                        if ($candidateResponse->successful() && $this->isXmlFeed($candidateResponse->body())) {
                            return $candidate;
                        }
                    }
                }

                return null;
            }
        );
    }

    private function commonFeedPaths(): array
    {
        return [
            '/feed/',
            '/rss',
            '/rss.xml',
        ];
    }

    private function commonSitemapPaths(): array
    {
        return [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/post-sitemap.xml',
            '/news-sitemap.xml',
            '/article-sitemap.xml',
        ];
    }

    private function sourceDiscoveryBases(array $source): Collection
    {
        $homepage = trim((string) ($source['homepage'] ?? ''));
        $origin = $this->sourceOrigin($homepage);

        return collect([$origin, $homepage])
            ->filter()
            ->map(fn (string $value) => rtrim($value, '/'))
            ->unique()
            ->values();
    }

    private function sourceOrigin(string $url): ?string
    {
        $parts = parse_url($url);

        if (! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $origin = $parts['scheme'].'://'.$parts['host'];

        if (isset($parts['port'])) {
            $origin .= ':'.$parts['port'];
        }

        return $origin;
    }

    private function joinDiscoveryUrl(string $baseUrl, string $path): string
    {
        return rtrim($baseUrl, '/').$path;
    }

    private function extractFeedUrlFromHtml(string $html, string $homepage): ?string
    {
        $patterns = [
            '/<link[^>]+type=["\']application\/(?:rss\+xml|atom\+xml)["\'][^>]+href=["\']([^"\']+)["\']/i',
            '/<link[^>]+href=["\']([^"\']+)["\'][^>]+type=["\']application\/(?:rss\+xml|atom\+xml)["\']/i',
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $html, $matches)) {
                continue;
            }

            return str_starts_with($matches[1], 'http')
                ? $matches[1]
                : rtrim($homepage, '/').'/'.ltrim($matches[1], '/');
        }

        return null;
    }

    private function fetchFeedItems(string $feedUrl): Collection
    {
        try {
            $response = $this->httpClient()->get($feedUrl);

            if (! $response->successful()) {
                return collect();
            }

            return $this->parseFeed($response->body());
        } catch (\Throwable $exception) {
            Log::warning('Media feed fetch failed.', [
                'feed_url' => $feedUrl,
                'message' => $exception->getMessage(),
            ]);

            return collect();
        }
    }

    private function parseFeed(string $xml): Collection
    {
        if (! $this->isXmlFeed($xml)) {
            return collect();
        }

        $feed = $this->loadXml($xml);

        if (! $feed) {
            return collect();
        }

        if (isset($feed->channel->item)) {
            return collect(iterator_to_array($feed->channel->item))
                ->map(fn ($item) => $this->normalizeRssItem($item))
                ->filter();
        }

        if (isset($feed->entry)) {
            return collect(iterator_to_array($feed->entry))
                ->map(fn ($item) => $this->normalizeAtomItem($item))
                ->filter();
        }

        return collect();
    }

    private function normalizeRssItem(\SimpleXMLElement $item): ?array
    {
        $contentNamespaces = $item->getNamespaces(true);
        $content = '';

        if (isset($contentNamespaces['content'])) {
            $encoded = $item->children($contentNamespaces['content']);
            $content = (string) ($encoded->encoded ?? '');
        }

        if (! $content && isset($contentNamespaces['dc'])) {
            $dc = $item->children($contentNamespaces['dc']);
            $author = (string) ($dc->creator ?? '');
        } else {
            $author = (string) ($item->author ?? '');
        }

        $title = $this->cleanText((string) ($item->title ?? ''));
        $body = $this->cleanText($content ?: (string) ($item->description ?? ''));
        $url = (string) ($item->link ?? '');

        if (! $title && ! $body) {
            return null;
        }

        return [
            'guid' => (string) ($item->guid ?? $url),
            'url' => $url,
            'title' => $title ?: 'Untitled article',
            'body' => $body ?: $title,
            'author' => $author ?: null,
            'published_at' => $this->parseDate((string) ($item->pubDate ?? '')),
            'text' => trim($title.' '.$body),
        ];
    }

    private function normalizeAtomItem(\SimpleXMLElement $item): ?array
    {
        $attributes = $item->link?->attributes();
        $url = (string) ($attributes['href'] ?? '');
        $title = $this->cleanText((string) ($item->title ?? ''));
        $body = $this->cleanText((string) ($item->summary ?? $item->content ?? ''));
        $author = $this->cleanText((string) ($item->author->name ?? ''));

        if (! $title && ! $body) {
            return null;
        }

        return [
            'guid' => (string) ($item->id ?? $url),
            'url' => $url,
            'title' => $title ?: 'Untitled article',
            'body' => $body ?: $title,
            'author' => $author ?: null,
            'published_at' => $this->parseDate((string) ($item->updated ?? $item->published ?? '')),
            'text' => trim($title.' '.$body),
        ];
    }

    private function loadXml(string $xml): ?\SimpleXMLElement
    {
        $previous = libxml_use_internal_errors(true);
        $document = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $document ?: null;
    }

    private function xmlChildValue(\SimpleXMLElement $node, string $name): string
    {
        $matches = $node->xpath('./*[local-name()="'.$name.'"]') ?: [];

        if ($matches === []) {
            return '';
        }

        return trim((string) $matches[0]);
    }

    private function firstXPathValue(\DOMXPath $xpath, array $expressions): string
    {
        foreach ($expressions as $expression) {
            $result = $xpath->query($expression);

            if (! $result || $result->length === 0) {
                continue;
            }

            $value = trim($result->item(0)?->textContent ?? '');

            if ($value !== '') {
                return $this->cleanText($value);
            }
        }

        return '';
    }

    private function parseDate(string $value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function cleanText(string $value, ?int $limit = 8000): string
    {
        $value = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        $value = trim($value);

        return $limit ? Str::limit($value, $limit, '...') : $value;
    }

    private function looksLikeArticleCandidate(array $candidate, array $source = []): bool
    {
        $url = trim((string) ($candidate['url'] ?? ''));

        if ($url === '' || ! $this->looksLikeArticleUrl($url, $source)) {
            return false;
        }

        $title = trim((string) ($candidate['title'] ?? ''));

        foreach (($source['exclude_title_patterns'] ?? []) as $pattern) {
            if ($title !== '' && @preg_match($pattern, $title) === 1) {
                return false;
            }
        }

        return true;
    }

    private function looksLikeArticleUrl(string $url, array $source = []): bool
    {
        $parts = parse_url($url);
        $path = $parts['path'] ?? '';

        if ($path === '' || $path === '/') {
            return false;
        }

        foreach ([
            '/tag/',
            '/tags/',
            '/category/',
            '/categories/',
            '/author/',
            '/search',
            '/page/',
            '/feed',
            '/topic/',
        ] as $excludedPath) {
            if (str_contains($path, $excludedPath)) {
                return false;
            }
        }

        foreach (($source['exclude_url_patterns'] ?? []) as $pattern) {
            if (@preg_match($pattern, $url) === 1) {
                return false;
            }
        }

        if (! empty($source['include_url_patterns'])) {
            $matchesIncludePattern = false;

            foreach ($source['include_url_patterns'] as $pattern) {
                if (@preg_match($pattern, $url) === 1) {
                    $matchesIncludePattern = true;
                    break;
                }
            }

            if (! $matchesIncludePattern) {
                return false;
            }
        }

        return ! preg_match('/\.(jpg|jpeg|png|gif|webp|pdf|xml)$/i', $path);
    }

    private function matchesKeyword(TrackedKeyword $keyword, string $text): bool
    {
        $text = mb_strtolower($text);
        $needle = trim(mb_strtolower($keyword->keyword));

        if ($needle === '') {
            return false;
        }

        return match ($keyword->match_type) {
            'exact' => (bool) preg_match('/\b'.preg_quote($needle, '/').'\b/u', $text),
            'boolean' => $this->matchesBooleanKeyword($keyword->keyword, $text),
            default => str_contains($text, $needle),
        };
    }

    private function matchesBooleanKeyword(string $expression, string $text): bool
    {
        $clauses = preg_split('/\s+OR\s+/i', $expression) ?: [];

        foreach ($clauses as $clause) {
            $mustMatch = [];
            $mustNotMatch = [];

            preg_match_all('/"[^"]+"|\S+/', $clause, $tokens);

            $mode = 'must';

            foreach ($tokens[0] as $token) {
                $upper = strtoupper($token);

                if ($upper === 'AND') {
                    continue;
                }

                if ($upper === 'NOT') {
                    $mode = 'not';

                    continue;
                }

                $token = trim($token, '"');

                if ($token === '') {
                    continue;
                }

                if ($mode === 'not') {
                    $mustNotMatch[] = mb_strtolower($token);
                    $mode = 'must';

                    continue;
                }

                $mustMatch[] = mb_strtolower($token);
            }

            $allMustMatch = collect($mustMatch)->every(fn ($token) => str_contains($text, $token));
            $noMustNotMatch = collect($mustNotMatch)->every(fn ($token) => ! str_contains($text, $token));

            if ($allMustMatch && $noMustNotMatch) {
                return true;
            }
        }

        return false;
    }

    private function isXmlFeed(string $value): bool
    {
        $trimmed = ltrim($value);

        return str_starts_with($trimmed, '<?xml')
            || str_starts_with($trimmed, '<rss')
            || str_starts_with($trimmed, '<feed');
    }

    private function httpClient()
    {
        return Http::timeout((int) config('media_sources.timeout_seconds', 12))
            ->connectTimeout((int) config('media_sources.connect_timeout_seconds', 3))
            ->withUserAgent((string) config('media_sources.user_agent'));
    }

    private function isMutedForProject(Project $project, ?string $url, ?string $author): bool
    {
        $muted = $project->mutedEntities()->get(['kind', 'value']);
        $domain = $this->normalizeSourceValue(parse_url((string) $url, PHP_URL_HOST));
        $normalizedAuthor = $this->normalizeSourceValue($author);

        return $muted->contains(fn (MutedEntity $item) => $item->kind === 'source' && $item->value === $domain)
            || ($normalizedAuthor !== ''
                && $muted->contains(fn (MutedEntity $item) => $item->kind === 'author' && $item->value === $normalizedAuthor));
    }

    private function normalizeSourceValue(?string $value): string
    {
        $value = trim(mb_strtolower((string) $value));

        return preg_replace('/^www\./', '', $value) ?? $value;
    }
}
