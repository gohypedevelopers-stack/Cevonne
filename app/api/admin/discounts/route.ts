export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchAdminDiscountsRoute } from "@/server/next/api/admin-discounts";

export async function GET(request: Request) {
  try {
    return await dispatchAdminDiscountsRoute(request, []);
  } catch (error) {
    console.error("API GET /api/admin/discounts ERROR:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await dispatchAdminDiscountsRoute(request, []);
  } catch (error) {
    console.error("API POST /api/admin/discounts ERROR:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), { status: 500 });
  }
}

