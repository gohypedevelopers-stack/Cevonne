export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchUsersRoute } from "@/server/next/api/users";

export async function GET(request: Request) {
  return dispatchUsersRoute(request, []);
}
