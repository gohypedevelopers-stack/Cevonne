export const G12_TREND_FETCHER_TITLE = "G12 Public Trend Fetcher + Viral Pattern Guard" as const;
export const G12_TREND_FETCHER_PURPOSE =
  "Finds safe public trend signals from Instagram/TikTok, stores clean insights, and keeps content blocked until G4/G5 approval." as const;
export const G12_TREND_FETCHER_ROUTE = "/admin/automations/g12-trend-fetcher" as const;
export const G12_TREND_FETCH_WEBHOOK_URL = "https://n8n.cevonne.com/webhook/g12-public-trend-fetch" as const;
export const G12_NEON_DASHBOARD_TABLES = {
  fetchRuns: "cevonne_g12_trend_fetch_runs",
  insights: "cevonne_g12_trend_insights",
  branchStatus: "cevonne_g12_trend_branch_status",
  actions: "cevonne_g12_trend_actions",
} as const;
export const G12_TREND_FETCHER_QUERY_DEFAULT = "lipstick" as const;
export const G12_TREND_FETCHER_RESULT_CAP_DEFAULT = 50;
export const G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT = 0;
export const G12_TREND_FETCHER_ACTOR = "website_admin" as const;
export const G12_TREND_FETCHER_GENERAL_BRANCH_KEY = "general_public_trend_fetch" as const;
export const G12_TREND_FETCHER_APPROVAL_MESSAGE =
  "Content still needs G4 content check and G5 human approval before use." as const;

export const G12_TREND_FETCHER_PLATFORM_CAPS = {
  INSTAGRAM: 50,
  TIKTOK: 50,
} as const;

export type G12TrendPlatform = keyof typeof G12_TREND_FETCHER_PLATFORM_CAPS;

export const G12_TREND_FETCHER_PLATFORM_OPTIONS = ["INSTAGRAM", "TIKTOK"] as const satisfies readonly G12TrendPlatform[];

export type G12TrendFetcherPlatformSelection = "both" | "instagram" | "tiktok";
export type G12TrendFetcherRunStatus = "ACCEPTED" | "PASS" | "BLOCK" | "ERROR";
export type G12TrendFetcherCardStatus = "Live" | "Testing" | "Needs Action";
export type G12TrendFetcherSource = "neon" | "fallback";
export type G12TrendFetcherBranchStatus = G12TrendFetcherCardStatus | "Needs Access";

export type G12TrendFetcherBranchDefinition = {
  key: string;
  name: string;
  frequency: string;
  intervalHours: number;
  summary: string;
  requiresAccess?: boolean;
};

export const G12_TREND_FETCHER_BRANCHES = [
  {
    key: "viral_audio_trends",
    name: "Viral audio trends",
    frequency: "Every 12 hours",
    intervalHours: 12,
    summary: "Tracks public audio lift and repeating pattern shifts.",
  },
  {
    key: "viral_reel_hooks_formats",
    name: "Viral Reel hooks/formats",
    frequency: "Every 24 hours",
    intervalHours: 24,
    summary: "Tracks opening hooks and repeatable Reel structures.",
  },
  {
    key: "shade_trends",
    name: "Shade trends",
    frequency: "Twice weekly",
    intervalHours: 84,
    summary: "Tracks shade preference shifts and naming patterns.",
  },
  {
    key: "reviews_customer_pain_points",
    name: "Reviews/customer pain points",
    frequency: "Every 3 days",
    intervalHours: 72,
    summary: "Collects safe public frustrations and product pain points.",
  },
  {
    key: "creator_discovery",
    name: "Creator discovery",
    frequency: "Every 3 days",
    intervalHours: 72,
    summary: "Finds creators and accounts surfacing related public trends.",
  },
  {
    key: "competitor_monitoring",
    name: "Competitor monitoring",
    frequency: "Every 5 days",
    intervalHours: 120,
    summary: "Tracks competitor public trend moves and surface patterns.",
  },
  {
    key: "pricing_packaging",
    name: "Pricing/packaging",
    frequency: "Weekly",
    intervalHours: 168,
    summary: "Observes public pricing and offer positioning language.",
  },
  {
    key: "internal_winning_content",
    name: "Internal winning content",
    frequency: "Weekly",
    intervalHours: 168,
    summary: "Surfaces internal winners and repeatable structure patterns.",
  },
  {
    key: "ugc_patterns",
    name: "UGC patterns",
    frequency: "Weekly",
    intervalHours: 168,
    summary: "Tracks UGC style patterns without copying creator identity.",
  },
  {
    key: "google_search_demand",
    name: "Google/Search demand",
    frequency: "Weekly",
    intervalHours: 168,
    summary: "Uses approved search data only. No Google scraping.",
    requiresAccess: true,
  },
] as const satisfies readonly G12TrendFetcherBranchDefinition[];

