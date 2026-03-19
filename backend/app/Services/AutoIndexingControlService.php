<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class AutoIndexingControlService
{
    private const CACHE_KEY = 'media:auto-indexing-paused';

    public function isPaused(): bool
    {
        return (bool) Cache::get(self::CACHE_KEY, false);
    }

    public function setPaused(bool $paused): void
    {
        if ($paused) {
            Cache::forever(self::CACHE_KEY, true);

            return;
        }

        Cache::forget(self::CACHE_KEY);
    }
}
