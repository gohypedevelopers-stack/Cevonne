import "server-only";

import { getPrisma } from "@/server/db/prismaClient";
import { env } from "@/server/config";
import {
  G12_COMPLIANCE_NOTES,
  G12_GOOGLE_SEARCH_ALLOWED_SOURCES,
  G12_NEON_DASHBOARD_TABLES,
  G12_TREND_FETCHER_APPROVAL_MESSAGE,
  G12_TREND_FETCHER_BRANCHES,
  G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
  G12_TREND_FETCHER_PLATFORM_CAPS,
  buildG12FallbackSnapshot,
  normalizeG12TrendFetcherPlatformResults,
  normalizeG12TrendFetcherRunStatus,
  type G12TrendFetcherApifyUsage,
  type G12TrendFetcherBranchKey,
  type G12TrendFetcherBranchRow,
  type G12TrendFetcherBlockedItem,
  type G12TrendFetcherInsight,
  type G12TrendFetcherPlatformResult,
  type G12TrendFetcherRun,
  type G12TrendFetcherSnapshot,
  type G12TrendFetcherSource,
} from "@/lib/g12-trend-fetcher";

type Row = Record<string, unknown>;

type NeonDashboardActionSnapshot = {
  approval_required: boolean;
  approval_requirement_message: string;
  manual_fetch_status: ReturnType<typeof normalizeG12TrendFetcherRunStatus> | null;
  manual_fetch_message: string | null;
  apify_usage: G12TrendFetcherApifyUsage[] | null;
  compliance_notes: string[] | null;
  blocked_items: G12TrendFetcherBlockedItem[] | null;
  google_search_demand: G12TrendFetcherSnapshot["google_search_demand"] | null;
};

const TABLE_LIMIT = 50;

const asRecord = (value: unknown): Row | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Row;
};

const pickString = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
  }

  return null;
};

const pickNumber = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const pickBoolean = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y", "on"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "n", "off"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
};

const pickDate = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return null;
};

const pickJson = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }

  return null;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const result = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));

  return result.length ? result : null;
};

const normalizeBranchKey = (value: unknown): G12TrendFetcherBranchKey | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  if (normalized === G12_TREND_FETCHER_GENERAL_BRANCH_KEY) {
    return G12_TREND_FETCHER_GENERAL_BRANCH_KEY;
  }

  const direct = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === normalized);
  if (direct) {
    return direct.key as G12TrendFetcherBranchKey;
  }

  const byName = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.name.toLowerCase() === normalized);
  return (byName?.key as G12TrendFetcherBranchKey | undefined) ?? null;
};

const normalizePlatform = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "INSTAGRAM" || normalized === "TIKTOK") {
    return normalized;
  }

  return null;
};

const normalizeApifyUsage = (value: unknown): G12TrendFetcherApifyUsage[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const result = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Row;
      const platform = normalizePlatform(
        pickString(row, ["platform", "platform_name", "platformName", "name"]),
      );
      if (!platform) {
        return null;
      }

      const fetches_used = pickNumber(row, ["fetches_used", "fetchesUsed", "used", "count"]) ?? 0;
      const cap = pickNumber(row, ["cap", "limit", "fetch_limit"]) ?? G12_TREND_FETCHER_PLATFORM_CAPS[platform];
      const note =
        pickString(row, ["note", "message", "summary", "description"]) ??
        `${platform === "INSTAGRAM" ? "Instagram" : "TikTok"} stayed within the public trend cap.`;

      return {
        platform,
        fetches_used,
        cap,
        note,
      } satisfies G12TrendFetcherApifyUsage;
    })
    .filter(Boolean);

  return result.length ? (result as G12TrendFetcherApifyUsage[]) : null;
};

