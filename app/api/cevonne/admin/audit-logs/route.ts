export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminAuditLogsRoute } from "@/server/next/api/cevonne-admin";

export async function GET(request: Request) {
  return dispatchCevonneAdminAuditLogsRoute(request);
}

