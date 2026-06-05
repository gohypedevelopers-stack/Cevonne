export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminSafeTestRoute } from "@/server/next/api/cevonne-admin";

export async function POST(request: Request) {
  return dispatchCevonneAdminSafeTestRoute(request);
}