const normalizeBlockedItem = (entry: unknown): G12TrendFetcherBlockedItem | null => {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }

  const row = entry as Row;
  const id = pickString(row, ["id", "item_id", "itemId", "quarantine_id", "quarantineId", "public_id", "publicId"]);
  if (!id) {
    return null;
  }

  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "branch", "branch_name", "branchName"]),
  );
  const branchDefinition = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === branch_key);
  const branch_name =
    branchDefinition?.name ?? pickString(row, ["branch_name", "branchName", "branch"]) ?? "General";
  const platform =
    normalizePlatform(pickString(row, ["platform", "platform_name", "platformName"])) ??
    "UNKNOWN";
  const reason =
    pickString(row, ["reason", "reject_reason", "rejectReason", "failure_reason", "failureReason", "message", "summary"]) ??
    "Blocked during quarantine.";
  const statusSource = pickString(row, ["status", "state", "classification", "result_status", "resultStatus"]) ?? "";
  const status = statusSource.toUpperCase().includes("BLOCK") ? "Blocked" : "Rejected";

  return {
    id,
    branch_key,
    branch_name,
    platform,
    reason,
    status,
    fetch_run_id: pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "source_fetch_run_id"]),
    created_at: pickDate(row, ["created_at", "createdAt", "completed_at", "completedAt", "updated_at", "updatedAt"]),
  };
};

const normalizeRun = (row: Row): G12TrendFetcherRun | null => {
  const fetchRunId = pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "public_id", "publicId", "id"]);
  if (!fetchRunId) {
    return null;
  }

  const raw_count = pickNumber(row, ["raw_count", "rawCount", "total_raw_count", "totalRawCount"]) ?? 0;
  const clean_count = pickNumber(row, ["clean_count", "cleanCount", "total_clean_count", "totalCleanCount"]) ?? 0;
  const stored_count = pickNumber(row, ["stored_count", "storedCount", "total_stored_count", "totalStoredCount"]) ?? 0;
  const rejected_count = pickNumber(row, ["rejected_count", "rejectedCount", "total_rejected_count", "totalRejectedCount"]) ?? 0;
  const blocked_count = pickNumber(row, ["blocked_count", "blockedCount", "total_blocked_count", "totalBlockedCount"]) ?? 0;
  const completed_at = pickDate(row, ["completed_at", "completedAt", "finished_at", "finishedAt", "created_at", "createdAt", "updated_at", "updatedAt"]);
  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "branch", "branch_name", "branchName", "workflow_branch"]),
  );

  const platformsRaw = pickJson(row, ["platforms", "platforms_json"]);
  const platforms = Array.isArray(platformsRaw)
    ? (platformsRaw.map(normalizePlatform).filter(Boolean) as Array<"INSTAGRAM" | "TIKTOK">)
    : [];

  const platformResultsRaw = pickJson(row, ["platform_results", "platformResults", "platform_metrics"]);
  const platform_results = normalizeG12TrendFetcherPlatformResults(platformResultsRaw, {
    raw_count,
    clean_count,
    stored_count,
    rejected_count,
    blocked_count,
  });

  return {
    fetch_run_id: fetchRunId,
    status: normalizeG12TrendFetcherRunStatus(
      pickString(row, ["status", "run_status", "result_status", "state", "fetch_status"]) ?? row.status,
    ),
    raw_count,
    clean_count,
    stored_count,
    rejected_count,
    blocked_count,
    completed_at,
    platform_results,
    branch_key,
    query: pickString(row, ["query", "search_query", "searchQuery", "term"]) ?? "",
    platforms: platforms.length > 0 ? platforms : ["INSTAGRAM", "TIKTOK"],
    top_comments_limit: pickNumber(row, ["top_comments_limit", "topCommentsLimit", "comments_limit", "commentsLimit"]) ?? 0,
  };
};

const normalizeInsight = (row: Row): G12TrendFetcherInsight | null => {
  const id = pickString(row, ["id", "insight_id", "insightId", "public_id", "publicId"]);
  if (!id) {
    return null;
  }

  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "branch", "branch_name", "branchName"]),
  );
  const branchDefinition = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === branch_key);
  const branch_name =
    branchDefinition?.name ?? pickString(row, ["branch_name", "branchName", "branch"]) ?? "General";
  const platform =
    normalizePlatform(pickString(row, ["platform"])) ??
    normalizePlatform(pickString(row, ["platform_name", "platformName"])) ??
    ((Array.isArray(row.platform_results) || typeof row.platform_results === "object") ? "MULTI" : "UNKNOWN");
  const title =
    pickString(row, ["title", "insight_title", "insightTitle", "headline", "name"]) ??
    pickString(row, ["summary", "insight_summary", "insightSummary", "description"]) ??
    branch_name;
  const summary =
    pickString(row, ["summary", "insight_summary", "insightSummary", "description", "body", "notes"]) ??
    title;

  return {
    id,
    branch_key,
    branch_name,
    platform,
    title,
    summary,
    fetch_run_id: pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "source_fetch_run_id"]),
    created_at: pickDate(row, ["created_at", "createdAt", "completed_at", "completedAt", "updated_at", "updatedAt"]),
    source_label: pickString(row, ["source_label", "sourceLabel", "source", "actor"]),
  };
};