export type G12TrendFetcherBranchKey =
  | (typeof G12_TREND_FETCHER_BRANCHES)[number]["key"]
  | typeof G12_TREND_FETCHER_GENERAL_BRANCH_KEY;

export type G12TrendFetcherBranchRow = {
  key: G12TrendFetcherBranchKey;
  name: string;
  frequency: string;
  last_run_at: string | null;
  next_run_at: string | null;
  status: G12TrendFetcherBranchStatus;
  last_run_status: G12TrendFetcherRunStatus | null;
  insight_count: number;
  summary: string;
};

export type G12TrendFetcherPlatformResult = {
  platform: G12TrendPlatform;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
};

export type G12TrendFetcherRun = {
  fetch_run_id: string;
  status: G12TrendFetcherRunStatus;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
  completed_at: string | null;
  platform_results: G12TrendFetcherPlatformResult[];
  branch_key: G12TrendFetcherBranchKey | null;
  query: string;
  platforms: G12TrendPlatform[];
  top_comments_limit: number;
};

export type G12TrendFetcherInsight = {
  id: string;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  platform: G12TrendPlatform | "MULTI" | "UNKNOWN";
  title: string;
  summary: string;
  fetch_run_id: string | null;
  created_at: string | null;
  source_label: string | null;
};

export type G12TrendFetcherBlockedItem = {
  id: string;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  platform: G12TrendPlatform | "MULTI" | "UNKNOWN";
  reason: string;
  status: "Rejected" | "Blocked";
  fetch_run_id: string | null;
  created_at: string | null;
};

export type G12TrendFetcherApifyUsage = {
  platform: G12TrendPlatform;
  fetches_used: number;
  cap: number;
  note: string;
};

export type G12TrendFetcherSnapshot = {
  source: G12TrendFetcherSource;
  card_status: G12TrendFetcherCardStatus;
  action_needed: boolean;
  last_run_status: G12TrendFetcherRunStatus;
  manual_fetch_status: G12TrendFetcherRunStatus;
  manual_fetch_message: string;
  last_run_time: string | null;
  last_fetch_run_id: string;
  instagram_cap: number;
  tiktok_cap: number;
  stored_insights_count: number;
  approval_required: boolean;
  approval_requirement_message: string;
  latest_run: G12TrendFetcherRun;
  branch_rows: G12TrendFetcherBranchRow[];
  apify_usage: G12TrendFetcherApifyUsage[];
  stored_insights: G12TrendFetcherInsight[];
  rejected_blocked_items: G12TrendFetcherBlockedItem[];
  compliance_notes: string[];
  google_search_demand: {
    status: "Needs Access";
    message: string;
    allowed_sources: string[];
  };
  fallback_label: string | null;
};

export type G12TrendFetcherSnapshotResponse = {
  status: "PASS";
  response_type: string;
  message: string;
  snapshot: G12TrendFetcherSnapshot;
};

export type G12ManualFetchPayload = {
  platforms: G12TrendPlatform[];
  query: string;
  fetch_limit: number;
  top_comments_limit: number;
  actor: typeof G12_TREND_FETCHER_ACTOR;
  branch_key: G12TrendFetcherBranchKey;
};

export type G12ManualFetchResponse = {
  status: G12TrendFetcherRunStatus;
  fetch_run_id: string | null;
  message: string;
  response_type?: string | null;
};

export const G12_COMPLIANCE_NOTES = [
  "Raw public data is research-only.",
  "Do not reuse scraped captions, media, audio, or creator identity directly.",
  "Content still needs G4 content check and G5 human approval before use.",
  "No auto posting happens from this workflow.",
  "No DM/comment/like/social action happens from this workflow.",
  "Private scraping, login/cookie scraping, fake accounts, and unsafe Google scraping are not allowed.",
] as const;

export const G12_GOOGLE_SEARCH_ALLOWED_SOURCES = [
  "Google Search Console",
  "Google Ads Keyword Planner",
  "Google Trends approved export/API",
  "Semrush/Ahrefs/Ubersuggest export/API",
  "Manual approved export",
] as const;

const numberFormatter = new Intl.NumberFormat("en-IN");

