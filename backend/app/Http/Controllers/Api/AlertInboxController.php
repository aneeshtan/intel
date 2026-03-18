<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertDelivery;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertInboxController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $deliveries = $user->alertDeliveries()
            ->whereHas('alertChannel', fn ($query) => $query->where('type', 'in_app'))
            ->where('status', 'sent')
            ->with(['alertChannel', 'alertRule.project', 'mention.trackedKeyword'])
            ->latest('created_at')
            ->limit((int) config('alerts.inbox_page_size', 50))
            ->get();

        return response()->json([
            'data' => $deliveries->map(fn (AlertDelivery $delivery): array => $this->serializeDelivery($delivery))->values(),
        ]);
    }

    public function markRead(AlertDelivery $alertDelivery): JsonResponse
    {
        $this->ensureOwnership($alertDelivery);

        $alertDelivery->forceFill([
            'read_at' => $alertDelivery->read_at ?? now(),
        ])->save();

        return response()->json([
            'data' => $this->serializeDelivery($alertDelivery->fresh(['alertChannel', 'alertRule.project', 'mention.trackedKeyword'])),
        ]);
    }

    private function ensureOwnership(AlertDelivery $alertDelivery): void
    {
        abort_unless($alertDelivery->user_id === request()->user()->id, 404);
    }

    private function serializeDelivery(AlertDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'status' => $delivery->status,
            'frequency' => $delivery->frequency,
            'subject' => $delivery->subject,
            'body' => $delivery->body,
            'payload' => $delivery->payload ?? [],
            'delivered_at' => optional($delivery->delivered_at)?->toIso8601String(),
            'read_at' => optional($delivery->read_at)?->toIso8601String(),
            'channel' => $delivery->alertChannel ? [
                'id' => $delivery->alertChannel->id,
                'type' => $delivery->alertChannel->type,
                'name' => $delivery->alertChannel->name,
            ] : null,
            'rule' => $delivery->alertRule ? [
                'id' => $delivery->alertRule->id,
                'name' => $delivery->alertRule->name,
                'project_id' => $delivery->alertRule->project_id,
                'project_name' => optional($delivery->alertRule->project)->name,
            ] : null,
            'mention' => $delivery->mention ? [
                'id' => $delivery->mention->id,
                'title' => $delivery->mention->title,
                'source' => $delivery->mention->source,
                'url' => $delivery->mention->url,
                'published_at' => optional($delivery->mention->published_at)?->toIso8601String(),
                'tracked_keyword' => $delivery->mention->trackedKeyword ? [
                    'id' => $delivery->mention->trackedKeyword->id,
                    'keyword' => $delivery->mention->trackedKeyword->keyword,
                ] : null,
            ] : null,
        ];
    }
}
