export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { getG8DashboardResponse } from "@/server/next/api/g8-dashboard-route";
import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const itemKey = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ ugcId: string }> }) {
  const { ugcId } = await context.params;
  if (!itemKey.safeParse(ugcId).success) return jsonResponse({ message: "UGC item not found." }, 404);
  return getG8DashboardResponse(request, "item", ugcId);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
