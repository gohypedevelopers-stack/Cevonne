export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { G9_DATE_RANGES, G9_RECOMMENDATION_FILTERS, G9_STATUS_FILTERS } from "@/lib/admin/g9-ads-optimizer";
import { getG9Recommendations, G9ServiceError } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const filtersSchema = z.object({
  recommendation: z.enum(G9_RECOMMENDATION_FILTERS).default("ALL"),
  status: z.enum(G9_STATUS_FILTERS).default("ALL"),
  dateRange: z.enum(G9_DATE_RANGES).default("LAST_90_DAYS"),
});

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  const parsed = filtersSchema.safeParse({
    recommendation: url.searchParams.get("recommendation") || undefined,
    status: url.searchParams.get("status") || undefined,
    dateRange: url.searchParams.get("dateRange") || undefined,
  });
  if (!parsed.success) return jsonResponse({ message: "Choose valid recommendation filters." }, 422, { "Cache-Control": "no-store" });
  try {
    return jsonResponse({ items: await getG9Recommendations(parsed.data) }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] recommendations route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "Ads recommendations could not be loaded. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
