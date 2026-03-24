<?php

return [
    'sync_ttl_minutes' => env('MEDIA_SYNC_TTL_MINUTES', 15),
    'discovery_ttl_minutes' => env('MEDIA_DISCOVERY_TTL_MINUTES', 30),
    'archive_sync_ttl_minutes' => env('MEDIA_ARCHIVE_SYNC_TTL_MINUTES', 360),
    'timeout_seconds' => env('MEDIA_HTTP_TIMEOUT_SECONDS', 5),
    'connect_timeout_seconds' => env('MEDIA_HTTP_CONNECT_TIMEOUT_SECONDS', 3),
    'archive_lookback_days' => env('MEDIA_ARCHIVE_LOOKBACK_DAYS', 90),
    'archive_article_limit_per_source' => env('MEDIA_ARCHIVE_ARTICLE_LIMIT_PER_SOURCE', 80),
    'discovery_article_limit_per_source' => env('MEDIA_DISCOVERY_ARTICLE_LIMIT_PER_SOURCE', 40),
    'archive_sitemap_limit_per_source' => env('MEDIA_ARCHIVE_SITEMAP_LIMIT_PER_SOURCE', 20),
    'homepage_article_limit_per_source' => env('MEDIA_HOMEPAGE_ARTICLE_LIMIT_PER_SOURCE', 15),
    'homepage_supplement_threshold_per_source' => env('MEDIA_HOMEPAGE_SUPPLEMENT_THRESHOLD_PER_SOURCE', 5),
    'repair_sync_lookback_days' => env('MEDIA_REPAIR_SYNC_LOOKBACK_DAYS', 2),
    'user_agent' => env(
        'MEDIA_HTTP_USER_AGENT',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    ),

    'sources' => [
        [
            'key' => 'trade-winds',
            'name' => 'Trade Winds',
            'homepage' => 'https://www.tradewindsnews.com/',
            'access' => 'premium',
            'excerpt_only' => true,
            // Sitemap is public — discovers article URLs without accessing gated content
            'sitemap_paths' => ['/sitemap.xml'],
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
            'feed_url' => 'https://theloadstar.com/feed/',
            'disable_sitemaps' => true,
        ],
        [
            'key' => 'shipping-watch',
            'name' => 'Shipping Watch',
            'homepage' => 'https://shippingwatch.com/',
            'access' => 'premium',
            'excerpt_only' => true,
            'disable_discovery' => true,
        ],
        [
            'key' => 'seatrade-maritime',
            'name' => 'Seatrade Maritime',
            'homepage' => 'https://www.seatrade-maritime.com/',
            'feed_url' => 'https://www.seatrade-maritime.com/rss.xml',
            'disable_sitemaps' => true,
            'exclude_url_patterns' => [
                '#/recent-(webinars|podcasts|documents|videos|publications|industry-events)(?:/|$)#i',
                '#/latest-news/?$#i',
            ],
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
            'access' => 'premium',
            'excerpt_only' => true,
            // Sitemap is public and returns ~100 recent articles — no auth needed
            'sitemap_paths' => ['/sitemap.xml'],
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
            'feed_url' => 'https://container-news.com/feed/',
            'sitemap_paths' => [
                '/post-sitemap.xml',
            ],
            'include_url_patterns' => [
                '~^https://container-news\.com/[^/?#]+/?$~i',
            ],
            'exclude_url_patterns' => [
                '#^https://container-news\.com/(?:top-right|featured|most-visited|sponsored|readers-speak|cn-index|cn-premium-articles|scfi|ccfi|ningbo-containerized-freight-index|mergers-and-acquisitions)(?:/|$)#i',
            ],
            'exclude_title_patterns' => [
                '/\bArchives\b/i',
                '/^CN Premium Articles\b/i',
            ],
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
            'access' => 'premium',
            'excerpt_only' => true,
            // Sitemap is public — discovers article URLs without accessing gated content
            'sitemap_paths' => ['/sitemap.xml'],
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
            'access' => 'premium',
            'excerpt_only' => true,
            // Sitemap is public (also has /sitemap.rss)
            'sitemap_paths' => ['/sitemap.xml'],
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
            'exclude_url_patterns' => [
                '~^https://www\.offshore-energy\.biz/region/[^/?#]+/?$~i',
            ],
        ],
        [
            'key' => 'lloyds-list',
            'name' => 'Lloyd\'s List',
            'homepage' => 'https://lloydslist.com/',
            'access' => 'premium',
            'excerpt_only' => true,
            'disable_discovery' => true,
        ],
        [
            'key' => 'safety4sea',
            'name' => 'SAFETY4SEA',
            'homepage' => 'https://safety4sea.com/',
        ],
        [
            'key' => 'ship-technology',
            'name' => 'Ship Technology',
            'homepage' => 'https://www.ship-technology.com/news/',
        ],
        [
            'key' => 'seatrade-cruise',
            'name' => 'Seatrade Cruise',
            'homepage' => 'https://www.seatrade-cruise.com/',
        ],
        [
            'key' => 'portnews',
            'name' => 'PortNews',
            'homepage' => 'https://en.portnews.ru/',
        ],
        [
            'key' => 'imo-media-centre',
            'name' => 'IMO Media Centre',
            'homepage' => 'https://www.imo.org/en/MediaCentre/Pages/Default.aspx',
        ],
        [
            'key' => 'bimco-news',
            'name' => 'BIMCO News',
            'homepage' => 'https://www.bimco.org/news',
        ],
        [
            'key' => 'iaph-news',
            'name' => 'IAPH World Ports',
            'homepage' => 'https://www.iaphworldports.org/news/',
        ],
        [
            'key' => 'unctad-maritime-transport',
            'name' => 'UNCTAD Review of Maritime Transport',
            'homepage' => 'https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport',
        ],
        [
            'key' => 'dnv-maritime-news',
            'name' => 'DNV Maritime News',
            'homepage' => 'https://www.dnv.com/news/',
        ],
        [
            'key' => 'maersk-news',
            'name' => 'Maersk News',
            'homepage' => 'https://www.maersk.com/news',
        ],
        [
            'key' => 'msc-press',
            'name' => 'MSC Press Releases',
            'homepage' => 'https://www.msc.com/en/media-centre/press-releases',
        ],
        [
            'key' => 'cma-cgm-news',
            'name' => 'CMA CGM News',
            'homepage' => 'https://www.cma-cgm.com/news',
        ],
        [
            'key' => 'hapag-lloyd-press',
            'name' => 'Hapag-Lloyd Press',
            'homepage' => 'https://www.hapag-lloyd.com/en/company/press/releases.html',
        ],
        [
            'key' => 'one-press-room',
            'name' => 'ONE Press Room',
            'homepage' => 'https://www.one-line.com/en/press-room',
        ],
        [
            'key' => 'dp-world-news',
            'name' => 'DP World News',
            'homepage' => 'https://www.dpworld.com/en/news',
            'include_url_patterns' => [
                '#^https://www\.dpworld\.com/en/news/[^/?#]+#i',
            ],
        ],
        [
            'key' => 'ad-ports-news',
            'name' => 'AD Ports Group News',
            'homepage' => 'https://www.adportsgroup.com/en/news-and-media',
            'include_url_patterns' => [
                '#^https://www\.adportsgroup\.com/en/news-and-media/.+#i',
            ],
            'exclude_url_patterns' => [
                '#^https://www\.adportsgroup\.com/ar/news-and-media(?:/|$)#i',
            ],
        ],
        [
            'key' => 'apm-terminals-news',
            'name' => 'APM Terminals News',
            'homepage' => 'https://www.apmterminals.com/en/news/news-releases',
            'include_url_patterns' => [
                '#^https://www\.apmterminals\.com/en/news/news-releases/\d{4}/.+#i',
            ],
        ],
        [
            'key' => 'port-of-rotterdam-news',
            'name' => 'Port of Rotterdam News',
            'homepage' => 'https://www.portofrotterdam.com/en/news-and-press-releases',
            'feed_url' => 'https://www.portofrotterdam.com/en/rss.xml',
            'disable_sitemaps' => true,
            'include_url_patterns' => [
                '#^https://www\.portofrotterdam\.com/(?:en/news-and-press-releases|nl/nieuws-en-persberichten)/[^/?#]+#i',
            ],
        ],
        [
            'key' => 'mpa-singapore-media',
            'name' => 'MPA Singapore Media Centre',
            'homepage' => 'https://www.mpa.gov.sg/media-centre',
            'feed_url' => 'https://www.mpa.gov.sg/feeds/media-releases',
            'disable_sitemaps' => true,
            'excerpt_only' => true,
            'include_url_patterns' => [
                '#^https://www\.mpa\.gov\.sg/media-centre/details/[^/?#]+#i',
            ],
            'exclude_title_patterns' => [
                '#^PORT MARINE NOTICE\b#i',
                '#^PORT MARINE CIRCULAR\b#i',
                '#^MAR(?:\(|\s|$)#i',
                '#^NOTICES? TO MARINERS\b#i',
            ],
        ],
        [
            'key' => 'port-houston-news',
            'name' => 'Port Houston News',
            'homepage' => 'https://porthouston.com/',
            'feed_url' => 'https://porthouston.com/feed/',
            'disable_sitemaps' => true,
            'excerpt_only' => true,
            'allow_document_urls' => true,
            'include_url_patterns' => [
                '#^https://porthouston\.com/.+#i',
            ],
        ],
    ],
];
