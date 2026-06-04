export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonnePrivacyRequestRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonnePrivacyRequestRoute(request);
}
