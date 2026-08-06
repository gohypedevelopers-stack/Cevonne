export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { getG9Activity, G9ServiceError } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const querySchema = z.object({ limit: z.coerce.number().int().min(5).max(30).default(6) });

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  const parsed = querySchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") || undefined });
  if (!parsed.success) return jsonResponse({ message: "Choose a valid activity limit." }, 422, { "Cache-Control": "no-store" });
  try {
    return jsonResponse(await getG9Activity(parsed.data.limit), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] activity route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "Recent ads activity could not be loaded. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
