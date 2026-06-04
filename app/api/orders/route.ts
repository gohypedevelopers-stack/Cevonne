export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchOrdersRoute } from "@/server/next/api/orders";

export async function GET(request: Request) {
  return dispatchOrdersRoute(request, []);
}

export async function POST(request: Request) {
  return dispatchOrdersRoute(request, []);
}
