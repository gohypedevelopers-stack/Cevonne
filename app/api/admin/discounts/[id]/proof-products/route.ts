export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchAdminDiscountsRoute } from "@/server/next/api/admin-discounts";

const resolveId = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { id?: string } | undefined);
  return resolved?.id ?? "";
};

export async function GET(request: Request, context: { params?: Promise<{ id?: string }> }) {
  const discountId = await resolveId(context?.params);
  if (!discountId) {
    return new Response(JSON.stringify({ message: "Discount not found." }), { status: 404 });
  }

  return dispatchAdminDiscountsRoute(request, [discountId, "proof-products"]);
}

export async function POST() {
  return new Response(JSON.stringify({ message: "Method Not Allowed" }), { status: 405 });
}
