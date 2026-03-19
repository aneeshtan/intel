<?php

namespace App\Services;

use App\Models\MediaArticle;
use App\Models\Mention;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;

class MediaSourceAuditService
{
    public function buildAudit(?int $days = null): array
    {
        $days = max(1, (int) ($days ?? 7));
        $since = CarbonImmutable::now()->subDays($days);
        $sources = collect(config('media_sources.sources', []));
        $logWindow = $this->readRecentLogLines($since);
        $articleStats = $this->articleStatsBySource();
        $mentionStats = $this->mentionStatsBySource();

        $rows = $sources
            ->map(function (array $source) use ($articleStats, $mentionStats, $logWindow, $since): array {
                $key = $source['key'];
                $articleStat = $articleStats->get($key, [
                    'article_count' => 0,
                    'source_name' => null,
                    'source_url' => null,
                    'earliest_published_at' => null,
                    'latest_published_at' => null,
                    'latest_created_at' => null,
                    'last_ingested_at' => null,
                ]);
                $mentionStat = $mentionStats->get($key, [
                    'matched_mentions_count' => 0,
                    'latest_match_at' => null,
                ]);

                $warningCount = $this->warningCountForSource($logWindow, $key);
                $latestPublishedAt = $articleStat['latest_published_at'];
                $freshnessHours = $latestPublishedAt
                    ? round($latestPublishedAt->diffInMinutes(CarbonImmutable::now()) / 60, 1)
                    : null;
                $status = $this->classifySource(
                    access: $source['access'] ?? 'open',
                    articleCount: (int) $articleStat['article_count'],
                    warningCount: $warningCount,
                    latestPublishedAt: $latestPublishedAt,
                    windowStart: $since,
                );

                return [
                    'key' => $key,
                    'name' => $source['name'],
                    'homepage' => $source['homepage'],
                    'access' => $source['access'] ?? 'open',
                    'status' => $status,
                    'status_label' => $this->statusLabel($status),
                    'notes' => $this->buildNotes(
                        access: $source['access'] ?? 'open',
                        articleCount: (int) $articleStat['article_count'],
                        warningCount: $warningCount,
                        freshnessHours: $freshnessHours,
                    ),
                    'article_count' => (int) ($articleStat['article_count'] ?? 0),
                    'matched_mentions_count' => (int) ($mentionStat['matched_mentions_count'] ?? 0),
                    'warning_count' => $warningCount,
                    'discovery_enabled' => empty($source['disable_discovery']),
                    'sitemaps_enabled' => empty($source['disable_sitemaps']),
                    'has_feed_url' => ! empty($source['feed_url']),
                    'feed_url' => $source['feed_url'] ?? null,
                    'include_url_patterns' => array_values($source['include_url_patterns'] ?? []),
                    'exclude_url_patterns' => array_values($source['exclude_url_patterns'] ?? []),
                    'exclude_title_patterns' => array_values($source['exclude_title_patterns'] ?? []),
                    'earliest_published_at' => $articleStat['earliest_published_at']?->toIso8601String(),
                    'latest_published_at' => $latestPublishedAt?->toIso8601String(),
                    'latest_match_at' => ($mentionStat['latest_match_at'] ?? null)?->toIso8601String(),
                    'last_ingested_at' => ($articleStat['last_ingested_at'] ?? null)?->toIso8601String(),
                    'freshness_hours' => $freshnessHours,
                ];
            })
            ->sortBy([
                ['status', 'asc'],
                ['warning_count', 'desc'],
                ['article_count', 'asc'],
                ['name', 'asc'],
            ])
            ->values();

        $publishedWindow = $rows
            ->flatMap(fn (array $row) => array_filter([
                $row['earliest_published_at'] ?? null,
                $row['latest_published_at'] ?? null,
            ]))
            ->sort()
            ->values();

        $summary = $rows->countBy('status');

        return [
            'summary' => [
                'configured_sources' => $rows->count(),
                'indexed_sources' => $rows->where('article_count', '>', 0)->count(),
                'archive_articles' => $rows->sum('article_count'),
                'matched_mentions' => $rows->sum('matched_mentions_count'),
                'archive_window_days' => (int) config('media_sources.archive_lookback_days', 90),
                'audit_window_days' => $days,
                'oldest_published_at' => $publishedWindow->first(),
                'newest_published_at' => $publishedWindow->last(),
                'working_sources' => (int) ($summary['working'] ?? 0),
                'flaky_sources' => (int) ($summary['flaky'] ?? 0),
                'broken_sources' => (int) ($summary['broken'] ?? 0),
                'premium_risk_sources' => (int) ($summary['premium-risk'] ?? 0),
                'unindexed_sources' => (int) ($summary['unindexed'] ?? 0),
                'pending_sources' => (int) ($summary['pending'] ?? 0),
            ],
            'sources' => $rows->all(),
        ];
    }

