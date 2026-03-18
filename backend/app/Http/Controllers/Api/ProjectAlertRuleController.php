<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertChannel;
use App\Models\AlertRule;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectAlertRuleController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $this->ensureOwnership($project);

        return response()->json([
            'data' => $project->alertRules()
                ->with('channels')
                ->latest()
                ->get()
                ->map(fn (AlertRule $rule): array => $this->serializeRule($rule))
                ->values(),
        ]);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $this->ensureOwnership($project);
        $validated = $this->validatePayload($request, $project);

        $rule = $project->alertRules()->create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'is_active' => $validated['is_active'] ?? true,
            'frequency' => $validated['frequency'] ?? config('alerts.default_frequency', 'instant'),
            'sentiment' => $validated['sentiment'] ?? null,
            'min_reach' => $validated['min_reach'] ?? null,
            'source_filters' => $validated['source_filters'] ?? [],
            'tracked_keyword_ids' => $validated['tracked_keyword_ids'] ?? [],
        ]);

        $rule->channels()->sync($validated['channel_ids']);

        return response()->json([
            'data' => $this->serializeRule($rule->load('channels')),
        ], 201);
    }

    public function update(Request $request, Project $project, AlertRule $alertRule): JsonResponse
    {
        $this->ensureRuleOwnership($project, $alertRule);
        $validated = $this->validatePayload($request, $project, true);

        $alertRule->update([
            'name' => $validated['name'] ?? $alertRule->name,
            'is_active' => $validated['is_active'] ?? $alertRule->is_active,
            'frequency' => $validated['frequency'] ?? $alertRule->frequency,
            'sentiment' => array_key_exists('sentiment', $validated)
                ? $validated['sentiment']
                : $alertRule->sentiment,
            'min_reach' => array_key_exists('min_reach', $validated)
                ? $validated['min_reach']
                : $alertRule->min_reach,
            'source_filters' => $validated['source_filters'] ?? $alertRule->source_filters,
            'tracked_keyword_ids' => $validated['tracked_keyword_ids'] ?? $alertRule->tracked_keyword_ids,
        ]);

        if (array_key_exists('channel_ids', $validated)) {
            $alertRule->channels()->sync($validated['channel_ids']);
        }

        return response()->json([
            'data' => $this->serializeRule($alertRule->fresh()->load('channels')),
        ]);
    }

    public function destroy(Project $project, AlertRule $alertRule): JsonResponse
    {
        $this->ensureRuleOwnership($project, $alertRule);
        $alertRule->delete();

        return response()->json([
            'message' => 'Alert rule deleted successfully.',
        ]);
    }

    private function validatePayload(Request $request, Project $project, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];
        $validated = $request->validate([
            'name' => [...$required, 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'frequency' => ['nullable', 'string', Rule::in(['instant', 'hourly', 'daily'])],
            'sentiment' => ['nullable', 'string', Rule::in(['positive', 'neutral', 'negative'])],
            'min_reach' => ['nullable', 'integer', 'min:0'],
            'source_filters' => ['nullable', 'array'],
            'source_filters.*' => ['string', 'max:32'],
            'tracked_keyword_ids' => ['nullable', 'array'],
            'tracked_keyword_ids.*' => ['integer'],
            'channel_ids' => [...$required, 'array', 'min:1'],
            'channel_ids.*' => ['integer'],
        ]);

        $validKeywordIds = $project->trackedKeywords()->pluck('id')->all();
        $keywordIds = array_values(array_unique($validated['tracked_keyword_ids'] ?? []));

        foreach ($keywordIds as $keywordId) {
            abort_unless(in_array($keywordId, $validKeywordIds, true), 422, 'Tracked keyword selection is invalid.');
        }

        $channelIds = array_values(array_unique($validated['channel_ids'] ?? []));
        $ownedChannelIds = AlertChannel::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('id', $channelIds)
            ->pluck('id')
            ->all();

        abort_unless(count($ownedChannelIds) === count($channelIds), 422, 'Alert channel selection is invalid.');

        $validated['tracked_keyword_ids'] = $keywordIds;
        $validated['channel_ids'] = $channelIds;

        return $validated;
    }

    private function ensureOwnership(Project $project): void
    {
        abort_unless($project->user_id === request()->user()->id, 404);
    }

    private function ensureRuleOwnership(Project $project, AlertRule $alertRule): void
    {
        $this->ensureOwnership($project);

        abort_unless(
            $alertRule->project_id === $project->id && $alertRule->user_id === request()->user()->id,
            404,
        );
    }

    private function serializeRule(AlertRule $rule): array
    {
        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'is_active' => $rule->is_active,
            'frequency' => $rule->frequency,
            'sentiment' => $rule->sentiment,
            'min_reach' => $rule->min_reach,
            'source_filters' => $rule->source_filters ?? [],
            'tracked_keyword_ids' => $rule->tracked_keyword_ids ?? [],
            'channels' => $rule->channels->map(fn (AlertChannel $channel): array => [
                'id' => $channel->id,
                'name' => $channel->name,
                'type' => $channel->type,
                'is_active' => $channel->is_active,
            ])->values(),
            'created_at' => optional($rule->created_at)?->toIso8601String(),
        ];
    }
}
