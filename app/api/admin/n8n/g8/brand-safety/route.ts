export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { dispatchG8AdminAction, g8ItemKey, g8NullableText } from "@/server/next/api/g8-admin-route";
import { methodNotAllowed } from "@/server/next/route-utils";

const brandSafetySchema = z.object({
  action: z.enum(["SAFETY_PASS", "SAFETY_BLOCK"]),
  itemKey: g8ItemKey,
  musicRights: z.enum(["PASS", "NOT_APPLICABLE", "BLOCK"]),
  evidenceUrl: z.url().nullable().optional().transform((value) => value || null),
  reviewerNote: g8NullableText,
  blockReason: z.enum(["CHILD_VISIBLE", "COMPETITOR_VISIBLE", "PRIVATE_CONTENT", "PROHIBITED_CONTENT", "CLAIM_RISK", "COPYRIGHT_NOT_CLEARED", "MUSIC_NOT_CLEARED"]).nullable(),
  confirmedChecks: z.array(z.string()).max(7).default([]),
}).superRefine((value, context) => {
  if (value.action === "SAFETY_PASS" && value.confirmedChecks.length !== 7) context.addIssue({ code: "custom", message: "Confirm every safety check before passing the review." });
  if (value.action === "SAFETY_PASS" && value.musicRights === "BLOCK") context.addIssue({ code: "custom", message: "Music rights must be cleared or not applicable." });
  if (value.action === "SAFETY_BLOCK" && !value.blockReason) context.addIssue({ code: "custom", message: "Choose a clear reason for blocking this content." });
});

export async function POST(request: Request) {
  return dispatchG8AdminAction(request, brandSafetySchema);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