    public function articleStatsBySource(): Collection
    {
        return MediaArticle::query()
            ->get([
                'source_key',
                'source_name',
                'source_url',
                'published_at',
                'created_at',
                'updated_at',
            ])
            ->groupBy('source_key')
            ->map(function (Collection $articles): array {
                return [
                    'article_count' => $articles->count(),
                    'source_name' => $articles->first()?->source_name,
                    'source_url' => $articles->first()?->source_url,
                    'earliest_published_at' => $articles
                        ->pluck('published_at')
                        ->filter()
                        ->sort()
                        ->first()?->toImmutable(),
                    'latest_published_at' => $articles
                        ->pluck('published_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toImmutable(),
                    'latest_created_at' => $articles
                        ->pluck('created_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toImmutable(),
                    'last_ingested_at' => $articles
                        ->pluck('updated_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toImmutable(),
                ];
            });
    }

    public function mentionStatsBySource(): Collection
    {
        return Mention::query()
            ->where('source', 'media')
            ->get(['metadata', 'published_at'])
            ->groupBy(fn (Mention $mention) => $mention->metadata['source_key'] ?? 'unknown')
            ->map(function (Collection $mentions): array {
                return [
                    'matched_mentions_count' => $mentions->count(),
                    'latest_match_at' => $mentions
                        ->pluck('published_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toImmutable(),
                ];
            });
    }

    public function readRecentLogLines(CarbonImmutable $since): array
    {
        $path = storage_path('logs/laravel.log');

        if (! File::exists($path)) {
            return [];
        }

        return collect(explode("\n", File::get($path)))
            ->filter(function (string $line) use ($since): bool {
                if (! preg_match('/^\[(?<timestamp>[^\]]+)\]/', $line, $matches)) {
                    return false;
                }

                if (
                    str_contains($line, ' testing.')
                    || str_contains($line, 'example.test')
                    || str_contains($line, 'feeds.example.test')
                ) {
                    return false;
                }

                try {
                    return CarbonImmutable::parse($matches['timestamp'])->gte($since);
                } catch (\Throwable) {
                    return false;
                }
            })
            ->values()
            ->all();
    }

    public function warningCountForSource(array $lines, string $sourceKey): int
    {
        return collect($lines)
            ->filter(fn (string $line): bool => str_contains($line, '"source":"'.$sourceKey.'"'))
            ->count();
    }

    public function classifySource(
        string $access,
        int $articleCount,
        int $warningCount,
        ?CarbonImmutable $latestPublishedAt,
        CarbonImmutable $windowStart
    ): string {
        if ($access === 'premium') {
            return 'premium-risk';
        }

        if ($articleCount === 0) {
            return 'unindexed';
        }

        if (! $latestPublishedAt || $latestPublishedAt->lt($windowStart) || $warningCount > 5) {
            return 'flaky';
        }

        return 'working';
    }

    public function buildNotes(
        string $access,
        int $articleCount,
        int $warningCount,
        ?float $freshnessHours
    ): string {
        if ($access === 'premium') {
            return 'Likely needs licensed or authenticated access.';
        }

        if ($articleCount === 0) {
            if ($warningCount > 0) {
                return 'Configured, but still unindexed. Discovery failures have been recorded.';
            }

            return 'Configured, but not indexed yet.';
        }

        if ($warningCount > 5) {
            return 'Archive exists, but current discovery is noisy or unstable.';
        }

        if ($freshnessHours !== null && $freshnessHours > 24) {
            return 'Indexed, but latest published article is stale.';
        }

        return 'Recently indexed with no major warning volume.';
    }

    public function statusLabel(string $status): string
    {
        return match ($status) {
            'working' => 'Indexed',
            'flaky' => 'Indexed with issues',
            'broken' => 'Broken',
            'premium-risk' => 'Premium risk',
            'unindexed' => 'Unindexed',
            default => 'Pending',
        };
    }
}
