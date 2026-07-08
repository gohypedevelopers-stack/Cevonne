export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { persistG5AssetComposerEditEntry } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  asset_id: z.string().trim().min(1),
  approval_id: z.string().trim().min(1).nullable().optional(),
  platform: z.literal("INSTAGRAM"),
  asset_title: z.string().trim().min(1),
  content_text: z.string().trim().min(1),
  hook_angle: z.string().trim().nullable().optional(),
  selected_caption: z.string().trim().nullable().optional(),
  selected_caption_index: z.number().int().nullable().optional(),
  selected_hook: z.string().trim().nullable().optional(),
  selected_hook_index: z.number().int().nullable().optional(),
  caption_options: z.any().optional(),
  hook_options: z.any().optional(),
  media_url: z.string().trim().min(1).nullable().optional(),
  storage_url: z.string().trim().min(1).nullable().optional(),
  media_assets: z.any().optional(),
  original_post_data: z.any().optional(),
  original_post_url: z.string().trim().min(1).nullable().optional(),
  source_content_id: z.string().trim().min(1).nullable().optional(),
  source_g4_review_id: z.string().trim().min(1).nullable().optional(),
  source_handoff_id: z.string().trim().min(1).nullable().optional(),
  source_platform: z.string().trim().min(1).nullable().optional(),
  source_event: z.string().trim().min(1).nullable().optional(),
  status: z.string().trim().min(1).nullable().optional(),
  source_status: z.string().trim().min(1).nullable().optional(),
  registration_status: z.string().trim().min(1).nullable().optional(),
  approval_status: z.string().trim().min(1).nullable().optional(),
  readiness_status: z.string().trim().min(1).nullable().optional(),
  g5_status: z.string().trim().min(1).nullable().optional(),
  used_in_g5: z.boolean().nullable().optional(),
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
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid G5 asset edit request" }, 400);
  }

  const result = await persistG5AssetComposerEditEntry(parsed.data);
  if (result.skipped && !result.auditRow) {
    return jsonResponse({ message: result.error_message || "Unable to save G5 asset details." }, 503);
  }

  const handledAt = new Date().toISOString();
  return jsonResponse(
    {
      status: "PASS",
      message: "Asset details updated.",
      response_type: "ASSET_EDIT",
      handled_at: handledAt,
      request_id: randomUUID(),
      sent_at: handledAt,
      webhook_url: "local://g5/asset-edit",
      http_status: 200,
      response_text: null,
      raw: result.auditRow,
    },
    200,
  );
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