const toDate = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addHours = (value: string | Date | null, hours: number) => {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  return new Date(date.getTime() + hours * 3_600_000).toISOString();
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3_600_000).toISOString();

export const formatG12DateTime = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatG12RelativeTime = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diff = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ];

  let unit: Intl.RelativeTimeFormatUnit = "day";
  let valueInUnits = diff;

  for (const [threshold, nextUnit] of units) {
    if (abs < threshold) {
      unit = nextUnit;
      break;
    }

    valueInUnits = Math.round(valueInUnits / threshold);
    unit = nextUnit;
  }

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(valueInUnits, unit);
};

export const formatG12Count = (value: number) => numberFormatter.format(value);

export const getG12CardStatusTone = (status: G12TrendFetcherCardStatus) => {
  switch (status) {
    case "Live":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Testing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Needs Action":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-border/70 bg-muted/20 text-muted-foreground";
  }
};

export const getG12RunStatusTone = (status: G12TrendFetcherRunStatus) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ACCEPTED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "ERROR":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-border/70 bg-muted/20 text-muted-foreground";
  }
};

export const getG12BranchStatusTone = (status: G12TrendFetcherBranchStatus) => {
  switch (status) {
    case "Live":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Testing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Needs Action":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Needs Access":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-border/70 bg-muted/20 text-muted-foreground";
  }
};

export const isG12TerminalStatus = (status: G12TrendFetcherRunStatus | null | undefined) =>
  status === "PASS" || status === "BLOCK" || status === "ERROR";

export const normalizeG12TrendFetcherRunStatus = (value: unknown): G12TrendFetcherRunStatus => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (normalized === "ACCEPTED" || normalized === "PASS" || normalized === "BLOCK" || normalized === "ERROR") {
    return normalized;
  }

  if (normalized === "MANUAL_ONLY" || normalized === "PENDING" || normalized === "QUEUED") {
    return "ACCEPTED";
  }

  if (normalized === "FAILED" || normalized === "FAIL") {
    return "ERROR";
  }

  return "ERROR";
};

export const buildG12ManualPayload = (input: {
  platformSelection: G12TrendFetcherPlatformSelection;
  query?: string | null;
  fetchLimit?: number | null;
  topCommentsLimit?: number | null;
  branchKey?: G12TrendFetcherBranchKey | null;
}): G12ManualFetchPayload => {
  const platforms: G12TrendPlatform[] =
    input.platformSelection === "both"
      ? ["INSTAGRAM", "TIKTOK"]
      : input.platformSelection === "instagram"
        ? ["INSTAGRAM"]
        : ["TIKTOK"];

  return {
    platforms,
    query: (input.query || G12_TREND_FETCHER_QUERY_DEFAULT).trim() || G12_TREND_FETCHER_QUERY_DEFAULT,
    fetch_limit: Number.isFinite(input.fetchLimit ?? NaN)
      ? Math.max(1, Math.min(100, Math.trunc(input.fetchLimit ?? G12_TREND_FETCHER_RESULT_CAP_DEFAULT)))
      : G12_TREND_FETCHER_RESULT_CAP_DEFAULT,
    top_comments_limit: Number.isFinite(input.topCommentsLimit ?? NaN)
      ? Math.max(0, Math.min(100, Math.trunc(input.topCommentsLimit ?? G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT)))
      : G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT,
    actor: G12_TREND_FETCHER_ACTOR,
    branch_key: input.branchKey ?? G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
  };
};

const makePlatformResults = (rawCount: number, cleanCount: number, storedCount: number, rejectedCount: number, blockedCount: number) => {
  const platformRaw = Math.round(rawCount / 2);
  const platformClean = Math.round(cleanCount / 2);
  const platformStored = Math.round(storedCount / 2);
  const platformRejected = Math.max(0, Math.round(rejectedCount / 2));
  const platformBlocked = Math.max(0, Math.round(blockedCount / 2));

  return [
    {
      platform: "INSTAGRAM" as const,
      raw_count: platformRaw,
      clean_count: platformClean,
      stored_count: platformStored,
      rejected_count: platformRejected,
      blocked_count: platformBlocked,
    },
    {
      platform: "TIKTOK" as const,
      raw_count: rawCount - platformRaw,
      clean_count: cleanCount - platformClean,
      stored_count: storedCount - platformStored,
      rejected_count: rejectedCount - platformRejected,
      blocked_count: blockedCount - platformBlocked,
    },
  ];
};

