"use client";

import { useEffect, useState, useTransition } from "react";

const TOKEN_KEY = "iqx-intelligence-token";
const inputClassName =
  "mt-2 w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400";

function getAdminSourceStatusClass(status: string) {
  return status === "working"
    ? "bg-emerald-100 text-emerald-700"
    : status === "flaky"
      ? "bg-amber-100 text-amber-700"
      : status === "unindexed"
        ? "bg-sky-100 text-sky-700"
      : status === "broken"
        ? "bg-rose-100 text-rose-700"
        : status === "premium-risk"
          ? "bg-violet-100 text-violet-700"
          : "bg-stone-200 text-stone-700";
}

function getAdminRefreshPhaseClass(phase: AdminRefreshPhase) {
  return phase === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : phase === "starting" || phase === "polling"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : phase === "stalled"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : phase === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-stone-200 bg-stone-50 text-stone-600";
}

function getAdminRefreshPhaseLabel(phase: AdminRefreshPhase) {
  return phase === "active"
    ? "Refresh active"
    : phase === "starting"
      ? "Starting refresh"
      : phase === "polling"
        ? "Checking progress"
        : phase === "stalled"
          ? "No visible change yet"
          : phase === "error"
            ? "Refresh failed"
            : "Idle";
}

const overviewStats = [
  {
    label: "Signals captured today",
    value: "1,284",
    detail: "+18% vs. weekly average",
  },
  {
    label: "Critical maritime alerts",
    value: "07",
    detail: "Congestion, bunker pricing, labor risk",
  },
  {
    label: "Decision makers reached",
    value: "82k",
    detail: "LinkedIn-heavy operator and port audience",
  },
];

type AuthMode = "login" | "register";
type WorkspaceTab =
  | "results"
  | "analysis"
  | "sources"
  | "articles"
  | "alerts"
  | "profile"
  | "keywords"
  | "projects"
  | "new-project"
  | "plans";

type AnalysisWindowDays = 14 | 30 | 90;

type Plan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  interval: string;
  projects_limit: number | null;
  keywords_limit: number | null;
  mentions_retention_days: number;
  features: string[] | null;
};

type Profile = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  plan: {
    id: number;
    name: string;
    slug: string;
    projects_limit: number | null;
    keywords_limit: number | null;
    mentions_retention_days: number;
  } | null;
  counts: {
    projects: number;
    keywords: number;
    unread_alerts: number;
  };
};

type ProjectSummary = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  audience: string | null;
  status: string;
  monitored_platforms: string[] | null;
  tracked_keywords_count: number;
  mentions_count: number;
};

type TrackedKeyword = {
  id: number;
  keyword: string;
  platform: string;
  match_type: string;
  is_active: boolean;
};

type Mention = {
  id: number;
  source: string;
  url?: string | null;
  author_name: string | null;
  title: string | null;
  body: string;
  sentiment: string;
  published_at: string | null;
  metadata: {
    demo?: boolean;
    source_name?: string;
    source_url?: string;
    sentiment_source?: string;
    original_sentiment?: string;
    manual_sentiment?: string;
    manual_sentiment_updated_at?: string;
    num_comments?: number;
    score?: number;
  } | null;
  tracked_keyword: {
    id: number;
    keyword: string;
  } | null;
};

type ProjectDetail = ProjectSummary & {
  tracked_keywords: TrackedKeyword[];
  mentions: Mention[];
  source_groups: {
    domain: string;
    label: string;
    mentions_count: number;
    estimated_reach: number;
    latest_published_at: string | null;
    latest_title: string | null;
    muted: boolean;
  }[];
  influencer_groups: {
    author: string;
    source: string;
    mentions_count: number;
    estimated_reach: number;
    latest_published_at: string | null;
    latest_title: string | null;
    muted: boolean;
  }[];
  muted_sources: string[];
  muted_authors: string[];
};

type MediaCoverage = {
  summary: {
    configured_sources: number;
    indexed_sources: number;
    archive_articles: number;
    matched_mentions: number;
    archive_window_days: number;
    audit_window_days: number;
    oldest_published_at: string | null;
    newest_published_at: string | null;
    working_sources: number;
    flaky_sources: number;
    broken_sources: number;
    premium_risk_sources: number;
    unindexed_sources: number;
    pending_sources: number;
  };
  sources: {
    key: string;
    name: string;
    homepage: string;
    status: string;
    status_label: string;
    access: string;
    notes: string;
    article_count: number;
    matched_mentions_count: number;
    warning_count: number;
    discovery_enabled: boolean;
    sitemaps_enabled: boolean;
    has_feed_url: boolean;
    feed_url: string | null;
    include_url_patterns: string[];
    exclude_url_patterns: string[];
    exclude_title_patterns: string[];
    earliest_published_at: string | null;
    latest_published_at: string | null;
    latest_match_at: string | null;
    last_ingested_at: string | null;
    freshness_hours: number | null;
  }[];
};

type CapturedArticle = {
  id: number;
  source_key: string;
  source_name: string;
  source_url: string | null;
  url: string | null;
  author_name: string | null;
  title: string;
  body: string;
  published_at: string | null;
};

type AdminCapturedArticles = {
  items: CapturedArticle[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  query: string | null;
};

type AdminCenterTab = "sources" | "projects" | "users" | "keywords" | "indexes";

type AdminRefreshPhase = "idle" | "starting" | "polling" | "active" | "stalled" | "error";

type AdminRefreshState = {
  phase: AdminRefreshPhase;
  started_at: string | null;
  source_key: string | null;
  source_name: string | null;
  poll_attempt: number;
  max_polls: number;
  baseline_article_count: number;
  current_article_count: number;
  baseline_indexed_sources: number;
  current_indexed_sources: number;
  latest_article_title: string | null;
  latest_article_published_at: string | null;
  message: string | null;
};

type AdminWorkspaceData = {
  summary: {
    users: number;
    projects: number;
    keywords: number;
    mentions: number;
  };
  automation: {
    auto_indexing_paused: boolean;
  };
  projects: {
    id: number;
    name: string;
    slug: string;
    status: string;
    description: string | null;
    tracked_keywords_count: number;
    mentions_count: number;
    updated_at: string | null;
    created_at: string | null;
    user: {
      id: number | null;
      name: string | null;
      email: string | null;
    };
  }[];
  users: {
    id: number;
    name: string;
    email: string;
    roles: string[];
    plan_name: string | null;
    projects_count: number;
    keywords_count: number;
    mentions_count: number;
    created_at: string | null;
  }[];
  keywords: {
    id: number;
    keyword: string;
    platform: string;
    match_type: string;
    is_active: boolean;
    mentions_count: number;
    created_at: string | null;
    updated_at: string | null;
    project: {
      id: number | null;
      name: string | null;
      status: string | null;
    };
    user: {
      id: number | null;
      name: string | null;
      email: string | null;
    };
  }[];
};

type AuthResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    roles: string[];
    plan: {
      name: string;
      slug: string;
      projects_limit: number | null;
      keywords_limit: number | null;
    } | null;
  };
};

type AlertChannel = {
  id: number;
  type: string;
  name: string;
  destination: string | null;
  config: Record<string, string> | null;
  is_active: boolean;
  created_at: string | null;
};

type AlertRule = {
  id: number;
  name: string;
  is_active: boolean;
  frequency: string;
  sentiment: string | null;
  min_reach: number | null;
  source_filters: string[];
  tracked_keyword_ids: number[];
  channels: {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
  }[];
  created_at: string | null;
};

type AlertInboxItem = {
  id: number;
  status: string;
  frequency: string;
  subject: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  delivered_at: string | null;
  read_at: string | null;
  channel: {
    id: number;
    type: string;
    name: string;
  } | null;
  rule: {
    id: number;
    name: string;
    project_id: number;
    project_name: string | null;
  } | null;
  mention: {
    id: number;
    title: string | null;
    source: string;
    url: string | null;
    published_at: string | null;
    tracked_keyword: {
      id: number;
      keyword: string;
    } | null;
  } | null;
};

const alertChannelTypeOptions = [
  { value: "in_app", label: "In-app", hint: "Workspace inbox alerts." },
  { value: "email", label: "Email", hint: "Send mention alerts by email." },
  { value: "slack", label: "Slack", hint: "Incoming webhook delivery to Slack." },
  { value: "teams", label: "Teams", hint: "Incoming webhook delivery to Microsoft Teams." },
  { value: "discord", label: "Discord", hint: "Incoming webhook delivery to Discord." },
  { value: "telegram", label: "Telegram", hint: "Bot token plus chat id." },
  { value: "webhook", label: "Webhook", hint: "Structured JSON to any endpoint." },
  { value: "sms", label: "SMS", hint: "Twilio SMS delivery." },
  { value: "whatsapp", label: "WhatsApp", hint: "Twilio WhatsApp delivery." },
] as const;

const mentionSentimentOptions = [
  { value: "auto", label: "Auto" },
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
] as const;

const analysisWindowOptions: { value: AnalysisWindowDays; label: string }[] = [
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

function formatPublishedAt(value: string | null) {
  if (!value) {
    return "Monitoring now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createAdminRefreshState(): AdminRefreshState {
  return {
    phase: "idle",
    started_at: null,
    source_key: null,
    source_name: null,
    poll_attempt: 0,
    max_polls: 12,
    baseline_article_count: 0,
    current_article_count: 0,
    baseline_indexed_sources: 0,
    current_indexed_sources: 0,
    latest_article_title: null,
    latest_article_published_at: null,
    message: null,
  };
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function parseKeywordList(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword, index, all) => all.indexOf(keyword) === index);
}

function buildProjectNameFromKeywords(keywords: string[]) {
  const firstKeyword = keywords[0] ?? "New monitor";

  return firstKeyword.length > 70 ? `${firstKeyword.slice(0, 67).trim()}...` : firstKeyword;
}

function mentionSentimentSelection(mention: Mention) {
  return mention.metadata?.sentiment_source === "manual" ? mention.sentiment : "auto";
}

function formatAnalysisWindow(days: AnalysisWindowDays) {
  return `Last ${days} days`;
}

function sourceCategoryLabel(mention: Mention) {
  const source = (mention.metadata?.source_name ?? mention.source).toLowerCase();

  if (source.includes("linkedin")) {
    return "LinkedIn";
  }

  if (source.includes("reddit")) {
    return "Reddit";
  }

  if (source.includes("x") || source.includes("twitter")) {
    return "X";
  }

  if (source.includes("facebook")) {
    return "Facebook";
  }

  if (source.includes("tiktok")) {
    return "TikTok";
  }

  return "News";
}

function estimateMentionReach(mention: Mention) {
  const source = (mention.metadata?.source_name ?? mention.source).toLowerCase();
  const base =
    source.includes("linkedin")
      ? 18000
      : source.includes("reddit")
        ? 12000
        : source.includes("x") || source.includes("twitter")
          ? 22000
          : source.includes("facebook")
            ? 16000
            : source.includes("tiktok")
              ? 28000
              : 42000;

  const sentimentMultiplier =
    mention.sentiment === "positive" ? 1.1 : mention.sentiment === "negative" ? 1.2 : 1;

  return Math.round(base * sentimentMultiplier + Math.min(mention.body.length * 12, 8000));
}

function estimateMentionFollowers(mention: Mention) {
  const category = sourceCategoryLabel(mention);
  const reach = estimateMentionReach(mention);
  const score = Number(mention.metadata?.score ?? 0);
  const comments = Number(mention.metadata?.num_comments ?? 0);
  const ratio =
    category === "News"
      ? 0.62
      : category === "X"
        ? 0.55
        : category === "TikTok"
          ? 0.5
          : category === "LinkedIn"
            ? 0.48
            : 0.44;

  return Math.max(500, Math.round(reach * ratio + score * 42 + comments * 24));
}

function filterMentionsByWindow(mentions: Mention[], days: AnalysisWindowDays) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return mentions.filter((mention) => {
    if (!mention.published_at) {
      return true;
    }

    return new Date(mention.published_at).getTime() >= cutoff;
  });
}

function buildMentionReachSeries(mentions: Mention[], days = 14) {
  const today = new Date();
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));

    const key = date.toISOString().slice(0, 10);

    return {
      key,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date),
      mentions: 0,
      reach: 0,
    };
  });

  const indexByKey = new Map(points.map((point, index) => [point.key, index]));

  for (const mention of mentions) {
    const date = new Date(mention.published_at ?? Date.now());
    const key = date.toISOString().slice(0, 10);
    const index = indexByKey.get(key);

    if (index === undefined) {
      continue;
    }

    points[index].mentions += 1;
    points[index].reach += estimateMentionReach(mention);
  }

  return points;
}

function buildCategoryBreakdown(mentions: Mention[]) {
  const order = ["News", "Reddit", "X", "LinkedIn", "Facebook", "TikTok"];
  const colors: Record<string, string> = {
    News: "#0f172a",
    Reddit: "#f97316",
    X: "#2563eb",
    LinkedIn: "#0a66c2",
    Facebook: "#1877f2",
    TikTok: "#111827",
  };
  const counts = mentions.reduce<Map<string, number>>((summary, mention) => {
    const category = sourceCategoryLabel(mention);
    summary.set(category, (summary.get(category) ?? 0) + 1);

    return summary;
  }, new Map());
  const total = mentions.length || 1;

  return order
    .map((label) => ({
      label,
      count: counts.get(label) ?? 0,
      share: Math.round(((counts.get(label) ?? 0) / total) * 100),
      color: colors[label],
    }))
    .filter((item) => item.count > 0);
}

function buildSentimentByCategory(mentions: Mention[]) {
  return buildCategoryBreakdown(mentions).map((category) => {
    const categoryMentions = mentions.filter((mention) => sourceCategoryLabel(mention) === category.label);
    const positive = categoryMentions.filter((mention) => mention.sentiment === "positive").length;
    const neutral = categoryMentions.filter((mention) => mention.sentiment === "neutral").length;
    const negative = categoryMentions.filter((mention) => mention.sentiment === "negative").length;

    return {
      category: category.label,
      total: categoryMentions.length,
      positive,
      neutral,
      negative,
    };
  });
}

