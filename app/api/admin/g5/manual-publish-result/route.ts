export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { recordG5ManualPublishResult } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  asset_id: z.string().trim().min(1),
  approval_id: z.string().trim().min(1),
  platform: z.literal("INSTAGRAM"),
  post_url: z.string().trim().min(1),
  published_by: z.string().trim().min(1),
  published_at: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid manual publish result request" }, 400);
  }

  const response = await recordG5ManualPublishResult(parsed.data);
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