const createFallbackInsights = (): G12TrendFetcherInsight[] => [
  {
    id: "g12-insight-fallback-1",
    branch_key: "viral_audio_trends",
    branch_name: "Viral audio trends",
    platform: "TIKTOK",
    title: "Public hook formats keep repeating",
    summary: "Short openings that name the problem first keep showing up in public trend signals.",
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    created_at: hoursAgo(2),
    source_label: "Demo fallback",
  },
  {
    id: "g12-insight-fallback-2",
    branch_key: "viral_reel_hooks_formats",
    branch_name: "Viral Reel hooks/formats",
    platform: "INSTAGRAM",
    title: "Public before/after frames still converting attention",
    summary: "Fast visual contrast and clear payoff framing are recurring in safe public trend signals.",
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    created_at: hoursAgo(5),
    source_label: "Demo fallback",
  },
];

const createFallbackBlockedItems = (): G12TrendFetcherBlockedItem[] => [
  {
    id: "g12-blocked-fallback-1",
    branch_key: "shade_trends",
    branch_name: "Shade trends",
    platform: "INSTAGRAM",
    reason: "Caption and creator identity stayed in quarantine because it was too close to the source post.",
    status: "Rejected",
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    created_at: daysAgo(1),
  },
  {
    id: "g12-blocked-fallback-2",
    branch_key: "competitor_monitoring",
    branch_name: "Competitor monitoring",
    platform: "TIKTOK",
    reason: "The public post was safe to read but the original wording was not safe to reuse directly.",
    status: "Rejected",
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    created_at: hoursAgo(8),
  },
  {
    id: "g12-blocked-fallback-3",
    branch_key: "ugc_patterns",
    branch_name: "UGC patterns",
    platform: "MULTI",
    reason: "Creator identity and audio were separated from the insight before storage.",
    status: "Blocked",
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    created_at: minutesAgo(125),
  },
];

const createFallbackBranchRows = (latestRun: G12TrendFetcherRun): G12TrendFetcherBranchRow[] =>
  G12_TREND_FETCHER_BRANCHES.map((branch, index) => {
    if ("requiresAccess" in branch && branch.requiresAccess) {
      return {
        key: branch.key,
        name: branch.name,
        frequency: branch.frequency,
        last_run_at: null,
        next_run_at: null,
        status: "Needs Access",
        last_run_status: null,
        insight_count: 0,
        summary: branch.summary,
      };
    }

    const lastRunAt = [
      hoursAgo(1),
      hoursAgo(5),
      daysAgo(1),
      daysAgo(2),
      daysAgo(2),
      daysAgo(3),
      daysAgo(4),
      daysAgo(5),
      daysAgo(6),
    ][index] ?? latestRun.completed_at;

    return {
      key: branch.key,
      name: branch.name,
      frequency: branch.frequency,
      last_run_at: lastRunAt,
      next_run_at: addHours(lastRunAt, branch.intervalHours),
      status: latestRun.status === "PASS" ? "Live" : "Testing",
      last_run_status: latestRun.status,
      insight_count: index < 2 ? 1 : 0,
      summary: branch.summary,
    };
  });

export const buildG12FallbackSnapshot = (): G12TrendFetcherSnapshot => {
  const latestRun: G12TrendFetcherRun = {
    fetch_run_id: "27dbb00e-2535-468e-877e-3b7837955308",
    status: "PASS",
    raw_count: 100,
    clean_count: 64,
    stored_count: 2,
    rejected_count: 36,
    blocked_count: 0,
    completed_at: hoursAgo(1),
    platform_results: makePlatformResults(100, 64, 2, 36, 0),
    branch_key: G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
    query: G12_TREND_FETCHER_QUERY_DEFAULT,
    platforms: [...G12_TREND_FETCHER_PLATFORM_OPTIONS] as G12TrendPlatform[],
    top_comments_limit: G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT,
  };

  const insights = createFallbackInsights();
  const blockedItems = createFallbackBlockedItems();
  const branchRows = createFallbackBranchRows(latestRun);

  return {
    source: "fallback",
    card_status: "Live",
    action_needed: false,
    last_run_status: latestRun.status,
    manual_fetch_status: latestRun.status,
    manual_fetch_message: "Legacy fallback snapshot loaded.",
    last_run_time: latestRun.completed_at,
    last_fetch_run_id: latestRun.fetch_run_id,
    instagram_cap: G12_TREND_FETCHER_PLATFORM_CAPS.INSTAGRAM,
    tiktok_cap: G12_TREND_FETCHER_PLATFORM_CAPS.TIKTOK,
    stored_insights_count: insights.length,
    latest_run: latestRun,
    branch_rows: branchRows,
    apify_usage: [
      {
        platform: "INSTAGRAM",
        fetches_used: 50,
        cap: G12_TREND_FETCHER_PLATFORM_CAPS.INSTAGRAM,
        note: "Demo fallback. Public trend fetch stayed within the Instagram cap.",
      },
      {
        platform: "TIKTOK",
        fetches_used: 50,
        cap: G12_TREND_FETCHER_PLATFORM_CAPS.TIKTOK,
        note: "Demo fallback. Public trend fetch stayed within the TikTok cap.",
      },
    ],
    stored_insights: insights,
    rejected_blocked_items: blockedItems,
    approval_required: true,
    approval_requirement_message: G12_TREND_FETCHER_APPROVAL_MESSAGE,
    compliance_notes: [...G12_COMPLIANCE_NOTES],
    google_search_demand: {
      status: "Needs Access",
      message:
        "Connect Google Search Console, Google Ads Keyword Planner, approved Google Trends export/API, or SEO tool export/API to enable this branch.",
      allowed_sources: [...G12_GOOGLE_SEARCH_ALLOWED_SOURCES],
    },
    fallback_label: "Legacy fallback snapshot",
  };
};

