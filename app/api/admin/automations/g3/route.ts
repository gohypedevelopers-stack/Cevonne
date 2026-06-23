export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getG3WorkflowDetail } from "@/server/next/api/g3-consent-attribution-adapter";
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

  const detail = await getG3WorkflowDetail();
  return jsonResponse(detail, 200);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
