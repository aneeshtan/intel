# IQX Intelligence

IQX Intelligence is a maritime social and media monitoring product concept with a premium Next.js frontend and a Laravel 12 backend foundation. The backend now supports registration, login, roles, plans, projects, and project-level keyword tracking.

## Product direction

- Core focus: maritime audience monitoring across LinkedIn, Reddit, and media search.
- Product style: modern monitoring workflows with a restrained executive interface.
- Primary use cases: keyword tracking, competitor monitoring, narrative shift detection, risk alerts, and executive briefings.

## Run locally

Frontend:

```bash
npm install --cache ./.npm-cache
npm run dev
```

Backend:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Then open `http://localhost:3000` for the frontend and `http://localhost:8000` for the API.

The frontend proxies Laravel requests through Next.js using `/backend/*`. If your Laravel app is not running at `http://127.0.0.1:8000`, set `BACKEND_URL` before starting Next.js.

## Current structure

- [src/app/page.tsx](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/src/app/page.tsx) contains the frontend product concept.
- [backend/routes/api.php](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/backend/routes/api.php) defines the Laravel API surface.
- [backend/README.md](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/backend/README.md) explains the backend stack and endpoints.
- [docs/product-architecture.md](/Users/farshad.ghanzanfari/Documents/www/IQX-Intel/docs/product-architecture.md) outlines the overall product and data strategy.

## Suggested next build steps

1. Expand the frontend from the current control surface into full project and mention workflows.
2. Add Stripe webhooks and subscription lifecycle handling.
3. Build source ingestion workers for Reddit and media mentions first.
4. Add LinkedIn access through compliant API or partner workflows.
