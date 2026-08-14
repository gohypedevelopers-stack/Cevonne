import "server-only";

import { z } from "zod";

import { performG8Action, type G8ActionInput } from "@/server/next/api/g8-creator-proof";
import { getAuthUser, invalidJsonResponse, jsonResponse } from "@/server/next/route-utils";

export const g8ItemKey = z.string().uuid();
export const g8NullableText = z.string().trim().max(2_000).nullable().optional().transform((value) => value || null);

export async function dispatchG8AdminAction(request: Request, schema: z.ZodType) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401);
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonResponse({ message: parsed.error.issues[0]?.message || "Check the form and try again." }, 422);

  const actor = auth.email?.trim() || auth.name?.trim() || auth.id;
  try {
    const result = await performG8Action(parsed.data as G8ActionInput, actor);
    return jsonResponse(result, result.status === "PENDING" ? 202 : result.status === "BLOCKED" ? 422 : 200);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "G8 could not complete this request. Please try again.";
    const isConnectionFailure = /connection|reach|longer than expected|configured/i.test(message);
    console.error("[g8] action failed", { message });
    return jsonResponse({ message }, isConnectionFailure ? 502 : 422);
  }
}
