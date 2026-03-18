"use client";

import { useEffect, useState, useTransition } from "react";

const TOKEN_KEY = "iqx-intelligence-token";
const inputClassName =
  "mt-2 w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400";

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
  | "profile"
  | "keywords"
  | "projects"
  | "new-project"
  | "plans";

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
    oldest_published_at: string | null;
    newest_published_at: string | null;
  };
  sources: {
    key: string;
    name: string;
    homepage: string;
    status: string;
    article_count: number;
    matched_mentions_count: number;
    earliest_published_at: string | null;
    latest_published_at: string | null;
    latest_match_at: string | null;
    last_ingested_at: string | null;
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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function buildMentionReachSeries(mentions: Mention[]) {
  const today = new Date();
  const points = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));

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

function buildLinePath(values: number[], width: number, height: number) {
  if (!values.length) {
    return "";
  }

  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
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

function buildSourceBreakdown(mentions: Mention[]) {
  return Array.from(
    mentions.reduce<Map<string, number>>((summary, mention) => {
      const source = mention.metadata?.source_name ?? mention.source;
      summary.set(source, (summary.get(source) ?? 0) + 1);

      return summary;
    }, new Map()),
  )
    .map(([source, count]) => ({ source, count }))
    .sort((left, right) => right.count - left.count);
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

function MentionReachChart({ mentions }: { mentions: Mention[] }) {
  const series = buildMentionReachSeries(mentions);
  const mentionValues = series.map((point) => point.mentions);
  const reachValues = series.map((point) => point.reach);
  const width = 760;
  const height = 220;
  const mentionPath = buildLinePath(mentionValues, width, height);
  const reachPath = buildLinePath(reachValues, width, height);

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
        <p className="text-sm text-stone-500">Last 14 days</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white p-4">
        <svg
          viewBox={`0 0 ${width} ${height + 32}`}
          className="h-64 w-full"
          role="img"
          aria-label="Mentions and reach chart"
        >
          {series.map((point, index) => {
            const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;

            return (
              <g key={point.key}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke="rgba(214,211,209,0.8)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#78716c"
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              y1={height - height * ratio}
              x2={width}
              y2={height - height * ratio}
              stroke="rgba(231,229,228,1)"
              strokeWidth="1"
            />
          ))}

          <path d={mentionPath} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
          <path d={reachPath} fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
          <span className="flex items-center gap-2 text-blue-600">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Mentions
          </span>
          <span className="flex items-center gap-2 text-green-700">
            <span className="h-2.5 w-2.5 rounded-full bg-green-700" />
            Reach
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
  const [mediaCoverage, setMediaCoverage] = useState<MediaCoverage | null>(null);
  const [capturedArticles, setCapturedArticles] = useState<AdminCapturedArticles | null>(null);
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
    name: "",
    description: "",
    audience: "",
  });
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const [projectEditorForm, setProjectEditorForm] = useState({
    name: "",
    description: "",
    audience: "",
    status: "active",
  });
  const [mentionsQuery, setMentionsQuery] = useState("");
  const [mentionsPage, setMentionsPage] = useState(1);
  const [adminArticlesQuery, setAdminArticlesQuery] = useState("");
  const [adminArticlesPage, setAdminArticlesPage] = useState(1);
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
    setMediaCoverage(null);
    setCapturedArticles(null);
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

  const loadMediaCoverage = async (authToken: string) => {
    const response = await apiRequest<{ data: MediaCoverage }>(
      "/admin/media-coverage",
      {},
      authToken,
    );

    setMediaCoverage(response.data);
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
    const [meResponse, projectsResponse] = await Promise.all([
      apiRequest<{ data: Profile }>("/me", {}, authToken),
      apiRequest<{ data: ProjectSummary[] }>("/projects", {}, authToken),
    ]);

    setProfile(meResponse.data);
    setProjects(projectsResponse.data);

    const projectId =
      projectsResponse.data.find((project) => project.id === preferredProjectId)?.id ??
      projectsResponse.data[0]?.id ??
      null;

    setSelectedProjectId(projectId);

    if (projectId) {
      await loadProjectDetail(authToken, projectId);
    } else {
      setSelectedProject(null);
    }

    if (meResponse.data.roles.includes("admin")) {
      await Promise.all([
        loadMediaCoverage(authToken),
        loadCapturedArticles(authToken, 1, ""),
      ]);
    } else {
      setMediaCoverage(null);
      setCapturedArticles(null);
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
        const response = await apiRequest<{ data: ProjectSummary }>(
          "/projects",
          {
            method: "POST",
            body: JSON.stringify({
              name: projectForm.name,
              description: projectForm.description || null,
              audience: projectForm.audience || null,
              monitored_platforms: ["linkedin", "reddit", "x", "media"],
            }),
          },
          token,
        );

        setProjectForm({ name: "", description: "", audience: "" });
        await hydrateSession(token, response.data.id);
        setActiveWorkspaceTab("results");
        setFlashMessage(`Project "${response.data.name}" created.`);
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
        await loadProjectDetail(token, projectId);
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

  const handleAdminCaptureMentions = () => {
    if (!token) {
      return;
    }

    startTransition(async () => {
      try {
        const baselineArticleCount = mediaCoverage?.summary.archive_articles ?? 0;
        const baselineLatestArticleId = capturedArticles?.items[0]?.id ?? null;
        const response = await apiRequest<{
          data: { projects_processed: number; capture_started: boolean };
          message: string;
        }>(
          "/admin/media-capture",
          {
            method: "POST",
            body: JSON.stringify({
              project_id: selectedProjectId,
              force: true,
              days: 90,
            }),
          },
          token,
        );

        await hydrateSession(token, selectedProjectId);

        if (profile?.roles.includes("admin")) {
          let archiveUpdated = false;

          for (let attempt = 0; attempt < 12; attempt += 1) {
            await wait(5000);

            const { coverage, articles } = await refreshAdminArchive(
              token,
              activeWorkspaceTab === "articles" ? adminArticlesPage : 1,
              activeWorkspaceTab === "articles" ? adminArticlesQuery : "",
            );

            const latestArticleId = articles.items[0]?.id ?? null;

            if (
              coverage.summary.archive_articles > baselineArticleCount ||
              latestArticleId !== baselineLatestArticleId
            ) {
              archiveUpdated = true;
              break;
            }
          }

          setFlashMessage(
            archiveUpdated
              ? "Archive refresh completed. New captured articles are now available."
              : response.message,
          );
        } else {
          setFlashMessage(response.message);
        }

        setBootError(null);
      } catch (error) {
        setBootError(
          error instanceof Error ? error.message : "Media capture could not be started.",
        );
      }
    });
  };

  const handleExportPdfReport = () => {
    if (typeof window === "undefined") {
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1200,height=900");

    if (!reportWindow) {
      setBootError("The report window could not be opened.");
      return;
    }

    const visibleMentions = filteredMentions.slice(0, 12)
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
            Generated on ${new Intl.DateTimeFormat("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date())}
          </p>
          <div class="grid">
            <div class="card"><div class="muted">Mentions</div><div style="font-size:34px;font-weight:700;margin-top:8px;">${filteredMentions.length}</div></div>
            <div class="card"><div class="muted">Estimated Reach</div><div style="font-size:34px;font-weight:700;margin-top:8px;">${formatCompactNumber(filteredMentions.reduce((sum, mention) => sum + estimateMentionReach(mention), 0))}</div></div>
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
  const indexedSources = mediaCoverage?.summary.indexed_sources ?? 0;
  const archiveArticles = mediaCoverage?.summary.archive_articles ?? 0;
  const coverageSources = mediaCoverage?.sources.slice(0, 6) ?? [];
  const allCapturedArticleItems = capturedArticles?.items ?? [];
  const allCapturedArticleMeta = capturedArticles?.meta ?? {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  };
  const latestCapturedArticle = allCapturedArticleItems[0] ?? null;
  const sourceBreakdown = buildSourceBreakdown(mentions);
  const sentimentBreakdown = buildSentimentBreakdown(mentions);
  const channelCoverage = buildChannelCoverage(
    sourceGroups.length
      ? sourceGroups.map((group) => group.domain)
      : mentions.map((mention) => mention.metadata?.source_name ?? mention.source),
  );
  const overviewCards = buildOverviewCards(mentions);
  const analyticsMetrics = buildAnalyticsMetrics(mentions);
  const dashboardCards = buildDashboardCards(currentProject, trackedKeywords.length);
  const isProfileDirty =
    profileForm.name.trim() !== (profile?.name ?? "") ||
    profileForm.email.trim() !== (profile?.email ?? "") ||
    profileForm.password.trim() !== "" ||
    profileForm.passwordConfirmation.trim() !== "";
  const workspaceTabs: { key: WorkspaceTab; label: string }[] = [
    { key: "results", label: "Mentions" },
    { key: "analysis", label: "Analytics" },
    { key: "sources", label: "Influencers & Sources" },
    ...(isAdmin ? [{ key: "articles" as WorkspaceTab, label: "All Captured Articles" }] : []),
    { key: "profile", label: "Profile" },
    { key: "keywords", label: "Keywords" },
    { key: "projects", label: "Projects" },
  ];
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
    sources: {
      eyebrow: "Active view",
      title: "Source visibility",
      description:
        "See where matched mentions are coming from and, for admins, inspect archive coverage without cluttering the main mention workflow.",
    },
    articles: {
      eyebrow: "Active view",
      title: "Captured article archive",
      description:
        "Browse the full captured news archive across all monitored sources, independent of project-level keyword matches.",
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

      <div className="sticky top-0 z-30 mx-auto max-w-7xl px-6 pt-6 sm:px-10 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/60 bg-white/78 px-5 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <div>
            <p className="text-xs tracking-[0.28em] text-stone-500 uppercase">
              Maritime Media Monitoring
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.03em]">IQX Intelligence</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            {profile
              ? workspaceTabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveWorkspaceTab(item.key)}
                    className={`rounded-full px-3 py-2 transition-colors ${
                      activeWorkspaceTab === item.key
                        ? "bg-stone-950 text-stone-50"
                        : "hover:bg-stone-100 hover:text-stone-950"
                    }`}
                  >
                    {item.label}
                  </button>
                ))
              : anonymousNavItems.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    className="rounded-full px-3 py-2 transition-colors hover:bg-stone-100 hover:text-stone-950"
                  >
                    {item.label}
                  </a>
                ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            {profile ? (
              <>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={handleAdminCaptureMentions}
                    disabled={isPending || !selectedProjectId}
                    className="rounded-full bg-stone-950 px-4 py-2 font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Refresh Archive
                  </button>
                ) : null}
                <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                  {profile.plan?.name ?? "No Plan"}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition-colors hover:border-stone-500"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <span className="hidden md:inline">LinkedIn</span>
                <span className="hidden h-1 w-1 rounded-full bg-stone-300 md:inline-block" />
                <span className="hidden md:inline">Reddit</span>
                <span className="hidden h-1 w-1 rounded-full bg-stone-300 md:inline-block" />
                <span className="hidden md:inline">X</span>
                <span className="hidden h-1 w-1 rounded-full bg-stone-300 md:inline-block" />
                <span className="hidden md:inline">Media Search</span>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition-colors hover:border-stone-500"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="rounded-full bg-stone-950 px-4 py-2 font-semibold text-stone-50 transition-transform hover:-translate-y-0.5"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      {!profile ? (
        <section
          id="overview"
          className="relative mx-auto flex max-w-7xl scroll-mt-28 flex-col px-6 pb-12 pt-10 sm:px-10 lg:px-12"
        >
          <div className="grid gap-8 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm tracking-[0.28em] text-stone-500 uppercase">
                Track reputation, risk, and market narratives in one place
              </p>
              <h2 className="mt-6 max-w-4xl text-5xl leading-[0.92] font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
                A clearer,
                <span className="font-serif italic text-stone-600">
                  {" "}
                  faster
                </span>{" "}
                way to monitor the maritime conversation.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
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
              className="scroll-mt-28 rounded-[2.25rem] border border-white/60 bg-white/78 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur"
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

      <section className="relative mx-auto max-w-[90rem] px-4 py-5 sm:px-6 lg:px-8">
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
          <div className="grid items-start gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
            <section className="grid gap-5 xl:sticky xl:top-28">
              <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                      Workspace
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {profile.name}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">{profile.email}</p>
                  </div>
                  <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                    {profile.plan?.name ?? "No Plan"}
                  </span>
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
              </article>

              <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
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
                      No projects yet. Open the New Project tab to launch the first monitor.
                    </div>
                  )}
                </div>

              </article>
            </section>

            <section className="grid gap-5">
              <article className="rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,243,239,0.92))] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
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

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Captured articles
                        </p>
                        <strong className="mt-3 block text-4xl font-semibold tracking-[-0.04em] text-stone-950">
                          {allCapturedArticleMeta.total}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          Total archived articles available to the admin archive view.
                        </p>
                      </article>

                      <article className="rounded-[1.35rem] border border-stone-200 bg-white/88 p-5">
                        <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                          Latest article
                        </p>
                        <strong className="mt-3 block text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                          {latestCapturedArticle?.title ?? "No archived article yet"}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          {latestCapturedArticle
                            ? `${latestCapturedArticle.source_name} · ${formatPublishedAt(latestCapturedArticle.published_at)}`
                            : "The most recent captured article will appear here once the archive is populated."}
                        </p>
                      </article>
                    </div>
                  </>
                ) : activeWorkspaceTab === "profile" ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
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

                    <div className="mt-5 flex flex-wrap gap-3">
                      {workspaceTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveWorkspaceTab(tab.key)}
                          className={`rounded-[1.1rem] px-4 py-2.5 text-sm font-semibold transition ${
                            activeWorkspaceTab === tab.key
                              ? "bg-stone-950 text-stone-50"
                              : "border border-stone-200 bg-white/90 text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    <div className="flex flex-wrap items-start justify-between gap-4">
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
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {currentProject?.name ?? "No project selected"}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {trackedKeywords.length} keywords
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                          {currentProject?.mentions_count ?? 0} mentions
                        </span>
                        {isAdmin && mediaCoverage ? (
                          <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                            {archiveArticles} archived articles
                          </span>
                        ) : null}
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={handleAdminCaptureMentions}
                            disabled={isPending || !selectedProjectId}
                            className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Refresh archive
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {workspaceTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveWorkspaceTab(tab.key)}
                          className={`rounded-[1.1rem] px-4 py-2.5 text-sm font-semibold transition ${
                            activeWorkspaceTab === tab.key
                              ? "bg-stone-950 text-stone-50"
                              : "border border-stone-200 bg-white/90 text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                  >
                    <MentionReachChart mentions={filteredMentions} />

                    <div className="flex items-center justify-between gap-4">
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
                          onClick={handleExportPdfReport}
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
                              <ResultToneBadge tone={mention.sentiment} />
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
                            <div className="mt-4 flex flex-wrap gap-3 border-t border-stone-200 pt-4 text-sm">
                              <button
                                type="button"
                                className="font-semibold text-blue-700 transition-colors hover:text-blue-900"
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
                                onClick={handleExportPdfReport}
                                className="font-semibold text-stone-700 transition-colors hover:text-stone-950"
                              >
                                Add to PDF report
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
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-5">
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
                            .slice(Math.max(0, safeMentionsPage - 3), Math.max(5, safeMentionsPage + 2))
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

              {activeWorkspaceTab === "analysis" ? (
                <article className="rounded-[2rem] border border-white/60 bg-white/86 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                    <div>
                      <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                        Performance snapshot
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        Monitoring analysis for {currentProject?.name ?? "the selected project"}
                      </h3>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {analyticsMetrics.map((card) => (
                          <article
                            key={card.label}
                            className="rounded-[1.2rem] border border-stone-200 bg-stone-50/90 p-4"
                          >
                            <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">
                              {card.label}
                            </p>
                            <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em]">
                              {card.value}
                            </strong>
                          </article>
                        ))}
                      </div>

                      <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Keyword concentration
                        </p>
                        <div className="mt-4 space-y-3">
                          {trackedKeywords.length ? (
                            trackedKeywords.slice(0, 5).map((keyword, index) => (
                              <div key={keyword.id}>
                                <div className="flex items-center justify-between gap-4 text-sm">
                                  <strong className="font-semibold text-stone-900">
                                    {keyword.keyword}
                                  </strong>
                                  <span className="text-stone-500">
                                    {Math.max(1, mentions.filter(
                                      (mention) =>
                                        mention.tracked_keyword?.id === keyword.id,
                                    ).length)}
                                    {" "}mentions
                                  </span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-stone-200">
                                  <div
                                    className="h-2 rounded-full bg-stone-950"
                                    style={{
                                      width: `${Math.min(22 + index * 14, 92)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-stone-500">
                              Add keywords to start seeing concentration and trend analysis.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5">
                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Tone mix
                        </p>
                        <div className="mt-4 space-y-3">
                          {sentimentBreakdown.map((item) => (
                            <div key={item.tone}>
                              <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="font-semibold capitalize text-stone-900">
                                  {item.tone}
                                </span>
                                <span className="text-stone-500">{item.count}</span>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-stone-200">
                                <div
                                  className={`h-2 rounded-full ${
                                    item.tone === "positive"
                                      ? "bg-emerald-500"
                                      : item.tone === "negative"
                                        ? "bg-rose-500"
                                        : "bg-stone-500"
                                  }`}
                                  style={{
                                    width: `${mentions.length ? Math.max((item.count / mentions.length) * 100, item.count ? 8 : 0) : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                          Executive readout
                        </p>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
                          <p>
                            {mentions.length
                              ? `IQX has matched ${mentions.length} recent mentions for ${currentProject?.name ?? "this project"}, with ${trackedKeywords.length} active keywords shaping the monitoring scope.`
                              : "No customer-facing mentions are visible yet. The system is ready to surface matched results as soon as the archive or live capture finds relevant coverage."}
                          </p>
                          <p>
                            {sourceBreakdown.length
                              ? `${sourceBreakdown[0]?.source} is currently the strongest visible source in the mention stream.`
                              : "Source diversity will appear here once the mention stream starts filling."}
                          </p>
                        </div>
                      </article>

                      <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50/90 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
                              Reports
                            </p>
                            <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-stone-900">
                              Export monitoring report
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={handleExportPdfReport}
                            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800"
                          >
                            Export PDF
                          </button>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-stone-500">
                          Create a printable PDF summary with the latest mentions, estimated reach,
                          and tracked keyword context.
                        </p>
                      </article>
                    </div>
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
                        onClick={handleAdminCaptureMentions}
                        disabled={isPending || !selectedProjectId}
                        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Refresh archive
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
                        Admin archive
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
                        onClick={() => token && void loadCapturedArticles(token, 1, adminArticlesQuery)}
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
                        Page {allCapturedArticleMeta.current_page} of {allCapturedArticleMeta.last_page}
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
                            allCapturedArticleMeta.current_page >= allCapturedArticleMeta.last_page
                          }
                          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
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
                    Launch a new monitor
                  </h3>

                  <div className="mt-5 grid gap-4">
                    <label className="text-sm font-medium text-stone-700">
                      Project name
                      <input
                        className={inputClassName}
                        value={projectForm.name}
                        onChange={(event) =>
                          setProjectForm((current) => ({
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
                        value={projectForm.audience}
                        onChange={(event) =>
                          setProjectForm((current) => ({
                            ...current,
                            audience: event.target.value,
                          }))
                        }
                        placeholder="Ports, shipowners, charterers"
                      />
                    </label>

                    <label className="text-sm font-medium text-stone-700">
                      Context
                      <textarea
                        className={`${inputClassName} min-h-28 resize-none`}
                        value={projectForm.description}
                        onChange={(event) =>
                          setProjectForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Explain what this workspace should monitor."
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={isPending || !projectForm.name.trim()}
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