const normalizeBranchStatusRow = (row: Row): G12TrendFetcherBranchRow | null => {
  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "key", "branch", "branch_name", "branchName"]),
  );
  if (!branch_key) {
    return null;
  }

  const branchDefinition = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === branch_key);
  const name = pickString(row, ["name", "branch_name", "branchName", "label"]) ?? branchDefinition?.name ?? "General";
  const frequency = pickString(row, ["frequency", "cadence"]) ?? branchDefinition?.frequency ?? "Weekly";
  const summary = pickString(row, ["summary", "description", "notes"]) ?? branchDefinition?.summary ?? "";
  const statusSource = (pickString(row, ["status", "branch_status", "branchStatus"]) ?? "").toLowerCase();
  const status =
    statusSource === "live" ||
    statusSource === "testing" ||
    statusSource === "needs action" ||
    statusSource === "needs access"
      ? ((statusSource === "live"
          ? "Live"
          : statusSource === "testing"
            ? "Testing"
            : statusSource === "needs action"
              ? "Needs Action"
              : "Needs Access") as G12TrendFetcherBranchRow["status"])
      : branchDefinition && "requiresAccess" in branchDefinition && branchDefinition.requiresAccess
        ? "Needs Access"
        : "Testing";
  const lastRunStatusSource = pickString(row, ["last_run_status", "lastRunStatus", "run_status", "runStatus"]);

  return {
    key: branch_key,
    name,
    frequency,
    last_run_at: pickDate(row, ["last_run_at", "lastRunAt", "completed_at", "completedAt", "updated_at", "updatedAt"]),
    next_run_at: pickDate(row, ["next_run_at", "nextRunAt"]),
    status,
    last_run_status:
      status === "Needs Access"
        ? null
        : lastRunStatusSource
          ? normalizeG12TrendFetcherRunStatus(lastRunStatusSource)
          : null,
    insight_count: pickNumber(row, ["insight_count", "insightCount", "stored_insights_count", "storedInsightsCount"]) ?? 0,
    summary,
  };
};

const normalizeActionRow = (row: Row): NeonDashboardActionSnapshot | null => {
  const actionKey = pickString(row, ["action_key", "actionKey", "key", "scope", "id"]) ?? "dashboard";
  if (!actionKey) {
    return null;
  }

  const approval_required =
    pickBoolean(row, ["approval_required", "approvalRequired", "g4_g5_approval_required", "g4G5ApprovalRequired"]) ?? true;
  const approval_requirement_message =
    pickString(row, ["approval_requirement_message", "approvalRequirementMessage", "approval_message", "approvalMessage"]) ??
    G12_TREND_FETCHER_APPROVAL_MESSAGE;
  const manual_fetch_status_source = pickString(
    row,
    ["manual_fetch_status", "manualFetchStatus", "latest_manual_fetch_status", "latestManualFetchStatus"],
  );
  const manual_fetch_status = manual_fetch_status_source
    ? normalizeG12TrendFetcherRunStatus(manual_fetch_status_source)
    : null;
  const manual_fetch_message =
    pickString(row, ["manual_fetch_message", "manualFetchMessage", "manual_message", "manualMessage"]) ??
    approval_requirement_message;
  const apify_usage = normalizeApifyUsage(
    pickJson(row, ["apify_usage", "apifyUsage", "usage_summary", "usageSummary", "platform_usage", "platformUsage"]),
  );
  const compliance_notes =
    normalizeStringArray(pickJson(row, ["compliance_notes", "complianceNotes"])) ?? [...G12_COMPLIANCE_NOTES];
  const blockedItemsSource = pickJson(row, ["blocked_items", "blockedItems", "rejected_blocked_items", "rejectedBlockedItems"]);
  const blockedRows = Array.isArray(blockedItemsSource)
    ? (blockedItemsSource.map(normalizeBlockedItem).filter(Boolean) as G12TrendFetcherBlockedItem[])
    : [];
  const allowed_sources =
    normalizeStringArray(pickJson(row, ["google_search_allowed_sources", "googleSearchAllowedSources"])) ??
    [...G12_GOOGLE_SEARCH_ALLOWED_SOURCES];
  const google_search_message =
    pickString(row, ["google_search_demand_message", "googleSearchDemandMessage"]) ??
    "Connect Google Search Console, Google Ads Keyword Planner, approved Google Trends export/API, or SEO tool export/API to enable this branch.";

  return {
    approval_required,
    approval_requirement_message,
    manual_fetch_status,
    manual_fetch_message,
    apify_usage,
    compliance_notes,
    blocked_items: blockedRows,
    google_search_demand: {
      status: "Needs Access",
      message: google_search_message,
      allowed_sources,
    },
  };
};

