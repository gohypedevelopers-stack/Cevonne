export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { registerG5Asset } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  workflow_id: z.literal("G5"),
  action_type: z.literal("IG_PUBLISH_POST"),
  platform: z.literal("INSTAGRAM"),
  asset_type: z.string().trim().min(1),
  asset_title: z.string().trim().min(1),
  content_text: z.string().trim().min(1),
  media_url: z.string().trim().min(1),
  storage_url: z.string().trim().min(1),
  g4_review_id: z.string().trim().min(1),
  g4_review_uuid: z.string().trim().min(1),
  content_review_id: z.string().trim().min(1),
  review_id: z.string().trim().min(1),
  source_platform: z.literal("WEBSITE"),
  source_event: z.literal("CLIENT_UPLOAD"),
  rights_status: z.literal("OWNED_OR_INTERNAL"),
  actor: z.string().trim().min(1),
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
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid G5 asset registration request" }, 400);
  }

  const response = await registerG5Asset(parsed.data);
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
