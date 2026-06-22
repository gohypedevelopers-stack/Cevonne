export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { env } from "@/server/config";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { proxyG2Webhook } from "@/server/next/api/g2-proxy";

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

  try {
    const body = await request.json().catch(() => ({}));
    const result = await proxyG2Webhook(env.n8nG2UpdateAccountPath, body);
    return Response.json(result.data as Record<string, unknown>, { status: result.status });
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        response_type: "G2_PROXY_REQUEST_FAILED",
        message: "G2 proxy request failed.",
      },
      502,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
