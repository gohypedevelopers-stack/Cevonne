export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadWorkflowDashboardDetail } from "@/server/next/api/admin-workflow-dashboard";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

export async function GET(request: Request, { params }: { params: Promise<{ workflowId?: string }> | { workflowId?: string } }) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const resolvedParams = await Promise.resolve(params);
  const workflowId = resolvedParams?.workflowId;
  if (!workflowId) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Workflow not found.",
      },
      404,
    );
  }

  try {
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

    return jsonResponse(
      {
        status: detail.status,
        message: detail.message,
        workflowGroup: detail.workflowGroup,
        workflow: detail.workflow,
        latestOutcome: detail.latestOutcome ?? null,
        savedInsights: detail.savedInsights ?? [],
        recentOutcomes: detail.recentOutcomes ?? [],
        g4Detail: detail.g4Detail ?? null,
        g5Detail: detail.g5Detail ?? null,
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unexpected error while loading workflow detail.",
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
