<?php

namespace App\Services;

use App\Models\Mention;
use App\Models\MutedEntity;
use App\Models\Project;
use App\Models\TrackedKeyword;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class XMentionIngestionService
{
    public function ingestProject(
        Project $project,
        ?TrackedKeyword $singleKeyword = null,
        bool $force = false,
        ?int $lookbackDays = null
    ): int {
        if (! $this->isConfigured()) {
            return 0;
        }

        $configuredLookback = (int) config('x.lookback_days', 7);
        $lookbackDays = min(7, max(1, $lookbackDays ?? $configuredLookback));
        $since = now()->subDays($lookbackDays)->startOfDay();

        $keywords = $singleKeyword
            ? collect([$singleKeyword])
            : $project->trackedKeywords()
                ->where('is_active', true)
                ->whereIn('platform', ['all', 'x'])
                ->get();

        if ($keywords->isEmpty()) {
            return 0;
        }

        $inserted = 0;

        foreach ($keywords as $keyword) {
            if (! $force && $this->projectKeywordRecentlySynced($project, $keyword)) {
                continue;
            }

            foreach ($this->searchKeyword($keyword->keyword, $since) as $tweet) {
                if (! $this->matchesKeyword($keyword, trim($tweet['title'].' '.$tweet['body']))) {
                    continue;
                }

                if ($this->isMutedForProject($project, 'x.com', $tweet['author'])) {
                    continue;
                }

                $mention = Mention::query()->firstOrCreate(
                    [
                        'source' => 'x',
                        'external_id' => sha1(implode('|', [
                            $project->id,
                            $keyword->id,
                            $tweet['id'],
                        ])),
                    ],
                    [
                        'project_id' => $project->id,
                        'tracked_keyword_id' => $keyword->id,
                        'author_name' => $tweet['author'],
                        'url' => $tweet['url'],
                        'title' => $tweet['title'],
                        'body' => $tweet['body'],
                        'sentiment' => 'neutral',
                        'published_at' => $tweet['published_at'],
                        'metadata' => [
                            'source_name' => 'x.com',
                            'source_domain' => 'x.com',
                            'username' => $tweet['author'],
                            'score' => $tweet['score'],
                            'num_comments' => $tweet['reply_count'],
                            'like_count' => $tweet['like_count'],
                            'reply_count' => $tweet['reply_count'],
                            'repost_count' => $tweet['repost_count'],
                            'quote_count' => $tweet['quote_count'],
                            'demo' => false,
                        ],
                    ],
                );

                if ($mention->wasRecentlyCreated) {
                    $inserted++;
                }
            }

            $this->markProjectKeywordSynced($project, $keyword);
        }

        return $inserted;
    }

    private function searchKeyword(string $keyword, Carbon $since): Collection
    {
        if (trim($keyword) === '') {
            return collect();
        }

        $results = collect();
        $nextToken = null;
        $maxPages = (int) config('x.max_pages', 3);
        $maxResults = min(100, max(10, (int) config('x.max_results', 25)));

        for ($page = 0; $page < $maxPages; $page++) {
            try {
                $response = $this->client()->get('https://api.x.com/2/tweets/search/recent', array_filter([
                    'query' => $keyword.' -is:retweet lang:en',
                    'max_results' => $maxResults,
                    'sort_order' => 'recency',
                    'tweet.fields' => 'created_at,author_id,public_metrics,text',
                    'expansions' => 'author_id',
                    'user.fields' => 'username,name',
                    'next_token' => $nextToken,
                    'start_time' => $since->toIso8601String(),
                ], fn ($value) => $value !== null));
            } catch (\Throwable $exception) {
                Log::warning('X search failed.', [
                    'keyword' => $keyword,
                    'message' => $exception->getMessage(),
                ]);

                break;
            }

            if (! $response->successful()) {
                Log::warning('X search request was unsuccessful.', [
                    'keyword' => $keyword,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                break;
            }

            $payload = $response->json();
            $users = collect(data_get($payload, 'includes.users', []))
                ->keyBy('id');
            $data = collect(data_get($payload, 'data', []));

            if ($data->isEmpty()) {
                break;
            }

            $batch = $data
                ->map(fn (array $tweet) => $this->normalizeTweet($tweet, $users))
                ->filter()
                ->filter(fn (array $tweet) => ! $tweet['published_at'] || $tweet['published_at']->gte($since))
                ->values();

            $results = $results->merge($batch);
            $nextToken = data_get($payload, 'meta.next_token');

            if (! $nextToken) {
                break;
            }
        }

        return $results->unique('id')->values();
    }

    private function normalizeTweet(array $tweet, Collection $users): ?array
    {
        $id = (string) ($tweet['id'] ?? '');
        $text = trim((string) ($tweet['text'] ?? ''));

        if ($id === '' || $text === '') {
            return null;
        }

        $user = $users->get((string) ($tweet['author_id'] ?? ''));
        $username = trim((string) data_get($user, 'username', 'x user'));
        $metrics = data_get($tweet, 'public_metrics', []);
        $title = mb_strimwidth($text, 0, 120, '...');

        return [
            'id' => $id,
            'title' => $title !== '' ? $title : 'Untitled X post',
            'body' => $text,
            'author' => $username !== '' ? '@'.$username : 'x user',
            'url' => $username !== '' ? "https://x.com/{$username}/status/{$id}" : "https://x.com/i/web/status/{$id}",
            'published_at' => isset($tweet['created_at']) ? Carbon::parse($tweet['created_at']) : null,
            'like_count' => (int) data_get($metrics, 'like_count', 0),
            'reply_count' => (int) data_get($metrics, 'reply_count', 0),
            'repost_count' => (int) data_get($metrics, 'retweet_count', 0),
            'quote_count' => (int) data_get($metrics, 'quote_count', 0),
            'score' => (int) data_get($metrics, 'like_count', 0)
                + (int) data_get($metrics, 'retweet_count', 0)
                + (int) data_get($metrics, 'quote_count', 0),
        ];
    }

    private function client()
    {
        return Http::timeout((int) config('x.timeout_seconds', 12))
            ->connectTimeout((int) config('x.connect_timeout_seconds', 4))
            ->withToken((string) config('x.bearer_token'));
    }

    private function isConfigured(): bool
    {
        return trim((string) config('x.bearer_token')) !== '';
    }

    private function projectKeywordRecentlySynced(Project $project, TrackedKeyword $keyword): bool
    {
        $ttlMinutes = (int) config('x.sync_ttl_minutes', 15);
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
            now()->addMinutes((int) config('x.sync_ttl_minutes', 15)),
        );
    }

    private function projectKeywordSyncKey(Project $project, TrackedKeyword $keyword): string
    {
        return "x-sync:project:{$project->id}:keyword:{$keyword->id}";
    }

    private function isMutedForProject(Project $project, string $domain, ?string $author): bool
    {
        $mutedSource = MutedEntity::query()
            ->where('project_id', $project->id)
            ->where('type', 'source')
            ->where('value', $domain)
            ->exists();

        if ($mutedSource) {
            return true;
        }

        if (! $author) {
            return false;
        }

        return MutedEntity::query()
            ->where('project_id', $project->id)
            ->where('type', 'author')
            ->where('value', $author)
            ->exists();
    }

    private function matchesKeyword(TrackedKeyword $keyword, string $value): bool
    {
        $needle = mb_strtolower(trim($keyword->keyword));
        $haystack = mb_strtolower($value);

        if ($needle === '') {
            return false;
        }

        return match ($keyword->match_type) {
            'exact' => $haystack === $needle,
            'boolean' => collect(preg_split('/\s+/', $needle) ?: [])
                ->filter()
                ->every(fn (string $token) => str_contains($haystack, $token)),
            default => str_contains($haystack, $needle),
        };
    }
}
