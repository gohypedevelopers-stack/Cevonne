export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runG5PublishingDryRun } from "@/server/next/api/g5-publishing-scheduler-adapter";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const toText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const resolveRequestedBy = (auth: { id: string; email?: string | null; name?: string | null }) =>
  toText(auth.name) || toText(auth.email) || auth.id;

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

  if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) {
    return invalidJsonResponse();
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const result = await runG5PublishingDryRun({
    approval_id: toText(record.approval_id) || toText(record.approvalId),
    asset_id: toText(record.asset_id) || toText(record.assetId),
    requested_by: toText(record.requested_by) || resolveRequestedBy(auth),
    notes: toText(record.notes),
  });

  return jsonResponse(result, 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
