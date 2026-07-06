export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { env } from "@/server/config";
import { postN8nWebhook } from "@/lib/n8n-client";
import { loadWorkflowDashboardDetail, runWorkflowDashboardWorkflow } from "@/server/next/api/admin-workflow-dashboard";
import { getG11RecommendationTypeConfig, getG11ReviewAreaConfig } from "@/lib/admin/workflows";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";
import type { WorkflowRunValues } from "@/lib/admin/workflows";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getNote = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }

  const note = value.note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
};

const normalizeDecision = (value: unknown) => getString(value).toUpperCase().replace(/[\s-]+/g, "_");

const buildG11ForwardPayload = (body: Record<string, unknown>) => {
  const actor = getString(body.actor) || "website_admin";
  const targetWorkflowGroup = getString(body.target_workflow_group);
  const platform = getString(body.platform);
  const requestedDecision = normalizeDecision(body.requested_decision);
  const inputSummary = { note: getNote(body.input_summary) };

  if (targetWorkflowGroup || platform || requestedDecision) {
    if (!requestedDecision || requestedDecision === "WEEKLY_DIGEST") {
      return {
        kind: "weekly" as const,
        payload: {
          actor,
          target_workflow_group: targetWorkflowGroup || "ALL",
          platform: platform || "ALL",
          input_summary: inputSummary,
        },
      };
    }

    return {
      kind: "decision" as const,
      payload: {
        actor,
        target_workflow_group: targetWorkflowGroup || "ALL",
        platform: platform || "ALL",
        requested_decision: requestedDecision,
        focus_area: getString(body.focus_area) || "Overall business summary",
        input_summary: inputSummary,
      },
    };
  }

  const reviewArea = getG11ReviewAreaConfig(getString(body.focus_area));
  const recommendationType = getG11RecommendationTypeConfig(getString(body.recommendation_type));

  if (recommendationType?.usesWeeklyDigest) {
    return {
      kind: "weekly" as const,
      payload: {
        actor: "website_admin",
        target_workflow_group: "ALL",
        platform: "ALL",
        input_summary: inputSummary,
      },
    };
  }

  return {
    kind: "decision" as const,
    payload: {
      actor: "website_admin",
      target_workflow_group: reviewArea?.targetWorkflowGroup ?? "ALL",
      platform: reviewArea?.platform ?? "ALL",
      requested_decision: recommendationType?.requestedDecision ?? "INVESTIGATE",
      focus_area: reviewArea?.label ?? "Overall business summary",
      input_summary: inputSummary,
    },
  };
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workflowId?: string }> | { workflowId?: string } },
) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const resolvedParams = await Promise.resolve(params);
  const workflowId = resolvedParams?.workflowId ?? null;
  if (!workflowId) {
    return jsonResponse({ status: "ERROR", message: "Workflow not found." }, 404);
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && !isRecord(body)) {
    return invalidJsonResponse();
  }

  try {
    if (workflowId === "G11") {
      console.log("G11 API ROUTE HIT");
      console.log("G11 API BODY:", body);

      const normalized = buildG11ForwardPayload((body ?? {}) as Record<string, unknown>);
      const webhookUrl =
        normalized.kind === "weekly" ? env.cevonneN8nWeeklyDigestUrl : env.cevonneN8nDecisionRecommendationUrl;

      console.log("G11 FORWARD URL:", webhookUrl || "(missing)");

      if (!webhookUrl) {
        return jsonResponse(
          {
            status: "ERROR",
            message: "G11 endpoint is not configured.",
          },
          500,
        );
      }

      console.log("G11 NORMALIZED PAYLOAD:", normalized.payload);

      const result = await postN8nWebhook({
        url: webhookUrl,
        payload: normalized.payload,
        dryRun: true,
        timeoutMs: 120000,
        source: "g11",
      });

      console.log("G11 N8N STATUS:", result.status);
      console.log("G11 N8N RESPONSE:", result);

      return jsonResponse(result, 200);
    }

    const detail = await loadWorkflowDashboardDetail(workflowId);
    if (!detail) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Workflow not found.",
        },
        404,
      );
    }

    const result = await runWorkflowDashboardWorkflow(workflowId, (body ?? {}) as WorkflowRunValues);
    if (!result) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Workflow could not be run.",
        },
        404,
      );
    }

    return jsonResponse(result, 200);
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unexpected error while running workflow.",
      },
      500,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
