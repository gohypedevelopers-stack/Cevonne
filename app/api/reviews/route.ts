export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchReviewsRoute } from "@/server/next/api/reviews";

export async function GET(request: Request) {
  return dispatchReviewsRoute(request, []);
}

export async function POST(request: Request) {
  return dispatchReviewsRoute(request, []);
}
