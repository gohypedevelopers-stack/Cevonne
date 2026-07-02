export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config";
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

  const result = await postN8nWebhook({
    path: env.n8nG4ContentUserActionPath,
    payload: (body ?? {}) as Record<string, unknown>,
  });

  return jsonResponse(result, result.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
