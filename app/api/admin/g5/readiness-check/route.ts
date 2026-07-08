export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { runG5ReadinessCheck } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  workflow_id: z.literal("G5"),
  requested_by_workflow: z.literal("G5"),
  action_type: z.literal("MANUAL_PUBLISH_READY_CHECK"),
  execution_mode: z.literal("DRY_RUN"),
  provider: z.literal("MANUAL_FALLBACK"),
  platform: z.literal("INSTAGRAM"),
  account_id: z.string().trim().min(1),
  asset_id: z.string().trim().min(1),
  content_review_id: z.string().trim().min(1),
  g4_review_id: z.string().trim().min(1),
  approval_id: z.string().trim().min(1),
  asset_type: z.string().trim().min(1),
  media_url: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  hook_angle: z.string().trim().min(1).nullable().optional(),
  selected_caption: z.string().trim().min(1).nullable().optional(),
  selected_caption_index: z.number().int().nullable().optional(),
  selected_hook: z.string().trim().min(1).nullable().optional(),
  selected_hook_index: z.number().int().nullable().optional(),
  caption_options: z.any().optional(),
  hook_options: z.any().optional(),
  media_assets: z.any().optional(),
  original_post_data: z.any().optional(),
  original_post_url: z.string().trim().min(1).nullable().optional(),
  source_content_id: z.string().trim().min(1).nullable().optional(),
  source_g4_review_id: z.string().trim().min(1).nullable().optional(),
  source_handoff_id: z.string().trim().min(1).nullable().optional(),
  source_status: z.string().trim().min(1).nullable().optional(),
  registration_status: z.string().trim().min(1).nullable().optional(),
  approval_status: z.string().trim().min(1).nullable().optional(),
  readiness_status: z.string().trim().min(1).nullable().optional(),
  g5_status: z.string().trim().min(1).nullable().optional(),
  metadata: z.any().optional(),
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
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid readiness check request" }, 400);
  }

  const response = await runG5ReadinessCheck(parsed.data);
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
