export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { performG8Action, type G8ActionInput } from "@/server/next/api/g8-creator-proof";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const nullableText = z.string().trim().max(2_000).nullable().optional().transform((value) => value || null);
const itemKey = z.string().uuid();

const intakeSchema = z.object({
  action: z.literal("INTAKE"),
  mediaId: z.string().trim().max(250).nullable().optional().transform((value) => value || null),
  sourceUrl: z.url().nullable().optional().transform((value) => value || null),
  creatorUsername: z.string().trim().min(1, "Add the creator username.").max(100),
  creatorDisplayName: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  mentionedBrand: z.boolean(),
  taggedBrand: z.boolean(),
  mediaType: z.enum(["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL", "UNKNOWN"]),
  caption: z.string().trim().max(5_000).default(""),
}).superRefine((value, context) => {
  if (!value.mediaId && !value.sourceUrl) context.addIssue({ code: "custom", message: "Add an Instagram media ID or source URL." });
  if (!value.mentionedBrand && !value.taggedBrand) context.addIssue({ code: "custom", message: "Select mentioned or tagged before saving." });
});

const permissionSchema = z.object({
  action: z.enum(["PERMISSION_YES", "PERMISSION_NO"]),
  itemKey,
  reviewerNote: nullableText,
  confirmed: z.boolean().refine((value) => value, { message: "Confirm that you checked the creator response in ManyChat." }),
});

const safetySchema = z.object({
  action: z.enum(["SAFETY_PASS", "SAFETY_BLOCK"]),
  itemKey,
  musicRights: z.enum(["PASS", "NOT_APPLICABLE", "BLOCK"]),
  reviewerNote: nullableText,
  blockReason: z.enum(["CHILD_VISIBLE", "COMPETITOR_VISIBLE", "PRIVATE_CONTENT", "PROHIBITED_CONTENT", "CLAIM_RISK", "COPYRIGHT_NOT_CLEARED", "MUSIC_NOT_CLEARED"]).nullable().optional().transform((value) => value || null),
  confirmedChecks: z.array(z.string()).max(7).default([]),
}).superRefine((value, context) => {
  if (value.action === "SAFETY_PASS" && value.confirmedChecks.length !== 7) {
    context.addIssue({ code: "custom", message: "Confirm every safety check before passing the review." });
  }
  if (value.action === "SAFETY_PASS" && value.musicRights === "BLOCK") {
    context.addIssue({ code: "custom", message: "Music rights must be cleared or not applicable." });
  }
  if (value.action === "SAFETY_BLOCK" && !value.blockReason) {
    context.addIssue({ code: "custom", message: "Choose or add a clear reason for blocking this content." });
  }
});

const disclosureSchema = z.object({
  action: z.literal("DISCLOSURE"),
  itemKey,
  relationshipType: z.enum(["ORGANIC", "GIFTED", "PAID", "AFFILIATE"]),
  disclosureText: nullableText,
  disclosureVisible: z.boolean().default(false),
  evidenceUrl: z.url().nullable().optional().transform((value) => value || null),
  paidPartnershipLabel: z.boolean().default(false),
  reviewerNote: nullableText,
}).superRefine((value, context) => {
  if (value.relationshipType === "ORGANIC") return;
  if (!value.disclosureText) context.addIssue({ code: "custom", message: "Add the disclosure text." });
  if (!value.disclosureVisible) context.addIssue({ code: "custom", message: "Confirm that the disclosure is clearly visible." });
  if (!value.evidenceUrl) context.addIssue({ code: "custom", message: "Add the disclosure reference link." });
  if (value.relationshipType === "PAID" && !value.paidPartnershipLabel) {
    context.addIssue({ code: "custom", message: "Confirm the paid partnership label." });
  }
});

const approvalSchema = z.object({
  action: z.literal("SEND_FOR_APPROVAL"),
  itemKey,
  assetTitle: z.string().trim().min(1, "Add an asset title.").max(180),
  contentText: z.string().trim().min(1, "Add the content text.").max(5_000),
});

const revocationSchema = z.object({
  action: z.literal("REVOKE_PERMISSION"),
  itemKey,
  reason: z.string().trim().min(3, "Add a revocation reason.").max(1_000),
  evidenceUrl: z.url("Add a valid reference link."),
  confirmed: z.boolean().refine((value) => value, { message: "Confirm that future use must be blocked." }),
});

const actionSchema = z.union([intakeSchema, permissionSchema, safetySchema, disclosureSchema, approvalSchema, revocationSchema]);

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

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ message: parsed.error.issues[0]?.message || "Check the form and try again." }, 422);

  const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
  try {
    const result = await performG8Action(parsed.data as G8ActionInput, actor);
    return jsonResponse(result, result.status === "PENDING" ? 202 : result.status === "BLOCKED" ? 422 : 200);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "G8 could not complete this request. Please try again.";
    const isConnectionFailure = /connection|reach|longer than expected|configured/i.test(message);
    console.error("[g8] action failed", { action: parsed.data.action, message });
    return jsonResponse({ message }, isConnectionFailure ? 502 : 422);
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
