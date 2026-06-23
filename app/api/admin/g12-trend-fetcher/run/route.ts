export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import {
  buildG12PublicTrendFetchPayload,
  G12_PUBLIC_TREND_FETCHER_DEFAULT_QUERY,
  G12_PUBLIC_TREND_FETCHER_DEFAULT_TOP_COMMENTS_LIMIT,
  type G12TrendFetcherPlatformSelection,
  type G12TrendPlatform,
} from "@/lib/g12-trend-fetcher";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const normalizePlatforms = (value: unknown): G12TrendPlatform[] => {
  if (!Array.isArray(value)) {
    return ["INSTAGRAM", "TIKTOK"];
  }

  const platforms = value
    .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
    .filter((entry): entry is G12TrendPlatform => entry === "INSTAGRAM" || entry === "TIKTOK");

  return platforms.length ? Array.from(new Set(platforms)) : ["INSTAGRAM", "TIKTOK"];
};

const normalizePlatformSelection = (value: unknown): G12TrendFetcherPlatformSelection => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "instagram") {
      return "instagram";
    }

    if (normalized === "tiktok") {
      return "tiktok";
    }
  }

  const platforms = normalizePlatforms(value);
  if (platforms.length === 1) {
    return platforms[0] === "INSTAGRAM" ? "instagram" : "tiktok";
  }

  return "both";
};

const toSafeInteger = (value: unknown, fallback: number, minimum: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.trunc(parsed));
};

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const n8nUrl = process.env.N8N_G12_PUBLIC_TREND_FETCH_URL;

    if (!n8nUrl) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "N8N_G12_PUBLIC_TREND_FETCH_URL is missing.",
        },
        500,
      );
    }

    const payload = buildG12PublicTrendFetchPayload({
      platformSelection: normalizePlatformSelection(body.platformSelection ?? body.platform_selection ?? body.platforms),
      query: typeof body.query === "string" && body.query.trim() ? body.query.trim() : G12_PUBLIC_TREND_FETCHER_DEFAULT_QUERY,
      fetchLimit: toSafeInteger(body.fetch_limit ?? body.fetchLimit, 50, 1),
      minInsightsToStore: toSafeInteger(body.min_insights_to_store ?? body.minInsightsToStore, 5, 0),
      maxInsightsToStore: toSafeInteger(body.max_insights_to_store ?? body.maxInsightsToStore, 10, 0),
      qualityMode:
        typeof body.quality_mode === "string" && body.quality_mode.trim()
          ? body.quality_mode.trim()
          : typeof body.qualityMode === "string" && body.qualityMode.trim()
            ? body.qualityMode.trim()
            : undefined,
      topCommentsLimit: toSafeInteger(body.top_comments_limit ?? body.topCommentsLimit, G12_PUBLIC_TREND_FETCHER_DEFAULT_TOP_COMMENTS_LIMIT, 0),
    });

    const response = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const resultText = await response.text();

    let result: any;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = {
        raw_response: resultText,
      };
    }

    return jsonResponse(
      {
        status: result.status || (response.ok ? "ACCEPTED" : "ERROR"),
        http_status: response.status,
        source: "N8N_G12_WEBHOOK",
        request_payload: payload,
        result,
        fetch_run_id: result.fetch_run_id ?? result.fetchRunId ?? null,
        message: result.message ?? (response.ok ? "G12 workflow request accepted." : "Failed to start G12 Trend Fetcher workflow."),
      },
      response.ok ? 200 : response.status,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Failed to start G12 Trend Fetcher workflow.",
        error: error?.message ?? String(error),
      },
      500,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