function buildShareOfVoice(mentions: Mention[], keywords: TrackedKeyword[]) {
  const total = mentions.length || 1;

  return keywords
    .map((keyword) => {
      const count = mentions.filter((mention) => mention.tracked_keyword?.id === keyword.id).length;

      return {
        id: keyword.id,
        label: keyword.keyword,
        count,
        share: Math.round((count / total) * 100),
      };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function dominantSentiment(mentions: Mention[]) {
  const counts = {
    positive: mentions.filter((mention) => mention.sentiment === "positive").length,
    neutral: mentions.filter((mention) => mention.sentiment === "neutral").length,
    negative: mentions.filter((mention) => mention.sentiment === "negative").length,
  };

  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "neutral") as "positive" | "neutral" | "negative";
}

function buildTopMentions(mentions: Mention[]) {
  return [...mentions]
    .sort((left, right) => {
      const leftScore =
        estimateMentionReach(left) +
        estimateMentionFollowers(left) +
        Number(left.metadata?.score ?? 0) * 55 +
        Number(left.metadata?.num_comments ?? 0) * 22;
      const rightScore =
        estimateMentionReach(right) +
        estimateMentionFollowers(right) +
        Number(right.metadata?.score ?? 0) * 55 +
        Number(right.metadata?.num_comments ?? 0) * 22;

      return rightScore - leftScore;
    })
    .slice(0, 5);
}

function buildTopProfiles(mentions: Mention[]) {
  return Array.from(
    mentions
      .filter((mention) => isSocialMention(mention) && mention.author_name?.trim())
      .reduce<Map<string, Mention[]>>((summary, mention) => {
        const key = mention.author_name?.trim() ?? "";
        const current = summary.get(key) ?? [];
        current.push(mention);
        summary.set(key, current);

        return summary;
      }, new Map()),
  )
    .map(([author, authorMentions]) => {
      const topMention = [...authorMentions].sort(
        (left, right) => estimateMentionReach(right) - estimateMentionReach(left),
      )[0];

      return {
        author,
        source: topMention?.metadata?.source_name ?? topMention?.source ?? "Social",
        followers: Math.max(...authorMentions.map((mention) => estimateMentionFollowers(mention))),
        reach: authorMentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0),
        mentionsCount: authorMentions.length,
        latestPublishedAt: [...authorMentions]
          .map((mention) => mention.published_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
        topMention,
        sentiment: dominantSentiment(authorMentions),
      };
    })
    .sort((left, right) => right.reach - left.reach);
}

function buildDonutGradient(items: { count: number; color: string }[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (!total) {
    return "conic-gradient(#e7e5e4 0deg 360deg)";
  }

  let current = 0;

  return `conic-gradient(${items
    .map((item) => {
      const start = (current / total) * 360;
      current += item.count;
      const end = (current / total) * 360;

      return `${item.color} ${start}deg ${end}deg`;
    })
    .join(", ")})`;
}

function buildLinePath(values: number[], width: number, height: number, scaleMax?: number) {
  if (!values.length) {
    return "";
  }

  const max = Math.max(scaleMax ?? Math.max(...values, 1), 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAxisSteps(maxValue: number, steps = 4) {
  if (maxValue <= 0) {
    return Array.from({ length: steps + 1 }, (_, index) => index);
  }

  const roughStep = maxValue / steps;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const normalized = roughStep / magnitude;
  const niceNormalizedStep =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalizedStep * magnitude;
  const ceiling = Math.ceil(maxValue / step) * step;

  return Array.from({ length: steps + 1 }, (_, index) => ceiling - step * index);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`/backend${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "The backend is unavailable. Start the Laravel API server or verify the BACKEND_URL setting.",
    );
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};
  const isJsonResponse = contentType.includes("application/json");

  if (text) {
    if (isJsonResponse) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("The backend returned invalid JSON.");
      }
    } else if (response.ok) {
      throw new Error("The backend returned an unexpected response format.");
    }
  }

  if (!response.ok) {
    const validationErrors = payload.errors as Record<string, string[]> | undefined;
    const validationMessage = validationErrors
      ? Object.values(validationErrors).flat()[0]
      : undefined;
    const plainTextMessage =
      !isJsonResponse && text && !text.trim().startsWith("<") ? text.trim() : undefined;
    const proxyFailureMessage =
      !isJsonResponse && [500, 502, 503, 504].includes(response.status)
        ? "The backend is unavailable. Start the Laravel API server or verify the BACKEND_URL setting."
        : undefined;

    throw new Error(
      validationMessage ??
        (payload.message as string | undefined) ??
        proxyFailureMessage ??
        plainTextMessage ??
        "The request could not be completed.",
    );
  }

  return payload as T;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <strong className="text-4xl font-semibold tracking-[-0.04em] text-stone-950">
          {value}
        </strong>
        <span className="max-w-[10rem] text-right text-sm leading-6 text-stone-500">
          {detail}
        </span>
      </div>
    </article>
  );
}

function ResultToneBadge({ tone }: { tone: string }) {
  const toneClassName =
    tone === "positive"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "negative"
        ? "bg-rose-100 text-rose-700"
        : "bg-stone-200 text-stone-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${toneClassName}`}>
      {tone}
    </span>
  );
}

function DonutBreakdownCard({
  eyebrow,
  title,
  items,
  totalLabel,
}: {
  eyebrow: string;
  title: string;
  items: { label: string; count: number; share: number; color: string }[];
  totalLabel: string;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">{eyebrow}</p>
      <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">{title}</h4>

      <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-center">
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-inner">
          <div
            className="flex h-36 w-36 items-center justify-center rounded-full"
            style={{
              background: buildDonutGradient(items),
            }}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
              <strong className="text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                {total}
              </strong>
              <span className="text-[11px] font-medium text-stone-500">{totalLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {items.length ? (
            items.map((item) => (
              <div key={item.label} className="rounded-[1.1rem] border border-white/70 bg-white/90 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <strong className="text-sm font-semibold text-stone-900">{item.label}</strong>
                  </div>
                  <span className="text-sm text-stone-500">
                    {item.count} • {item.share}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.1rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
              No breakdown is available for this date range yet.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function buildOverviewCards(mentions: Mention[]) {
  const totalReach = mentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0);
  const positiveMentions = mentions.filter((mention) => mention.sentiment === "positive").length;
  const negativeMentions = mentions.filter((mention) => mention.sentiment === "negative").length;

  return [
    {
      label: "Total mentions",
      value: `${mentions.length}`,
      note: "Matched mentions in the current project and period.",
    },
    {
      label: "Total reach",
      value: formatCompactNumber(totalReach),
      note: "Estimated visibility across the captured mention stream.",
    },
    {
      label: "Negative mentions",
      value: `${negativeMentions}`,
      note: "Mentions flagged with negative tone in the current stream.",
    },
    {
      label: "Positive mentions",
      value: `${positiveMentions}`,
      note: "Mentions flagged with positive tone in the current stream.",
    },
  ];
}

function buildDashboardCards(project: ProjectSummary | ProjectDetail | null, keywordCount: number) {
  return [
    {
      label: "Tracked keywords",
      value: `${keywordCount}`,
      note: "Saved queries actively shaping this monitoring brief.",
    },
    {
      label: "Project status",
      value: project ? project.status : "N/A",
      note: "Current operational state for the selected monitor.",
    },
    {
      label: "Channels",
      value: `${project?.monitored_platforms?.length ?? 0}`,
      note: "Configured platform groups for this project.",
    },
  ];
}

function buildSentimentBreakdown(mentions: Mention[]) {
  const order: Array<"positive" | "neutral" | "negative"> = [
    "positive",
    "neutral",
    "negative",
  ];

  return order.map((tone) => ({
    tone,
    count: mentions.filter((mention) => mention.sentiment === tone).length,
  }));
}

function buildChannelCoverage(sourceLabels: string[]) {
  const lowerSources = sourceLabels.map((source) => source.toLowerCase());
  const newsCount = lowerSources.filter(
    (source) =>
      !["linkedin", "reddit", "x", "twitter", "facebook", "tiktok"].some((token) =>
        source.includes(token),
      ),
  ).length;

  return [
    {
      label: "News",
      status: "Live",
      detail: "Archive + daily capture",
      count: newsCount,
    },
    {
      label: "Reddit",
      status: "Live",
      detail: "Official API collector",
      count: lowerSources.filter((source) => source.includes("reddit")).length,
    },
    {
      label: "X",
      status: "Live",
      detail: "Recent search API",
      count: lowerSources.filter(
        (source) => source.includes("x") || source.includes("twitter"),
      ).length,
    },
    {
      label: "LinkedIn",
      status: "Planned",
      detail: "Owned-page or partner access",
      count: lowerSources.filter((source) => source.includes("linkedin")).length,
    },
    {
      label: "Facebook",
      status: "Planned",
      detail: "Collector not enabled yet",
      count: lowerSources.filter((source) => source.includes("facebook")).length,
    },
    {
      label: "TikTok",
      status: "Planned",
      detail: "Collector not enabled yet",
      count: lowerSources.filter((source) => source.includes("tiktok")).length,
    },
  ];
}

function isSocialMention(mention: Mention) {
  const source = (mention.metadata?.source_name ?? mention.source).toLowerCase();

  return ["reddit", "linkedin", "x", "twitter", "facebook", "tiktok", "bsky"].some((token) =>
    source.includes(token),
  );
}

function buildAnalyticsMetrics(mentions: Mention[]) {
  const totalReach = mentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0);
  const socialMentions = mentions.filter((mention) => isSocialMention(mention));
  const nonSocialMentions = mentions.filter((mention) => !isSocialMention(mention));
  const socialReach = socialMentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0);
  const nonSocialReach = nonSocialMentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0);
  const positiveMentions = mentions.filter((mention) => mention.sentiment === "positive").length;
  const negativeMentions = mentions.filter((mention) => mention.sentiment === "negative").length;
  const userGeneratedContent = mentions.filter((mention) =>
    isSocialMention(mention) || mention.author_name?.toLowerCase().includes("user"),
  ).length;
  const socialComments = socialMentions.reduce(
    (sum, mention) => sum + Number(mention.metadata?.num_comments ?? 0),
    0,
  );
  const socialShares = socialMentions.reduce(
    (sum, mention) => sum + Math.max(0, Math.round(Number(mention.metadata?.score ?? 0) / 8)),
    0,
  );
  const socialReactions = socialMentions.reduce(
    (sum, mention) => sum + Math.max(0, Math.round(Number(mention.metadata?.score ?? 0) / 3)),
    0,
  );
  const totalSocialInteractions = socialComments + socialShares + socialReactions;
  const ave = Math.round(nonSocialReach * 0.06);

  return [
    { label: "Total mentions", value: `${mentions.length}` },
    { label: "Total reach", value: formatCompactNumber(totalReach) },
    { label: "Positive mentions", value: `${positiveMentions}` },
    { label: "Negative mentions", value: `${negativeMentions}` },
    { label: "Social media reach", value: formatCompactNumber(socialReach) },
    { label: "Non-social media reach", value: formatCompactNumber(nonSocialReach) },
    { label: "User generated content", value: `${userGeneratedContent}` },
    { label: "Social media mentions", value: `${socialMentions.length}` },
    { label: "Non-social media mentions", value: `${nonSocialMentions.length}` },
    { label: "Social media reactions", value: `${socialReactions}` },
    { label: "Social media comments", value: `${socialComments}` },
    { label: "Social media shares", value: `${socialShares}` },
    { label: "Total social interactions", value: `${totalSocialInteractions}` },
    { label: "AVE", value: `$${ave.toLocaleString("en-US")}` },
  ];
}

function MentionReachChart({
  mentions,
  windowDays = 14,
  label = "Last 14 days",
}: {
  mentions: Mention[];
  windowDays?: number;
  label?: string;
}) {
  const series = buildMentionReachSeries(mentions, windowDays);
  const mentionValues = series.map((point) => point.mentions);
  const reachValues = series.map((point) => point.reach);
  const width = 760;
  const height = 260;
  const plotLeft = 52;
  const plotRight = 56;
  const plotTop = 18;
  const plotBottom = 36;
  const plotWidth = width - plotLeft - plotRight;
  const plotHeight = height - plotTop - plotBottom;
  const maxMentions = Math.max(...mentionValues, 1);
  const maxReach = Math.max(...reachValues, 1);
  const mentionSteps = buildAxisSteps(maxMentions);
  const reachSteps = buildAxisSteps(maxReach);
  const mentionScaleMax = Math.max(...mentionSteps, 1);
  const reachScaleMax = Math.max(...reachSteps, 1);
  const xLabelFrequency = windowDays <= 14 ? 1 : windowDays <= 30 ? 3 : 7;
  const showPointLabels = windowDays <= 30;
  const xForIndex = (index: number) =>
    series.length === 1 ? plotLeft + plotWidth / 2 : plotLeft + (index / (series.length - 1)) * plotWidth;
  const yForMentions = (value: number) => plotTop + plotHeight - (value / mentionScaleMax) * plotHeight;
  const yForReach = (value: number) => plotTop + plotHeight - (value / reachScaleMax) * plotHeight;
  const mentionPath = buildLinePath(
    mentionValues,
    plotWidth,
    plotHeight,
    mentionScaleMax,
  )
    .replaceAll(/([ML]) ([^ ]+) ([^ ]+)/g, (_, command, x, y) => {
      return `${command} ${Number(x) + plotLeft} ${Number(y) + plotTop}`;
    });
  const reachPath = buildLinePath(
    reachValues,
    plotWidth,
    plotHeight,
    reachScaleMax,
  )
    .replaceAll(/([ML]) ([^ ]+) ([^ ]+)/g, (_, command, x, y) => {
      return `${command} ${Number(x) + plotLeft} ${Number(y) + plotTop}`;
    });

  return (
    <article className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-[0.9rem] bg-white px-4 py-2 text-sm font-semibold text-stone-950">
            Mentions & Reach
          </span>
          <span className="rounded-[0.9rem] border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-500">
            Sentiment
          </span>
        </div>
        <p className="text-sm text-stone-500">{label}</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-64 w-full"
          role="img"
          aria-label="Mentions and reach chart"
        >
          {mentionSteps.map((step) => {
            const y = yForMentions(step);

            return (
              <g key={`grid-${step}`}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={width - plotRight}
                  y2={y}
                  stroke="rgba(231,229,228,1)"
                  strokeWidth="1"
                />
                <text
                  x={plotLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#78716c"
                >
                  {step}
                </text>
              </g>
            );
          })}

          {reachSteps.map((step) => {
            const y = yForReach(step);

            return (
              <text
                key={`reach-${step}`}
                x={width - plotRight + 10}
                y={y + 4}
                fontSize="11"
                fill="#78716c"
              >
                {formatCompactNumber(step)}
              </text>
            );
          })}

          {series.map((point, index) => {
            const x = xForIndex(index);
            const shouldShowLabel = index % xLabelFrequency === 0 || index === series.length - 1;

            return (
              <g key={point.key}>
                {shouldShowLabel ? (
                  <>
                    <line
                      x1={x}
                      y1={plotTop}
                      x2={x}
                      y2={plotTop + plotHeight}
                      stroke="rgba(245,245,244,0.9)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#78716c"
                    >
                      {point.label}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          <path
            d={mentionPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={reachPath}
            fill="none"
            stroke="#15803d"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {series.map((point, index) => {
            const x = xForIndex(index);
            const y = yForMentions(point.mentions);

            return (
              <g key={`mention-point-${point.key}`}>
                <circle cx={x} cy={y} r="4.5" fill="#2563eb" />
                {showPointLabels && point.mentions > 0 ? (
                  <text
                    x={x}
                    y={Math.max(plotTop + 12, y - 10)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#1d4ed8"
                  >
                    {point.mentions}
                  </text>
                ) : null}
              </g>
            );
          })}

          {series.map((point, index) => {
            const x = xForIndex(index);
            const y = yForReach(point.reach);

            return (
              <g key={`reach-point-${point.key}`}>
                <circle cx={x} cy={y} r="4.5" fill="#15803d" />
                {showPointLabels && point.reach > 0 ? (
                  <text
                    x={x}
                    y={Math.max(plotTop + 12, y - 10)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#166534"
                  >
                    {formatCompactNumber(point.reach)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
          <span className="flex items-center gap-2 text-blue-600">
            <span className="h-0.5 w-6 rounded-full bg-blue-600" />
            Mentions count
          </span>
          <span className="flex items-center gap-2 text-green-700">
            <span className="h-0.5 w-6 rounded-full bg-green-700" />
            Estimated reach
          </span>
        </div>
      </div>
    </article>
  );
}

export function IqxIntelligenceApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>([]);
  const [projectAlertRules, setProjectAlertRules] = useState<AlertRule[]>([]);
  const [alertInbox, setAlertInbox] = useState<AlertInboxItem[]>([]);
  const [mediaCoverage, setMediaCoverage] = useState<MediaCoverage | null>(null);
  const [capturedArticles, setCapturedArticles] = useState<AdminCapturedArticles | null>(null);
  const [adminWorkspaceData, setAdminWorkspaceData] = useState<AdminWorkspaceData | null>(null);
  const [adminRefreshState, setAdminRefreshState] = useState<AdminRefreshState>(() =>
    createAdminRefreshState(),
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("results");
  const [bootError, setBootError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const [projectForm, setProjectForm] = useState({
    keywords: "",
  });
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const [alertChannelForm, setAlertChannelForm] = useState({
    editingId: null as number | null,
    name: "",
    type: "in_app",
    destination: "",
    botToken: "",
    accountSid: "",
    authToken: "",
    fromNumber: "",
    isActive: true,
  });
  const [alertRuleForm, setAlertRuleForm] = useState({
    editingId: null as number | null,
    name: "",
    frequency: "instant",
    minReach: "",
    sentiment: "all",
    sourceFilters: ["media", "reddit", "x"] as string[],
    trackedKeywordIds: [] as number[],
    channelIds: [] as number[],
    isActive: true,
  });
  const [projectEditorForm, setProjectEditorForm] = useState({
    name: "",
    description: "",
    audience: "",
    status: "active",
  });
  const [mentionsQuery, setMentionsQuery] = useState("");
  const [mentionsPage, setMentionsPage] = useState(1);
  const [analysisWindowDays, setAnalysisWindowDays] = useState<AnalysisWindowDays>(14);
  const [updatingMentionId, setUpdatingMentionId] = useState<number | null>(null);
  const [activeAdminCenterTab, setActiveAdminCenterTab] = useState<AdminCenterTab>("sources");
  const [adminArticlesQuery, setAdminArticlesQuery] = useState("");
  const [adminArticlesPage, setAdminArticlesPage] = useState(1);
  const [adminSourceQuery, setAdminSourceQuery] = useState("");
  const [adminSourceStatusFilter, setAdminSourceStatusFilter] = useState<
    "all" | "working" | "flaky" | "broken" | "premium-risk" | "unindexed"
  >("all");
  const [adminInventoryQuery, setAdminInventoryQuery] = useState("");
  const [keywordForm, setKeywordForm] = useState({
    keyword: "",
    platform: "all",
    matchType: "phrase",
  });

  const clearSession = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setProfile(null);
    setProjects([]);
    setSelectedProjectId(null);
    setSelectedProject(null);
    setAlertChannels([]);
    setProjectAlertRules([]);
    setAlertInbox([]);
    setMediaCoverage(null);
    setCapturedArticles(null);
    setAdminWorkspaceData(null);
    setAdminRefreshState(createAdminRefreshState());
    setActiveWorkspaceTab("results");
  };

  const loadProjectDetail = async (authToken: string, projectId: number) => {
    const response = await apiRequest<{ data: ProjectDetail }>(
      `/projects/${projectId}`,
      {},
      authToken,
    );

    setSelectedProject(response.data);
    setProjects((current) =>
      current.map((project) =>
        project.id === response.data.id
          ? {
              ...project,
              tracked_keywords_count: response.data.tracked_keywords_count,
              mentions_count: response.data.mentions_count,
            }
          : project,
      ),
    );
  };

  const loadAlertChannels = async (authToken: string) => {
    const response = await apiRequest<{ data: AlertChannel[] }>(
      "/alerts/channels",
      {},
      authToken,
    );

    setAlertChannels(response.data);

    return response.data;
  };

  const loadAlertInbox = async (authToken: string) => {
    const response = await apiRequest<{ data: AlertInboxItem[] }>(
      "/alerts/inbox",
      {},
      authToken,
    );

    setAlertInbox(response.data);

    return response.data;
  };

  const loadProjectAlertRules = async (authToken: string, projectId: number) => {
    const response = await apiRequest<{ data: AlertRule[] }>(
      `/projects/${projectId}/alerts`,
      {},
      authToken,
    );

    setProjectAlertRules(response.data);

    return response.data;
  };

  const loadMediaCoverage = async (authToken: string) => {
    const response = await apiRequest<{ data: MediaCoverage }>(
      "/admin/media-coverage",
      {},
      authToken,
    );

    setMediaCoverage(response.data);
  };

  const loadAdminWorkspaceData = async (authToken: string) => {
    const response = await apiRequest<{ data: AdminWorkspaceData }>(
      "/admin/workspace",
      {},
      authToken,
    );

    setAdminWorkspaceData(response.data);
  };

  const updateAdminIndexingStatus = async (
    authToken: string,
    autoIndexingPaused: boolean,
  ) => {
    const response = await apiRequest<{ data: { auto_indexing_paused: boolean } }>(
      "/admin/indexing-status",
      {
        method: "PATCH",
        body: JSON.stringify({
          auto_indexing_paused: autoIndexingPaused,
        }),
      },
      authToken,
    );

    setAdminWorkspaceData((current) =>
      current
        ? {
            ...current,
            automation: {
              ...current.automation,
              auto_indexing_paused: response.data.auto_indexing_paused,
            },
          }
        : current,
    );

    return response.data;
  };

  const loadCapturedArticles = async (
    authToken: string,
    page = 1,
    query = "",
  ) => {
    const params = new URLSearchParams({
      page: `${page}`,
      per_page: "20",
    });

    if (query.trim()) {
      params.set("q", query.trim());
    }

    const response = await apiRequest<{ data: AdminCapturedArticles }>(
      `/admin/media-articles?${params.toString()}`,
      {},
      authToken,
    );

    setCapturedArticles(response.data);
  };

  const refreshAdminArchive = async (
    authToken: string,
    page = 1,
    query = "",
  ) => {
    const params = new URLSearchParams({
      page: `${page}`,
      per_page: "20",
    });

    if (query.trim()) {
      params.set("q", query.trim());
    }

    const [coverageResponse, articlesResponse] = await Promise.all([
      apiRequest<{ data: MediaCoverage }>("/admin/media-coverage", {}, authToken),
      apiRequest<{ data: AdminCapturedArticles }>(
        `/admin/media-articles?${params.toString()}`,
        {},
        authToken,
      ),
    ]);

    setMediaCoverage(coverageResponse.data);
    setCapturedArticles(articlesResponse.data);

    return {
      coverage: coverageResponse.data,
      articles: articlesResponse.data,
    };
  };

  const hydrateSession = async (authToken: string, preferredProjectId?: number | null) => {
    const [meResponse, projectsResponse, channelsResponse, inboxResponse] = await Promise.all([
      apiRequest<{ data: Profile }>("/me", {}, authToken),
      apiRequest<{ data: ProjectSummary[] }>("/projects", {}, authToken),
      apiRequest<{ data: AlertChannel[] }>("/alerts/channels", {}, authToken),
      apiRequest<{ data: AlertInboxItem[] }>("/alerts/inbox", {}, authToken),
    ]);

    setProfile(meResponse.data);
    setProjects(projectsResponse.data);
    setAlertChannels(channelsResponse.data);
    setAlertInbox(inboxResponse.data);

    const projectId =
      projectsResponse.data.find((project) => project.id === preferredProjectId)?.id ??
      projectsResponse.data[0]?.id ??
      null;

    setSelectedProjectId(projectId);

    if (projectId) {
      await Promise.all([
        loadProjectDetail(authToken, projectId),
        loadProjectAlertRules(authToken, projectId),
      ]);
    } else {
      setSelectedProject(null);
      setProjectAlertRules([]);
    }

    if (meResponse.data.roles.includes("admin")) {
      await Promise.all([
        loadAdminWorkspaceData(authToken),
        loadMediaCoverage(authToken),
        loadCapturedArticles(authToken, 1, ""),
      ]);
    } else {
      setAdminWorkspaceData(null);
      setMediaCoverage(null);
      setCapturedArticles(null);
      setAdminRefreshState(createAdminRefreshState());
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await apiRequest<{ data: Plan[] }>("/plans");
        setPlans(response.data);

        const storedToken = window.localStorage.getItem(TOKEN_KEY);

        if (!storedToken) {
          return;
        }

        setToken(storedToken);
        await hydrateSession(storedToken);
      } catch (error) {
        clearSession();
        setBootError(
          error instanceof Error ? error.message : "The backend connection failed.",
        );
      } finally {
        setIsBooting(false);
      }
    };

    void initialize();
    // The app bootstraps once on mount and then manages session state explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProfileForm({
      name: profile?.name ?? "",
      email: profile?.email ?? "",
      password: "",
      passwordConfirmation: "",
    });
  }, [profile]);

  useEffect(() => {
    setProjectEditorForm({
      name: selectedProject?.name ?? "",
      description: selectedProject?.description ?? "",
      audience: selectedProject?.audience ?? "",
      status: selectedProject?.status ?? "active",
    });
  }, [selectedProject]);

  useEffect(() => {
    setAlertRuleForm((current) => ({
      ...current,
      trackedKeywordIds: current.trackedKeywordIds.filter((keywordId) =>
        (selectedProject?.tracked_keywords ?? []).some((keyword) => keyword.id === keywordId),
      ),
      channelIds: current.channelIds.filter((channelId) =>
        alertChannels.some((channel) => channel.id === channelId),
      ),
    }));
  }, [alertChannels, selectedProject]);

  useEffect(() => {
    setMentionsPage(1);
  }, [mentionsQuery, selectedProjectId]);

  useEffect(() => {
    setAdminArticlesPage(1);
  }, [adminArticlesQuery]);

  useEffect(() => {
    if (!token || !profile?.roles.includes("admin") || activeWorkspaceTab !== "articles") {
      return;
    }

    void loadCapturedArticles(token, adminArticlesPage, adminArticlesQuery);
  }, [activeWorkspaceTab, adminArticlesPage, adminArticlesQuery, profile, token]);

  const handleAuthSubmit = () => {
    startTransition(async () => {
      try {
        const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
        const payload =
          authMode === "register"
            ? {
                name: authForm.name,
                email: authForm.email,
                password: authForm.password,
                password_confirmation: authForm.passwordConfirmation,
                device_name: "iqx-web",
              }
            : {
                email: authForm.email,
                password: authForm.password,
                device_name: "iqx-web",
              };

        const response = await apiRequest<AuthResponse>(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        window.localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setFlashMessage(
          authMode === "register"
            ? "Account created. You can start organizing maritime projects now."
            : "Welcome back. Your workspace is ready.",
        );
        setBootError(null);
        setAuthForm({
          name: "",
          email: "",
          password: "",
          passwordConfirmation: "",
        });
        setActiveWorkspaceTab("results");
        await hydrateSession(response.token);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Authentication failed.");
      }
    });
  };

  const handleLogout = () => {
    startTransition(async () => {
      try {
        if (token) {
          await apiRequest("/auth/logout", { method: "POST" }, token);
        }
      } catch {
        // Clear the local session even if the token was already invalid server-side.
      } finally {
        clearSession();
        setFlashMessage("You have been signed out.");
      }
    });
  };

  const handleProfileSave = () => {
    if (!token || !profile) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{ data: Profile }>(
          "/me",
          {
            method: "PATCH",
            body: JSON.stringify({
              name: profileForm.name.trim(),
              email: profileForm.email.trim(),
              ...(profileForm.password.trim()
                ? {
                    password: profileForm.password,
                    password_confirmation: profileForm.passwordConfirmation,
                  }
                : {}),
            }),
          },
          token,
        );

        setProfile(response.data);
        setProfileForm({
          name: response.data.name,
          email: response.data.email,
          password: "",
          passwordConfirmation: "",
        });
        setFlashMessage("Profile details updated.");
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Profile update failed.");
      }
    });
  };

  const handleCreateProject = () => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        const keywords = parseKeywordList(projectForm.keywords);

        if (!keywords.length) {
          setBootError("Add at least one keyword or key phrase to create a project.");
          return;
        }

        const projectName = buildProjectNameFromKeywords(keywords);
        const response = await apiRequest<{ data: ProjectSummary }>(
          "/projects",
          {
            method: "POST",
            body: JSON.stringify({
              name: projectName,
              description: null,
              audience: null,
              monitored_platforms: ["linkedin", "reddit", "x", "media"],
            }),
          },
          token,
        );

        for (const keyword of keywords) {
          await apiRequest<{ data: TrackedKeyword }>(
            `/projects/${response.data.id}/keywords`,
            {
              method: "POST",
              body: JSON.stringify({
                keyword,
                platform: "all",
                match_type: "phrase",
              }),
            },
            token,
          );
        }

        setProjectForm({ keywords: "" });
        await hydrateSession(token, response.data.id);
        setActiveWorkspaceTab("results");
        setFlashMessage(
          `Project "${response.data.name}" created with ${keywords.length} keyword${keywords.length === 1 ? "" : "s"}.`,
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Project creation failed.");
      }
    });
  };

  const handleUpdateProject = () => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{ data: ProjectSummary }>(
          `/projects/${selectedProjectId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: projectEditorForm.name,
              description: projectEditorForm.description || null,
              audience: projectEditorForm.audience || null,
              status: projectEditorForm.status,
              monitored_platforms:
                currentProject?.monitored_platforms ?? ["linkedin", "reddit", "x", "media"],
            }),
          },
          token,
        );

        await hydrateSession(token, response.data.id);
        setFlashMessage(`Project "${response.data.name}" updated.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Project update failed.");
      }
    });
  };

  const handleDeleteProject = () => {
    if (!token || !selectedProjectId || !currentProject) {
      return;
    }

    if (!window.confirm(`Delete project "${currentProject.name}"? This will remove its keywords and mentions.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const deletedName = currentProject.name;

        await apiRequest(
          `/projects/${selectedProjectId}`,
          {
            method: "DELETE",
          },
          token,
        );

        await hydrateSession(token);
        setActiveWorkspaceTab("projects");
        setFlashMessage(`Project "${deletedName}" deleted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Project deletion failed.");
      }
    });
  };

  const handleProjectSelect = (projectId: number) => {
    if (!token) {
      return;
    }

    setSelectedProjectId(projectId);
    setActiveWorkspaceTab("results");

    startTransition(async () => {
      try {
        await Promise.all([
          loadProjectDetail(token, projectId),
          loadProjectAlertRules(token, projectId),
        ]);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Project load failed.");
      }
    });
  };

  const handleCreateKeyword = () => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<{ data: TrackedKeyword }>(
          `/projects/${selectedProjectId}/keywords`,
          {
            method: "POST",
            body: JSON.stringify({
              keyword: keywordForm.keyword,
              platform: keywordForm.platform,
              match_type: keywordForm.matchType,
            }),
          },
          token,
        );

        setKeywordForm({ keyword: "", platform: "all", matchType: "phrase" });
        await hydrateSession(token, selectedProjectId);
        setActiveWorkspaceTab("results");
        setFlashMessage("Tracked keyword added.");
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Keyword creation failed.");
      }
    });
  };

  const handleDeleteKeyword = (keywordId: number, keywordLabel: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/keywords/${keywordId}`,
          {
            method: "DELETE",
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);
        setFlashMessage(`Keyword "${keywordLabel}" removed.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Keyword removal failed.");
      }
    });
  };

  const handleMuteSource = (domain: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/sources/mute`,
          {
            method: "POST",
            body: JSON.stringify({ domain }),
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);
        setFlashMessage(`Source "${domain}" muted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Source mute failed.");
      }
    });
  };

  const handleUnmuteSource = (domain: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/sources/mute/${encodeURIComponent(domain)}`,
          {
            method: "DELETE",
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);
        setFlashMessage(`Source "${domain}" unmuted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Source unmute failed.");
      }
    });
  };

  const handleMuteInfluencer = (author: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/influencers/mute`,
          {
            method: "POST",
            body: JSON.stringify({ author }),
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);
        setFlashMessage(`Influencer "${author}" muted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Influencer mute failed.");
      }
    });
  };

  const handleUpdateMentionSentiment = (
    mentionId: number,
    sentiment: (typeof mentionSentimentOptions)[number]["value"],
  ) => {
    if (!token || !selectedProjectId) {
      return;
    }

    setUpdatingMentionId(mentionId);

    startTransition(async () => {
      try {
        const response = await apiRequest<{ data: Mention; message?: string }>(
          `/projects/${selectedProjectId}/mentions/${mentionId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ sentiment }),
          },
          token,
        );

        setSelectedProject((current) =>
          current && current.id === selectedProjectId
            ? {
                ...current,
                mentions: current.mentions.map((mention) =>
                  mention.id === mentionId ? response.data : mention,
                ),
              }
            : current,
        );
        setFlashMessage(
          response.message ??
            (sentiment === "auto"
              ? "Sentiment reset to the system value."
              : "Sentiment updated."),
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Sentiment update failed.");
      } finally {
        setUpdatingMentionId((current) => (current === mentionId ? null : current));
      }
    });
  };

  const handleExcludeMention = (mentionId: number, mentionTitle: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    if (!window.confirm(`Exclude "${mentionTitle}" from this project's mentions?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{ message: string }>(
          `/projects/${selectedProjectId}/mentions/${mentionId}/exclude`,
          {
            method: "POST",
          },
          token,
        );

        setFlashMessage(response.message);
        await hydrateSession(token, selectedProjectId);
        setBootError(null);
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Mention could not be excluded.",
        );
      }
    });
  };

  const handleDeleteCapturedArticle = (article: CapturedArticle) => {
    if (!token) {
      return;
    }

    if (!window.confirm(`Delete "${article.title}" from the captured article archive?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{
          message: string;
          data: { deleted_mentions: number };
        }>(
          `/admin/media-articles/${article.id}`,
          {
            method: "DELETE",
          },
          token,
        );

        await refreshAdminArchive(token, adminArticlesPage, adminArticlesQuery);
        if (selectedProjectId) {
          await loadProjectDetail(token, selectedProjectId);
        }
        setFlashMessage(
          response.data.deleted_mentions > 0
            ? `${response.message} ${response.data.deleted_mentions} linked mention(s) were removed too.`
            : response.message,
        );
        setBootError(null);
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Captured article could not be deleted.",
        );
      }
    });
  };

  const handleUnmuteInfluencer = (author: string) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/influencers/mute/${encodeURIComponent(author)}`,
          {
            method: "DELETE",
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);
        setFlashMessage(`Influencer "${author}" unmuted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Influencer unmute failed.");
      }
    });
  };

  const resetAlertChannelForm = () => {
    setAlertChannelForm({
      editingId: null,
      name: "",
      type: "in_app",
      destination: "",
      botToken: "",
      accountSid: "",
      authToken: "",
      fromNumber: "",
      isActive: true,
    });
  };

  const resetAlertRuleForm = () => {
    setAlertRuleForm({
      editingId: null,
      name: "",
      frequency: "instant",
      minReach: "",
      sentiment: "all",
      sourceFilters: ["media", "reddit", "x"],
      trackedKeywordIds: [],
      channelIds: [],
      isActive: true,
    });
  };

  const handleEditAlertChannel = (channel: AlertChannel) => {
    setActiveWorkspaceTab("alerts");
    setAlertChannelForm({
      editingId: channel.id,
      name: channel.name,
      type: channel.type,
      destination: channel.destination ?? "",
      botToken: channel.config?.bot_token ?? "",
      accountSid: channel.config?.account_sid ?? "",
      authToken: channel.config?.auth_token ?? "",
      fromNumber: channel.config?.from_number ?? "",
      isActive: channel.is_active,
    });
  };

  const handleSaveAlertChannel = () => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        const config: Record<string, string> = {};

        if (alertChannelForm.type === "telegram" && alertChannelForm.botToken.trim()) {
          config.bot_token = alertChannelForm.botToken.trim();
        }

        if (["sms", "whatsapp"].includes(alertChannelForm.type)) {
          if (alertChannelForm.accountSid.trim()) {
            config.account_sid = alertChannelForm.accountSid.trim();
          }

          if (alertChannelForm.authToken.trim()) {
            config.auth_token = alertChannelForm.authToken.trim();
          }

          if (alertChannelForm.fromNumber.trim()) {
            config.from_number = alertChannelForm.fromNumber.trim();
          }
        }

        const destination =
          alertChannelForm.type === "in_app" ? null : alertChannelForm.destination.trim() || null;
        const payload = {
          type: alertChannelForm.type,
          name: alertChannelForm.name.trim(),
          destination,
          config,
          is_active: alertChannelForm.isActive,
        };

        await apiRequest<{ data: AlertChannel }>(
          alertChannelForm.editingId
            ? `/alerts/channels/${alertChannelForm.editingId}`
            : "/alerts/channels",
          {
            method: alertChannelForm.editingId ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
          token,
        );

        await loadAlertChannels(token);

        if (selectedProjectId) {
          await loadProjectAlertRules(token, selectedProjectId);
        }

        resetAlertChannelForm();
        setFlashMessage(
          alertChannelForm.editingId
            ? "Alert channel updated."
            : "Alert channel added.",
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert channel save failed.");
      }
    });
  };

  const handleToggleAlertChannel = (channel: AlertChannel) => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<{ data: AlertChannel }>(
          `/alerts/channels/${channel.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              is_active: !channel.is_active,
            }),
          },
          token,
        );

        await loadAlertChannels(token);
        setFlashMessage(
          channel.is_active
            ? `Alert channel "${channel.name}" paused.`
            : `Alert channel "${channel.name}" re-enabled.`,
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert channel update failed.");
      }
    });
  };

  const handleDeleteAlertChannel = (channel: AlertChannel) => {
    if (!token) {
      return;
    }

    if (!window.confirm(`Delete alert channel "${channel.name}"?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/alerts/channels/${channel.id}`,
          {
            method: "DELETE",
          },
          token,
        );

        await loadAlertChannels(token);

        if (selectedProjectId) {
          await loadProjectAlertRules(token, selectedProjectId);
        }

        if (alertChannelForm.editingId === channel.id) {
          resetAlertChannelForm();
        }

        setFlashMessage(`Alert channel "${channel.name}" deleted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert channel deletion failed.");
      }
    });
  };

  const handleEditAlertRule = (rule: AlertRule) => {
    setActiveWorkspaceTab("alerts");
    setAlertRuleForm({
      editingId: rule.id,
      name: rule.name,
      frequency: rule.frequency,
      minReach: rule.min_reach ? `${rule.min_reach}` : "",
      sentiment: rule.sentiment ?? "all",
      sourceFilters: rule.source_filters.length ? rule.source_filters : ["media", "reddit", "x"],
      trackedKeywordIds: rule.tracked_keyword_ids,
      channelIds: rule.channels.map((channel) => channel.id),
      isActive: rule.is_active,
    });
  };

  const handleSaveAlertRule = () => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<{ data: AlertRule }>(
          alertRuleForm.editingId
            ? `/projects/${selectedProjectId}/alerts/${alertRuleForm.editingId}`
            : `/projects/${selectedProjectId}/alerts`,
          {
            method: alertRuleForm.editingId ? "PATCH" : "POST",
            body: JSON.stringify({
              name: alertRuleForm.name.trim(),
              frequency: alertRuleForm.frequency,
              is_active: alertRuleForm.isActive,
              min_reach: alertRuleForm.minReach.trim()
                ? Number(alertRuleForm.minReach)
                : null,
              sentiment: alertRuleForm.sentiment === "all" ? null : alertRuleForm.sentiment,
              source_filters: alertRuleForm.sourceFilters,
              tracked_keyword_ids: alertRuleForm.trackedKeywordIds,
              channel_ids: alertRuleForm.channelIds,
            }),
          },
          token,
        );

        await loadProjectAlertRules(token, selectedProjectId);
        await loadAlertInbox(token);
        resetAlertRuleForm();
        setFlashMessage(
          alertRuleForm.editingId
            ? "Alert rule updated."
            : "Alert rule created.",
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert rule save failed.");
      }
    });
  };

  const handleToggleAlertRule = (rule: AlertRule) => {
    if (!token || !selectedProjectId) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<{ data: AlertRule }>(
          `/projects/${selectedProjectId}/alerts/${rule.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              is_active: !rule.is_active,
            }),
          },
          token,
        );

        await loadProjectAlertRules(token, selectedProjectId);
        setFlashMessage(
          rule.is_active
            ? `Alert rule "${rule.name}" paused.`
            : `Alert rule "${rule.name}" re-enabled.`,
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert rule update failed.");
      }
    });
  };

  const handleDeleteAlertRule = (rule: AlertRule) => {
    if (!token || !selectedProjectId) {
      return;
    }

    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(
          `/projects/${selectedProjectId}/alerts/${rule.id}`,
          {
            method: "DELETE",
          },
          token,
        );

        await loadProjectAlertRules(token, selectedProjectId);

        if (alertRuleForm.editingId === rule.id) {
          resetAlertRuleForm();
        }

        setFlashMessage(`Alert rule "${rule.name}" deleted.`);
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert rule deletion failed.");
      }
    });
  };

  const handleMarkAlertRead = (item: AlertInboxItem) => {
    if (!token || item.read_at) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<{ data: AlertInboxItem }>(
          `/alerts/inbox/${item.id}/read`,
          {
            method: "PATCH",
          },
          token,
        );

        setAlertInbox((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry,
          ),
        );
        setProfile((current) =>
          current
            ? {
                ...current,
                counts: {
                  ...current.counts,
                  unread_alerts: Math.max(0, current.counts.unread_alerts - 1),
                },
              }
            : current,
        );
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Alert read state could not be updated.");
      }
    });
  };

  const handleCheckout = (planSlug: string) => {
    if (!token) {
      setFlashMessage("Create an account or sign in before starting a subscription.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{
          checkout_url?: string;
          billing_portal_url?: string;
          message?: string;
        }>(
          `/billing/checkout/${planSlug}`,
          {
            method: "POST",
            body: JSON.stringify({
              success_url: window.location.href,
              cancel_url: window.location.href,
            }),
          },
          token,
        );

        const destination = response.checkout_url ?? response.billing_portal_url;

        if (destination) {
          window.location.href = destination;
          return;
        }

        setFlashMessage(response.message ?? "Billing request completed.");
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Billing checkout could not start.",
        );
      }
    });
  };

  const handleOpenPortal = () => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await apiRequest<{ billing_portal_url: string }>(
          `/billing/portal?return_url=${encodeURIComponent(window.location.href)}`,
          {},
          token,
        );

        window.location.href = response.billing_portal_url;
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Billing portal could not be opened.",
        );
      }
    });
  };

  const handleAdminCaptureMentions = (
    source?: Pick<MediaCoverage["sources"][number], "key" | "name">,
  ) => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        const startedAt = new Date().toISOString();
        const baselineArticleCount = mediaCoverage?.summary.archive_articles ?? 0;
        const baselineIndexedSources = mediaCoverage?.summary.indexed_sources ?? 0;
        const baselineLatestArticleId = capturedArticles?.items[0]?.id ?? null;
        const baselineLatestArticle = capturedArticles?.items[0] ?? null;
        const maxPolls = 12;

        setAdminRefreshState({
          phase: "starting",
          started_at: startedAt,
          source_key: source?.key ?? null,
          source_name: source?.name ?? null,
          poll_attempt: 0,
          max_polls: maxPolls,
          baseline_article_count: baselineArticleCount,
          current_article_count: baselineArticleCount,
          baseline_indexed_sources: baselineIndexedSources,
          current_indexed_sources: baselineIndexedSources,
          latest_article_title: baselineLatestArticle?.title ?? null,
          latest_article_published_at: baselineLatestArticle?.published_at ?? null,
          message: source
            ? `Queueing index for ${source.name}.`
            : "Queueing refresh for news, Reddit, and X.",
        });
        const response = await apiRequest<{
          data: { projects_processed: number; capture_started: boolean; source_key?: string | null };
          message: string;
        }>(
          "/admin/media-capture",
          {
            method: "POST",
            body: JSON.stringify({
              project_id: selectedProjectId,
              source_key: source?.key ?? null,
              force: true,
              days: 90,
            }),
          },
          token,
        );

        setAdminRefreshState((current) => ({
          ...current,
          phase: "polling",
          message: response.message,
        }));

        await hydrateSession(token, selectedProjectId);

        if (profile?.roles.includes("admin")) {
          let archiveActivityDetected = false;
          let latestState = createAdminRefreshState();

          for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
            await wait(5000);

            const { coverage, articles } = await refreshAdminArchive(
              token,
              activeWorkspaceTab === "articles" ? adminArticlesPage : 1,
              activeWorkspaceTab === "articles" ? adminArticlesQuery : "",
            );

            const latestArticle = articles.items[0] ?? null;
            const latestArticleId = latestArticle?.id ?? null;
            const currentArticleCount = coverage.summary.archive_articles;
            const currentIndexedSources = coverage.summary.indexed_sources;
            const activityDetected =
              currentArticleCount > baselineArticleCount ||
              currentIndexedSources > baselineIndexedSources ||
              latestArticleId !== baselineLatestArticleId;

            latestState = {
              phase: activityDetected ? "active" : "polling",
              started_at: startedAt,
              source_key: source?.key ?? null,
              source_name: source?.name ?? null,
              poll_attempt: attempt,
              max_polls: maxPolls,
              baseline_article_count: baselineArticleCount,
              current_article_count: currentArticleCount,
              baseline_indexed_sources: baselineIndexedSources,
              current_indexed_sources: currentIndexedSources,
              latest_article_title: latestArticle?.title ?? baselineLatestArticle?.title ?? null,
              latest_article_published_at:
                latestArticle?.published_at ?? baselineLatestArticle?.published_at ?? null,
              message: activityDetected
                ? "New archive activity detected. Background indexing may still be running."
                : `Checking source and archive progress (${attempt}/${maxPolls}).`,
            };

            setAdminRefreshState(latestState);

            if (activityDetected) {
              archiveActivityDetected = true;
              break;
            }
          }

          if (!archiveActivityDetected) {
            latestState = {
              phase: "stalled",
              started_at: startedAt,
              source_key: source?.key ?? null,
              source_name: source?.name ?? null,
              poll_attempt: maxPolls,
              max_polls: maxPolls,
              baseline_article_count: baselineArticleCount,
              current_article_count: latestState.current_article_count || baselineArticleCount,
              baseline_indexed_sources: baselineIndexedSources,
              current_indexed_sources:
                latestState.current_indexed_sources || baselineIndexedSources,
              latest_article_title:
                latestState.latest_article_title ?? baselineLatestArticle?.title ?? null,
              latest_article_published_at:
                latestState.latest_article_published_at ??
                baselineLatestArticle?.published_at ??
                null,
              message:
                "Refresh started, but no new indexed articles were visible during the last minute.",
            };

            setAdminRefreshState(latestState);
          }

          setFlashMessage(
            archiveActivityDetected
              ? source
                ? `${source.name} indexing activity detected. Open Admin Center to monitor that source.`
                : "Refresh activity detected. Open Admin Center to monitor indexed sources and captured articles."
              : source
                ? `${source.name} indexing started. Open Admin Center to watch that source.`
                : "Refresh started. Open Admin Center to watch indexing progress.",
          );
        } else {
          setFlashMessage(response.message);
        }

        setBootError(null);
      } catch (error) {
        setAdminRefreshState((current) => ({
          ...current,
          phase: "error",
          source_key: current.source_key ?? source?.key ?? null,
          source_name: current.source_name ?? source?.name ?? null,
          message:
            error instanceof Error ? error.message : "Media capture could not be started.",
        }));
        setBootError(
          error instanceof Error ? error.message : "Media capture could not be started.",
        );
      }
    });
  };

  const handleToggleAutoIndexing = () => {
    if (!token || !adminWorkspaceData) {
      return;
    }

    startTransition(async () => {
      try {
        const nextPausedState = !adminWorkspaceData.automation.auto_indexing_paused;
        const response = await updateAdminIndexingStatus(token, nextPausedState);

        setFlashMessage(
          response.auto_indexing_paused
            ? "Auto indexing paused. Scheduled media discovery will stay off until you resume it."
            : "Auto indexing resumed. Scheduled media discovery is live again.",
        );
        setBootError(null);
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Auto indexing status could not be updated.",
        );
      }
    });
  };

  const handleExportPdfReport = (
    reportMentions = filteredMentions,
    reportLabel = "Latest monitoring snapshot for the selected project.",
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1200,height=900");

    if (!reportWindow) {
      setBootError("The report window could not be opened.");
      return;
    }

    const visibleMentions = reportMentions.slice(0, 12)
      .map((mention) => {
        const source = mention.metadata?.source_name ?? mention.source;

        return `
          <article style="border:1px solid #d6d3d1;border-radius:18px;padding:18px;margin-bottom:14px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#78716c;">${source}</div>
            <h3 style="margin:10px 0 8px;font-size:22px;color:#0c0a09;">${mention.title ?? "Untitled result"}</h3>
            <p style="margin:0 0 10px;color:#57534e;line-height:1.7;">${mention.body}</p>
            <div style="font-size:12px;color:#78716c;">${formatPublishedAt(mention.published_at)} | Keyword: ${mention.tracked_keyword?.keyword ?? "Unlinked"} | Reach: ${formatCompactNumber(estimateMentionReach(mention))}</div>
          </article>
        `;
      })
      .join("");

    reportWindow.document.write(`
      <html>
        <head>
          <title>${currentProject?.name ?? "IQX Intelligence"} Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #1c1917; }
            h1, h2, h3, p { margin: 0; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
            .card { border: 1px solid #d6d3d1; border-radius: 20px; padding: 18px; background: #fafaf9; }
            .muted { color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: .14em; }
          </style>
        </head>
        <body>
          <div class="muted">IQX Intelligence PDF Report</div>
          <h1 style="font-size: 38px; margin-top: 10px;">${currentProject?.name ?? "Monitoring report"}</h1>
          <p style="margin-top: 12px; font-size: 16px; color: #57534e;">
            ${reportLabel}
          </p>
          <p style="margin-top: 12px; font-size: 16px; color: #57534e;">
            Generated on ${new Intl.DateTimeFormat("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date())}
          </p>
          <div class="grid">
            <div class="card"><div class="muted">Mentions</div><div style="font-size:34px;font-weight:700;margin-top:8px;">${reportMentions.length}</div></div>
            <div class="card"><div class="muted">Estimated Reach</div><div style="font-size:34px;font-weight:700;margin-top:8px;">${formatCompactNumber(reportMentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0))}</div></div>
            <div class="card"><div class="muted">Tracked Keywords</div><div style="font-size:34px;font-weight:700;margin-top:8px;">${trackedKeywords.length}</div></div>
          </div>
          <h2 style="font-size: 26px; margin: 24px 0 16px;">Recent Results</h2>
          ${visibleMentions || '<p style="color:#57534e;">No mentions available for export yet.</p>'}
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const currentProject =
    selectedProject ?? projects.find((project) => project.id === selectedProjectId) ?? null;
  const trackedKeywords = selectedProject?.tracked_keywords ?? [];
  const mentions = selectedProject?.mentions ?? [];
  const analysisMentions = filterMentionsByWindow(mentions, analysisWindowDays);
  const sourceGroups = selectedProject?.source_groups ?? [];
  const influencerGroups = selectedProject?.influencer_groups ?? [];
  const filteredMentions = mentions.filter((mention) => {
    const haystack = `${mention.title ?? ""} ${mention.body} ${mention.author_name ?? ""} ${
      mention.metadata?.source_name ?? mention.source
    } ${mention.tracked_keyword?.keyword ?? ""}`.toLowerCase();

    return haystack.includes(mentionsQuery.trim().toLowerCase());
  });
  const mentionsPageSize = 8;
  const totalMentionsPages = Math.max(1, Math.ceil(filteredMentions.length / mentionsPageSize));
  const safeMentionsPage = Math.min(mentionsPage, totalMentionsPages);
  const paginatedMentions = filteredMentions.slice(
    (safeMentionsPage - 1) * mentionsPageSize,
    safeMentionsPage * mentionsPageSize,
  );
  const isAdmin = profile?.roles.includes("admin") ?? false;
  const adminCenterTabs: { key: AdminCenterTab; label: string }[] = [
    { key: "sources", label: "All Sources" },
    { key: "projects", label: "All Projects" },
    { key: "users", label: "All Users" },
    { key: "keywords", label: "All Keywords" },
    { key: "indexes", label: "All Indexes" },
  ];
  const indexedSources = mediaCoverage?.summary.indexed_sources ?? 0;
  const archiveArticles = mediaCoverage?.summary.archive_articles ?? 0;
  const coverageSources = mediaCoverage?.sources.slice(0, 6) ?? [];
  const filteredAdminSources = (mediaCoverage?.sources ?? []).filter((source) => {
    const normalizedQuery = adminSourceQuery.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery === "" ||
      `${source.name} ${source.key} ${source.homepage} ${source.notes} ${source.status_label}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesStatus =
      adminSourceStatusFilter === "all" || source.status === adminSourceStatusFilter;

    return matchesQuery && matchesStatus;
  });
  const allCapturedArticleItems = capturedArticles?.items ?? [];
  const allCapturedArticleMeta = capturedArticles?.meta ?? {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  };
  const latestCapturedArticle = allCapturedArticleItems[0] ?? null;
  const normalizedAdminInventoryQuery = adminInventoryQuery.trim().toLowerCase();
  const adminProjects = (adminWorkspaceData?.projects ?? []).filter((project) => {
    if (normalizedAdminInventoryQuery === "") {
      return true;
    }

    return `${project.name} ${project.slug} ${project.status} ${project.user.name ?? ""} ${
      project.user.email ?? ""
    } ${project.description ?? ""}`
      .toLowerCase()
      .includes(normalizedAdminInventoryQuery);
  });
  const adminUsers = (adminWorkspaceData?.users ?? []).filter((account) => {
    if (normalizedAdminInventoryQuery === "") {
      return true;
    }

    return `${account.name} ${account.email} ${account.roles.join(" ")} ${
      account.plan_name ?? ""
    }`
      .toLowerCase()
      .includes(normalizedAdminInventoryQuery);
  });
  const adminKeywords = (adminWorkspaceData?.keywords ?? []).filter((keyword) => {
    if (normalizedAdminInventoryQuery === "") {
      return true;
    }

    return `${keyword.keyword} ${keyword.platform} ${keyword.match_type} ${
      keyword.project.name ?? ""
    } ${keyword.user.name ?? ""} ${keyword.user.email ?? ""}`
      .toLowerCase()
      .includes(normalizedAdminInventoryQuery);
  });
  const adminRefreshArticleDelta =
    adminRefreshState.current_article_count - adminRefreshState.baseline_article_count;
  const adminRefreshIndexedDelta =
    adminRefreshState.current_indexed_sources - adminRefreshState.baseline_indexed_sources;
  const adminRefreshProgressPercent =
    adminRefreshState.phase === "idle"
      ? 0
      : Math.max(
          8,
          Math.min(
            100,
            Math.round((adminRefreshState.poll_attempt / adminRefreshState.max_polls) * 100),
          ),
        );
  const isAdminRefreshRunning =
    adminRefreshState.phase === "starting" || adminRefreshState.phase === "polling";
  const adminRefreshScopeLabel = adminRefreshState.source_name
    ? `Target: ${adminRefreshState.source_name}`
    : "Target: all enabled sources";
  const autoIndexingPaused = adminWorkspaceData?.automation.auto_indexing_paused ?? false;
  const adminRefreshButtonLabel =
    adminRefreshState.phase === "starting"
      ? "Starting refresh..."
      : adminRefreshState.phase === "polling"
        ? `Refreshing... ${adminRefreshState.poll_attempt}/${adminRefreshState.max_polls}`
        : "Refresh archive";
  const channelCoverage = buildChannelCoverage(
    sourceGroups.length
      ? sourceGroups.map((group) => group.domain)
      : mentions.map((mention) => mention.metadata?.source_name ?? mention.source),
  );
  const overviewCards = buildOverviewCards(mentions);
  const analyticsMetrics = buildAnalyticsMetrics(analysisMentions);
  const dashboardCards = buildDashboardCards(currentProject, trackedKeywords.length);
  const analysisOverviewCards = analyticsMetrics.slice(0, 9);
  const analysisCategoryBreakdown = buildCategoryBreakdown(analysisMentions);
  const analysisSentimentBreakdown = buildSentimentBreakdown(analysisMentions).map((item) => ({
    ...item,
    share: analysisMentions.length ? Math.round((item.count / analysisMentions.length) * 100) : 0,
    color:
      item.tone === "positive"
        ? "#10b981"
        : item.tone === "negative"
          ? "#f43f5e"
          : "#78716c",
  }));
  const analysisSentimentByCategory = buildSentimentByCategory(analysisMentions);
  const popularAnalysisMentions = buildTopMentions(analysisMentions);
  const topPublicProfiles = buildTopProfiles(analysisMentions).slice(0, 5);
  const shareOfVoice = buildShareOfVoice(analysisMentions, trackedKeywords);
  const topFollowers = [...topPublicProfiles]
    .sort((left, right) => right.followers - left.followers)
    .slice(0, 5);
  const alertSourceOptions = [
    { value: "media", label: "Media" },
    { value: "reddit", label: "Reddit" },
    { value: "x", label: "X" },
  ];
  const selectedAlertChannelOption = alertChannelTypeOptions.find(
    (option) => option.value === alertChannelForm.type,
  );
  const alertDestinationLabel =
    alertChannelForm.type === "email"
      ? "Recipient email"
      : alertChannelForm.type === "telegram"
        ? "Telegram chat id"
        : ["sms", "whatsapp"].includes(alertChannelForm.type)
          ? "Recipient phone number"
          : alertChannelForm.type === "in_app"
            ? "Destination"
            : "Webhook URL";
  const isProfileDirty =
    profileForm.name.trim() !== (profile?.name ?? "") ||
    profileForm.email.trim() !== (profile?.email ?? "") ||
    profileForm.password.trim() !== "" ||
    profileForm.passwordConfirmation.trim() !== "";
  const workspaceTabs: { key: WorkspaceTab; label: string }[] = [
    { key: "results", label: "Mentions" },
    {
      key: "alerts",
      label: `Alerts${profile?.counts.unread_alerts ? ` (${profile.counts.unread_alerts})` : ""}`,
    },
    { key: "analysis", label: "Analytics" },
    { key: "sources", label: "Influencers & Sources" },
    ...(isAdmin ? [{ key: "articles" as WorkspaceTab, label: "Admin Center" }] : []),
    { key: "profile", label: "Profile" },
    { key: "keywords", label: "Keywords" },
    { key: "projects", label: "Projects" },
  ];
  const headerWorkspaceTabs = workspaceTabs.filter(
    (tab) => tab.key !== "profile" && tab.key !== "articles",
  );
  const activeViewWorkspaceTabs: { key: WorkspaceTab; label: string }[] = [
    workspaceTabs.find((tab) => tab.key === "results"),
    workspaceTabs.find((tab) => tab.key === "keywords"),
    workspaceTabs.find((tab) => tab.key === "analysis"),
    workspaceTabs.find((tab) => tab.key === "sources"),
    workspaceTabs.find((tab) => tab.key === "alerts"),
  ].filter((tab): tab is { key: WorkspaceTab; label: string } => Boolean(tab));
  const anonymousNavItems = [
    { key: "overview", label: "Overview", href: "#overview" },
    { key: "access", label: "Access", href: "#access" },
  ];
  const activeTabCopy: Record<
    WorkspaceTab,
    { eyebrow: string; title: string; description: string }
  > = {
    results: {
      eyebrow: "Active view",
      title: "Mention stream",
      description:
        "Review matched mentions first, then move into analysis, sources, and keyword tuning as needed.",
    },
    analysis: {
      eyebrow: "Active view",
      title: "Analytics",
      description:
        "Track mentions, estimated reach, tone, and source performance in a customer-friendly monitoring view.",
    },
    alerts: {
      eyebrow: "Active view",
      title: "Alert routing",
      description:
        "Connect inbox, email, chat, webhook, and mobile delivery channels, then define project rules for instant or digest notifications.",
    },
    sources: {
      eyebrow: "Active view",
      title: "Source visibility",
      description:
        "See where matched mentions are coming from and, for admins, inspect archive coverage without cluttering the main mention workflow.",
    },
    articles: {
      eyebrow: "Active view",
      title: "Admin center",
      description:
        "Manage the monitored source inventory, see which sources are indexed, and inspect the captured archive from one admin-only workspace.",
    },
    profile: {
      eyebrow: "Active view",
      title: "Profile & membership",
      description:
        "Review your current access, update account details, and move into plan management without leaving the workspace.",
    },
    keywords: {
      eyebrow: "Active view",
      title: "Keyword management",
      description:
        "Add focused search terms, control platform targeting, and shape the exact signal set for the selected project.",
    },
    projects: {
      eyebrow: "Active view",
      title: "Project monitoring",
      description:
        "Switch between customer, port, competitor, or risk monitors and keep each tracking brief clearly separated.",
    },
    "new-project": {
      eyebrow: "Active view",
      title: "Create a new project",
      description:
        "Launch a dedicated monitoring brief for a brand, route, incident, competitor, or campaign without cluttering the core view.",
    },
    plans: {
      eyebrow: "Active view",
      title: "Subscription plans",
      description:
        "Manage access, plan limits, and commercial coverage only when you need it, not on every workspace screen.",
    },
  };
  const currentTabCopy = activeTabCopy[activeWorkspaceTab];

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--canvas)] text-stone-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,_rgba(196,181,253,0.22),_transparent_38%),radial-gradient(circle_at_25%_30%,_rgba(125,211,252,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.16),_transparent_24%)]" />

      <div className="sticky top-0 z-30 w-full px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <header className="w-full rounded-[1.5rem] border border-white/60 bg-white/86 px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur sm:px-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <h1 className="text-base font-semibold tracking-[-0.03em] text-stone-950 sm:text-lg">
              IQX Intelligence
            </h1>

            <nav className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto text-sm text-stone-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-3">
              {profile
                ? headerWorkspaceTabs.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveWorkspaceTab(item.key)}
                      className={`shrink-0 rounded-full px-3 py-2 transition-colors ${
                        activeWorkspaceTab === item.key
                          ? "bg-stone-950 text-stone-50"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))
                : anonymousNavItems.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="shrink-0 rounded-full px-3 py-2 transition-colors hover:bg-stone-100 hover:text-stone-950"
                    >
                      {item.label}
                    </a>
                  ))}
            </nav>
          </div>
        </header>
      </div>

      {!profile ? (
        <section
          id="overview"
          className="relative mx-auto flex max-w-7xl scroll-mt-28 flex-col px-4 pb-10 pt-8 sm:px-10 sm:pb-12 sm:pt-10 lg:px-12"
        >
          <div className="grid gap-8 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
                Track reputation, risk, and market narratives in one place
              </p>
              <h2 className="mt-6 max-w-4xl text-4xl leading-[0.94] font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
                A clearer,
                <span className="font-serif italic text-stone-600">
                  {" "}
                  faster
                </span>{" "}
                way to monitor the maritime conversation.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                IQX Intelligence helps shipping brands, port operators, logistics teams,
                and maritime advisors track keywords across LinkedIn, X, Reddit, and industry
                media, then turn those signals into organized projects, alerts, and
                executive-ready monitoring streams.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {overviewStats.map((item) => (
                  <StatCard key={item.label} {...item} />
                ))}
              </div>
            </div>

            <aside
              id="access"
              className="scroll-mt-28 rounded-[2rem] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[2.25rem] sm:p-6"
            >
              <div className="flex gap-2 rounded-full border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "register"
                      ? "bg-stone-950 text-stone-50"
                      : "text-stone-600"
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "login" ? "bg-stone-950 text-stone-50" : "text-stone-600"
                  }`}
                >
                  Login
                </button>
              </div>

              <div className="mt-6">
                <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                  Start monitoring
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {authMode === "register"
                    ? "Create your IQX Intelligence workspace"
                    : "Sign in to your monitoring workspace"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-500">
                  Launch projects for brands, routes, ports, competitors, or risk themes and
                  keep every keyword, result stream, and alert path in one disciplined view.
                </p>
              </div>

              <div className="mt-6 grid gap-4">
                {authMode === "register" ? (
                  <label className="text-sm font-medium text-stone-700">
                    Full name
                    <input
                      className={inputClassName}
                      value={authForm.name}
                      onChange={(event) =>
                        setAuthForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Farshad Ghanzanfari"
                    />
                  </label>
                ) : null}

                <label className="text-sm font-medium text-stone-700">
                  Email
                  <input
                    className={inputClassName}
                    type="email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="name@company.com"
                  />
                </label>

                <label className="text-sm font-medium text-stone-700">
                  Password
                  <input
                    className={inputClassName}
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Strong password"
                  />
                </label>

                {authMode === "register" ? (
                  <label className="text-sm font-medium text-stone-700">
                    Confirm password
                    <input
                      className={inputClassName}
                      type="password"
                      value={authForm.passwordConfirmation}
                      onChange={(event) =>
                        setAuthForm((current) => ({
                          ...current,
                          passwordConfirmation: event.target.value,
                        }))
                      }
                      placeholder="Repeat password"
                    />
                  </label>
                ) : null}

                <button
                  type="button"
                  onClick={handleAuthSubmit}
                  disabled={
                    isPending ||
                    !authForm.email.trim() ||
                    !authForm.password.trim() ||
                    (authMode === "register" && !authForm.name.trim())
                  }
                  className="mt-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authMode === "register" ? "Create account" : "Sign in"}
                </button>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <section className="relative mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        {flashMessage ? (
          <div className="mb-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            {flashMessage}
          </div>
        ) : null}

        {bootError ? (
          <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {bootError}
          </div>
        ) : null}

        {isBooting ? (
          <div className="rounded-[2.4rem] border border-white/60 bg-white/75 p-8 text-sm text-stone-500 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            Loading your monitoring workspace...
          </div>
        ) : profile ? (
          <div className="grid items-start gap-4 xl:grid-cols-[21rem_minmax(0,1fr)] xl:gap-5">
            <section className="grid gap-5 xl:sticky xl:top-28">
              <article className="rounded-[2rem] border border-white/60 bg-white/86 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      Workspace
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveWorkspaceTab("profile")}
                      className="mt-2 inline-flex items-center gap-2 text-left text-2xl font-semibold tracking-[-0.04em] text-stone-950 transition-colors hover:text-stone-600 sm:text-3xl"
                      aria-label="Open profile settings"
                    >
                      <span>{profile.name}</span>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </span>
                    </button>
                    <p className="mt-2 text-sm text-stone-500">{profile.email}</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setActiveWorkspaceTab("articles")}
                      className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50 transition-colors hover:bg-stone-800"
                    >
                      Admin
                    </button>
                  ) : (
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                      {profile.plan?.name ?? "No Plan"}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-3 grid-cols-2">
                  <article className="rounded-[1.25rem] border border-stone-200 bg-stone-50/90 p-4">
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      Projects
                    </p>
                    <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                      {profile.counts.projects}
                    </strong>
                    <p className="mt-1 text-xs text-stone-500">
                      Limit: {profile.plan?.projects_limit ?? "Flexible"}
                    </p>
                  </article>

                  <article className="rounded-[1.25rem] border border-stone-200 bg-stone-50/90 p-4">
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      Keywords
                    </p>
                    <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                      {profile.counts.keywords}
                    </strong>
                    <p className="mt-1 text-xs text-stone-500">
                      Limit: {profile.plan?.keywords_limit ?? "Flexible"}
                    </p>
                  </article>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab("profile")}
                    className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800"
                  >
                    Open profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                  >
                    Sign out
                  </button>
                </div>
              </article>

              <article className="rounded-[2rem] border border-white/60 bg-white/86 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      Project list
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                      All monitoring projects
                    </h3>
                  </div>
                  <span className="font-serif text-3xl italic text-stone-400">
                    {projects.length}
                  </span>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab("new-project")}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                  >
                    New project
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {projects.length ? (
                    projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleProjectSelect(project.id)}
                        className={`w-full rounded-[1.35rem] border p-4 text-left transition ${
                          selectedProjectId === project.id
                            ? "border-stone-900 bg-stone-950 text-stone-50"
                            : "border-stone-200 bg-stone-50/90 text-stone-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <strong className="text-base font-semibold">{project.name}</strong>
                          <span className="text-xs uppercase tracking-[0.18em] opacity-70">
                            {project.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm opacity-70">
                          {project.audience ?? "Maritime audience not specified yet"}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                          <span>{project.tracked_keywords_count} keywords</span>
                          <span>{project.mentions_count} mentions</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                      No projects yet. Use the button above to launch the first monitor.
                    </div>
                  )}
                </div>

              </article>
            </section>

            <section className="grid gap-5">
              <article className="rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,243,239,0.92))] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
                {activeWorkspaceTab === "articles" ? (
                  <>
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        {currentTabCopy.eyebrow}
                      </p>
                      <h3 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">
                        {currentTabCopy.title}
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
                        {currentTabCopy.description}
                      </p>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">Indexed</p>
                        <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em] text-stone-950">
                          {indexedSources}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          Sources with at least one captured article.
                        </p>
                      </article>

                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">Broken</p>
                        <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em] text-stone-950">
                          {mediaCoverage?.summary.broken_sources ?? 0}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          Sources with repeated failures and no indexed coverage.
                        </p>
                      </article>

                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Unindexed
                        </p>
                        <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em] text-stone-950">
                          {mediaCoverage?.summary.unindexed_sources ?? 0}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          Configured sources that do not have captured articles yet.
                        </p>
                      </article>

                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">Archive articles</p>
                        <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em] text-stone-950">
                          {allCapturedArticleMeta.total}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          Total captured articles available in the admin archive.
                        </p>
                      </article>
                    </div>

                    <article className="mt-4 rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                      <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">Latest article</p>
                      <strong className="mt-3 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                        {latestCapturedArticle?.title ?? "No archived article yet"}
                      </strong>
                      <p className="mt-2 text-sm leading-6 text-stone-500">
                        {latestCapturedArticle
                          ? `${latestCapturedArticle.source_name} · ${formatPublishedAt(latestCapturedArticle.published_at)}`
                          : "The most recent captured article will appear here once the archive is populated."}
                      </p>
                    </article>
                  </>
                ) : activeWorkspaceTab === "new-project" ? (
                  <div className="max-w-2xl">
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      {currentTabCopy.eyebrow}
                    </p>
                    <h3 className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] sm:text-[2rem]">
                      {currentTabCopy.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-stone-500">
                      Start with the keywords you want to monitor. The first keyword becomes the
                      project name automatically.
                    </p>
                  </div>
                ) : activeWorkspaceTab === "profile" ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          {currentTabCopy.eyebrow}
                        </p>
                        <h3 className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] sm:text-[2rem]">
                          {currentTabCopy.title}
                        </h3>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
                          {currentTabCopy.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {profile.email}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {profile.plan?.name ?? "No Plan"}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {profile.roles.join(", ")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {activeViewWorkspaceTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveWorkspaceTab(tab.key)}
                          className={`shrink-0 rounded-[1.1rem] px-4 py-2.5 text-sm font-semibold transition ${
                            activeWorkspaceTab === tab.key
                              ? "bg-stone-950 text-stone-50"
                              : "border border-stone-200 bg-white/90 text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <article className="rounded-[1.2rem] border border-stone-200 bg-white/88 p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Current plan
                        </p>
                        <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                          {profile.plan?.name ?? "No Plan"}
                        </strong>
                        <p className="mt-2 text-sm leading-5 text-stone-500">
                          {isAdmin ? "Admin access bypasses commercial limits." : "Membership access currently applied to this workspace."}
                        </p>
                      </article>

                      <article className="rounded-[1.2rem] border border-stone-200 bg-white/88 p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Projects used
                        </p>
                        <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                          {profile.counts.projects}
                        </strong>
                        <p className="mt-2 text-sm leading-5 text-stone-500">
                          Limit: {profile.plan?.projects_limit ?? "Flexible"}
                        </p>
                      </article>

                      <article className="rounded-[1.2rem] border border-stone-200 bg-white/88 p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Keywords used
                        </p>
                        <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                          {profile.counts.keywords}
                        </strong>
                        <p className="mt-2 text-sm leading-5 text-stone-500">
                          Limit: {profile.plan?.keywords_limit ?? "Flexible"}
                        </p>
                      </article>

                      <article className="rounded-[1.2rem] border border-stone-200 bg-white/88 p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Retention
                        </p>
                        <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                          {profile.plan?.mentions_retention_days ?? 0}d
                        </strong>
                        <p className="mt-2 text-sm leading-5 text-stone-500">
                          Mention retention window attached to the current plan.
                        </p>
                      </article>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          {currentTabCopy.eyebrow}
                        </p>
                        <h3 className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] sm:text-[2rem]">
                          {currentTabCopy.title}
                        </h3>
                      </div>
                      <div className="w-full rounded-[1.35rem] border border-stone-200 bg-white/90 px-4 py-3 sm:max-w-sm">
                        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">
                          Current project
                        </p>
                        <div className="mt-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-2xl font-semibold tracking-[-0.05em] text-stone-950 sm:text-[2rem]">
                              {currentProject?.name ?? "No project selected"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveWorkspaceTab("projects")}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900"
                            aria-label="Edit project"
                            title="Edit project"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {trackedKeywords.length} keywords
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {currentProject?.mentions_count ?? 0} mentions
                        </span>
                        {isAdmin && adminRefreshState.phase !== "idle" ? (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAdminRefreshPhaseClass(adminRefreshState.phase)}`}
                          >
                            {getAdminRefreshPhaseLabel(adminRefreshState.phase)}
                            {adminRefreshState.phase === "polling"
                              ? ` ${adminRefreshState.poll_attempt}/${adminRefreshState.max_polls}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {activeViewWorkspaceTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveWorkspaceTab(tab.key)}
                          className={`shrink-0 rounded-[1.1rem] px-4 py-2.5 text-sm font-semibold transition ${
                            activeWorkspaceTab === tab.key
                              ? "bg-stone-950 text-stone-50"
                              : "border border-stone-200 bg-white/90 text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveWorkspaceTab("projects")}
                        className="shrink-0 rounded-[1.1rem] border border-stone-200 bg-white/90 px-4 py-2.5 text-stone-700 transition hover:border-stone-400"
                        aria-label="Edit project"
                        title="Edit project"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {overviewCards.map((card) => (
                        <article
                          key={card.label}
                          className="rounded-[1.2rem] border border-stone-200 bg-white/88 p-4"
                        >
                          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                            {card.label}
                          </p>
                          <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                            {card.value}
                          </strong>
                          <p className="mt-2 text-sm leading-5 text-stone-500">{card.note}</p>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </article>

              {activeWorkspaceTab === "results" ? (
                <div className="grid gap-5">
                  <article
                    id="results"
                    className="rounded-[2rem] border border-white/60 bg-white/86 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5"
                  >
                    <MentionReachChart mentions={filteredMentions} />

                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Recent results
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                          Matched mentions and recent coverage
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-500">
                          {filteredMentions.length} results
                        </span>
                        <button
                          type="button"
                          onClick={() => handleExportPdfReport()}
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="text-sm font-medium text-stone-700">
                        Search mentions, authors and sources
                        <input
                          className={inputClassName}
                          value={mentionsQuery}
                          onChange={(event) => setMentionsQuery(event.target.value)}
                          placeholder="Search through mentions, authors and domains..."
                        />
                      </label>

                      <div className="flex items-end">
                        <div className="rounded-[1rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                          Recent first
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {filteredMentions.length ? (
                        paginatedMentions.map((mention) => (
                          <article
                            key={mention.id}
                            className="rounded-[1.2rem] border border-stone-200 bg-stone-50/90 p-5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                <span className="font-semibold uppercase tracking-[0.18em]">
                                  {mention.metadata?.source_name ?? mention.source}
                                </span>
                                <span>•</span>
                                <span>{formatCompactNumber(estimateMentionReach(mention))} reach</span>
                                <span>•</span>
                                <span>{formatPublishedAt(mention.published_at)}</span>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <ResultToneBadge tone={mention.sentiment} />
                                <label className="flex items-center gap-2 text-xs font-medium text-stone-500">
                                  <span>
                                    {mention.metadata?.sentiment_source === "manual"
                                      ? "Manual"
                                      : "System"}
                                  </span>
                                  <select
                                    value={mentionSentimentSelection(mention)}
                                    onChange={(event) =>
                                      handleUpdateMentionSentiment(
                                        mention.id,
                                        event.target.value as (typeof mentionSentimentOptions)[number]["value"],
                                      )
                                    }
                                    disabled={updatingMentionId === mention.id}
                                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 outline-none transition focus:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {mentionSentimentOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </div>

                            <h4 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-stone-900">
                              {mention.title ?? "Untitled result"}
                            </h4>
                            <p className="mt-2 text-sm leading-6 text-stone-500">
                              {mention.body}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                              <span>{mention.author_name ?? "Unknown source"}</span>
                              <span>Keyword: {mention.tracked_keyword?.keyword ?? "Unlinked"}</span>
                            </div>
                            <div className="mt-4 flex flex-col gap-3 border-t border-stone-200 pt-4 text-sm sm:flex-row sm:flex-wrap">
                              <button
                                type="button"
                                className="w-full rounded-full border border-blue-200 px-4 py-2 text-center font-semibold text-blue-700 transition-colors hover:border-blue-400 hover:text-blue-900 sm:w-auto sm:rounded-none sm:border-0 sm:px-0 sm:py-0 sm:text-left"
                                onClick={() => {
                                  if (mention.url) {
                                    window.open(mention.url, "_blank", "noopener,noreferrer");
                                  }
                                }}
                              >
                                Visit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportPdfReport()}
                                className="w-full rounded-full border border-stone-300 px-4 py-2 text-center font-semibold text-stone-700 transition-colors hover:border-stone-500 hover:text-stone-950 sm:w-auto sm:rounded-none sm:border-0 sm:px-0 sm:py-0 sm:text-left"
                              >
                                Add to PDF report
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleExcludeMention(mention.id, mention.title ?? "this mention")
                                }
                                disabled={isPending}
                                className="w-full rounded-full border border-amber-200 px-4 py-2 text-center font-semibold text-amber-700 transition-colors hover:border-amber-400 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:rounded-none sm:border-0 sm:px-0 sm:py-0 sm:text-left"
                              >
                                Exclude from my mentions
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-sm text-stone-500">
                          No matched mentions yet. IQX will populate this stream as archived and newly captured content matches your active keywords.
                        </div>
                      )}
                    </div>
                    {filteredMentions.length > 0 ? (
                      <div className="mt-5 flex flex-col items-start justify-between gap-4 border-t border-stone-200 pt-5 sm:flex-row sm:items-center">
                        <p className="text-sm text-stone-500">
                          Page {safeMentionsPage} of {totalMentionsPages}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMentionsPage((current) => Math.max(1, current - 1))}
                            disabled={safeMentionsPage === 1}
                            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          {Array.from({ length: totalMentionsPages }, (_, index) => index + 1)
                            .slice(
                              Math.max(0, safeMentionsPage - 2),
                              Math.max(4, safeMentionsPage + 1),
                            )
                            .map((page) => (
                              <button
                                key={page}
                                type="button"
                                onClick={() => setMentionsPage(page)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                  page === safeMentionsPage
                                    ? "bg-stone-950 text-stone-50"
                                    : "border border-stone-300 text-stone-700 hover:border-stone-500"
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() =>
                              setMentionsPage((current) => Math.min(totalMentionsPages, current + 1))
                            }
                            disabled={safeMentionsPage === totalMentionsPages}
                            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>

                </div>
              ) : null}

              {activeWorkspaceTab === "alerts" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <section className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Delivery channels
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                        Route alerts anywhere
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-stone-500">
                        Configure inbox, email, chat, webhook, and mobile destinations. IQX will use these channels from project-level alert rules.
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-stone-700">
                          Channel type
                          <select
                            className={inputClassName}
                            value={alertChannelForm.type}
                            onChange={(event) =>
                              setAlertChannelForm((current) => ({
                                ...current,
                                type: event.target.value,
                                destination: event.target.value === "in_app" ? "" : current.destination,
                              }))
                            }
                          >
                            {alertChannelTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <span className="mt-2 block text-sm font-normal text-stone-500">
                            {selectedAlertChannelOption?.hint}
                          </span>
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Channel name
                          <input
                            className={inputClassName}
                            value={alertChannelForm.name}
                            onChange={(event) =>
                              setAlertChannelForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Executive inbox"
                          />
                        </label>

                        {alertChannelForm.type !== "in_app" ? (
                          <label className="text-sm font-medium text-stone-700 md:col-span-2">
                            {alertDestinationLabel}
                            <input
                              className={inputClassName}
                              value={alertChannelForm.destination}
                              onChange={(event) =>
                                setAlertChannelForm((current) => ({
                                  ...current,
                                  destination: event.target.value,
                                }))
                              }
                              placeholder={
                                ["slack", "teams", "discord", "webhook"].includes(alertChannelForm.type)
                                  ? "https://hooks.example.com/..."
                                  : alertChannelForm.type === "email"
                                    ? "alerts@company.com"
                                    : alertChannelForm.type === "telegram"
                                      ? "123456789"
                                      : "+15551234567"
                              }
                            />
                          </label>
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-4 text-sm text-stone-500 md:col-span-2">
                            In-app delivery stores alerts in the workspace inbox automatically. No external destination is required.
                          </div>
                        )}

                        {alertChannelForm.type === "telegram" ? (
                          <label className="text-sm font-medium text-stone-700 md:col-span-2">
                            Telegram bot token
                            <input
                              className={inputClassName}
                              value={alertChannelForm.botToken}
                              onChange={(event) =>
                                setAlertChannelForm((current) => ({
                                  ...current,
                                  botToken: event.target.value,
                                }))
                              }
                              placeholder="123456:ABCDEF..."
                            />
                          </label>
                        ) : null}

                        {["sms", "whatsapp"].includes(alertChannelForm.type) ? (
                          <>
                            <label className="text-sm font-medium text-stone-700">
                              Twilio account SID
                              <input
                                className={inputClassName}
                                value={alertChannelForm.accountSid}
                                onChange={(event) =>
                                  setAlertChannelForm((current) => ({
                                    ...current,
                                    accountSid: event.target.value,
                                  }))
                                }
                                placeholder="AC..."
                              />
                            </label>

                            <label className="text-sm font-medium text-stone-700">
                              Twilio auth token
                              <input
                                className={inputClassName}
                                value={alertChannelForm.authToken}
                                onChange={(event) =>
                                  setAlertChannelForm((current) => ({
                                    ...current,
                                    authToken: event.target.value,
                                  }))
                                }
                                placeholder="Auth token"
                              />
                            </label>

                            <label className="text-sm font-medium text-stone-700 md:col-span-2">
                              Twilio from number
                              <input
                                className={inputClassName}
                                value={alertChannelForm.fromNumber}
                                onChange={(event) =>
                                  setAlertChannelForm((current) => ({
                                    ...current,
                                    fromNumber: event.target.value,
                                  }))
                                }
                                placeholder={
                                  alertChannelForm.type === "whatsapp"
                                    ? "whatsapp:+14155238886"
                                    : "+15557654321"
                                }
                              />
                            </label>
                          </>
                        ) : null}

                        <label className="flex items-center gap-3 rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 md:col-span-2">
                          <input
                            type="checkbox"
                            checked={alertChannelForm.isActive}
                            onChange={(event) =>
                              setAlertChannelForm((current) => ({
                                ...current,
                                isActive: event.target.checked,
                              }))
                            }
                          />
                          Active and available for rules
                        </label>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSaveAlertChannel}
                          disabled={
                            isPending ||
                            !alertChannelForm.name.trim() ||
                            (alertChannelForm.type !== "in_app" && !alertChannelForm.destination.trim())
                          }
                          className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {alertChannelForm.editingId ? "Save channel" : "Add channel"}
                        </button>
                        <button
                          type="button"
                          onClick={resetAlertChannelForm}
                          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {alertChannels.length ? (
                          alertChannels.map((channel) => (
                            <article
                              key={channel.id}
                              className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <strong className="text-base font-semibold text-stone-900">
                                      {channel.name}
                                    </strong>
                                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                      {channel.type.replaceAll("_", " ")}
                                    </span>
                                    {!channel.is_active ? (
                                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                        paused
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 text-sm text-stone-500">
                                    {channel.destination ?? "Workspace inbox"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditAlertChannel(channel)}
                                    className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAlertChannel(channel)}
                                    disabled={isPending}
                                    className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {channel.is_active ? "Pause" : "Enable"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAlertChannel(channel)}
                                    disabled={isPending}
                                    className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            Add your first alert destination to start routing mentions.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="grid gap-5">
                      <article className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                              Project rules
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                              {currentProject ? `Rules for ${currentProject.name}` : "Select a project"}
                            </h3>
                          </div>
                          {currentProject ? (
                            <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                              {projectAlertRules.length} rule{projectAlertRules.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>

                        {currentProject ? (
                          <>
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                              <label className="text-sm font-medium text-stone-700">
                                Rule name
                                <input
                                  className={inputClassName}
                                  value={alertRuleForm.name}
                                  onChange={(event) =>
                                    setAlertRuleForm((current) => ({
                                      ...current,
                                      name: event.target.value,
                                    }))
                                  }
                                  placeholder="Executive hot mentions"
                                />
                              </label>

                              <label className="text-sm font-medium text-stone-700">
                                Frequency
                                <select
                                  className={inputClassName}
                                  value={alertRuleForm.frequency}
                                  onChange={(event) =>
                                    setAlertRuleForm((current) => ({
                                      ...current,
                                      frequency: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="instant">Instant</option>
                                  <option value="hourly">Hourly digest</option>
                                  <option value="daily">Daily digest</option>
                                </select>
                              </label>

                              <label className="text-sm font-medium text-stone-700">
                                Minimum estimated reach
                                <input
                                  className={inputClassName}
                                  value={alertRuleForm.minReach}
                                  onChange={(event) =>
                                    setAlertRuleForm((current) => ({
                                      ...current,
                                      minReach: event.target.value.replaceAll(/[^\d]/g, ""),
                                    }))
                                  }
                                  placeholder="15000"
                                />
                              </label>

                              <label className="text-sm font-medium text-stone-700">
                                Sentiment
                                <select
                                  className={inputClassName}
                                  value={alertRuleForm.sentiment}
                                  onChange={(event) =>
                                    setAlertRuleForm((current) => ({
                                      ...current,
                                      sentiment: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="all">All tones</option>
                                  <option value="positive">Positive only</option>
                                  <option value="neutral">Neutral only</option>
                                  <option value="negative">Negative only</option>
                                </select>
                              </label>

                              <div className="rounded-[1.2rem] border border-stone-200 bg-white p-4 md:col-span-2">
                                <p className="text-sm font-medium text-stone-700">Source filters</p>
                                <div className="mt-3 flex flex-wrap gap-3">
                                  {alertSourceOptions.map((option) => (
                                    <label
                                      key={option.value}
                                      className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={alertRuleForm.sourceFilters.includes(option.value)}
                                        onChange={(event) =>
                                          setAlertRuleForm((current) => ({
                                            ...current,
                                            sourceFilters: event.target.checked
                                              ? [...current.sourceFilters, option.value]
                                              : current.sourceFilters.filter((value) => value !== option.value),
                                          }))
                                        }
                                      />
                                      {option.label}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                                <p className="text-sm font-medium text-stone-700">Tracked keywords</p>
                                <div className="mt-3 space-y-2">
                                  {trackedKeywords.length ? (
                                    trackedKeywords.map((keyword) => (
                                      <label
                                        key={keyword.id}
                                        className="flex items-center gap-2 text-sm text-stone-700"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={alertRuleForm.trackedKeywordIds.includes(keyword.id)}
                                          onChange={(event) =>
                                            setAlertRuleForm((current) => ({
                                              ...current,
                                              trackedKeywordIds: event.target.checked
                                                ? [...current.trackedKeywordIds, keyword.id]
                                                : current.trackedKeywordIds.filter((id) => id !== keyword.id),
                                            }))
                                          }
                                        />
                                        {keyword.keyword}
                                      </label>
                                    ))
                                  ) : (
                                    <p className="text-sm text-stone-500">
                                      Add tracked keywords before scoping rules to specific terms.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                                <p className="text-sm font-medium text-stone-700">Delivery channels</p>
                                <div className="mt-3 space-y-2">
                                  {alertChannels.length ? (
                                    alertChannels.map((channel) => (
                                      <label
                                        key={channel.id}
                                        className="flex items-center gap-2 text-sm text-stone-700"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={alertRuleForm.channelIds.includes(channel.id)}
                                          onChange={(event) =>
                                            setAlertRuleForm((current) => ({
                                              ...current,
                                              channelIds: event.target.checked
                                                ? [...current.channelIds, channel.id]
                                                : current.channelIds.filter((id) => id !== channel.id),
                                            }))
                                          }
                                        />
                                        {channel.name}{" "}
                                        <span className="text-stone-400">({channel.type})</span>
                                      </label>
                                    ))
                                  ) : (
                                    <p className="text-sm text-stone-500">
                                      Add at least one delivery channel before creating a rule.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <label className="flex items-center gap-3 rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 md:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={alertRuleForm.isActive}
                                  onChange={(event) =>
                                    setAlertRuleForm((current) => ({
                                      ...current,
                                      isActive: event.target.checked,
                                    }))
                                  }
                                />
                                Rule is active
                              </label>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={handleSaveAlertRule}
                                disabled={
                                  isPending ||
                                  !alertRuleForm.name.trim() ||
                                  !alertRuleForm.channelIds.length
                                }
                                className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {alertRuleForm.editingId ? "Save rule" : "Add rule"}
                              </button>
                              <button
                                type="button"
                                onClick={resetAlertRuleForm}
                                className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                              >
                                Reset
                              </button>
                            </div>

                            <div className="mt-5 space-y-3">
                              {projectAlertRules.length ? (
                                projectAlertRules.map((rule) => (
                                  <article
                                    key={rule.id}
                                    className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <strong className="text-base font-semibold text-stone-900">
                                            {rule.name}
                                          </strong>
                                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                                            {rule.frequency}
                                          </span>
                                          {!rule.is_active ? (
                                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                              paused
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                          {rule.min_reach ? (
                                            <span className="rounded-full bg-stone-100 px-3 py-1">
                                              min reach {formatCompactNumber(rule.min_reach)}
                                            </span>
                                          ) : null}
                                          <span className="rounded-full bg-stone-100 px-3 py-1">
                                            sentiment {rule.sentiment ?? "all"}
                                          </span>
                                          <span className="rounded-full bg-stone-100 px-3 py-1">
                                            {rule.channels.length} channel{rule.channels.length === 1 ? "" : "s"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleEditAlertRule(rule)}
                                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAlertRule(rule)}
                                          disabled={isPending}
                                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {rule.is_active ? "Pause" : "Enable"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAlertRule(rule)}
                                          disabled={isPending}
                                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>

                                    <p className="mt-3 text-sm text-stone-500">
                                      Sources: {rule.source_filters.length ? rule.source_filters.join(", ") : "all"}
                                      {" "} | Keywords: {rule.tracked_keyword_ids.length || "all"}
                                    </p>
                                  </article>
                                ))
                              ) : (
                                <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                                  No alert rules yet for this project. Add one to control where fresh mentions go.
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="mt-5 rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-8 text-sm text-stone-500">
                            Select a project first. Rules are scoped per project so each monitor can alert differently.
                          </div>
                        )}
                      </article>

                      <article className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                              Inbox
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                              Recent in-app alerts
                            </h3>
                          </div>
                          <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                            {profile?.counts.unread_alerts ?? 0} unread
                          </span>
                        </div>

                        <div className="mt-5 space-y-3">
                          {alertInbox.length ? (
                            alertInbox.map((item) => (
                              <article
                                key={item.id}
                                className={`rounded-[1.2rem] border p-4 ${
                                  item.read_at
                                    ? "border-stone-200 bg-white"
                                    : "border-blue-200 bg-blue-50/70"
                                }`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <strong className="text-base font-semibold text-stone-900">
                                        {item.subject ?? "Alert"}
                                      </strong>
                                      {!item.read_at ? (
                                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                          unread
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-stone-500">
                                      {item.body}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                                      {item.rule?.project_name ? (
                                        <span className="rounded-full bg-stone-100 px-3 py-1">
                                          {item.rule.project_name}
                                        </span>
                                      ) : null}
                                      {item.mention?.tracked_keyword?.keyword ? (
                                        <span className="rounded-full bg-stone-100 px-3 py-1">
                                          {item.mention.tracked_keyword.keyword}
                                        </span>
                                      ) : null}
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {item.mention?.source ?? item.channel?.name ?? "inbox"}
                                      </span>
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {formatPublishedAt(item.delivered_at)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {!item.read_at ? (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkAlertRead(item)}
                                        disabled={isPending}
                                        className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Mark read
                                      </button>
                                    ) : null}
                                    {item.mention?.url ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          window.open(
                                            item.mention?.url ?? "",
                                            "_blank",
                                            "noopener,noreferrer",
                                          )
                                        }
                                        className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500"
                                      >
                                        Open source
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                              In-app notifications will land here once new mentions match your rules.
                            </div>
                          )}
                        </div>
                      </article>
                    </section>
                  </div>
                </article>
              ) : null}

              {activeWorkspaceTab === "analysis" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Performance snapshot
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Monitoring analysis for {currentProject?.name ?? "the selected project"}
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
                        Review the strongest mentions, top public profiles, category mix, sentiment,
                        share of voice, and follower concentration across {formatAnalysisWindow(analysisWindowDays).toLowerCase()}.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap gap-2 rounded-full border border-stone-200 bg-stone-50 p-1">
                        {analysisWindowOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAnalysisWindowDays(option.value)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                              analysisWindowDays === option.value
                                ? "bg-stone-950 text-stone-50"
                                : "text-stone-600 hover:bg-white hover:text-stone-950"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportPdfReport(
                            analysisMentions,
                            `${formatAnalysisWindow(analysisWindowDays)} analysis export for ${currentProject?.name ?? "the selected project"}.`,
                          )
                        }
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 hover:text-stone-950"
                      >
                        Export
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
                    <MentionReachChart
                      mentions={analysisMentions}
                      windowDays={analysisWindowDays}
                      label={formatAnalysisWindow(analysisWindowDays)}
                    />

                    <article className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Overview
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {analysisOverviewCards.map((card) => (
                          <article
                            key={card.label}
                            className="rounded-[1.2rem] border border-white/70 bg-white/90 p-4"
                          >
                            <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                              {card.label}
                            </p>
                            <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                              {card.value}
                            </strong>
                          </article>
                        ))}
                      </div>
                    </article>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-3">
                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5 xl:col-span-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                            Mentions
                          </p>
                          <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                            The most popular mentions
                          </h4>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {popularAnalysisMentions.length} shown
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {popularAnalysisMentions.length ? (
                          popularAnalysisMentions.map((mention) => (
                            <article
                              key={mention.id}
                              className="rounded-[1.2rem] border border-white/70 bg-white/90 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <strong className="text-base font-semibold text-stone-950">
                                    {mention.title ?? "Untitled mention"}
                                  </strong>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                    <span>{mention.metadata?.source_name ?? mention.source}</span>
                                    <span>•</span>
                                    <span>{formatCompactNumber(estimateMentionReach(mention))} reach</span>
                                    <span>•</span>
                                    <span>{formatPublishedAt(mention.published_at)}</span>
                                  </div>
                                </div>
                                <ResultToneBadge tone={mention.sentiment} />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">
                                {mention.body.length > 180 ? `${mention.body.slice(0, 177)}...` : mention.body}
                              </p>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            No popular mentions are available for this date range yet.
                          </div>
                        )}
                      </div>
                    </article>

                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5 xl:col-span-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                            Public profiles
                          </p>
                          <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                            From top public profiles
                          </h4>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          Social only
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {topPublicProfiles.length ? (
                          topPublicProfiles.map((profileItem) => (
                            <article
                              key={profileItem.author}
                              className="rounded-[1.2rem] border border-white/70 bg-white/90 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <strong className="text-base font-semibold text-stone-950">
                                    {profileItem.author}
                                  </strong>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                    <span>{profileItem.source}</span>
                                    <span>•</span>
                                    <span>{formatCompactNumber(profileItem.reach)} reach</span>
                                    <span>•</span>
                                    <span>{formatCompactNumber(profileItem.followers)} followers</span>
                                  </div>
                                </div>
                                <ResultToneBadge tone={profileItem.sentiment} />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">
                                {profileItem.topMention?.body.length && profileItem.topMention.body.length > 160
                                  ? `${profileItem.topMention.body.slice(0, 157)}...`
                                  : profileItem.topMention?.body ?? "Top post summary unavailable."}
                              </p>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            Top public profiles will appear once social mentions are available.
                          </div>
                        )}
                      </div>
                    </article>

                    <div className="grid gap-5 xl:col-span-1">
                      <DonutBreakdownCard
                        eyebrow="Category mix"
                        title="Mentions by categories"
                        items={analysisCategoryBreakdown.map((item) => ({
                          label: item.label,
                          count: item.count,
                          share: item.share,
                          color: item.color,
                        }))}
                        totalLabel="mentions"
                      />

                      <DonutBreakdownCard
                        eyebrow="Tone"
                        title="Sentiment chart"
                        items={analysisSentimentBreakdown.map((item) => ({
                          label: item.tone.charAt(0).toUpperCase() + item.tone.slice(1),
                          count: item.count,
                          share: item.share,
                          color: item.color,
                        }))}
                        totalLabel="mentions"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Category tone
                      </p>
                      <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                        Sentiment by categories
                      </h4>

                      <div className="mt-4 space-y-4">
                        {analysisSentimentByCategory.length ? (
                          analysisSentimentByCategory.map((row) => (
                            <div key={row.category}>
                              <div className="flex items-center justify-between gap-4 text-sm">
                                <strong className="font-semibold text-stone-900">{row.category}</strong>
                                <span className="text-stone-500">{row.total} mentions</span>
                              </div>
                              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-stone-200">
                                <div
                                  className="bg-emerald-500"
                                  style={{
                                    width: `${row.total ? (row.positive / row.total) * 100 : 0}%`,
                                  }}
                                />
                                <div
                                  className="bg-stone-500"
                                  style={{
                                    width: `${row.total ? (row.neutral / row.total) * 100 : 0}%`,
                                  }}
                                />
                                <div
                                  className="bg-rose-500"
                                  style={{
                                    width: `${row.total ? (row.negative / row.total) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-white px-3 py-1">Positive {row.positive}</span>
                                <span className="rounded-full bg-white px-3 py-1">Neutral {row.neutral}</span>
                                <span className="rounded-full bg-white px-3 py-1">Negative {row.negative}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            Category sentiment will populate once mentions are captured in this period.
                          </div>
                        )}
                      </div>
                    </article>

                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Keyword mix
                      </p>
                      <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                        Most Share of Voice
                      </h4>

                      <div className="mt-4 space-y-3">
                        {shareOfVoice.length ? (
                          shareOfVoice.map((item) => (
                            <div key={item.id} className="rounded-[1.2rem] border border-white/70 bg-white/90 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <strong className="text-sm font-semibold text-stone-900">{item.label}</strong>
                                <span className="text-sm text-stone-500">{item.share}%</span>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-stone-200">
                                <div
                                  className="h-2 rounded-full bg-stone-950"
                                  style={{ width: `${Math.max(item.share, 8)}%` }}
                                />
                              </div>
                              <div className="mt-2 text-xs text-stone-500">{item.count} mentions</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            Share of voice appears once keywords start matching mentions.
                          </div>
                        )}
                      </div>
                    </article>

                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Audience concentration
                      </p>
                      <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                        Most followers
                      </h4>

                      <div className="mt-4 space-y-3">
                        {topFollowers.length ? (
                          topFollowers.map((item) => (
                            <article
                              key={item.author}
                              className="rounded-[1.2rem] border border-white/70 bg-white/90 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <strong className="text-base font-semibold text-stone-950">
                                    {item.author}
                                  </strong>
                                  <p className="mt-1 text-sm text-stone-500">{item.source}</p>
                                </div>
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                                  {formatCompactNumber(item.followers)} followers
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-stone-100 px-3 py-1">
                                  {item.mentionsCount} mentions
                                </span>
                                <span className="rounded-full bg-stone-100 px-3 py-1">
                                  {formatCompactNumber(item.reach)} reach
                                </span>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                            Follower rankings appear once public-profile mentions are available.
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                </article>
              ) : null}

              {activeWorkspaceTab === "sources" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Influencers & Sources
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Full discovered source and author list
                      </h3>
                    </div>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleAdminCaptureMentions()}
                        disabled={isPending || isAdminRefreshRunning || !selectedProjectId}
                        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {adminRefreshButtonLabel}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="grid gap-5">
                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          All sources
                        </p>
                        <div className="mt-4 space-y-3">
                          {sourceGroups.length ? (
                            sourceGroups.map((item) => (
                              <article
                                key={item.domain}
                                className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <strong className="text-base font-semibold text-stone-900">
                                      {item.domain}
                                    </strong>
                                    <p className="mt-1 text-sm text-stone-500">{item.label}</p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {item.mentions_count} mentions
                                      </span>
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {formatCompactNumber(item.estimated_reach)} reach
                                      </span>
                                      {item.muted ? (
                                        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                                          muted
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      item.muted
                                        ? handleUnmuteSource(item.domain)
                                        : handleMuteSource(item.domain)
                                    }
                                    disabled={isPending}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                      item.muted
                                        ? "border border-stone-300 text-stone-700 hover:border-stone-500"
                                        : "border border-rose-200 text-rose-600 hover:border-rose-400"
                                    }`}
                                  >
                                    {item.muted ? "Unmute" : "Ban source"}
                                  </button>
                                </div>
                                <p className="mt-3 text-sm text-stone-500">
                                  {item.latest_title ?? "No title available"}
                                </p>
                              </article>
                            ))
                          ) : (
                            <article
                              className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500"
                            >
                              Sources will appear here when mentions have been grouped.
                            </article>
                          )}
                        </div>
                      </article>

                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Influencers
                        </p>
                        <div className="mt-4 space-y-3">
                          {influencerGroups.length ? (
                            influencerGroups.map((item) => (
                              <article
                                key={item.author}
                                className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <strong className="text-base font-semibold text-stone-900">
                                      {item.author}
                                    </strong>
                                    <p className="mt-1 text-sm text-stone-500">{item.source}</p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {item.mentions_count} mentions
                                      </span>
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {formatCompactNumber(item.estimated_reach)} reach
                                      </span>
                                      {item.muted ? (
                                        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                                          muted
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      item.muted
                                        ? handleUnmuteInfluencer(item.author)
                                        : handleMuteInfluencer(item.author)
                                    }
                                    disabled={isPending}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                      item.muted
                                        ? "border border-stone-300 text-stone-700 hover:border-stone-500"
                                        : "border border-rose-200 text-rose-600 hover:border-rose-400"
                                    }`}
                                  >
                                    {item.muted ? "Unmute" : "Ban author"}
                                  </button>
                                </div>
                                <p className="mt-3 text-sm text-stone-500">
                                  {item.latest_title ?? "No recent mention summary available"}
                                </p>
                              </article>
                            ))
                          ) : (
                            <article className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                              Influencers will appear when author-level mentions are available.
                            </article>
                          )}
                        </div>
                      </article>
                    </div>

                    <div className="grid gap-5">
                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Monitored channels
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          {channelCoverage.map((channel) => (
                            <article
                              key={channel.label}
                              className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <strong className="text-base font-semibold text-stone-900">
                                  {channel.label}
                                </strong>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    channel.status === "Live"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {channel.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-stone-500">{channel.detail}</p>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                {channel.count} current mentions
                              </p>
                            </article>
                          ))}
                        </div>
                      </article>

                      {isAdmin && mediaCoverage ? (
                        <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                                Admin diagnostics
                              </p>
                              <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-900">
                                Archive coverage
                              </h4>
                            </div>
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                              {indexedSources} / {mediaCoverage.summary.configured_sources} indexed
                            </span>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <article className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                              <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                Window
                              </p>
                              <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                                {mediaCoverage.summary.archive_window_days}d
                              </strong>
                            </article>
                            <article className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                              <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                Articles
                              </p>
                              <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                                {archiveArticles}
                              </strong>
                            </article>
                            <article className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                              <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                Matches
                              </p>
                              <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                                {mediaCoverage.summary.matched_mentions}
                              </strong>
                            </article>
                          </div>

                          <div className="mt-5 space-y-3">
                            {coverageSources.map((source) => (
                              <article
                                key={source.key}
                                className="rounded-[1.2rem] border border-stone-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <strong className="text-base font-semibold text-stone-900">
                                      {source.name}
                                    </strong>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {source.article_count} articles
                                      </span>
                                      <span className="rounded-full bg-stone-100 px-3 py-1">
                                        {source.matched_mentions_count} matches
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right text-xs text-stone-500">
                                    <p>
                                      Latest article:{" "}
                                      {source.latest_published_at
                                        ? formatPublishedAt(source.latest_published_at)
                                        : "Not indexed yet"}
                                    </p>
                                    <p className="mt-1">
                                      Last ingest:{" "}
                                      {source.last_ingested_at
                                        ? formatPublishedAt(source.last_ingested_at)
                                        : "Pending"}
                                    </p>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </article>
                      ) : null}
                    </div>
                  </div>
                </article>
              ) : null}

              {activeWorkspaceTab === "articles" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Admin center
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Platform inventory
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-700">
                        {mediaCoverage?.summary.configured_sources ?? 0} sources
                      </span>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-700">
                        {adminWorkspaceData?.summary.projects ?? 0} projects
                      </span>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-700">
                        {adminWorkspaceData?.summary.users ?? 0} users
                      </span>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-700">
                        {adminWorkspaceData?.summary.keywords ?? 0} keywords
                      </span>
                    </div>
                  </div>

                  <article className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Refresh progress
                        </p>
                        <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                          Watch source indexing live
                        </h4>
                        <p className="mt-2 max-w-3xl text-sm text-stone-500">
                          Use refresh here, then watch article count, indexed source count, and
                          the latest captured article update while the background jobs run.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAdminRefreshPhaseClass(adminRefreshState.phase)}`}
                        >
                          {getAdminRefreshPhaseLabel(adminRefreshState.phase)}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            autoIndexingPaused
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          Auto indexing: {autoIndexingPaused ? "Paused" : "Live"}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleAutoIndexing}
                          disabled={isPending || !adminWorkspaceData}
                          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {autoIndexingPaused ? "Resume auto indexing" : "Pause auto indexing"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminCaptureMentions()}
                          disabled={isPending || isAdminRefreshRunning || !selectedProjectId}
                          className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {adminRefreshButtonLabel}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          adminRefreshState.phase === "error"
                            ? "bg-rose-500"
                            : adminRefreshState.phase === "active"
                              ? "bg-emerald-500"
                              : adminRefreshState.phase === "stalled"
                                ? "bg-amber-500"
                                : "bg-sky-500"
                        }`}
                        style={{ width: `${adminRefreshProgressPercent}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-stone-500">
                      <span className="rounded-full bg-white px-3 py-1">
                        {adminRefreshScopeLabel}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        Scheduler: {autoIndexingPaused ? "Paused" : "Running"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        Checks: {adminRefreshState.poll_attempt}/{adminRefreshState.max_polls}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        Started:{" "}
                        {adminRefreshState.started_at
                          ? formatPublishedAt(adminRefreshState.started_at)
                          : "Not started"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        Articles: {adminRefreshState.current_article_count}
                        {adminRefreshArticleDelta > 0 ? ` (+${adminRefreshArticleDelta})` : ""}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        Indexed sources: {adminRefreshState.current_indexed_sources}
                        {adminRefreshIndexedDelta > 0 ? ` (+${adminRefreshIndexedDelta})` : ""}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <article className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Scheduler control
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {autoIndexingPaused
                            ? "Scheduled media discovery and repair indexing are paused. Manual refresh and per-source indexing still work."
                            : "Scheduled media discovery and repair indexing are running normally. Manual refresh and per-source indexing still work."}
                        </p>
                      </article>
                      <article className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Current status
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {adminRefreshState.message ??
                            "No refresh is running. Start one here to watch indexing activity."}
                        </p>
                      </article>
                      <article className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Latest captured article
                        </p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">
                          {adminRefreshState.latest_article_title ??
                            latestCapturedArticle?.title ??
                            "No captured article yet"}
                        </p>
                        <p className="mt-2 text-xs text-stone-500">
                          {formatPublishedAt(
                            adminRefreshState.latest_article_published_at ??
                              latestCapturedArticle?.published_at ??
                              null,
                          )}
                        </p>
                      </article>
                      <article className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          What to watch
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          New articles, higher indexed-source counts, fresher timestamps, and the
                          archive list below updating with new rows.
                        </p>
                      </article>
                    </div>
                  </article>

                  <div className="mt-6 flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {adminCenterTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveAdminCenterTab(tab.key)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          activeAdminCenterTab === tab.key
                            ? "bg-stone-950 text-stone-50"
                            : "border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeAdminCenterTab === "sources" ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Search sources
                          <input
                            value={adminSourceQuery}
                            onChange={(event) => setAdminSourceQuery(event.target.value)}
                            className={inputClassName}
                            placeholder="Search by source, key, homepage, or health note"
                          />
                        </label>
                        <label className="text-sm font-medium text-stone-700">
                          Status
                          <select
                            value={adminSourceStatusFilter}
                            onChange={(event) =>
                              setAdminSourceStatusFilter(
                                event.target.value as
                                  | "all"
                                  | "working"
                                  | "flaky"
                                  | "broken"
                                  | "premium-risk"
                                  | "unindexed",
                              )
                            }
                            className={inputClassName}
                          >
                            <option value="all">All statuses</option>
                            <option value="working">Indexed / healthy</option>
                            <option value="flaky">Indexed / issues</option>
                            <option value="unindexed">Unindexed</option>
                            <option value="broken">Broken</option>
                            <option value="premium-risk">Premium risk</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {filteredAdminSources.length ? (
                          filteredAdminSources.map((source) => (
                            <article
                              key={source.key}
                              className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {source.key}
                                    </span>
                                    <span
                                      className={`rounded-full px-3 py-1 ${getAdminSourceStatusClass(source.status)}`}
                                    >
                                      {source.status_label}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {source.access}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {source.name}
                                  </h4>
                                  <p className="mt-2 text-sm leading-6 text-stone-500">
                                    {source.notes}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={source.homepage}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                                  >
                                    Open source
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdminCaptureMentions({
                                        key: source.key,
                                        name: source.name,
                                      })
                                    }
                                    disabled={isPending || isAdminRefreshRunning || !selectedProjectId}
                                    className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isAdminRefreshRunning && adminRefreshState.source_key === source.key
                                      ? "Indexing..."
                                      : "Index now"}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Articles
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {source.article_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Matches
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {source.matched_mentions_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Warnings
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {source.warning_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Freshness
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {source.freshness_hours === null
                                      ? "N/A"
                                      : `${Math.round(source.freshness_hours)}h`}
                                  </strong>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-white px-3 py-1">
                                  Discovery: {source.discovery_enabled ? "On" : "Off"}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1">
                                  Sitemaps: {source.sitemaps_enabled ? "On" : "Off"}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1">
                                  Feed: {source.has_feed_url ? "Configured" : "Auto"}
                                </span>
                                {source.feed_url ? (
                                  <span className="rounded-full bg-white px-3 py-1">
                                    Feed URL: {source.feed_url}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Latest article
                                  </p>
                                  <p className="mt-2">
                                    {source.latest_published_at
                                      ? formatPublishedAt(source.latest_published_at)
                                      : "Not indexed yet"}
                                  </p>
                                  <p className="mt-2 text-xs text-stone-500">
                                    Last ingest:{" "}
                                    {source.last_ingested_at
                                      ? formatPublishedAt(source.last_ingested_at)
                                      : "Pending"}
                                  </p>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Latest keyword match
                                  </p>
                                  <p className="mt-2">
                                    {source.latest_match_at
                                      ? formatPublishedAt(source.latest_match_at)
                                      : "No matched mention yet"}
                                  </p>
                                  <p className="mt-2 text-xs text-stone-500 break-all">
                                    {source.homepage}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-[1.4rem] border border-dashed border-stone-200 bg-stone-50/90 px-5 py-8 text-sm text-stone-500 lg:col-span-2">
                            No sources match the current admin search and status filter.
                          </article>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeAdminCenterTab === "projects" ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Search projects
                          <input
                            value={adminInventoryQuery}
                            onChange={(event) => setAdminInventoryQuery(event.target.value)}
                            className={inputClassName}
                            placeholder="Search by project, owner, email, or status"
                          />
                        </label>
                        <div className="flex items-end">
                          <span className="rounded-full border border-stone-200 bg-white px-3 py-3 text-xs font-semibold text-stone-500">
                            {adminProjects.length} projects
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {adminProjects.length ? (
                          adminProjects.map((project) => (
                            <article
                              key={project.id}
                              className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {project.status}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {project.slug}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {project.name}
                                  </h4>
                                  <p className="mt-2 text-sm text-stone-500">
                                    Owner: {project.user.name ?? "Unknown"} ·{" "}
                                    {project.user.email ?? "No email"}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-stone-500">
                                    {project.description ?? "No description saved for this project."}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Keywords
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {project.tracked_keywords_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Mentions
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {project.mentions_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Updated
                                  </p>
                                  <p className="mt-2 text-sm text-stone-600">
                                    {formatPublishedAt(project.updated_at)}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-[1.4rem] border border-dashed border-stone-200 bg-stone-50/90 px-5 py-8 text-sm text-stone-500 lg:col-span-2">
                            No projects match the current admin search.
                          </article>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeAdminCenterTab === "users" ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Search users
                          <input
                            value={adminInventoryQuery}
                            onChange={(event) => setAdminInventoryQuery(event.target.value)}
                            className={inputClassName}
                            placeholder="Search by name, email, role, or plan"
                          />
                        </label>
                        <div className="flex items-end">
                          <span className="rounded-full border border-stone-200 bg-white px-3 py-3 text-xs font-semibold text-stone-500">
                            {adminUsers.length} users
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {adminUsers.length ? (
                          adminUsers.map((account) => (
                            <article
                              key={account.id}
                              className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    {account.roles.map((role) => (
                                      <span key={role} className="rounded-full bg-white px-3 py-1">
                                        {role}
                                      </span>
                                    ))}
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {account.plan_name ?? "No plan"}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {account.name}
                                  </h4>
                                  <p className="mt-2 text-sm text-stone-500">{account.email}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Projects
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {account.projects_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Keywords
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {account.keywords_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Mentions
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {account.mentions_count}
                                  </strong>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-[1.4rem] border border-dashed border-stone-200 bg-stone-50/90 px-5 py-8 text-sm text-stone-500 lg:col-span-2">
                            No users match the current admin search.
                          </article>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeAdminCenterTab === "keywords" ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Search keywords
                          <input
                            value={adminInventoryQuery}
                            onChange={(event) => setAdminInventoryQuery(event.target.value)}
                            className={inputClassName}
                            placeholder="Search by keyword, project, owner, platform, or match type"
                          />
                        </label>
                        <div className="flex items-end">
                          <span className="rounded-full border border-stone-200 bg-white px-3 py-3 text-xs font-semibold text-stone-500">
                            {adminKeywords.length} keywords
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {adminKeywords.length ? (
                          adminKeywords.map((keyword) => (
                            <article
                              key={keyword.id}
                              className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {keyword.platform}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {keyword.match_type}
                                    </span>
                                    <span
                                      className={`rounded-full px-3 py-1 ${
                                        keyword.is_active
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-stone-200 text-stone-600"
                                      }`}
                                    >
                                      {keyword.is_active ? "Active" : "Paused"}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {keyword.keyword}
                                  </h4>
                                  <p className="mt-2 text-sm text-stone-500">
                                    Project: {keyword.project.name ?? "Unknown"} · Owner:{" "}
                                    {keyword.user.name ?? "Unknown"}
                                  </p>
                                  <p className="mt-1 text-sm text-stone-500">
                                    {keyword.user.email ?? "No email"}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Mentions
                                  </p>
                                  <strong className="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {keyword.mentions_count}
                                  </strong>
                                </div>
                                <div className="rounded-[1.1rem] border border-stone-200 bg-white p-4">
                                  <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                                    Updated
                                  </p>
                                  <p className="mt-2 text-sm text-stone-600">
                                    {formatPublishedAt(keyword.updated_at)}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-[1.4rem] border border-dashed border-stone-200 bg-stone-50/90 px-5 py-8 text-sm text-stone-500 lg:col-span-2">
                            No keywords match the current admin search.
                          </article>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeAdminCenterTab === "indexes" ? (
                    <>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <article className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5">
                          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                            Indexed sources
                          </p>
                          <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                            {indexedSources}
                          </strong>
                          <p className="mt-2 text-sm text-stone-500">
                            Out of {mediaCoverage?.summary.configured_sources ?? 0} configured
                            sources.
                          </p>
                        </article>
                        <article className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5">
                          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                            Archived articles
                          </p>
                          <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                            {archiveArticles}
                          </strong>
                          <p className="mt-2 text-sm text-stone-500">
                            Total captured maritime articles in the archive.
                          </p>
                        </article>
                        <article className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5">
                          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                            Matched mentions
                          </p>
                          <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                            {mediaCoverage?.summary.matched_mentions ?? 0}
                          </strong>
                          <p className="mt-2 text-sm text-stone-500">
                            Mentions created from indexed media coverage.
                          </p>
                        </article>
                        <article className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5">
                          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                            Freshest article
                          </p>
                          <p className="mt-2 text-sm font-semibold text-stone-900">
                            {latestCapturedArticle?.title ?? "No captured article yet"}
                          </p>
                          <p className="mt-2 text-sm text-stone-500">
                            {formatPublishedAt(latestCapturedArticle?.published_at ?? null)}
                          </p>
                        </article>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {coverageSources.map((source) => (
                          <article
                            key={source.key}
                            className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                  <span
                                    className={`rounded-full px-3 py-1 ${getAdminSourceStatusClass(source.status)}`}
                                  >
                                    {source.status_label}
                                  </span>
                                </div>
                                <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                  {source.name}
                                </h4>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                                {source.article_count} indexed
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-stone-500">
                              Latest article:{" "}
                              {source.latest_published_at
                                ? formatPublishedAt(source.latest_published_at)
                                : "Not indexed yet"}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              Last ingest:{" "}
                              {source.last_ingested_at
                                ? formatPublishedAt(source.last_ingested_at)
                                : "Pending"}
                            </p>
                          </article>
                        ))}
                      </div>

                      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                            Captured archive
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                            All captured maritime articles
                          </h3>
                        </div>
                        <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-500">
                          {allCapturedArticleMeta.total} archived articles
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Search captured articles
                          <input
                            value={adminArticlesQuery}
                            onChange={(event) => setAdminArticlesQuery(event.target.value)}
                            className={inputClassName}
                            placeholder="Search titles, body text, source, author, or URL"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() =>
                              token && void loadCapturedArticles(token, 1, adminArticlesQuery)
                            }
                            disabled={isPending}
                            className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Refresh list
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        {allCapturedArticleItems.length ? (
                          allCapturedArticleItems.map((article) => (
                            <article
                              key={article.id}
                              className="rounded-[1.4rem] border border-stone-200 bg-stone-50/90 p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {article.source_name}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {formatPublishedAt(article.published_at)}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-stone-950">
                                    {article.title}
                                  </h4>
                                </div>
                                {article.url ? (
                                  <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                                  >
                                    Visit article
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCapturedArticle(article)}
                                  disabled={isPending}
                                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Delete article
                                </button>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-stone-600">
                                {article.body}
                              </p>

                              <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-white px-3 py-1">
                                  Source key: {article.source_key}
                                </span>
                                {article.author_name ? (
                                  <span className="rounded-full bg-white px-3 py-1">
                                    Author: {article.author_name}
                                  </span>
                                ) : null}
                                {article.source_url ? (
                                  <span className="rounded-full bg-white px-3 py-1">
                                    Home: {article.source_url}
                                  </span>
                                ) : null}
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-[1.4rem] border border-dashed border-stone-200 bg-stone-50/90 px-5 py-8 text-sm text-stone-500">
                            No captured articles match the current archive search.
                          </article>
                        )}
                      </div>

                      {allCapturedArticleMeta.last_page > 1 ? (
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-stone-500">
                            Page {allCapturedArticleMeta.current_page} of{" "}
                            {allCapturedArticleMeta.last_page}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAdminArticlesPage((current) => Math.max(1, current - 1))
                              }
                              disabled={allCapturedArticleMeta.current_page <= 1}
                              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAdminArticlesPage((current) =>
                                  Math.min(allCapturedArticleMeta.last_page, current + 1),
                                )
                              }
                              disabled={
                                allCapturedArticleMeta.current_page >=
                                allCapturedArticleMeta.last_page
                              }
                              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </article>
              ) : null}

              {activeWorkspaceTab === "keywords" ? (
                <article
                  id="keywords"
                  className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Keyword list
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Saved searches for this project
                      </h3>
                    </div>
                    {currentProject ? (
                      <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-500">
                        {trackedKeywords.length} active
                      </span>
                    ) : null}
                  </div>

                  {currentProject ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_10rem_10rem_auto]">
                        <label className="text-sm font-medium text-stone-700">
                          Keyword
                          <input
                            className={inputClassName}
                            value={keywordForm.keyword}
                            onChange={(event) =>
                              setKeywordForm((current) => ({
                                ...current,
                                keyword: event.target.value,
                              }))
                            }
                            placeholder="Suez Canal"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Platform
                          <select
                            className={inputClassName}
                            value={keywordForm.platform}
                            onChange={(event) =>
                              setKeywordForm((current) => ({
                                ...current,
                                platform: event.target.value,
                              }))
                            }
                          >
                            <option value="all">All</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="x">X</option>
                            <option value="reddit">Reddit</option>
                            <option value="media">Media</option>
                          </select>
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Match type
                          <select
                            className={inputClassName}
                            value={keywordForm.matchType}
                            onChange={(event) =>
                              setKeywordForm((current) => ({
                                ...current,
                                matchType: event.target.value,
                              }))
                            }
                          >
                            <option value="phrase">Phrase</option>
                            <option value="exact">Exact</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </label>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleCreateKeyword}
                            disabled={isPending || !keywordForm.keyword.trim()}
                            className="w-full rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {trackedKeywords.length ? (
                          trackedKeywords.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-[1.2rem] border border-stone-200 bg-stone-50/85 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                  <strong className="text-base font-semibold text-stone-900">
                                    {item.keyword}
                                  </strong>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {item.platform}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {item.match_type}
                                    </span>
                                    <span className="rounded-full bg-white px-3 py-1">
                                      {item.is_active ? "active" : "paused"}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKeyword(item.id, item.keyword)}
                                  disabled={isPending}
                                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Remove keyword
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                            This project has no tracked keywords yet.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-sm text-stone-500">
                      Pick a project to see and manage its keyword list.
                    </div>
                  )}
                </article>
              ) : null}

              {activeWorkspaceTab === "projects" ? (
                <article
                  id="projects"
                  className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Project focus
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        {currentProject ? "Edit selected project" : "Select a project"}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {currentProject ? (
                        <button
                          type="button"
                          onClick={handleDeleteProject}
                          disabled={isPending}
                          className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove project
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setActiveWorkspaceTab("new-project")}
                        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                      >
                        New project
                      </button>
                    </div>
                  </div>

                  {currentProject ? (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_10rem]">
                        <label className="text-sm font-medium text-stone-700">
                          Project name
                          <input
                            className={inputClassName}
                            value={projectEditorForm.name}
                            onChange={(event) =>
                              setProjectEditorForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Port congestion watch"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Target audience
                          <input
                            className={inputClassName}
                            value={projectEditorForm.audience}
                            onChange={(event) =>
                              setProjectEditorForm((current) => ({
                                ...current,
                                audience: event.target.value,
                              }))
                            }
                            placeholder="Ports, shipowners, charterers"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Status
                          <select
                            className={inputClassName}
                            value={projectEditorForm.status}
                            onChange={(event) =>
                              setProjectEditorForm((current) => ({
                                ...current,
                                status: event.target.value,
                              }))
                            }
                          >
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="draft">Draft</option>
                          </select>
                        </label>
                      </div>

                      <label className="mt-4 block text-sm font-medium text-stone-700">
                        Context
                        <textarea
                          className={`${inputClassName} min-h-28 resize-none`}
                          value={projectEditorForm.description}
                          onChange={(event) =>
                            setProjectEditorForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Explain what this workspace should monitor."
                        />
                      </label>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleUpdateProject}
                          disabled={isPending || !projectEditorForm.name.trim()}
                          className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProjectEditorForm({
                              name: currentProject.name,
                              description: currentProject.description ?? "",
                              audience: currentProject.audience ?? "",
                              status: currentProject.status,
                            })
                          }
                          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {dashboardCards.map((card) => (
                          <article
                            key={card.label}
                            className="rounded-[1.2rem] border border-stone-200 bg-stone-50/90 p-4"
                          >
                            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                              {card.label}
                            </p>
                            <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em]">
                              {card.value}
                            </strong>
                            <p className="mt-3 text-sm leading-6 text-stone-500">{card.note}</p>
                          </article>
                        ))}
                      </div>
                      <div className="mt-5 rounded-[1.2rem] border border-stone-200 bg-stone-50/90 p-4 text-sm text-stone-500">
                        Audience: {currentProject.audience ?? "Pending"} | Platforms:{" "}
                        {currentProject.monitored_platforms?.join(", ") ?? "LinkedIn, X, Reddit, Media"}
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-sm text-stone-500">
                      Select a project from the left column or open the New Project tab to start a new monitor.
                    </div>
                  )}
                </article>
              ) : null}

              {activeWorkspaceTab === "new-project" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                    New project
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    Enter keywords or key phrases
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
                    Add comma-separated keywords to monitor. IQX will use the first keyword as the project name and add the rest as tracked terms automatically.
                  </p>

                  <div className="mt-5 grid gap-4">
                    <label className="text-sm font-medium text-stone-700">
                      Keywords / key phrases
                      <textarea
                        className={`${inputClassName} min-h-28 resize-none`}
                        value={projectForm.keywords}
                        onChange={(event) =>
                          setProjectForm((current) => ({
                            ...current,
                            keywords: event.target.value,
                          }))
                        }
                        placeholder="SeaLead, Red Sea disruption, container rates"
                      />
                      <span className="mt-2 block text-sm font-normal text-stone-500">
                        Type comma-separated phrases to monitor. The first one becomes the project name.
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={isPending || !parseKeywordList(projectForm.keywords).length}
                        className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Create project
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveWorkspaceTab("results")}
                        className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {activeWorkspaceTab === "profile" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <section className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Account details
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                        Edit your profile
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-stone-500">
                        Update the contact details used for this workspace. Leave the password fields blank if you do not want to change them.
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-stone-700">
                          Full name
                          <input
                            className={inputClassName}
                            value={profileForm.name}
                            onChange={(event) =>
                              setProfileForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Harbor Ops"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Email
                          <input
                            className={inputClassName}
                            type="email"
                            value={profileForm.email}
                            onChange={(event) =>
                              setProfileForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            placeholder="name@company.com"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          New password
                          <input
                            className={inputClassName}
                            type="password"
                            value={profileForm.password}
                            onChange={(event) =>
                              setProfileForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            placeholder="Leave blank to keep current password"
                          />
                        </label>

                        <label className="text-sm font-medium text-stone-700">
                          Confirm new password
                          <input
                            className={inputClassName}
                            type="password"
                            value={profileForm.passwordConfirmation}
                            onChange={(event) =>
                              setProfileForm((current) => ({
                                ...current,
                                passwordConfirmation: event.target.value,
                              }))
                            }
                            placeholder="Repeat new password"
                          />
                        </label>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleProfileSave}
                          disabled={
                            isPending ||
                            !profileForm.name.trim() ||
                            !profileForm.email.trim() ||
                            !isProfileDirty ||
                            profileForm.password !== profileForm.passwordConfirmation
                          }
                          className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save profile
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProfileForm({
                              name: profile.name,
                              email: profile.email,
                              password: "",
                              passwordConfirmation: "",
                            })
                          }
                          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500"
                        >
                          Sign out
                        </button>
                        {profileForm.password !== profileForm.passwordConfirmation ? (
                          <p className="text-sm text-rose-600">
                            Password confirmation must match.
                          </p>
                        ) : null}
                      </div>
                    </section>

                    <section className="grid gap-5">
                      <article className="rounded-[1.6rem] border border-stone-200 bg-stone-50/90 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                              Membership
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                              Current access
                            </h3>
                          </div>
                          <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                            {profile.plan?.name ?? "No Plan"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          <article className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                            <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                              Projects
                            </p>
                            <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                              {profile.counts.projects}
                            </strong>
                            <p className="mt-2 text-sm text-stone-500">
                              Limit: {profile.plan?.projects_limit ?? "Flexible"}
                            </p>
                          </article>

                          <article className="rounded-[1.2rem] border border-stone-200 bg-white p-4">
                            <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                              Keywords
                            </p>
                            <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                              {profile.counts.keywords}
                            </strong>
                            <p className="mt-2 text-sm text-stone-500">
                              Limit: {profile.plan?.keywords_limit ?? "Flexible"}
                            </p>
                          </article>
                        </div>

                        <div className="mt-5 rounded-[1.2rem] border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-500">
                          <p>
                            Retention: {profile.plan?.mentions_retention_days ?? 0} days
                          </p>
                          <p className="mt-1">
                            Roles: {profile.roles.join(", ")}
                          </p>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {!isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveWorkspaceTab("plans")}
                                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800"
                              >
                                Compare plans
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenPortal}
                                disabled={isPending}
                                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Open billing portal
                              </button>
                            </>
                          ) : (
                            <div className="rounded-[1.2rem] border border-dashed border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
                              Admin access is managed outside the subscription workflow.
                            </div>
                          )}
                        </div>
                      </article>
                    </section>
                  </div>
                </article>
              ) : null}

              {activeWorkspaceTab === "plans" ? (
                <article
                  id="plans"
                  className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Plans
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Subscription access
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenPortal}
                      disabled={isPending}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Open portal
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {plans.map((plan) => (
                      <article
                        key={plan.slug}
                        className={`rounded-[1.5rem] border p-5 ${
                          profile.plan?.slug === plan.slug
                            ? "border-stone-900 bg-stone-950 text-stone-50"
                            : "border-stone-200 bg-stone-50/90 text-stone-900"
                        }`}
                      >
                        <h4 className="text-lg font-semibold tracking-[-0.03em]">
                          {plan.name}
                        </h4>
                        <p className="mt-2 text-sm leading-6 opacity-75">
                          {plan.description}
                        </p>
                        <strong className="mt-4 block text-3xl font-semibold tracking-[-0.04em]">
                          {formatPrice(plan.price_cents)}
                        </strong>
                        <p className="mt-1 text-sm opacity-75">/ {plan.interval}</p>
                        <button
                          type="button"
                          onClick={() => handleCheckout(plan.slug)}
                          disabled={isPending}
                          className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold ${
                            profile.plan?.slug === plan.slug
                              ? "border border-white/20 bg-white/10 text-stone-50"
                              : "bg-stone-950 text-stone-50"
                          }`}
                        >
                          {profile.plan?.slug === plan.slug ? "Manage" : "Choose"}
                        </button>
                      </article>
                    ))}
                  </div>
                </article>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="rounded-[2.4rem] border border-white/60 bg-white/80 p-7 text-sm text-stone-500 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            Sign in or register to access projects, tracked keywords, and result streams.
          </div>
        )}
      </section>
    </main>
  );
}
