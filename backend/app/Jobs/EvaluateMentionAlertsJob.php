<?php

namespace App\Jobs;

use App\Models\Mention;
use App\Services\MentionAlertService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class EvaluateMentionAlertsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $mentionId) {}

    public function handle(MentionAlertService $alertService): void
    {
        $mention = Mention::query()->find($this->mentionId);

        if (! $mention) {
            return;
        }

        $alertService->queueDeliveriesForMention($mention);
    }
}
