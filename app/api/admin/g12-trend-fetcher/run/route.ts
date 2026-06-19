export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { G12_TREND_FETCHER_GENERAL_BRANCH_KEY, G12_TREND_FETCHER_QUERY_DEFAULT, type G12TrendPlatform } from "@/lib/g12-trend-fetcher";

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

    const branchKeyValue = typeof body.branch_key === "string" && body.branch_key.trim()
      ? body.branch_key.trim()
      : G12_TREND_FETCHER_GENERAL_BRANCH_KEY;

    const payload = {
      platforms: normalizePlatforms(body.platforms),
      query: typeof body.query === "string" && body.query.trim() ? body.query.trim() : G12_TREND_FETCHER_QUERY_DEFAULT,
      fetch_limit: toSafeInteger(body.fetch_limit, 50, 1),
      top_comments_limit: toSafeInteger(body.top_comments_limit, 0, 0),
      actor: typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "website_admin",
      branch_key: branchKeyValue,
    };

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
