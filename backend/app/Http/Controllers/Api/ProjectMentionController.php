<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class ProjectMentionController extends Controller
{
    public function update(Project $project, Mention $mention): JsonResponse
    {
        $this->ensureOwnership($project);
        abort_unless($mention->project_id === $project->id, 404);

        $validated = request()->validate([
            'sentiment' => ['required', 'string', Rule::in(['auto', 'positive', 'neutral', 'negative'])],
        ]);

        $metadata = (array) ($mention->metadata ?? []);
        $currentSentiment = $mention->sentiment ?: 'neutral';

        if ($validated['sentiment'] === 'auto') {
            $mention->forceFill([
                'sentiment' => $metadata['original_sentiment'] ?? $currentSentiment,
                'metadata' => array_filter([
                    ...$metadata,
                    'sentiment_source' => 'system',
                    'manual_sentiment' => null,
                    'manual_sentiment_updated_at' => null,
                ], static fn ($value, string $key): bool => ! in_array($key, [
                    'manual_sentiment',
                    'manual_sentiment_updated_at',
                ], true) || $value !== null, ARRAY_FILTER_USE_BOTH),
            ])->save();
        } else {
            if (($metadata['sentiment_source'] ?? 'system') !== 'manual' && ! array_key_exists('original_sentiment', $metadata)) {
                $metadata['original_sentiment'] = $currentSentiment;
            }

            $mention->forceFill([
                'sentiment' => $validated['sentiment'],
                'metadata' => [
                    ...$metadata,
                    'sentiment_source' => 'manual',
                    'manual_sentiment' => $validated['sentiment'],
                    'manual_sentiment_updated_at' => now()->toIso8601String(),
                ],
            ])->save();
        }

        return response()->json([
            'message' => $validated['sentiment'] === 'auto'
                ? 'Sentiment reset to the system value.'
                : 'Sentiment updated successfully.',
            'data' => $mention->fresh()->load('trackedKeyword:id,keyword'),
        ]);
    }

    private function ensureOwnership(Project $project): void
    {
        abort_unless($project->user_id === request()->user()->id, 404);
    }
}
