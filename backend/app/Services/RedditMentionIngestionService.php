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

class RedditMentionIngestionService
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

        $lookbackDays ??= (int) config('reddit.lookback_days', 90);
        $since = now()->subDays($lookbackDays)->startOfDay();

        $keywords = $singleKeyword
            ? collect([$singleKeyword])
            : $project->trackedKeywords()
                ->where('is_active', true)
                ->whereIn('platform', ['all', 'reddit'])
                ->get();

        if ($keywords->isEmpty()) {
            return 0;
        }

        $inserted = 0;

        foreach ($keywords as $keyword) {
            if (! $force && $this->projectKeywordRecentlySynced($project, $keyword)) {
                continue;
            }

            foreach ($this->searchKeyword($keyword->keyword, $since) as $post) {
                if (! $this->matchesKeyword($keyword, trim($post['title'].' '.$post['body']))) {
                    continue;
                }

                if ($this->isMutedForProject($project, 'reddit.com', $post['author'])) {
                    continue;
                }

                $mention = Mention::query()->firstOrCreate(
                    [
                        'source' => 'reddit',
                        'external_id' => sha1(implode('|', [
                            $project->id,
                            $keyword->id,
                            $post['id'],
                        ])),
                    ],
                    [
                        'project_id' => $project->id,
                        'tracked_keyword_id' => $keyword->id,
                        'author_name' => $post['author'],
                        'url' => $post['url'],
                        'title' => $post['title'],
                        'body' => $post['body'],
                        'sentiment' => 'neutral',
                        'published_at' => $post['published_at'],
                        'metadata' => [
                            'source_name' => 'reddit.com',
                            'source_domain' => 'reddit.com',
                            'subreddit' => $post['subreddit'],
                            'score' => $post['score'],
                            'num_comments' => $post['num_comments'],
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
        $token = $this->accessToken();

        if (! $token || trim($keyword) === '') {
            return collect();
        }

        $results = collect();
        $after = null;
        $maxPages = (int) config('reddit.max_pages', 3);
        $limit = min(100, max(1, (int) config('reddit.results_per_page', 25)));

        for ($page = 0; $page < $maxPages; $page++) {
            try {
                $response = $this->oauthClient($token)->get('https://oauth.reddit.com/search', [
                    'q' => $keyword,
                    'sort' => 'new',
                    'type' => 'link',
                    't' => 'all',
                    'limit' => $limit,
                    'restrict_sr' => false,
                    'after' => $after,
                ]);
            } catch (\Throwable $exception) {
                Log::warning('Reddit search failed.', [
                    'keyword' => $keyword,
                    'message' => $exception->getMessage(),
                ]);

                break;
            }

            if (! $response->successful()) {
                break;
            }

            $payload = $response->json();
            $children = collect(data_get($payload, 'data.children', []));

            if ($children->isEmpty()) {
                break;
            }

            $batch = $children
                ->map(fn (array $child) => $this->normalizePost($child['data'] ?? []))
                ->filter()
                ->filter(fn (array $post) => ! $post['published_at'] || $post['published_at']->gte($since))
                ->values();

            $results = $results->merge($batch);
            $after = data_get($payload, 'data.after');

            if (! $after) {
                break;
            }
        }

        return $results->unique('id')->values();
    }

    private function normalizePost(array $post): ?array
    {
        $title = trim((string) ($post['title'] ?? ''));
        $body = trim((string) ($post['selftext'] ?? ''));

        if ($title === '' && $body === '') {
            return null;
        }

        $permalink = (string) ($post['permalink'] ?? '');

        return [
            'id' => (string) ($post['id'] ?? ''),
            'title' => $title ?: 'Untitled Reddit post',
            'body' => $body ?: $title,
            'author' => (string) ($post['author'] ?? 'reddit user'),
            'subreddit' => (string) ($post['subreddit'] ?? ''),
            'score' => (int) ($post['score'] ?? 0),
            'num_comments' => (int) ($post['num_comments'] ?? 0),
            'url' => $permalink !== '' ? 'https://www.reddit.com'.$permalink : null,
            'published_at' => isset($post['created_utc'])
                ? Carbon::createFromTimestampUTC((int) $post['created_utc'])
                : null,
        ];
    }

    private function accessToken(): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        return Cache::remember('reddit-access-token', now()->addMinutes(50), function (): ?string {
            try {
                $response = Http::asForm()
                    ->timeout((int) config('reddit.timeout_seconds', 12))
                    ->connectTimeout((int) config('reddit.connect_timeout_seconds', 4))
                    ->withBasicAuth(
                        (string) config('reddit.client_id'),
                        (string) config('reddit.client_secret'),
                    )
                    ->withUserAgent((string) config('reddit.user_agent'))
                    ->post('https://www.reddit.com/api/v1/access_token', [
                        'grant_type' => 'client_credentials',
                    ]);
            } catch (\Throwable $exception) {
                Log::warning('Reddit access token request failed.', [
                    'message' => $exception->getMessage(),
                ]);

                return null;
            }

            if (! $response->successful()) {
                Log::warning('Reddit access token request was unsuccessful.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            return $response->json('access_token');
        });
    }

    private function oauthClient(string $token)
    {
        return Http::timeout((int) config('reddit.timeout_seconds', 12))
            ->connectTimeout((int) config('reddit.connect_timeout_seconds', 4))
            ->withUserAgent((string) config('reddit.user_agent'))
            ->withToken($token);
    }

    private function isConfigured(): bool
    {
        return (string) config('reddit.client_id') !== ''
            && (string) config('reddit.client_secret') !== '';
    }

    private function projectKeywordRecentlySynced(Project $project, TrackedKeyword $keyword): bool
    {
        $ttlMinutes = (int) config('reddit.sync_ttl_minutes', 15);
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
            now()->addMinutes((int) config('reddit.sync_ttl_minutes', 15)),
        );
    }

    private function projectKeywordSyncKey(Project $project, TrackedKeyword $keyword): string
    {
        return "reddit-sync:project:{$project->id}:keyword:{$keyword->id}";
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

    private function isMutedForProject(Project $project, string $domain, ?string $author): bool
    {
        $muted = $project->mutedEntities()->get(['kind', 'value']);
        $normalizedDomain = $this->normalizeValue($domain);
        $normalizedAuthor = $this->normalizeValue($author);

        return $muted->contains(fn (MutedEntity $item) => $item->kind === 'source' && $item->value === $normalizedDomain)
            || ($normalizedAuthor !== ''
                && $muted->contains(fn (MutedEntity $item) => $item->kind === 'author' && $item->value === $normalizedAuthor));
    }

    private function normalizeValue(?string $value): string
    {
        $value = trim(mb_strtolower((string) $value));

        return preg_replace('/^www\./', '', $value) ?? $value;
    }
}
