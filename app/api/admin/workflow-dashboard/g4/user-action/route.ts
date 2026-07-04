export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";
import {
  persistG4RejectedReview,
  persistG4RecreatedReview,
  queueG4ApprovalRequest,
} from "@/server/next/api/g4-content-check-adapter";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && !isRecord(body)) {
    return invalidJsonResponse();
  }

  const actionType = typeof body?.action_type === "string" ? body.action_type.trim().toUpperCase() : "";
  const reviewId = typeof body?.review_id === "string" ? body.review_id.trim() : "";
  const assetId = typeof body?.asset_id === "string" ? body.asset_id.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform.trim() : "";

  console.info("[g4-user-action] request payload", {
    action_type: actionType || null,
    review_id: reviewId || null,
    asset_id: assetId || null,
    platform: platform || null,
    actor: typeof body?.actor === "string" ? body.actor : null,
    requested_by: auth.email ?? auth.id,
  });

  const result = await postN8nWebhook({
    path: env.n8nG4ContentUserActionPath,
    payload: (body ?? {}) as Record<string, unknown>,
  });

  console.info("[g4-user-action] webhook response", {
    action_type: actionType || null,
    status: result.status,
    message: result.message,
    response_type: result.response_type ?? null,
    review_id: result.review_id ?? null,
    content_review_id: result.content_review_id ?? null,
    handled_at: result.handled_at ?? null,
    http_status: result.http_status ?? null,
  });

  if (result.status === "PASS" && actionType === "SEND_TO_G5_APPROVAL") {
    const handoff = await queueG4ApprovalRequest({
      adminUserId: auth.id,
      adminEmail: auth.email ?? null,
      sourceId: reviewId || assetId || null,
      handledAt: result.handled_at ?? null,
    });

    if (handoff.status === "ERROR") {
      console.warn("[g4-user-action] failed to persist G4 approval handoff", {
        action_type: actionType,
        review_id: reviewId || null,
        asset_id: assetId || null,
        message: handoff.message,
      });

      return jsonResponse(
        {
          ...result,
          status: "ERROR",
          message: handoff.message,
          persistence_status: handoff.status,
          persistence_message: handoff.message,
        },
        500,
      );
    }

    console.info("[g4-user-action] persisted G4 approval handoff", {
      action_type: actionType,
      review_id: reviewId || null,
      asset_id: assetId || null,
      approval_id: handoff.approvalId,
      already_queued: handoff.alreadyQueued,
      approval_status: handoff.approvalRequest?.status ?? null,
      handled_at: handoff.approvalRequest?.createdAt ?? null,
    });

    return jsonResponse(
      {
        ...result,
        message: handoff.message,
        webhook_message: result.message,
        persistence_status: handoff.status,
        persistence_message: handoff.message,
        approval_id: handoff.approvalId ?? result.review_id ?? null,
      },
      200,
    );
  }

  if (result.status !== "ERROR" && actionType === "REJECT_CONTENT") {
    const rejection = await persistG4RejectedReview({
      adminUserId: auth.id,
      adminEmail: auth.email ?? null,
      sourceId: reviewId || assetId || null,
      handledAt: result.handled_at ?? null,
    });

    if (rejection.status === "ERROR") {
      console.warn("[g4-user-action] failed to persist G4 rejection", {
        action_type: actionType,
        review_id: reviewId || null,
        asset_id: assetId || null,
        message: rejection.message,
      });

      return jsonResponse(
        {
          ...result,
          status: "ERROR",
          message: rejection.message,
          persistence_status: rejection.status,
          persistence_message: rejection.message,
        },
        500,
      );
    }

    console.info("[g4-user-action] persisted G4 rejection", {
      action_type: actionType,
      review_id: reviewId || null,
      asset_id: assetId || null,
      approval_id: rejection.approvalId,
      approval_status: null,
      handled_at: result.handled_at ?? null,
    });

    const persistedStatus = "REJECTED" as const;
    return jsonResponse(
      {
        ...result,
        status: persistedStatus,
        message: rejection.message,
        webhook_message: result.message,
        persistence_status: persistedStatus,
        persistence_message: rejection.message,
        approval_id: rejection.approvalId ?? result.review_id ?? null,
      },
      200,
    );
  }

  if (result.status !== "ERROR" && actionType === "RECREATE_CONTENT") {
    const recreation = await persistG4RecreatedReview({
      adminUserId: auth.id,
      adminEmail: auth.email ?? null,
      sourceId: reviewId || assetId || null,
      handledAt: result.handled_at ?? null,
    });

    if (recreation.status === "ERROR") {
      console.warn("[g4-user-action] failed to persist G4 recreation", {
        action_type: actionType,
        review_id: reviewId || null,
        asset_id: assetId || null,
        message: recreation.message,
      });

      return jsonResponse(
        {
          ...result,
          status: "ERROR",
          message: recreation.message,
          persistence_status: recreation.status,
          persistence_message: recreation.message,
        },
        500,
      );
    }

    console.info("[g4-user-action] persisted G4 recreation", {
      action_type: actionType,
      review_id: reviewId || null,
      asset_id: assetId || null,
      approval_id: recreation.approvalId,
      approval_status: null,
      handled_at: result.handled_at ?? null,
    });

    const persistedStatus = "PASS" as const;
    return jsonResponse(
      {
        ...result,
        status: persistedStatus,
        message: recreation.message,
        webhook_message: result.message,
        persistence_status: persistedStatus,
        persistence_message: recreation.message,
        approval_id: recreation.approvalId ?? result.review_id ?? null,
      },
      200,
    );
  }

  return jsonResponse(result, result.status === "ERROR" ? 502 : 200);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
