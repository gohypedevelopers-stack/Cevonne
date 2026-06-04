export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneOptOutRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonneOptOutRoute(request);
}
