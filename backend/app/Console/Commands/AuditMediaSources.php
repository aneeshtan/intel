<?php

namespace App\Console\Commands;

use App\Models\MediaArticle;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;

class AuditMediaSources extends Command
{
    protected $signature = 'media:audit {--days=7}';

    protected $description = 'Audit configured media sources for freshness, failures, and likely reliability.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $since = CarbonImmutable::now()->subDays($days);
        $sources = collect(config('media_sources.sources', []));

        if ($sources->isEmpty()) {
            $this->warn('No media sources are configured.');

            return self::SUCCESS;
        }

        $logWindow = $this->readRecentLogLines($since);
        $stats = $this->articleStatsBySource();

        $rows = $sources
            ->map(function (array $source) use ($stats, $logWindow, $since): array {
                $key = $source['key'];
                $articleStat = $stats->get($key, [
                    'article_count' => 0,
                    'latest_published_at' => null,
                    'latest_created_at' => null,
                ]);

                $warningCount = $this->warningCountForSource($logWindow, $key);
                $latestPublishedAt = $articleStat['latest_published_at'];
                $freshnessHours = $latestPublishedAt
                    ? round($latestPublishedAt->diffInMinutes(CarbonImmutable::now()) / 60, 1)
                    : null;

                return [
                    'key' => $key,
                    'name' => $source['name'],
                    'access' => $source['access'] ?? 'open',
                    'article_count' => $articleStat['article_count'],
                    'latest_published_at' => $latestPublishedAt?->toIso8601String() ?? '-',
                    'latest_created_at' => $articleStat['latest_created_at']?->toIso8601String() ?? '-',
                    'warning_count' => $warningCount,
                    'status' => $this->classifySource(
                        access: $source['access'] ?? 'open',
                        articleCount: (int) $articleStat['article_count'],
                        warningCount: $warningCount,
                        latestPublishedAt: $latestPublishedAt,
                        windowStart: $since,
                    ),
                    'notes' => $this->buildNotes(
                        access: $source['access'] ?? 'open',
                        articleCount: (int) $articleStat['article_count'],
                        warningCount: $warningCount,
                        freshnessHours: $freshnessHours,
                    ),
                ];
            })
            ->sortBy([
                ['status', 'asc'],
                ['warning_count', 'desc'],
                ['article_count', 'asc'],
            ])
            ->values();

        $this->table(
            ['Status', 'Source', 'Access', 'Articles', 'Latest Published', 'Warnings', 'Notes'],
            $rows->map(fn (array $row) => [
                $row['status'],
                $row['name'],
                $row['access'],
                $row['article_count'],
                $row['latest_published_at'],
                $row['warning_count'],
                $row['notes'],
            ])->all()
        );

        $summary = $rows->countBy('status');
        $this->newLine();
        $this->info(sprintf(
            'Configured sources: %d | working: %d | flaky: %d | broken: %d | premium-risk: %d',
            $rows->count(),
            (int) ($summary['working'] ?? 0),
            (int) ($summary['flaky'] ?? 0),
            (int) ($summary['broken'] ?? 0),
            (int) ($summary['premium-risk'] ?? 0),
        ));

        return self::SUCCESS;
    }

    private function articleStatsBySource(): Collection
    {
        return MediaArticle::query()
            ->selectRaw('source_key, COUNT(*) as article_count, MAX(published_at) as latest_published_at, MAX(created_at) as latest_created_at')
            ->groupBy('source_key')
            ->get()
            ->keyBy('source_key')
            ->map(fn ($row) => [
                'article_count' => (int) $row->article_count,
                'latest_published_at' => $row->latest_published_at ? CarbonImmutable::parse($row->latest_published_at) : null,
                'latest_created_at' => $row->latest_created_at ? CarbonImmutable::parse($row->latest_created_at) : null,
            ]);
    }

    private function readRecentLogLines(CarbonImmutable $since): array
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

                try {
                    return CarbonImmutable::parse($matches['timestamp'])->gte($since);
                } catch (\Throwable) {
                    return false;
                }
            })
            ->values()
            ->all();
    }

    private function warningCountForSource(array $lines, string $sourceKey): int
    {
        return collect($lines)
            ->filter(fn (string $line): bool => str_contains($line, '"source":"'.$sourceKey.'"'))
            ->count();
    }

    private function classifySource(
        string $access,
        int $articleCount,
        int $warningCount,
        ?CarbonImmutable $latestPublishedAt,
        CarbonImmutable $windowStart
    ): string {
        if ($access === 'premium') {
            return 'premium-risk';
        }

        if ($articleCount === 0 && $warningCount > 0) {
            return 'broken';
        }

        if ($articleCount === 0) {
            return 'flaky';
        }

        if (! $latestPublishedAt || $latestPublishedAt->lt($windowStart) || $warningCount > 5) {
            return 'flaky';
        }

        return 'working';
    }

    private function buildNotes(
        string $access,
        int $articleCount,
        int $warningCount,
        ?float $freshnessHours
    ): string {
        if ($access === 'premium') {
            return 'Likely needs licensed or authenticated access.';
        }

        if ($articleCount === 0 && $warningCount > 0) {
            return 'No stored coverage and repeated fetch/discovery failures.';
        }

        if ($articleCount === 0) {
            return 'No indexed articles yet.';
        }

        if ($warningCount > 5) {
            return 'Archive exists, but current discovery is noisy or unstable.';
        }

        if ($freshnessHours !== null && $freshnessHours > 24) {
            return 'Indexed, but latest published article is stale.';
        }

        return 'Recently indexed with no major warning volume.';
    }
}
