export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase-admin";
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

const createUnavailableRunResponse = () =>
  ({
    status: "ERROR",
    message: "G12 Supabase data is unavailable in this environment.",
    run: null,
    insights: [],
    metrics: [],
    rawCounts: {},
  }) as const;

export async function GET(request: Request, { params }: { params: Promise<{ fetchRunId: string }> }) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonResponse(createUnavailableRunResponse(), 200);
  }

  try {
    const { fetchRunId: rawFetchRunId } = await params;
    const fetchRunId = rawFetchRunId?.trim();

    if (!fetchRunId) {
      return jsonResponse(
        {
          status: "BLOCK",
          message: "fetchRunId is required.",
        },
        400,
      );
    }

    const { data: runRow, error: runError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.fetchRuns)
      .select(G12_RUN_SELECT)
      .eq("fetch_run_id", fetchRunId)
      .maybeSingle();

    if (runError) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to load G12 run.",
          error: runError.message,
        },
        500,
      );
    }

    if (!runRow) {
      return jsonResponse(
        {
          status: "PENDING",
          message: "Run not found yet. It may still be processing.",
          run: null,
          insights: [],
          metrics: [],
          rawCounts: {},
        },
        200,
      );
    }

    const [insightsResult, metricsResult, rawResult] = await Promise.all([
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.insights)
        .select("*")
        .eq("fetch_run_id", fetchRunId)
        .order("created_at", { ascending: false, nullsFirst: false }),
      supabaseAdmin
        .from(G12_SUPABASE_TABLES.metrics)
        .select("*")
        .eq("fetch_run_id", fetchRunId)
        .order("created_at", { ascending: false, nullsFirst: false }),
      supabaseAdmin.from(G12_SUPABASE_TABLES.rawScrapeQuarantine).select("platform").eq("fetch_run_id", fetchRunId),
    ]);

    if (insightsResult.error || metricsResult.error || rawResult.error) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to load G12 related records from Supabase.",
          errors: {
            insights: insightsResult.error?.message ?? null,
            metrics: metricsResult.error?.message ?? null,
            raw: rawResult.error?.message ?? null,
          },
        },
        500,
      );
    }

    const run = normalizeG12SupabaseRunRow(runRow as Record<string, unknown>);
    if (!run) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "G12 run could not be normalized.",
        },
        500,
      );
    }

    const insights = (insightsResult.data ?? [])
      .map((row, index) => normalizeG12SupabaseInsightRow(row as Record<string, unknown>, index))
      .filter(Boolean);
    const metrics = (metricsResult.data ?? [])
      .map((row, index) => normalizeG12SupabaseMetricRow(row as Record<string, unknown>, index))
      .filter(Boolean);
    const rawCounts = countG12RawCounts((rawResult.data ?? []) as Array<Record<string, unknown>>);

    return jsonResponse(
      {
        status: run.status || "PASS",
        source: "SUPABASE_REAL_DATA",
        message: "G12 run loaded from Supabase.",
        run,
        insights,
        metrics,
        rawCounts,
      },
      200,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unexpected error while loading G12 run.",
        error: error?.message ?? String(error),
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
