export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { submitG5ApprovalDecision } from "@/server/next/api/g5-asset-approval";
import { invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const requestSchema = z.object({
  approval_id: z.string().trim().min(1),
  asset_id: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer_id: z.string().trim().min(1),
  reviewer_note: z.string().trim().min(1).nullable().optional(),
  rejection_reason: z.string().trim().min(1).nullable().optional(),
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
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid approval decision request" }, 400);
  }

  const response = await submitG5ApprovalDecision(parsed.data);
  return jsonResponse(response, response.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