export const getG12TrendFetcherBranchDefinition = (key: string) =>
  G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === key) ?? null;

export const getG12TrendFetcherBranchLabel = (key: string | null | undefined) => {
  if (!key) return "General Manual Fetch";

  if (key === G12_TREND_FETCHER_GENERAL_BRANCH_KEY) {
    return "General Manual Fetch";
  }

  return getG12TrendFetcherBranchDefinition(key)?.name ?? key;
};

export const normalizeG12TrendFetcherPlatformResults = (
  results: unknown,
  fallbackTotals: {
    raw_count: number;
    clean_count: number;
    stored_count: number;
    rejected_count: number;
    blocked_count: number;
  },
): G12TrendFetcherPlatformResult[] => {
  const parseEntry = (entry: unknown, fallbackPlatform?: string | null) => {
    if (typeof entry !== "object" || !entry || Array.isArray(entry)) {
      return null;
    }

    const row = entry as Record<string, unknown>;
    const platformRaw =
      typeof row.platform === "string" ? row.platform.toUpperCase() : (fallbackPlatform ?? "").toUpperCase();
    const platform = platformRaw === "INSTAGRAM" || platformRaw === "TIKTOK" ? platformRaw : null;
    if (!platform) {
      return null;
    }

    const raw_count = Number(row.raw_count ?? row.rawCount ?? 0);
    const clean_count = Number(row.clean_count ?? row.cleanCount ?? 0);
    const stored_count = Number(row.stored_count ?? row.storedCount ?? 0);
    const rejected_count = Number(row.rejected_count ?? row.rejectedCount ?? 0);
    const blocked_count = Number(row.blocked_count ?? row.blockedCount ?? 0);

    return {
      platform,
      raw_count: Number.isFinite(raw_count) ? raw_count : 0,
      clean_count: Number.isFinite(clean_count) ? clean_count : 0,
      stored_count: Number.isFinite(stored_count) ? stored_count : 0,
      rejected_count: Number.isFinite(rejected_count) ? rejected_count : 0,
      blocked_count: Number.isFinite(blocked_count) ? blocked_count : 0,
    } satisfies G12TrendFetcherPlatformResult;
  };

  const parsed = Array.isArray(results)
    ? results.map((entry) => parseEntry(entry)).filter(Boolean)
    : results && typeof results === "object"
      ? Object.entries(results as Record<string, unknown>)
          .map(([platform, entry]) => parseEntry(entry, platform))
          .filter(Boolean)
      : [];

  const sortedParsed = parsed
    .map((entry) => entry as G12TrendFetcherPlatformResult)
    .sort(
      (left, right) =>
        G12_TREND_FETCHER_PLATFORM_OPTIONS.indexOf(left.platform) -
        G12_TREND_FETCHER_PLATFORM_OPTIONS.indexOf(right.platform),
    );

  if (sortedParsed.length > 0) {
    return sortedParsed;
  }

  return makePlatformResults(
    fallbackTotals.raw_count,
    fallbackTotals.clean_count,
    fallbackTotals.stored_count,
    fallbackTotals.rejected_count,
    fallbackTotals.blocked_count,
  );
};
