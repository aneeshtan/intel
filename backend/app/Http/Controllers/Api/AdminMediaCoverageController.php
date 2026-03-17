<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaArticle;
use App\Models\Mention;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class AdminMediaCoverageController extends Controller
{
    public function __invoke(): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        $configuredSources = collect(config('media_sources.sources', []));

        $articleStats = MediaArticle::query()
            ->get([
                'source_key',
                'source_name',
                'source_url',
                'published_at',
                'updated_at',
            ])
            ->groupBy('source_key')
            ->map(function (Collection $articles) {
                return [
                    'article_count' => $articles->count(),
                    'source_name' => $articles->first()?->source_name,
                    'source_url' => $articles->first()?->source_url,
                    'earliest_published_at' => $articles
                        ->pluck('published_at')
                        ->filter()
                        ->sort()
                        ->first()?->toIso8601String(),
                    'latest_published_at' => $articles
                        ->pluck('published_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toIso8601String(),
                    'last_ingested_at' => $articles
                        ->pluck('updated_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toIso8601String(),
                ];
            });

        $mentionStats = Mention::query()
            ->where('source', 'media')
            ->get(['metadata', 'published_at'])
            ->groupBy(fn (Mention $mention) => $mention->metadata['source_key'] ?? 'unknown')
            ->map(function (Collection $mentions) {
                return [
                    'matched_mentions_count' => $mentions->count(),
                    'latest_match_at' => $mentions
                        ->pluck('published_at')
                        ->filter()
                        ->sortDesc()
                        ->first()?->toIso8601String(),
                ];
            });

        $sources = $configuredSources->map(function (array $source) use ($articleStats, $mentionStats): array {
            $article = $articleStats->get($source['key'], []);
            $match = $mentionStats->get($source['key'], []);
            $articleCount = (int) ($article['article_count'] ?? 0);

            return [
                'key' => $source['key'],
                'name' => $source['name'],
                'homepage' => $source['homepage'],
                'status' => $articleCount > 0 ? 'indexed' : 'pending',
                'article_count' => $articleCount,
                'matched_mentions_count' => (int) ($match['matched_mentions_count'] ?? 0),
                'earliest_published_at' => $article['earliest_published_at'] ?? null,
                'latest_published_at' => $article['latest_published_at'] ?? null,
                'latest_match_at' => $match['latest_match_at'] ?? null,
                'last_ingested_at' => $article['last_ingested_at'] ?? null,
            ];
        });

        $allPublishedAt = $articleStats
            ->flatMap(fn (array $stats) => array_filter([
                $stats['earliest_published_at'] ?? null,
                $stats['latest_published_at'] ?? null,
            ]))
            ->sort()
            ->values();

        return response()->json([
            'data' => [
                'summary' => [
                    'configured_sources' => $configuredSources->count(),
                    'indexed_sources' => $sources->where('article_count', '>', 0)->count(),
                    'archive_articles' => $sources->sum('article_count'),
                    'matched_mentions' => $sources->sum('matched_mentions_count'),
                    'archive_window_days' => (int) config('media_sources.archive_lookback_days', 90),
                    'oldest_published_at' => $allPublishedAt->first(),
                    'newest_published_at' => $allPublishedAt->last(),
                ],
                'sources' => $sources->values(),
            ],
        ]);
    }
}
