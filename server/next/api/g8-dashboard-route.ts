import "server-only";

import { getG8DashboardData } from "@/server/next/api/g8-creator-proof";
import { getAuthUser, jsonResponse } from "@/server/next/route-utils";

export async function getG8DashboardResponse(request: Request, responseType: "dashboard" | "summary" | "item", itemKey?: string) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401);
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403);

  try {
    const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
    const dashboard = await getG8DashboardData(actor);
    if (responseType === "summary") return jsonResponse({ ...dashboard.summary, refreshedAt: dashboard.refreshedAt }, 200, { "Cache-Control": "no-store" });
    if (responseType === "item") {
      const item = dashboard.items.find((entry) => entry.itemKey === itemKey);
      if (!item) return jsonResponse({ message: "UGC item not found." }, 404);
      return jsonResponse(item, 200, { "Cache-Control": "no-store" });
    }
    return jsonResponse(dashboard, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[g8] dashboard load failed", { message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ message: "UGC data could not be loaded. Check the connection and try again." }, 502);
  }
}
