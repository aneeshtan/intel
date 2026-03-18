<?php

namespace App\Services;

use App\Jobs\SendAlertDeliveryJob;
use App\Models\AlertChannel;
use App\Models\AlertDelivery;
use App\Models\AlertRule;
use App\Models\Mention;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class MentionAlertService
{
    public function queueDeliveriesForMention(Mention $mention): int
    {
        $mention->loadMissing(['project.user', 'trackedKeyword']);

        if ($this->shouldSkipMention($mention) || ! $mention->project || ! $mention->project->user) {
            return 0;
        }

        $reach = $this->estimateReach($mention);
        $inserted = 0;
        $rules = AlertRule::query()
            ->where('project_id', $mention->project_id)
            ->where('user_id', $mention->project->user_id)
            ->where('is_active', true)
            ->with(['channels' => fn ($query) => $query->where('is_active', true)])
            ->get();

        foreach ($rules as $rule) {
            if (! $this->ruleMatchesMention($rule, $mention, $reach)) {
                continue;
            }

            foreach ($rule->channels as $channel) {
                $frequency = $channel->type === AlertChannel::TYPE_IN_APP ? 'instant' : $rule->frequency;
                $delivery = AlertDelivery::query()->firstOrCreate(
                    [
                        'alert_rule_id' => $rule->id,
                        'alert_channel_id' => $channel->id,
                        'mention_id' => $mention->id,
                    ],
                    [
                        'user_id' => $rule->user_id,
                        'status' => $frequency === 'instant' ? 'queued' : 'pending',
                        'frequency' => $frequency,
                        'payload' => [
                            'estimated_reach' => $reach,
                            'source_name' => $mention->metadata['source_name'] ?? $mention->source,
                        ],
                    ],
                );

                if (! $delivery->wasRecentlyCreated) {
                    continue;
                }

                $inserted++;

                if ($frequency === 'instant') {
                    SendAlertDeliveryJob::dispatch($delivery->id)->afterCommit();
                }
            }
        }

        return $inserted;
    }

    public function processDigest(string $frequency): int
    {
        $groups = AlertDelivery::query()
            ->where('status', 'pending')
            ->where('frequency', $frequency)
            ->with(['alertChannel', 'alertRule.project', 'mention.trackedKeyword'])
            ->get()
            ->groupBy(fn (AlertDelivery $delivery): string => $delivery->alert_rule_id.'|'.$delivery->alert_channel_id);

        $sent = 0;

        foreach ($groups as $deliveries) {
            $delivery = $deliveries->first();

            if (! $delivery || ! $delivery->alertChannel || ! $delivery->alertRule) {
                continue;
            }

            [$subject, $body] = $this->formatDigestMessage($delivery->alertRule, $deliveries, $frequency);

            try {
                $this->deliverToChannel(
                    $delivery->alertChannel,
                    $subject,
                    $body,
                    $this->buildDigestPayload($delivery->alertRule, $deliveries, $frequency),
                );

                AlertDelivery::query()
                    ->whereKey($deliveries->pluck('id'))
                    ->update([
                        'status' => 'sent',
                        'subject' => $subject,
                        'body' => $body,
                        'delivered_at' => now(),
                        'error_message' => null,
                    ]);

                $sent++;
            } catch (\Throwable $exception) {
                Log::warning('Alert digest delivery failed.', [
                    'rule_id' => $delivery->alert_rule_id,
                    'channel_id' => $delivery->alert_channel_id,
                    'message' => $exception->getMessage(),
                ]);

                AlertDelivery::query()
                    ->whereKey($deliveries->pluck('id'))
                    ->update([
                        'status' => 'failed',
                        'error_message' => $exception->getMessage(),
                    ]);
            }
        }

        return $sent;
    }

    public function sendDelivery(AlertDelivery $delivery): void
    {
        $delivery->loadMissing(['alertChannel', 'alertRule.project', 'mention.trackedKeyword', 'user']);

        if (! $delivery->alertChannel) {
            $delivery->forceFill([
                'status' => 'failed',
                'error_message' => 'Alert channel is missing.',
            ])->save();

            return;
        }

        [$subject, $body] = $this->formatMentionMessage($delivery->mention, $delivery->alertRule);

        try {
            $this->deliverToChannel(
                $delivery->alertChannel,
                $subject,
                $body,
                $this->buildMentionPayload($delivery),
            );

            $delivery->forceFill([
                'status' => 'sent',
                'subject' => $subject,
                'body' => $body,
                'delivered_at' => now(),
                'error_message' => null,
            ])->save();
        } catch (\Throwable $exception) {
            Log::warning('Alert delivery failed.', [
                'delivery_id' => $delivery->id,
                'channel_type' => $delivery->alertChannel->type,
                'message' => $exception->getMessage(),
            ]);

            $delivery->forceFill([
                'status' => 'failed',
                'subject' => $subject,
                'body' => $body,
                'error_message' => $exception->getMessage(),
            ])->save();
        }
    }

    private function shouldSkipMention(Mention $mention): bool
    {
        if (($mention->metadata['demo'] ?? false) === true) {
            return true;
        }

        if (! $mention->published_at) {
            return false;
        }

        return $mention->published_at->lt(
            now()->subHours((int) config('alerts.recent_mention_window_hours', 24))
        );
    }

    private function ruleMatchesMention(AlertRule $rule, Mention $mention, int $reach): bool
    {
        if ($rule->sentiment && $rule->sentiment !== $mention->sentiment) {
            return false;
        }

        if ($rule->min_reach !== null && $reach < $rule->min_reach) {
            return false;
        }

        $sourceFilters = collect($rule->source_filters ?? [])
            ->filter()
            ->map(fn ($value) => mb_strtolower((string) $value))
            ->values();

        if ($sourceFilters->isNotEmpty() && ! $sourceFilters->contains(mb_strtolower($mention->source))) {
            return false;
        }

        $trackedKeywordIds = collect($rule->tracked_keyword_ids ?? [])->filter()->map(fn ($value) => (int) $value);

        if ($trackedKeywordIds->isNotEmpty() && ! $trackedKeywordIds->contains((int) $mention->tracked_keyword_id)) {
            return false;
        }

        return true;
    }

    private function deliverToChannel(
        AlertChannel $channel,
        string $subject,
        string $body,
        array $payload
    ): void {
        match ($channel->type) {
            AlertChannel::TYPE_IN_APP => null,
            AlertChannel::TYPE_EMAIL => $this->sendEmail($channel, $subject, $body),
            AlertChannel::TYPE_SLACK => $this->sendWebhook(
                $this->requireDestination($channel),
                ['text' => "{$subject}\n{$body}"]
            ),
            AlertChannel::TYPE_TEAMS => $this->sendWebhook(
                $this->requireDestination($channel),
                [
                    '@type' => 'MessageCard',
                    '@context' => 'https://schema.org/extensions',
                    'summary' => $subject,
                    'themeColor' => '0F172A',
                    'title' => $subject,
                    'text' => nl2br(e($body)),
                ]
            ),
            AlertChannel::TYPE_DISCORD => $this->sendWebhook(
                $this->requireDestination($channel),
                ['content' => "{$subject}\n{$body}"]
            ),
            AlertChannel::TYPE_TELEGRAM => $this->sendTelegram($channel, "{$subject}\n\n{$body}"),
            AlertChannel::TYPE_WEBHOOK => $this->sendWebhook($this->requireDestination($channel), $payload),
            AlertChannel::TYPE_SMS => $this->sendTwilioMessage($channel, $body, false),
            AlertChannel::TYPE_WHATSAPP => $this->sendTwilioMessage($channel, $body, true),
            default => throw new \RuntimeException("Unsupported alert channel type [{$channel->type}]."),
        };
    }

    private function sendEmail(AlertChannel $channel, string $subject, string $body): void
    {
        $to = trim((string) ($channel->destination ?: $channel->user?->email));

        if ($to === '') {
            throw new \RuntimeException('Email destination is missing.');
        }

        Mail::raw($body, function ($message) use ($to, $subject): void {
            $message->to($to)->subject($subject);
        });
    }

    private function sendWebhook(string $destination, array $payload): void
    {
        $response = Http::timeout(12)->connectTimeout(4)->post($destination, $payload);

        if (! $response->successful()) {
            throw new \RuntimeException("Webhook delivery failed with status {$response->status()}.");
        }
    }

    private function sendTelegram(AlertChannel $channel, string $message): void
    {
        $botToken = trim((string) ($channel->config['bot_token'] ?? ''));
        $chatId = trim((string) ($channel->destination ?: ($channel->config['chat_id'] ?? '')));

        if ($botToken === '' || $chatId === '') {
            throw new \RuntimeException('Telegram bot token or chat id is missing.');
        }

        $response = Http::timeout(12)
            ->connectTimeout(4)
            ->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $message,
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException("Telegram delivery failed with status {$response->status()}.");
        }
    }

    private function sendTwilioMessage(AlertChannel $channel, string $message, bool $whatsapp): void
    {
        $accountSid = trim((string) ($channel->config['account_sid'] ?? ''));
        $authToken = trim((string) ($channel->config['auth_token'] ?? ''));
        $from = trim((string) ($channel->config['from_number'] ?? ''));
        $to = trim((string) $channel->destination);

        if ($accountSid === '' || $authToken === '' || $from === '' || $to === '') {
            throw new \RuntimeException('Twilio credentials or destination are missing.');
        }

        $response = Http::asForm()
            ->withBasicAuth($accountSid, $authToken)
            ->timeout(12)
            ->connectTimeout(4)
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$accountSid}/Messages.json", [
                'From' => $whatsapp ? $this->ensureWhatsappPrefix($from) : $from,
                'To' => $whatsapp ? $this->ensureWhatsappPrefix($to) : $to,
                'Body' => $message,
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException("Twilio delivery failed with status {$response->status()}.");
        }
    }

    private function ensureWhatsappPrefix(string $value): string
    {
        return str_starts_with($value, 'whatsapp:') ? $value : 'whatsapp:'.$value;
    }

    private function buildMentionPayload(AlertDelivery $delivery): array
    {
        $mention = $delivery->mention;
        $rule = $delivery->alertRule;

        return [
            'event' => 'mention.alert',
            'delivery_id' => $delivery->id,
            'rule' => $rule ? [
                'id' => $rule->id,
                'name' => $rule->name,
                'frequency' => $rule->frequency,
            ] : null,
            'channel' => $delivery->alertChannel ? [
                'id' => $delivery->alertChannel->id,
                'type' => $delivery->alertChannel->type,
                'name' => $delivery->alertChannel->name,
            ] : null,
            'project' => $mention && $mention->project ? [
                'id' => $mention->project->id,
                'name' => $mention->project->name,
            ] : null,
            'mention' => $mention ? [
                'id' => $mention->id,
                'source' => $mention->source,
                'title' => $mention->title,
                'body' => $mention->body,
                'url' => $mention->url,
                'published_at' => optional($mention->published_at)?->toIso8601String(),
                'tracked_keyword' => $mention->trackedKeyword ? [
                    'id' => $mention->trackedKeyword->id,
                    'keyword' => $mention->trackedKeyword->keyword,
                ] : null,
                'estimated_reach' => $this->estimateReach($mention),
            ] : null,
        ];
    }

    private function buildDigestPayload(AlertRule $rule, Collection $deliveries, string $frequency): array
    {
        $mentions = $deliveries->pluck('mention')->filter();
        $project = $rule->project;

        return [
            'event' => 'mention.alert.digest',
            'frequency' => $frequency,
            'rule' => [
                'id' => $rule->id,
                'name' => $rule->name,
            ],
            'project' => $project ? [
                'id' => $project->id,
                'name' => $project->name,
            ] : null,
            'mentions' => $mentions->map(fn (Mention $mention): array => [
                'id' => $mention->id,
                'title' => $mention->title,
                'source' => $mention->source,
                'url' => $mention->url,
                'published_at' => optional($mention->published_at)?->toIso8601String(),
                'estimated_reach' => $this->estimateReach($mention),
            ])->values()->all(),
        ];
    }

    private function formatMentionMessage(?Mention $mention, ?AlertRule $rule): array
    {
        $projectName = $mention?->project?->name ?? 'your project';
        $keyword = $mention?->trackedKeyword?->keyword ?? 'tracked keyword';
        $source = $mention?->metadata['source_name'] ?? $mention?->source ?? 'unknown source';
        $reach = $mention ? number_format($this->estimateReach($mention)) : '0';
        $subject = "{$projectName}: new {$source} mention for {$keyword}";
        $body = implode("\n", array_filter([
            $mention?->title ?: 'Untitled mention',
            '',
            $mention?->body,
            '',
            "Project: {$projectName}",
            "Keyword: {$keyword}",
            "Source: {$source}",
            'Sentiment: '.($mention?->sentiment ?? 'neutral'),
            "Estimated reach: {$reach}",
            $mention?->url ? "URL: {$mention->url}" : null,
            $rule ? "Rule: {$rule->name}" : null,
        ]));

        return [$subject, $body];
    }

    private function formatDigestMessage(AlertRule $rule, Collection $deliveries, string $frequency): array
    {
        $projectName = $rule->project?->name ?? 'your project';
        $subject = "{$projectName}: {$deliveries->count()} {$frequency} mention alert".($deliveries->count() === 1 ? '' : 's');
        $lines = [
            "{$deliveries->count()} new mention(s) matched rule \"{$rule->name}\" for {$projectName}.",
            '',
        ];

        foreach ($deliveries->take(10) as $delivery) {
            $mention = $delivery->mention;

            if (! $mention) {
                continue;
            }

            $lines[] = '- '.trim(($mention->title ?: 'Untitled mention').' ['.($mention->metadata['source_name'] ?? $mention->source).']');
        }

        if ($deliveries->count() > 10) {
            $lines[] = '';
            $lines[] = 'Additional mentions omitted from this digest.';
        }

        return [$subject, implode("\n", $lines)];
    }

    private function estimateReach(Mention $mention): int
    {
        $metadata = (array) ($mention->metadata ?? []);
        $source = mb_strtolower((string) ($metadata['source_name'] ?? $mention->source ?? ''));
        $score = max(0, (int) ($metadata['score'] ?? 0));
        $comments = max(0, (int) ($metadata['num_comments'] ?? 0));
        $likes = max(0, (int) ($metadata['like_count'] ?? 0));
        $reposts = max(0, (int) ($metadata['repost_count'] ?? 0));

        $base = str_contains($source, 'linkedin')
            ? 18000
            : (str_contains($source, 'reddit')
                ? 12000
                : ((str_contains($source, 'x') || str_contains($source, 'twitter'))
                    ? 22000
                    : (str_contains($source, 'facebook')
                        ? 16000
                        : (str_contains($source, 'tiktok') ? 28000 : 42000))));

        return (int) round(
            $base
            + min(mb_strlen((string) $mention->body) * 12, 8000)
            + ($score * 30)
            + ($comments * 40)
            + ($likes * 12)
            + ($reposts * 35)
        );
    }

    private function requireDestination(AlertChannel $channel): string
    {
        $destination = trim((string) $channel->destination);

        if ($destination === '') {
            throw new \RuntimeException("Destination is missing for {$channel->type} channel.");
        }

        return $destination;
    }
}
