export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config/env";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const toText = (value: unknown, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
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
    const trend_insight_id = toText(body.trend_insight_id);
    const fetch_run_id = toText(body.fetch_run_id);
    const trend_title = toText(body.trend_title);
    const source_platform = toText(body.source_platform);
    const source_account_name = toText(body.source_account_name);
    const source_url = toText(body.source_url);
    const original_caption_preview = toText(body.original_caption_preview);
    const hook_angle = toText(body.hook_angle);
    const saved_insight_text = toText(body.saved_insight_text, toText(body.caption_summary));
    const content_recommendation = toText(body.content_recommendation);
    const clean_metric_summary = toText(body.clean_metric_summary);

    if (!trend_insight_id || !fetch_run_id || !trend_title || !source_platform || !source_account_name) {
      return jsonResponse(
        {
          status: "BLOCK",
          message: "Missing required clean trend fields.",
        },
        400,
      );
    }

    const cleanPayload = {
      requested_by_workflow: "G12",
      target_workflow_group: "G4",
      action_type: "CREATE_CONTENT_DRAFT_FROM_TREND",
      platform: "INTERNAL",
      trend_insight_id,
      fetch_run_id,
      trend_title,
      source_platform,
      source_account_name,
      source_url,
      original_caption_preview,
      saved_insight_text,
      caption_summary: saved_insight_text,
      hook_angle,
      content_recommendation,
      clean_metric_summary,
      views: toNumber(body.views, 0),
      likes: toNumber(body.likes, 0),
      comments: toNumber(body.comments, 0),
      shares: toNumber(body.shares, 0),
      engagement_rate: toNumber(body.engagement_rate, 0),
      brand_fit_score: toNumber(body.brand_fit_score, 0),
      risk_score: toNumber(body.risk_score, 0),
      actor: "admin_dashboard",
    };

    const response = await postN8nWebhook({
      path: env.n8nG4ContentCheckPath,
      payload: cleanPayload,
    });

    if (response.status === "ERROR") {
      return jsonResponse(
        {
          status: "ERROR",
          message: response.message,
        },
        500,
      );
    }

    return jsonResponse(
      {
        status: response.status,
        message: response.message,
        request_id: response.request_id,
        sent_at: response.sent_at,
        content_draft_id: response.id ?? response.event_id ?? null,
        trend_insight_id,
        fetch_run_id,
      },
      200,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Failed to send the trend to Content Draft.",
        error: error?.message ?? String(error),
      },
      500,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
