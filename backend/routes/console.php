<?php

use App\Console\Commands\DiscoverMediaArticles;
use App\Console\Commands\ImportRedditMentions;
use App\Console\Commands\ImportXMentions;
use App\Console\Commands\SendAlertDigests;
use App\Services\AutoIndexingControlService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(DiscoverMediaArticles::class)
    ->everyFiveMinutes()
    ->when(fn () => ! app(AutoIndexingControlService::class)->isPaused())
    ->withoutOverlapping();
Schedule::command(ImportRedditMentions::class)->everyFifteenMinutes()->withoutOverlapping();
Schedule::command(ImportXMentions::class)->everyFifteenMinutes()->withoutOverlapping();
Schedule::command(SendAlertDigests::class, ['frequency' => 'hourly'])->hourly()->withoutOverlapping();
Schedule::command(SendAlertDigests::class, ['frequency' => 'daily'])->daily()->withoutOverlapping();
Schedule::command('media:ingest --days='.((int) config('media_sources.repair_sync_lookback_days', 2)))
    ->daily()
    ->when(fn () => ! app(AutoIndexingControlService::class)->isPaused())
    ->withoutOverlapping();
