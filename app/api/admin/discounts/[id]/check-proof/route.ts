export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { discountProofRequestSchema } from "@/lib/admin/discounts";
import { runAdminDiscountProofCheck } from "@/server/next/api/admin-discounts";
import { invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const resolveId = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { id?: string } | undefined);
  return resolved?.id ?? "";
};

export async function POST(request: Request, context: { params?: Promise<{ id?: string }> }) {
  const discountId = await resolveId(context?.params);
  if (!discountId) {
    return jsonResponse({ message: "Discount not found." }, 404);
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) {
    return invalidJsonResponse();
  }

  const parsed = discountProofRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message ?? "Invalid proof request." }, 400);
  }

  return runAdminDiscountProofCheck(discountId, parsed.data);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
