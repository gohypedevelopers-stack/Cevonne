export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { dispatchG8AdminAction, g8ItemKey, g8NullableText } from "@/server/next/api/g8-admin-route";
import { methodNotAllowed } from "@/server/next/route-utils";

const disclosureSchema = z.object({
  action: z.literal("DISCLOSURE"),
  itemKey: g8ItemKey,
  relationshipType: z.enum(["ORGANIC", "GIFTED", "PAID", "AFFILIATE"]),
  disclosureText: g8NullableText,
  disclosureVisible: z.boolean(),
  evidenceUrl: z.url().nullable().optional().transform((value) => value || null),
  paidPartnershipLabel: z.boolean(),
  reviewerNote: g8NullableText,
}).superRefine((value, context) => {
  if (value.relationshipType === "ORGANIC") return;
  if (!value.disclosureText) context.addIssue({ code: "custom", message: "Add the disclosure text." });
  if (!value.disclosureVisible) context.addIssue({ code: "custom", message: "Confirm that the disclosure is clearly visible." });
  if (value.relationshipType === "PAID" && !value.paidPartnershipLabel) context.addIssue({ code: "custom", message: "Confirm the paid partnership label." });
});

export async function POST(request: Request) {
  return dispatchG8AdminAction(request, disclosureSchema);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
