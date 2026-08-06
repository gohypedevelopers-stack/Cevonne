export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { G9_DATE_RANGES } from "@/lib/admin/g9-ads-optimizer";
import { G9ServiceError, runG9Review } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const bodySchema = z.object({
  dateRange: z.enum(G9_DATE_RANGES).default("LAST_30_DAYS"),
  note: z.string().trim().max(1_000).nullable().optional().transform((value) => value || null),
}).strict();

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  let body: unknown;
  try { body = await request.json(); } catch { return invalidJsonResponse(); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ message: parsed.error.issues[0]?.message || "Check the review details and try again." }, 422, { "Cache-Control": "no-store" });
  const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
  try {
    return jsonResponse(await runG9Review(parsed.data, actor), 202, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] review route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "The ad review could not be started. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
