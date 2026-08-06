export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { decideG9Recommendation, G9ServiceError } from "@/server/next/api/g9-ads-optimizer";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const bodySchema = z.object({
  reference: z.string().trim().min(20).max(2_000),
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  note: z.string().trim().max(1_000).nullable().optional().transform((value) => value || null),
}).strict().superRefine((value, context) => {
  if (["REJECT", "REQUEST_CHANGES"].includes(value.decision) && (!value.note || value.note.length < 3)) {
    context.addIssue({ code: "custom", path: ["note"], message: value.decision === "REJECT" ? "Add a short reason for rejecting this recommendation." : "Describe the changes needed." });
  }
});

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403, { "Cache-Control": "no-store" });
  let body: unknown;
  try { body = await request.json(); } catch { return invalidJsonResponse(); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ message: parsed.error.issues[0]?.message || "Check the decision and try again." }, 422, { "Cache-Control": "no-store" });
  const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
  try {
    return jsonResponse(await decideG9Recommendation(parsed.data, actor), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const status = error instanceof G9ServiceError ? error.status : 502;
    console.error("[g9] approval route failed", { status });
    return jsonResponse({ message: error instanceof G9ServiceError ? error.message : "The approval decision could not be saved. Try again." }, status, { "Cache-Control": "no-store" });
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
