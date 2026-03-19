<?php

namespace App\Console\Commands;

use App\Services\MediaSourceAuditService;
use Illuminate\Console\Command;

class AuditMediaSources extends Command
{
    protected $signature = 'media:audit {--days=7}';

    protected $description = 'Audit configured media sources for freshness, failures, and likely reliability.';

    public function handle(MediaSourceAuditService $auditService): int
    {
        $audit = $auditService->buildAudit((int) $this->option('days'));
        $rows = collect($audit['sources']);

        if ($rows->isEmpty()) {
            $this->warn('No media sources are configured.');

            return self::SUCCESS;
        }

        $this->table(
            ['Status', 'Source', 'Access', 'Articles', 'Latest Published', 'Warnings', 'Notes'],
            $rows->map(fn (array $row) => [
                $row['status'],
                $row['name'],
                $row['access'],
                $row['article_count'],
                $row['latest_published_at'] ?? '-',
                $row['warning_count'],
                $row['notes'],
            ])->all()
        );

        $summary = $audit['summary'];
        $this->newLine();
        $this->info(sprintf(
            'Configured sources: %d | working: %d | flaky: %d | broken: %d | premium-risk: %d | unindexed: %d',
            (int) $summary['configured_sources'],
            (int) $summary['working_sources'],
            (int) $summary['flaky_sources'],
            (int) $summary['broken_sources'],
            (int) $summary['premium_risk_sources'],
            (int) ($summary['unindexed_sources'] ?? 0),
        ));

        return self::SUCCESS;
    }
}
