export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadWorkflowDashboardOverview } from "@/server/next/api/admin-workflow-dashboard";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

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
    const overview = await loadWorkflowDashboardOverview();

    return jsonResponse(
      {
        status: overview.status,
        message: overview.message,
        workflows: overview.workflows,
      },
      200,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unexpected error while loading workflow dashboard overview.",
        error: error?.message ?? String(error),
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
