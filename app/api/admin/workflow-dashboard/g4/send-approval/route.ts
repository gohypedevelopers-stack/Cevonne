export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { queueG4ApprovalRequest } from "@/server/next/api/g4-content-check-adapter";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const body = (await request.json().catch(() => null)) as { sourceId?: string | null } | null;

  const result = await queueG4ApprovalRequest({
    adminUserId: auth.id,
    adminEmail: auth.email ?? null,
    sourceId: body?.sourceId ?? null,
  });

  return jsonResponse(result, result.status === "ERROR" ? 500 : result.status === "BLOCK" ? 409 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
