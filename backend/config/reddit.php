<?php

return [
    'client_id' => env('REDDIT_CLIENT_ID'),
    'client_secret' => env('REDDIT_CLIENT_SECRET'),
    'user_agent' => env('REDDIT_USER_AGENT', 'IQX Intelligence/1.0 by iqxintel'),
    'lookback_days' => env('REDDIT_LOOKBACK_DAYS', 90),
    'results_per_page' => env('REDDIT_RESULTS_PER_PAGE', 25),
    'max_pages' => env('REDDIT_MAX_PAGES', 3),
    'sync_ttl_minutes' => env('REDDIT_SYNC_TTL_MINUTES', 15),
    'timeout_seconds' => env('REDDIT_HTTP_TIMEOUT_SECONDS', 12),
    'connect_timeout_seconds' => env('REDDIT_HTTP_CONNECT_TIMEOUT_SECONDS', 4),
];