const buildPlatformUsage = (platformResults: G12TrendFetcherPlatformResult[]): G12TrendFetcherApifyUsage[] => {
  const byPlatform = new Map(platformResults.map((result) => [result.platform, result]));

  return ["INSTAGRAM", "TIKTOK"].map((platform) => {
    const result = byPlatform.get(platform as "INSTAGRAM" | "TIKTOK");
    const used = result?.raw_count ?? 0;
    const cap = G12_TREND_FETCHER_PLATFORM_CAPS[platform as "INSTAGRAM" | "TIKTOK"];

    return {
      platform: platform as "INSTAGRAM" | "TIKTOK",
      fetches_used: used,
      cap,
      note:
        used > 0
          ? `${platform === "INSTAGRAM" ? "Instagram" : "TikTok"} stayed within the public trend cap.`
          : `${platform === "INSTAGRAM" ? "Instagram" : "TikTok"} had no live rows loaded yet.`,
    };
  });
};

const groupByBranch = (runs: G12TrendFetcherRun[]) => {
  const groups = new Map<G12TrendFetcherBranchKey, G12TrendFetcherRun[]>();

  for (const run of runs) {
    const branchKey = run.branch_key ?? G12_TREND_FETCHER_GENERAL_BRANCH_KEY;
    const current = groups.get(branchKey) ?? [];
    current.push(run);
    groups.set(branchKey, current);
  }

  for (const [key, value] of groups.entries()) {
    value.sort((left, right) => {
      const leftTime = new Date(left.completed_at ?? "").getTime();
      const rightTime = new Date(right.completed_at ?? "").getTime();
      return rightTime - leftTime;
    });
    groups.set(key, value);
  }

  return groups;
};

const mapInsightsByBranch = (insights: G12TrendFetcherInsight[]) => {
  const counts = new Map<G12TrendFetcherBranchKey, number>();

  for (const insight of insights) {
    const branchKey = insight.branch_key ?? G12_TREND_FETCHER_GENERAL_BRANCH_KEY;
    counts.set(branchKey, (counts.get(branchKey) ?? 0) + 1);
  }

  return counts;
};

const buildDerivedBranchRows = (
  latestRun: G12TrendFetcherRun,
  runs: G12TrendFetcherRun[],
  insights: G12TrendFetcherInsight[],
): G12TrendFetcherBranchRow[] => {
  const runsByBranch = groupByBranch(runs);
  const insightCounts = mapInsightsByBranch(insights);

  return G12_TREND_FETCHER_BRANCHES.map((branch) => {
    if ("requiresAccess" in branch && branch.requiresAccess) {
      return {
        key: branch.key,
        name: branch.name,
        frequency: branch.frequency,
        last_run_at: null,
        next_run_at: null,
        status: "Needs Access",
        last_run_status: null,
        insight_count: insightCounts.get(branch.key as G12TrendFetcherBranchKey) ?? 0,
        summary: branch.summary,
      };
    }

    const branchRun = runsByBranch.get(branch.key as G12TrendFetcherBranchKey)?.[0] ?? latestRun;
    const last_run_at = branchRun?.completed_at ?? latestRun.completed_at;
    const lastStatus = branchRun?.status ?? latestRun.status;
    const status =
      lastStatus === "PASS"
        ? "Live"
        : lastStatus === "BLOCK" || lastStatus === "ERROR"
          ? "Needs Action"
          : "Testing";

    return {
      key: branch.key as G12TrendFetcherBranchKey,
      name: branch.name,
      frequency: branch.frequency,
      last_run_at,
      next_run_at: last_run_at ? new Date(new Date(last_run_at).getTime() + branch.intervalHours * 3_600_000).toISOString() : null,
      status,
      last_run_status: lastStatus,
      insight_count: insightCounts.get(branch.key as G12TrendFetcherBranchKey) ?? 0,
      summary: branch.summary,
    };
  });
};

