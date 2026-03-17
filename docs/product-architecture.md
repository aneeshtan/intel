# IQX Intelligence: MVP Product Architecture

## Positioning

IQX Intelligence should monitor how the maritime market is talking, not just count mentions. The useful wedge is a focused intelligence layer for shipowners, ports, charterers, brokers, offshore operators, and maritime service brands.

## MVP feature set

1. Keyword monitoring
   - Saved keyword packs for ports, operators, vessel classes, routes, regulations, fuels, and competitors.
   - Boolean-style rules for include and exclude terms.
   - Language and geography filters where source coverage allows it.
2. Mention stream
   - Unified feed across LinkedIn, Reddit, and media.
   - Source, author or publisher, timestamp, engagement proxy, sentiment, and keyword match context.
   - Quick triage states such as `watch`, `brief`, and `critical`.
3. Alerting
   - Volume spike alerts.
   - Sentiment drift alerts.
   - Publisher or account watch alerts.
   - Daily and weekly email or Slack briefings.
4. Intelligence views
   - Topic clusters such as port congestion, decarbonization, shipbuilding, offshore energy, and geopolitical routing.
   - Competitor share of attention.
   - Source mix by platform.
   - Executive summary generated from recent mention changes.

## Source strategy

### LinkedIn

- Treat LinkedIn as a high-value but compliance-sensitive source.
- Prefer official APIs, partner data access, or user-connected workflows before considering any scraping path.
- If direct full-firehose access is unavailable, start with narrower scopes:
  - company pages you administer,
  - opted-in connected accounts,
  - selected public pages or posts through compliant third-party providers.

### Reddit

- Use the Reddit API for posts, comments, subreddit targeting, author metadata, and timestamps.
- Build industry-focused collections around shipping, logistics, supply chain, offshore, energy, and regional trade communities.

### Media search

- Use a news or web search provider to ingest article headlines, snippets, publication names, canonical URLs, and published dates.
- Maritime-specific coverage should prioritize trade media, port authority publications, logistics press, and major business news outlets.

## Recommended backend shape

1. Core platform
   - Laravel 12 API backend.
   - Sanctum token auth for the existing separate frontend.
   - Cashier for subscription checkout and billing portal flows.
   - `jeremykenedy/laravel-roles` plus `jeremykenedy/laravel-users` for role-aware user management.
2. Collectors
   - One ingestion worker per source type.
   - Scheduled polling plus webhook support where available.
3. Normalization
   - Convert all source events into a shared `Mention` model.
   - Store raw payloads separately for auditability.
4. Enrichment
   - Keyword matching.
   - Sentiment and urgency scoring.
   - Entity tagging for ports, operators, vessel classes, trade lanes, and regulations.
5. Delivery
   - Searchable feed API.
   - Alert engine.
   - Summarization service for daily briefings.

## Initial data model

```ts
type Mention = {
  id: string;
  source: "linkedin" | "reddit" | "media";
  authorName: string;
  authorType?: "executive" | "publisher" | "community" | "analyst";
  url: string;
  title?: string;
  body: string;
  publishedAt: string;
  matchedKeywords: string[];
  sentiment: "positive" | "neutral" | "negative";
  urgencyScore: number;
  reachEstimate?: number;
  entities: string[];
};
```

## UI principle

The product should feel closer to an executive briefing room than a traditional social dashboard. That means fewer competing colors, stronger whitespace, one clear hierarchy, and a default view that answers three questions fast:

1. What changed?
2. Why does it matter to the maritime market?
3. What needs action today?
