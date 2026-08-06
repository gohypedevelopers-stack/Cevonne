export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getG9Overview, G9ServiceError } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  try {
    return jsonResponse(await getG9Overview(), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] overview route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "Ads overview could not be loaded. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
