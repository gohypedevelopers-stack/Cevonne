export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { submitG5ApprovalDecision } from "@/server/next/api/g5-asset-approval";
import { notifyG8OfG5Decision } from "@/server/next/api/g8-creator-proof";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  approval_id: z.string().trim().min(1),
  asset_id: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer_id: z.string().trim().min(1).optional(),
  reviewer_note: z.string().trim().min(1).nullable().optional(),
  rejection_reason: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401);
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid approval decision request" }, 400);
  }

  const reviewerId = auth.email?.trim() || auth.name?.trim() || auth.id;
  const response = await submitG5ApprovalDecision({
    ...parsed.data,
    reviewer_id: reviewerId,
  });

  if (response.status !== "ERROR") {
    try {
      await notifyG8OfG5Decision({
        assetId: parsed.data.asset_id,
        approvalId: parsed.data.approval_id,
        decision: parsed.data.decision,
        reviewerId,
        reviewerNote: parsed.data.reviewer_note || parsed.data.rejection_reason || null,
      });
    } catch (error) {
      console.error("[g5-approval] G8 callback failed after the G5 decision was recorded", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
