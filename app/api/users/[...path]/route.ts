export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchUsersRoute } from "@/server/next/api/users";

const resolveSegments = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { path?: string[] } | undefined);
  return resolved?.path ?? [];
};

export async function GET(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchUsersRoute(request, await resolveSegments(context?.params));
}

export async function POST(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchUsersRoute(request, await resolveSegments(context?.params));
}

export async function PATCH(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchUsersRoute(request, await resolveSegments(context?.params));
}
