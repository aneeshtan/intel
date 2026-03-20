<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MutedEntity;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class ProjectListeningController extends Controller
{
    public function muteSource(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        $domain = $this->normalize(request()->string('domain')->toString());
        abort_if($domain === '', 422, 'A source domain is required.');

        $project->mutedEntities()->firstOrCreate([
            'kind' => 'source',
            'value' => $domain,
        ]);

        return response()->json([
            'message' => "Source {$domain} muted successfully.",
        ]);
    }

    public function unmuteSource(Project $project, string $domain): JsonResponse
    {
        $this->ensureOwnership($project);

        $project->mutedEntities()
            ->where('kind', 'source')
            ->where('value', $this->normalize($domain))
            ->delete();

        return response()->json([
            'message' => "Source {$domain} unmuted successfully.",
        ]);
    }

    public function muteInfluencer(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        $author = $this->normalize(request()->string('author')->toString());
        abort_if($author === '', 422, 'An influencer name is required.');

        $project->mutedEntities()->firstOrCreate([
            'kind' => 'author',
            'value' => $author,
        ]);

        return response()->json([
            'message' => "Influencer {$author} muted successfully.",
        ]);
    }

    public function unmuteInfluencer(Project $project, string $author): JsonResponse
    {
        $this->ensureOwnership($project);

        $project->mutedEntities()
            ->where('kind', 'author')
            ->where('value', $this->normalize($author))
            ->delete();

        return response()->json([
            'message' => "Influencer {$author} unmuted successfully.",
        ]);
    }

    public static function summarizeProject(Project $project): array
    {
        $mentions = $project->mentions()
            ->with('trackedKeyword:id,keyword')
            ->latest('published_at')
            ->get();
        $activeMentions = $mentions
            ->filter(function ($mention): bool {
                $metadata = (array) ($mention->metadata ?? []);

                return ! ((bool) ($metadata['excluded'] ?? false));
            })
            ->values();

        $muted = $project->mutedEntities()->get(['kind', 'value']);
        $mutedSources = $muted->where('kind', 'source')->pluck('value')->values();
        $mutedAuthors = $muted->where('kind', 'author')->pluck('value')->values();

        $visibleMentions = $activeMentions->filter(function ($mention) use ($mutedSources, $mutedAuthors): bool {
            $sourceDomain = self::extractSourceDomain($mention);
            $author = self::normalize($mention->author_name);

            return ! $mutedSources->contains($sourceDomain)
                && ! ($author !== '' && $mutedAuthors->contains($author));
        })->values();

        return [
            'mentions' => $visibleMentions->take(20)->values(),
            'mentions_count' => $visibleMentions->count(),
            'source_groups' => self::groupSources($activeMentions, $mutedSources),
            'influencer_groups' => self::groupInfluencers($activeMentions, $mutedAuthors),
            'muted_sources' => $mutedSources,
            'muted_authors' => $mutedAuthors,
        ];
    }

    private static function groupSources(Collection $mentions, Collection $mutedSources): Collection
    {
        return $mentions
            ->groupBy(fn ($mention) => self::extractSourceDomain($mention) ?: 'unknown')
            ->map(function (Collection $group, string $domain) use ($mutedSources): array {
                $firstMention = $group->first();
                $metadata = (array) ($firstMention->metadata ?? []);

                return [
                    'domain' => $domain,
                    'label' => $metadata['source_name']
                        ?? $firstMention->source
                        ?? $domain,
                    'mentions_count' => $group->count(),
                    'estimated_reach' => $group->sum(fn ($mention) => self::estimateReach($mention)),
                    'latest_published_at' => optional(
                        $group->pluck('published_at')->filter()->sortDesc()->first()
                    )?->toIso8601String(),
                    'latest_title' => $group->first()->title,
                    'muted' => $mutedSources->contains($domain),
                ];
            })
            ->sortByDesc('mentions_count')
            ->values();
    }

    private static function groupInfluencers(Collection $mentions, Collection $mutedAuthors): Collection
    {
        return $mentions
            ->filter(fn ($mention) => self::normalize($mention->author_name) !== '')
            ->groupBy(fn ($mention) => self::normalize($mention->author_name))
            ->map(function (Collection $group, string $author) use ($mutedAuthors): array {
                $firstMention = $group->first();
                $metadata = (array) ($firstMention->metadata ?? []);

                return [
                    'author' => $author,
                    'source' => $metadata['source_name']
                        ?? $firstMention->source
                        ?? 'unknown',
                    'mentions_count' => $group->count(),
                    'estimated_reach' => $group->sum(fn ($mention) => self::estimateReach($mention)),
                    'latest_published_at' => optional(
                        $group->pluck('published_at')->filter()->sortDesc()->first()
                    )?->toIso8601String(),
                    'latest_title' => $group->first()->title,
                    'muted' => $mutedAuthors->contains($author),
                ];
            })
            ->sortByDesc('estimated_reach')
            ->values();
    }

    private static function extractSourceDomain($mention): string
    {
        $metadata = (array) ($mention->metadata ?? []);

        $candidate = $metadata['source_domain']
            ?? parse_url((string) $mention->url, PHP_URL_HOST)
            ?? parse_url((string) ($metadata['source_url'] ?? ''), PHP_URL_HOST)
            ?? '';

        return self::normalize((string) $candidate);
    }

    private static function normalize(?string $value): string
    {
        $value = trim(mb_strtolower((string) $value));

        return preg_replace('/^www\./', '', $value) ?? $value;
    }

    private static function estimateReach($mention): int
    {
        $metadata = (array) ($mention->metadata ?? []);
        $source = self::normalize(
            $metadata['source_name']
            ?? $mention->source
            ?? ''
        );

        $base = str_contains($source, 'linkedin')
            ? 18000
            : (str_contains($source, 'reddit')
                ? 12000
                : ((str_contains($source, 'x') || str_contains($source, 'twitter'))
                    ? 22000
                    : (str_contains($source, 'facebook')
                        ? 16000
                        : (str_contains($source, 'tiktok') ? 28000 : 42000))));

        $multiplier = $mention->sentiment === 'positive'
            ? 1.1
            : ($mention->sentiment === 'negative' ? 1.2 : 1.0);

        return (int) round($base * $multiplier + min(mb_strlen((string) $mention->body) * 12, 8000));
    }

    private function ensureOwnership(Project $project): void
    {
        abort_unless($project->user_id === request()->user()->id, 404);
    }
}
