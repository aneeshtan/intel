<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendTestAlertEmail extends Command
{
    protected $signature = 'alerts:test-email
                            {to : Recipient email address}
                            {--host= : SMTP host (overrides .env)}
                            {--port= : SMTP port (overrides .env)}
                            {--user= : SMTP username (overrides .env)}
                            {--pass= : SMTP password (overrides .env)}
                            {--from= : From address (overrides .env)}
                            {--encryption=tls : Encryption: tls, ssl, or none}';

    protected $description = 'Send a test alert email to verify the mail configuration.';

    public function handle(): int
    {
        $to = (string) $this->argument('to');

        // Allow inline SMTP overrides without touching .env
        if ($host = $this->option('host')) {
            config(['mail.mailers.smtp.host' => $host]);
            config(['mail.mailers.smtp.transport' => 'smtp']);
            config(['mail.default' => 'smtp']);
        }
        if ($port = $this->option('port')) {
            config(['mail.mailers.smtp.port' => (int) $port]);
        }
        if ($user = $this->option('user')) {
            config(['mail.mailers.smtp.username' => $user]);
        }
        if ($pass = $this->option('pass')) {
            config(['mail.mailers.smtp.password' => $pass]);
        }
        if ($from = $this->option('from')) {
            config(['mail.from.address' => $from]);
        }

        $encryption = $this->option('encryption');
        if ($encryption && $encryption !== 'none') {
            config(['mail.mailers.smtp.encryption' => $encryption]);
        } elseif ($encryption === 'none') {
            config(['mail.mailers.smtp.encryption' => null]);
        }

        $mailer = config('mail.default');
        $fromAddress = config('mail.from.address');

        $this->info('');
        $this->line("  <fg=cyan;options=bold>IQX Alert — Email Test</>");
        $this->line('  ────────────────────────────────');
        $this->line("  Mailer  : <fg=yellow>{$mailer}</>");
        $this->line("  From    : <fg=yellow>{$fromAddress}</>");
        $this->line("  To      : <fg=yellow>{$to}</>");
        $this->info('');
        $this->line('  Sending…');

        try {
            Mail::raw(
                $this->buildBody($to),
                function ($message) use ($to, $fromAddress): void {
                    $message
                        ->to($to)
                        ->subject('IQX Intel — Test Alert Email ✓')
                        ->from($fromAddress, config('app.name', 'IQX Intel'));
                }
            );

            $this->info('  <fg=green;options=bold>✓ Email sent successfully!</>');
            $this->line("  Check <fg=yellow>{$to}</> for the test message.");

            if ($mailer === 'log') {
                $this->warn('');
                $this->warn('  Note: MAIL_MAILER=log — the email was written to storage/logs/laravel.log,');
                $this->warn('  not delivered to a real inbox. Set real SMTP credentials to send live.');
            }

        } catch (\Throwable $e) {
            $this->error('  ✗ Failed to send email: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info('');

        return self::SUCCESS;
    }

    private function buildBody(string $to): string
    {
        $now = now()->format('Y-m-d H:i:s T');
        $appName = config('app.name', 'IQX Intel');
        $appUrl = config('app.url', 'http://localhost');

        return <<<TEXT
        Hello,

        This is a test alert email from {$appName}.

        If you received this message, your email alert channel is configured correctly
        and will deliver real-time mention alerts to this address.

        ─────────────────────────────────────────────
        Sent to   : {$to}
        Sent at   : {$now}
        Platform  : {$appName}
        Dashboard : {$appUrl}
        ─────────────────────────────────────────────

        You can safely ignore this message.

        — The {$appName} Team
        TEXT;
    }
}
