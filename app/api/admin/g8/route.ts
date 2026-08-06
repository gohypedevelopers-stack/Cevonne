export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getG8DashboardData } from "@/server/next/api/g8-creator-proof";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401);
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403);

  try {
    const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
    return jsonResponse(await getG8DashboardData(actor), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[g8] dashboard load failed", { message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ message: "UGC data could not be loaded. Check the connection and try again." }, 502);
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
