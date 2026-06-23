export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadWorkflowDashboardDetail, runWorkflowDashboardWorkflow } from "@/server/next/api/admin-workflow-dashboard";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";
import type { WorkflowRunValues } from "@/lib/admin/workflows";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

  try {
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
