export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchShadesRoute } from "@/server/next/api/shades";

export async function GET(request: Request) {
  return dispatchShadesRoute(request, []);
}

export async function POST(request: Request) {
  return dispatchShadesRoute(request, []);
}
