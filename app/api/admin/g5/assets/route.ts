export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { archiveG5Assets, loadG5DashboardAssets } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const deleteRequestSchema = z.object({
  asset_id: z.string().trim().min(1).nullable().optional(),
  approval_id: z.string().trim().min(1).nullable().optional(),
  client_tabs: z.array(z.enum(["approved_content", "pending_approval", "ready_to_publish", "published_manually", "blocked_rejected", "archived"])).optional(),
  actor: z.string().trim().min(1).nullable().optional(),
});

export async function GET() {
  const response = await loadG5DashboardAssets();
  return jsonResponse(response, response.status === "ERROR" ? 503 : 200);
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = deleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid G5 asset delete request" }, 400);
  }

  const response = await archiveG5Assets(parsed.data);
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
