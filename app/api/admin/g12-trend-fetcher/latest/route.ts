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

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const { data: latestRun, error: runError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.fetchRuns)
      .select(G12_RUN_SELECT)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to load latest G12 run from Supabase.",
          error: runError.message,
        },
        500,
      );
    }

    if (!latestRun?.fetch_run_id) {
      return jsonResponse(
        {
          status: "EMPTY",
          message: "No real G12 trend data found yet. Run the Trend Fetcher to populate this page.",
          run: null,
          insights: [],
          metrics: [],
          rawItems: [],
          rawCounts: {},
          storedInsights: [],
          storedMetrics: [],
          storedRawItems: [],
        },
        200,
      );
    }

    const fetchRunId = latestRun.fetch_run_id;

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

    const run = normalizeG12SupabaseRunRow(latestRun);
    if (!run) {
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

    const insights = storedInsights.filter((insight) => insight.fetch_run_id === fetchRunId);
    const metrics = storedMetrics.filter((metric) => metric.fetch_run_id === fetchRunId);
    const rawItems = storedRawItems.filter((rawItem) => {
      const value =
        (typeof rawItem.fetch_run_id === "string" && rawItem.fetch_run_id) ||
        (typeof rawItem.fetchRunId === "string" && rawItem.fetchRunId) ||
        (typeof rawItem.run_id === "string" && rawItem.run_id) ||
        (typeof rawItem.runId === "string" && rawItem.runId) ||
        null;
      return value === fetchRunId;
    });
    const rawCounts = countG12RawCounts(rawItems);

    return jsonResponse(
      {
        status: "PASS",
        source: "SUPABASE_REAL_DATA",
        message: "Latest G12 dashboard data loaded from Supabase.",
        run,
        insights,
        metrics,
        rawItems,
        rawCounts,
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
