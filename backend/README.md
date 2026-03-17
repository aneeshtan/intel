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

## Notes

- `laravel-users` routes are available at `/users` for internal management, but the main customer flow is intended to go through the API and frontend.
- Plans are seeded locally and matched to Stripe price IDs through environment variables.
