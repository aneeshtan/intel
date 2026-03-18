# IQX Intelligence Backend

This Laravel 12 backend is the account and workspace layer for IQX Intelligence. It is API-first so the existing frontend can consume it directly.

## Stack

- Laravel 12
- Sanctum for API token auth
- Cashier for Stripe subscriptions
- `jeremykenedy/laravel-roles` for roles and permissions
- `jeremykenedy/laravel-users` for internal user management routes

## What is implemented

- User registration and login
- Sanctum token issuance and logout
- Role-aware users with default `user` role assignment on registration
- Seeded subscription plans
- User-owned projects
- Project-level tracked keywords
- Stripe checkout and billing portal endpoints

## Key API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/plans`
- `POST /api/billing/checkout/{plan:slug}`
- `GET /api/billing/portal`
- `GET|POST|PUT|DELETE /api/projects`
- `GET|POST|PUT|DELETE /api/projects/{project}/keywords`

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

For local development with background ingestion running:

```bash
composer run dev
```

## Environment

Set these before using billing:

```bash
STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PROFESSIONAL_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
```

Media discovery tuning:

```bash
MEDIA_ARCHIVE_LOOKBACK_DAYS=90
MEDIA_DISCOVERY_ARTICLE_LIMIT_PER_SOURCE=20
MEDIA_REPAIR_SYNC_LOOKBACK_DAYS=2
```

## Scheduled ingestion

The scalable media ingestion flow is split into two stages:

- `media:discover` runs every 5 minutes via the Laravel scheduler and only discovers recent candidate URLs from feeds and sitemaps.
- Each discovered URL is queued as a `FetchMediaArticleJob`, which fetches the full article, stores it, and generates mentions.
- `media:ingest` remains available as a heavier repair/backfill command and is scheduled once daily for a short lookback window.

This keeps discovery cheap and frequent while pushing article fetch and mention generation onto the queue.

## Production scheduler and queue worker

Laravel scheduling should be triggered by system cron every minute:

```cron
* * * * * cd /var/www/iqx-intel/backend && php artisan schedule:run >> /dev/null 2>&1
```

You also need a persistent queue worker in production because article fetches are now queued:

```bash
php artisan queue:work --queue=default --sleep=3 --tries=3 --timeout=120
```

Example deployment config files are included in [`deploy/laravel-scheduler.cron.example`](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/backend/deploy/laravel-scheduler.cron.example) and [`deploy/queue-worker.supervisor.example`](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/backend/deploy/queue-worker.supervisor.example).

## Notes

- `laravel-users` routes are available at `/users` for internal management, but the main customer flow is intended to go through the API and frontend.
- Plans are seeded locally and matched to Stripe price IDs through environment variables.
