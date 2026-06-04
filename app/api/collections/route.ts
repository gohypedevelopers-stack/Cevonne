export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCollectionsRoute } from "@/server/next/api/collections";

export async function GET(request: Request) {
  return dispatchCollectionsRoute(request, []);
}

export async function POST(request: Request) {
  return dispatchCollectionsRoute(request, []);
}
