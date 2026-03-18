<?php

namespace App\Console\Commands;

use App\Services\MentionAlertService;
use Illuminate\Console\Command;

class SendAlertDigests extends Command
{
    protected $signature = 'alerts:send-digests {frequency=hourly}';

    protected $description = 'Send grouped alert digests for pending hourly or daily rules.';

    public function handle(MentionAlertService $alertService): int
    {
        $frequency = (string) $this->argument('frequency');

        if (! in_array($frequency, ['hourly', 'daily'], true)) {
            $this->error('Frequency must be hourly or daily.');

            return self::FAILURE;
        }

        $sent = $alertService->processDigest($frequency);

        $this->info("Alert digests processed: {$sent} group(s) sent.");

        return self::SUCCESS;
    }
}
