export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { normalizeG7DashboardSummary } from "@/lib/admin/g7-dashboard-summary";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const G7_DASHBOARD_SUMMARY_URL = "https://n8n.cevonne.com/webhook/g7-dashboard-summary";

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const response = await fetch(G7_DASHBOARD_SUMMARY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 10 }),
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);
    const summary = normalizeG7DashboardSummary(body);

    if (!response.ok || !summary) {
      throw new Error("G7 data could not be loaded. Check the n8n connection.");
    }

    return jsonResponse(summary, 200);
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "G7 data could not be loaded. Check the n8n connection.",
      },
      502,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
