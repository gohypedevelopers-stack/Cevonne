export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runWorkflowDashboardWorkflow } from "@/server/next/api/admin-workflow-dashboard";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && !isRecord(body)) {
    return invalidJsonResponse();
  }

  const result = await runWorkflowDashboardWorkflow("G4", (body ?? {}) as Record<string, string | boolean>);
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
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