const mergeBranchRows = (
  tableRows: G12TrendFetcherBranchRow[],
  latestRun: G12TrendFetcherRun,
  runs: G12TrendFetcherRun[],
  insights: G12TrendFetcherInsight[],
): G12TrendFetcherBranchRow[] => {
  const derivedRows = buildDerivedBranchRows(latestRun, runs, insights);
  const byKey = new Map(tableRows.map((row) => [row.key, row]));

  return derivedRows.map((derived) => {
    const override = byKey.get(derived.key);
    if (!override) {
      return derived;
    }

    return {
      ...derived,
      ...override,
      key: derived.key,
      name: override.name || derived.name,
      frequency: override.frequency || derived.frequency,
      summary: override.summary || derived.summary,
      status: override.status ?? derived.status,
      last_run_status: override.last_run_status ?? derived.last_run_status,
      last_run_at: override.last_run_at ?? derived.last_run_at,
      next_run_at: override.next_run_at ?? derived.next_run_at,
      insight_count: Number.isFinite(override.insight_count) ? override.insight_count : derived.insight_count,
    };
  });
};

const loadTableRows = async (tableName: string, orderCandidates: string[], limit = TABLE_LIMIT) => {
  const prisma = await getPrisma();
  const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('public.${tableName}') IS NOT NULL AS exists`,
  );

  if (!tableExists[0]?.exists) {
    return [];
  }

  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}'`,
  );
  const columnNames = new Set(columns.map((column) => column.column_name));
  const orderColumn = orderCandidates.find((candidate) => columnNames.has(candidate)) ?? null;
  const query = orderColumn
    ? `SELECT * FROM ${tableName} ORDER BY ${orderColumn} DESC NULLS LAST LIMIT ${limit}`
    : `SELECT * FROM ${tableName} LIMIT ${limit}`;

  const rows = await prisma.$queryRawUnsafe<unknown[]>(query);
  return rows.map(asRecord).filter(Boolean) as Row[];
};

const normalizeRuns = (rows: Row[]) => rows.map((row) => normalizeRun(row)).filter(Boolean) as G12TrendFetcherRun[];
const normalizeInsights = (rows: Row[]) => rows.map((row) => normalizeInsight(row)).filter(Boolean) as G12TrendFetcherInsight[];
const normalizeBranchStatusRows = (rows: Row[]) =>
  rows.map((row) => normalizeBranchStatusRow(row)).filter(Boolean) as G12TrendFetcherBranchRow[];
const normalizeActionRows = (rows: Row[]) =>
  rows.map((row) => normalizeActionRow(row)).filter(Boolean) as NeonDashboardActionSnapshot[];

