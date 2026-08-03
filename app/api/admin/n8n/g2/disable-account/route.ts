export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { env } from "@/server/config";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { callG2Webhook } from "@/server/next/api/g2-proxy";

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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = {
      updated_by: "website_admin",
      ...body,
    };
    const data = await callG2Webhook(env.n8nG2DisableAccountPath, payload);
    return Response.json(data);
  } catch (error) {
    return jsonResponse(
      {
        status: "ERROR",
        response_type: "G2_PROXY_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "Unable to disable account monitoring in G2.",
      },
      502,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
