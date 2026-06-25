export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  countG12RawCounts,
  G12_RUN_SELECT,
  G12_SUPABASE_TABLES,
  normalizeG12SupabaseInsightRow,
  normalizeG12SupabaseMetricRow,
  normalizeG12SupabaseRunRow,
} from "@/server/next/api/g12-trend-fetcher-supabase";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const getRawItemRunId = (rawItem: Record<string, unknown>) =>
  (typeof rawItem.fetch_run_id === "string" && rawItem.fetch_run_id) ||
  (typeof rawItem.fetchRunId === "string" && rawItem.fetchRunId) ||
  (typeof rawItem.run_id === "string" && rawItem.run_id) ||
  (typeof rawItem.runId === "string" && rawItem.runId) ||
  null;

const filterRawItemsByRunId = (rawItems: Array<Record<string, unknown>>, fetchRunId: string) =>
  rawItems.filter((rawItem) => getRawItemRunId(rawItem) === fetchRunId);

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const [
      { data: latestRunRow, error: runError },
      { data: latestStoredRunRow, error: latestStoredRunError },
    ] = await Promise.all([
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.fetchRuns)
        .select(G12_RUN_SELECT)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.fetchRuns)
        .select(G12_RUN_SELECT)
        .gt("stored_count", 0)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (runError || latestStoredRunError) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to load latest G12 run data from Supabase.",
          errors: {
            latestRun: runError?.message ?? null,
            latestStoredRun: latestStoredRunError?.message ?? null,
          },
        },
        500,
      );
    }

    if (!latestRunRow?.fetch_run_id && !latestStoredRunRow?.fetch_run_id) {
      return jsonResponse(
        {
          status: "EMPTY",
          message: "No real G12 trend data found yet. Run the Trend Fetcher to populate this page.",
          run: null,
          latestStoredRun: null,
          insights: [],
          metrics: [],
          rawItems: [],
          rawCounts: {},
          latestStoredInsights: [],
          latestStoredMetrics: [],
          latestStoredRawItems: [],
          storedInsights: [],
          storedMetrics: [],
          storedRawItems: [],
        },
        200,
      );
    }

    const run = latestRunRow ? normalizeG12SupabaseRunRow(latestRunRow) : null;
    const latestStoredRun = latestStoredRunRow ? normalizeG12SupabaseRunRow(latestStoredRunRow) : null;
    const latestRunId = run?.fetch_run_id ?? null;
    const latestStoredRunId = latestStoredRun?.fetch_run_id ?? null;

    const [
      { data: insightRows, error: insightsError },
      { data: metricRows, error: metricsError },
      { data: rawRows, error: rawError },
    ] = await Promise.all([
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.insights)
        .select("*")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(100),
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.metrics)
        .select("*")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(100),
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.rawScrapeQuarantine)
        .select("*")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(200),
    ]);

    if (insightsError || metricsError || rawError) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to load G12 related records from Supabase.",
          errors: {
            insights: insightsError?.message ?? null,
            metrics: metricsError?.message ?? null,
            raw: rawError?.message ?? null,
          },
        },
        500,
      );
    }

    if (!run && latestRunRow) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Latest G12 run row could not be normalized.",
        },
        500,
      );
    }

    const storedInsights = (insightRows ?? [])
      .map((row, index) => normalizeG12SupabaseInsightRow(row as Record<string, unknown>, index))
      .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight));
    const storedMetrics = (metricRows ?? [])
      .map((row, index) => normalizeG12SupabaseMetricRow(row as Record<string, unknown>, index))
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
    const storedRawItems = (rawRows ?? []) as Array<Record<string, unknown>>;

    const insights = latestRunId ? storedInsights.filter((insight) => insight.fetch_run_id === latestRunId) : [];
    const metrics = latestRunId ? storedMetrics.filter((metric) => metric.fetch_run_id === latestRunId) : [];
    const rawItems = latestRunId ? filterRawItemsByRunId(storedRawItems, latestRunId) : [];
    const rawCounts = countG12RawCounts(rawItems);
    const latestStoredInsights = latestStoredRunId
      ? storedInsights.filter((insight) => insight.fetch_run_id === latestStoredRunId)
      : [];
    const latestStoredMetrics = latestStoredRunId
      ? storedMetrics.filter((metric) => metric.fetch_run_id === latestStoredRunId)
      : [];
    const latestStoredRawItems = latestStoredRunId ? filterRawItemsByRunId(storedRawItems, latestStoredRunId) : [];

    return jsonResponse(
      {
        status: "PASS",
        source: "SUPABASE_REAL_DATA",
        message: "Latest G12 dashboard data loaded from Supabase.",
        run,
        latestStoredRun,
        insights,
        metrics,
        rawItems,
        rawCounts,
        latestStoredInsights,
        latestStoredMetrics,
        latestStoredRawItems,
        storedInsights,
        storedMetrics,
        storedRawItems,
      },
      200,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unexpected error while loading G12 Trend Fetcher data.",
        error: error?.message ?? String(error),
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
