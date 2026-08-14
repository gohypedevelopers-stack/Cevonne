export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getG8DashboardResponse } from "@/server/next/api/g8-dashboard-route";
import { methodNotAllowed } from "@/server/next/route-utils";

export async function GET(request: Request) {
  return getG8DashboardResponse(request, "summary");
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
