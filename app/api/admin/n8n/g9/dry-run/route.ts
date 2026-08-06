export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { G9ServiceError, runG9DryRun } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const bodySchema = z.object({ reference: z.string().trim().min(20).max(2_000) }).strict();

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  let body: unknown;
  try { body = await request.json(); } catch { return invalidJsonResponse(); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ message: "Refresh this recommendation and try again." }, 422, { "Cache-Control": "no-store" });
  const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
  try {
    return jsonResponse(await runG9DryRun(parsed.data, actor), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] dry-run route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "The dry run could not be completed. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
