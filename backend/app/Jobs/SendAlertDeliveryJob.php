<?php

namespace App\Jobs;

use App\Models\AlertDelivery;
use App\Services\MentionAlertService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendAlertDeliveryJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $deliveryId) {}

    public function handle(MentionAlertService $alertService): void
    {
        $delivery = AlertDelivery::query()->find($this->deliveryId);

        if (! $delivery) {
            return;
        }

        $alertService->sendDelivery($delivery);
    }
}
