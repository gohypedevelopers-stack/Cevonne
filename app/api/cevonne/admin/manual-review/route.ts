export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminManualReviewRoute } from "@/server/next/api/cevonne-admin";

export async function POST(request: Request) {
  return dispatchCevonneAdminManualReviewRoute(request);
}

