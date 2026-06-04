export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchProductsRoute } from "@/server/next/api/products";

export async function GET(request: Request) {
  return dispatchProductsRoute(request, []);
}

export async function POST(request: Request) {
  return dispatchProductsRoute(request, []);
}
