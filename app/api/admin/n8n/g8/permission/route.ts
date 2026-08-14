export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { dispatchG8AdminAction, g8ItemKey, g8NullableText } from "@/server/next/api/g8-admin-route";
import { methodNotAllowed } from "@/server/next/route-utils";

const permissionSchema = z.object({
  action: z.enum(["PERMISSION_YES", "PERMISSION_NO"]),
  itemKey: g8ItemKey,
  reviewerNote: g8NullableText,
  permissionRequestText: z.string().trim().min(1, "The approved permission request is required.").max(5_000),
  creatorReplyText: z.string().trim().min(1, "Enter the creator's reply shown in the proof.").max(5_000),
  requestEvidenceUrl: z.url("Attach the permission request proof."),
  replyEvidenceUrl: z.url("Attach the creator reply proof."),
  confirmed: z.literal(true, { error: "Confirm the creator response before recording it." }),
}).superRefine((value, context) => {
  const expectedReply = value.action === "PERMISSION_YES" ? "YES" : "NO";
  if (!new RegExp(`^${expectedReply}\\b`, "i").test(value.creatorReplyText)) {
    context.addIssue({ code: "custom", path: ["creatorReplyText"], message: `The recorded reply must begin with ${expectedReply}.` });
  }
});

export async function POST(request: Request) {
  return dispatchG8AdminAction(request, permissionSchema);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
