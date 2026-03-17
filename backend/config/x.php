<?php

return [
    'bearer_token' => env('X_BEARER_TOKEN'),
    'lookback_days' => env('X_LOOKBACK_DAYS', 7),
    'max_results' => env('X_MAX_RESULTS', 25),
    'max_pages' => env('X_MAX_PAGES', 3),
    'sync_ttl_minutes' => env('X_SYNC_TTL_MINUTES', 15),
    'timeout_seconds' => env('X_HTTP_TIMEOUT_SECONDS', 12),
    'connect_timeout_seconds' => env('X_HTTP_CONNECT_TIMEOUT_SECONDS', 4),
];
