<?php

return [
    'sync_ttl_minutes' => env('MEDIA_SYNC_TTL_MINUTES', 15),
    'discovery_ttl_minutes' => env('MEDIA_DISCOVERY_TTL_MINUTES', 360),
    'archive_sync_ttl_minutes' => env('MEDIA_ARCHIVE_SYNC_TTL_MINUTES', 360),
    'timeout_seconds' => env('MEDIA_HTTP_TIMEOUT_SECONDS', 5),
    'connect_timeout_seconds' => env('MEDIA_HTTP_CONNECT_TIMEOUT_SECONDS', 3),
    'archive_lookback_days' => env('MEDIA_ARCHIVE_LOOKBACK_DAYS', 90),
    'archive_article_limit_per_source' => env('MEDIA_ARCHIVE_ARTICLE_LIMIT_PER_SOURCE', 80),
    'archive_sitemap_limit_per_source' => env('MEDIA_ARCHIVE_SITEMAP_LIMIT_PER_SOURCE', 12),
    'user_agent' => env(
        'MEDIA_HTTP_USER_AGENT',
        'IQX Intelligence Feed Monitor/1.0 (+https://iqxintel.local)'
    ),

    'sources' => [
        [
            'key' => 'trade-winds',
            'name' => 'Trade Winds',
            'homepage' => 'https://www.tradewindsnews.com/',
        ],
        [
            'key' => 'splash247',
            'name' => 'Splash247',
            'homepage' => 'https://splash247.com/',
        ],
        [
            'key' => 'the-loadstar',
            'name' => 'The Loadstar',
            'homepage' => 'https://theloadstar.com/',
        ],
        [
            'key' => 'shipping-watch',
            'name' => 'Shipping Watch',
            'homepage' => 'https://shippingwatch.com/',
        ],
        [
            'key' => 'seatrade-maritime',
            'name' => 'Seatrade Maritime',
            'homepage' => 'https://www.seatrade-maritime.com/',
        ],
        [
            'key' => 'hellenic-shipping-news',
            'name' => 'Hellenic Shipping News',
            'homepage' => 'https://www.hellenicshippingnews.com/',
        ],
        [
            'key' => 'ports-and-harbors',
            'name' => 'Ports & Harbors',
            'homepage' => 'https://www.ports-and-harbors.com/',
        ],
        [
            'key' => 'joc',
            'name' => 'JOC',
            'homepage' => 'https://www.joc.com/',
        ],
        [
            'key' => 'the-maritime-standard',
            'name' => 'The Maritime Standard',
            'homepage' => 'https://www.themaritimestandard.com/',
        ],
        [
            'key' => 'container-news',
            'name' => 'Container News',
            'homepage' => 'https://container-news.com/',
        ],
        [
            'key' => 'logistics-middle-east',
            'name' => 'Logistics Middle East',
            'homepage' => 'https://www.logisticsmiddleeast.com/',
        ],
        [
            'key' => 'logistics-gulf',
            'name' => 'Logistics Gulf',
            'homepage' => 'https://logisticsgulf.com/',
        ],
        [
            'key' => 'assafina',
            'name' => 'Assafina',
            'homepage' => 'https://www.assafinaonline.com/en/',
        ],
        [
            'key' => 'logistics-insider',
            'name' => 'Logistics Insider',
            'homepage' => 'https://www.logisticsinsider.in/',
        ],
        [
            'key' => 'mph-news',
            'name' => 'MPH News',
            'homepage' => 'https://mph-intl.com/',
        ],
        [
            'key' => 'dvz',
            'name' => 'DVZ',
            'homepage' => 'https://www.dvz.de/',
        ],
        [
            'key' => 'supply-chain-dive',
            'name' => 'Supply Chain Dive',
            'homepage' => 'https://www.supplychaindive.com/',
        ],
        [
            'key' => 'world-cargo-news',
            'name' => 'World Cargo News',
            'homepage' => 'https://www.worldcargonews.com/',
        ],
        [
            'key' => 'cargo-talk',
            'name' => 'Cargo Talk',
            'homepage' => 'https://www.cargotalkgcc.com/',
        ],
        [
            'key' => 'the-maritime-executive',
            'name' => 'The Maritime Executive',
            'homepage' => 'https://maritime-executive.com/',
        ],
        [
            'key' => 'gcaptain',
            'name' => 'gCaptain',
            'homepage' => 'https://gcaptain.com/',
        ],
        [
            'key' => 'marinelink',
            'name' => 'MarineLink',
            'homepage' => 'https://www.marinelink.com/',
        ],
        [
            'key' => 'port-technology',
            'name' => 'Port Technology International',
            'homepage' => 'https://www.porttechnology.org/',
        ],
        [
            'key' => 'baird-maritime',
            'name' => 'Baird Maritime',
            'homepage' => 'https://www.bairdmaritime.com/',
        ],
        [
            'key' => 'breakbulk-news',
            'name' => 'Breakbulk News',
            'homepage' => 'https://breakbulk.news/',
        ],
        [
            'key' => 'maritime-gateway',
            'name' => 'Maritime Gateway',
            'homepage' => 'https://www.maritimegateway.com/',
        ],
        [
            'key' => 'maritime-fairtrade',
            'name' => 'Maritime Fairtrade',
            'homepage' => 'https://maritimefairtrade.org/',
        ],
        [
            'key' => 'shipping-herald',
            'name' => 'Shipping Herald',
            'homepage' => 'https://www.shippingherald.com/',
        ],
        [
            'key' => 'maritime-professional',
            'name' => 'Maritime Professional',
            'homepage' => 'https://www.maritimeprofessional.com/',
        ],
        [
            'key' => 'maritime-news',
            'name' => 'Maritime News',
            'homepage' => 'https://www.maritimenews.com/',
        ],
        [
            'key' => 'riviera-maritime-media',
            'name' => 'Riviera Maritime Media',
            'homepage' => 'https://www.rivieramm.com/news-content-hub',
        ],
        [
            'key' => 'dry-bulk-magazine',
            'name' => 'Dry Bulk',
            'homepage' => 'https://www.drybulkmagazine.com/',
        ],
        [
            'key' => 'ajot',
            'name' => 'American Journal of Transportation',
            'homepage' => 'https://www.ajot.com/',
        ],
        [
            'key' => 'offshore-energy',
            'name' => 'Offshore Energy',
            'homepage' => 'https://www.offshore-energy.biz/',
        ],
    ],
];
