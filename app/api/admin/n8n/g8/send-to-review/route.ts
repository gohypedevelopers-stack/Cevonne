export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { dispatchG8AdminAction, g8ItemKey } from "@/server/next/api/g8-admin-route";
import { methodNotAllowed } from "@/server/next/route-utils";

const sendToReviewSchema = z.object({
  action: z.literal("SEND_FOR_APPROVAL"),
  itemKey: g8ItemKey,
});

export async function POST(request: Request) {
  return dispatchG8AdminAction(request, sendToReviewSchema);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
