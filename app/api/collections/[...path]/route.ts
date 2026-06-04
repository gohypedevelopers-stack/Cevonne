export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCollectionsRoute } from "@/server/next/api/collections";

const resolveSegments = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { path?: string[] } | undefined);
  return resolved?.path ?? [];
};

export async function GET(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchCollectionsRoute(request, await resolveSegments(context?.params));
}

export async function POST(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchCollectionsRoute(request, await resolveSegments(context?.params));
}

export async function PUT(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchCollectionsRoute(request, await resolveSegments(context?.params));
}

export async function DELETE(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchCollectionsRoute(request, await resolveSegments(context?.params));
}