const buildFromLoadedData = (
  runs: G12TrendFetcherRun[],
  insights: G12TrendFetcherInsight[],
  branchStatusRows: G12TrendFetcherBranchRow[],
  actionRows: NeonDashboardActionSnapshot[],
) => {
  const sortedRuns = [...runs].sort((left, right) => {
    const leftTime = new Date(left.completed_at ?? "").getTime();
    const rightTime = new Date(right.completed_at ?? "").getTime();
    return rightTime - leftTime;
  });

  const latestRun = sortedRuns[0];
  if (!latestRun) {
    return buildG12FallbackSnapshot();
  }

  const actionRow = actionRows[0] ?? null;
  const platformResults = latestRun.platform_results.length
    ? latestRun.platform_results
    : normalizeG12TrendFetcherPlatformResults(null, {
        raw_count: latestRun.raw_count,
        clean_count: latestRun.clean_count,
        stored_count: latestRun.stored_count,
        rejected_count: latestRun.rejected_count,
        blocked_count: latestRun.blocked_count,
      });

  const normalizedLatestRun: G12TrendFetcherRun = {
    ...latestRun,
    platform_results: platformResults,
    platforms: latestRun.platforms.length ? latestRun.platforms : ["INSTAGRAM", "TIKTOK"],
  };

  const card_status =
    normalizedLatestRun.status === "PASS"
      ? "Live"
      : normalizedLatestRun.status === "BLOCK" || normalizedLatestRun.status === "ERROR"
        ? "Needs Action"
        : "Testing";

  const branch_rows = branchStatusRows.length
    ? mergeBranchRows(branchStatusRows, normalizedLatestRun, sortedRuns, insights)
    : buildDerivedBranchRows(normalizedLatestRun, sortedRuns, insights);

  const apify_usage = actionRow?.apify_usage?.length ? actionRow.apify_usage : buildPlatformUsage(platformResults);
  const compliance_notes = actionRow?.compliance_notes?.length ? actionRow.compliance_notes : [...G12_COMPLIANCE_NOTES];
  const google_search_demand =
    actionRow?.google_search_demand ?? {
      status: "Needs Access" as const,
      message:
        "Connect Google Search Console, Google Ads Keyword Planner, approved Google Trends export/API, or SEO tool export/API to enable this branch.",
      allowed_sources: [...G12_GOOGLE_SEARCH_ALLOWED_SOURCES],
    };
  const approval_required = actionRow?.approval_required ?? true;
  const approval_requirement_message = actionRow?.approval_requirement_message ?? G12_TREND_FETCHER_APPROVAL_MESSAGE;
  const manual_fetch_status = actionRow?.manual_fetch_status ?? normalizedLatestRun.status;
  const manual_fetch_message =
    actionRow?.manual_fetch_message ?? "The latest dashboard-safe run is synced into Neon and ready to review.";
  const blocked_items = actionRow?.blocked_items ?? [];

  return {
    source: "neon" as G12TrendFetcherSource,
    card_status,
    action_needed: card_status !== "Live",
    last_run_status: normalizedLatestRun.status,
    manual_fetch_status,
    manual_fetch_message,
    last_run_time: normalizedLatestRun.completed_at,
    last_fetch_run_id: normalizedLatestRun.fetch_run_id,
    instagram_cap: G12_TREND_FETCHER_PLATFORM_CAPS.INSTAGRAM,
    tiktok_cap: G12_TREND_FETCHER_PLATFORM_CAPS.TIKTOK,
    stored_insights_count: insights.length,
    approval_required,
    approval_requirement_message,
    latest_run: normalizedLatestRun,
    branch_rows,
    apify_usage,
    stored_insights: insights,
    rejected_blocked_items: blocked_items,
    compliance_notes,
    google_search_demand,
    fallback_label: null,
  } satisfies G12TrendFetcherSnapshot;
};

export const getG12TrendFetcherSnapshot = async (): Promise<G12TrendFetcherSnapshot> => {
  if (!env.databaseUrl.trim()) {
    return buildG12FallbackSnapshot();
  }

  try {
    const [runRows, insightRows, branchStatusTableRows, actionTableRows] = await Promise.all([
      loadTableRows(G12_NEON_DASHBOARD_TABLES.fetchRuns, ["completed_at", "created_at", "updated_at", "finished_at", "finishedAt", "run_at", "runAt"]),
      loadTableRows(G12_NEON_DASHBOARD_TABLES.insights, ["created_at", "createdAt", "completed_at", "completedAt", "updated_at", "updatedAt"]),
      loadTableRows(G12_NEON_DASHBOARD_TABLES.branchStatus, ["next_run_at", "nextRunAt", "last_run_at", "lastRunAt", "updated_at", "updatedAt"]),
      loadTableRows(G12_NEON_DASHBOARD_TABLES.actions, ["updated_at", "updatedAt", "created_at", "createdAt"]),
    ]);

    const runs = normalizeRuns(runRows);
    const insights = normalizeInsights(insightRows);
    const branchStatusRows = normalizeBranchStatusRows(branchStatusTableRows);
    const actionRows = normalizeActionRows(actionTableRows);

    if (!runs.length && !insights.length && !branchStatusRows.length && !actionRows.length) {
      return buildG12FallbackSnapshot();
    }

    return buildFromLoadedData(runs, insights, branchStatusRows, actionRows);
  } catch {
    return buildG12FallbackSnapshot();
  }
};
