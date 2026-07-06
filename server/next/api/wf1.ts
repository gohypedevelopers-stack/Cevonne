import "server-only";

import { z } from "zod";

import { env } from "@/server/config";
import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";
import { postN8nWebhook } from "@/lib/n8n-client";
import {
  appendWf1Log,
  cancelWf1QueueItem,
  getWf1ApprovalItem,
  getWf1Approvals,
  getWf1BufferHealth,
  getWf1Detail,
  getWf1DryRuns,
  getWf1Queue,
  getWf1QueueItem,
  getWf1Settings,
  getWf1Summary,
  markWf1QueueFallback,
  recordWf1ApprovalDecision,
  recordWf1BufferHealth,
  recordWf1DryRunResult,
  recordWf1Intake,
  recordWf1PublishResult,
  rescheduleWf1QueueItem,
  replaceWf1Settings,
} from "@/server/next/api/wf1-store";
import { getWf1FailureReason, getWf1ActionGuidance } from "@/lib/wf1";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const ensureAuthenticated = async (request: Request) => {
  const auth = await getAuthUser(request);
  if (!auth) {
    return { response: unauthorizedResponse() } as const;
  }

  return { auth } as const;
};

const ensureAdmin = async (request: Request) => {
  const authResult = await ensureAuthenticated(request);
  if ("response" in authResult) return authResult;

  if (authResult.auth.role !== "ADMIN") {
    return { response: forbiddenResponse() } as const;
  }

  return authResult;
};

const detailEnvelope = (message = "WF1 detail loaded.") => ({
  status: "PASS" as const,
  message,
  ...getWf1Detail(),
});

const listEnvelope = <T,>(message: string, key: string, value: T) => ({
  status: "PASS" as const,
  message,
  workflow: getWf1Summary(),
  [key]: value,
});

const methodNotAllowedResponse = () => methodNotAllowed(["GET", "POST"]);

const intakeSchema = z
  .object({
    asset_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    approval_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    approval_status: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    g4_review_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    content_text: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    media_url: z.preprocess(emptyToUndefined, z.string().trim().url()),
    media_preview_url: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    account_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    scheduled_at: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    actor: z.preprocess(emptyToUndefined, z.string().trim().min(1)).optional(),
  })
  .strict();

const approvalDecisionSchema = z
  .object({
    approval_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    note: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]).optional(),
  })
  .strict();

const dryRunSchema = z
  .object({
    asset_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    approval_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    approval_status: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    g4_review_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    content_text: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    media_url: z.preprocess(emptyToUndefined, z.string().trim().url()),
    account_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    scheduled_at: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    actor: z.preprocess(emptyToUndefined, z.string().trim().min(1)).optional(),
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const bufferHealthSchema = z
  .object({
    approved_buffer_days: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return undefined;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().nonnegative().optional(),
    ),
    evergreen_fallback_count: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return undefined;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().nonnegative().optional(),
    ),
    token_expires_at: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    account_health: z.enum(["Clean", "Attention needed", "Unknown"]).optional(),
    missing_content_warnings: z.array(z.string().trim().min(1)).optional(),
    urgent_action: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    recent_dry_run_completed_at: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const rescheduleSchema = z
  .object({
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    scheduled_at: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    note: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const cancelSchema = z
  .object({
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    reason: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const fallbackSchema = z
  .object({
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    fallback: z.boolean().optional(),
  })
  .strict();

const publishResultSchema = z
  .object({
    queue_id: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    result: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
  })
  .strict();

const settingsSchema = z
  .object({
    instagram_account_id: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    posting_timezone: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    default_posting_times: z.array(z.preprocess(emptyToUndefined, z.string().trim().min(1))).min(1),
    minimum_buffer_days: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return undefined;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().nonnegative(),
    ),
    minimum_fallback_posts: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return undefined;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      },
      z.number().int().nonnegative(),
    ),
    dry_run_mode_enabled: z.boolean(),
    live_publishing_enabled: z.boolean(),
    token_expires_at: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "string") {
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        return value;
      },
      z.string().trim().min(1).nullable(),
    ),
    alert_recipients: z.array(z.string().trim().email()).min(1),
    rollback_action_available: z.boolean(),
  })
  .strict();

const parseJson = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return { response: body } as const;
  }

  if (!isRecord(body)) {
    return { response: jsonResponse({ message: "Invalid JSON payload" }, 400) } as const;
  }

  return { body } as const;
};

const ensureAdminOrReturn = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  return authResult.auth;
};

const successResponse = (payload: Record<string, unknown>) => jsonResponse(payload, 200);

const buildSummaryPayload = () => detailEnvelope("WF1 summary loaded.");

const buildQueuePayload = () => listEnvelope("WF1 queue loaded.", "queue", getWf1Queue());

const buildApprovalsPayload = () => listEnvelope("WF1 approvals loaded.", "approvals", getWf1Approvals());

const buildDryRunsPayload = () => listEnvelope("WF1 dry-runs loaded.", "dryRuns", getWf1DryRuns());

const buildLogsPayload = () => listEnvelope("WF1 logs loaded.", "logs", getWf1Detail().logs);

const buildBufferPayload = () => ({
  status: "PASS" as const,
  message: "WF1 buffer health loaded.",
  workflow: getWf1Summary(),
  bufferHealth: getWf1BufferHealth(),
});

const buildSettingsPayload = () => ({
  status: "PASS" as const,
  message: "WF1 settings loaded.",
  workflow: getWf1Summary(),
  settings: getWf1Settings(),
});

const buildSummaryRoute = async (request: Request) => {
  const auth = await ensureAuthenticated(request);
  if ("response" in auth) return auth.response;
  return successResponse(buildSummaryPayload());
};

const buildListRoute = async (request: Request, action: string) => {
  const auth = await ensureAuthenticated(request);
  if ("response" in auth) return auth.response;

  if (action === "queue") return successResponse(buildQueuePayload());
  if (action === "logs") return successResponse(buildLogsPayload());
  if (action === "approvals") return successResponse(buildApprovalsPayload());
  if (action === "dry-runs") return successResponse(buildDryRunsPayload());
  if (action === "buffer-health") return successResponse(buildBufferPayload());
  if (action === "settings") return successResponse(buildSettingsPayload());

  return jsonResponse({ message: "Not found" }, 404);
};

const wf1ActionFromRoute = (action: string) => {
  if (action === "approve" || action === "reject" || action === "request-changes") {
    return action as "approve" | "reject" | "request-changes";
  }

  return action;
};

export const dispatchWf1DetailRoute = async (request: Request) => {
  if (request.method !== "GET") {
    return methodNotAllowedResponse();
  }

  return buildSummaryRoute(request);
};

export const dispatchWf1QueueRoute = async (request: Request) => {
  if (request.method !== "GET") {
    return methodNotAllowedResponse();
  }

  return buildListRoute(request, "queue");
};

export const dispatchWf1LogsRoute = async (request: Request) => {
  if (request.method !== "GET") {
    return methodNotAllowedResponse();
  }

  return buildListRoute(request, "logs");
};

const coerceActionDecision = (action: string): "APPROVE" | "REJECT" | "REQUEST_CHANGES" => {
  if (action === "reject") return "REJECT";
  if (action === "request-changes") return "REQUEST_CHANGES";
  return "APPROVE";
};

const getQueueItemByApprovalId = (approvalId: string) => {
  const approval = getWf1ApprovalItem(approvalId);
  if (!approval) return null;
  const queueItem = approval.queueId ? getWf1QueueItem(approval.queueId) : null;
  return { approval, queueItem };
};

export const dispatchWf1ActionRoute = async (request: Request, actionInput: string) => {
  const action = wf1ActionFromRoute(actionInput);

  if (request.method === "GET") {
    if (action === "queue") return buildListRoute(request, "queue");
    if (action === "logs") return buildListRoute(request, "logs");
    if (action === "approvals") return buildListRoute(request, "approvals");
    if (action === "dry-runs") return buildListRoute(request, "dry-runs");
    if (action === "buffer-health") return buildListRoute(request, "buffer-health");
    if (action === "settings") return buildListRoute(request, "settings");
    return jsonResponse({ message: "Not found" }, 404);
  }

  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const admin = await ensureAdminOrReturn(request);
  if (admin instanceof Response) {
    return admin;
  }

  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) {
    return parsedBody.response;
  }

  const routePath = `/api/admin/workflows/wf1/${action}`;

  if (action === "settings") {
    const parsed = settingsSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const updatedSettings = replaceWf1Settings({
      instagramAccountId: parsed.data.instagram_account_id,
      postingTimezone: parsed.data.posting_timezone,
      defaultPostingTimes: parsed.data.default_posting_times,
      minimumBufferDays: parsed.data.minimum_buffer_days,
      minimumFallbackPosts: parsed.data.minimum_fallback_posts,
      dryRunModeEnabled: parsed.data.dry_run_mode_enabled,
      livePublishingEnabled: parsed.data.live_publishing_enabled,
      tokenExpiresAt: parsed.data.token_expires_at,
      alertRecipients: parsed.data.alert_recipients,
      rollbackActionAvailable: parsed.data.rollback_action_available,
    });

    const log = appendWf1Log({
      event: "Workflow settings updated",
      status: "Passed",
      message: "Workflow settings were saved from the admin panel.",
      actor: "admin",
      severity: "info",
      technical: (getWf1Queue()[0]?.technical ?? getWf1Detail().queue[0]?.technical)!,
    });

    return jsonResponse(
      {
        status: "PASS",
        message: "WF1 settings saved.",
        workflow: getWf1Summary(),
        settings: updatedSettings,
        bufferHealth: getWf1BufferHealth(),
        log,
      },
      200,
    );
  }

  if (action === "intake") {
    const parsed = intakeSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const n8nResponse = await postN8nWebhook({
      path: env.n8nWf1IntakePath,
      payload: {
        asset_id: parsed.data.asset_id,
        approval_id: parsed.data.approval_id,
        approval_status: parsed.data.approval_status,
        g4_review_id: parsed.data.g4_review_id,
        content_text: parsed.data.content_text,
        media_url: parsed.data.media_url,
        media_preview_url: parsed.data.media_preview_url ?? null,
        account_id: parsed.data.account_id,
        scheduled_at: parsed.data.scheduled_at,
        actor: parsed.data.actor || "admin",
        workflow_id: "WF1",
        route_path: routePath,
      },
      dryRun: true,
    });

    const actor = (parsed.data.actor || "admin") as "admin" | "system" | "website";
    const isSuccess = n8nResponse.status === "PASS" || n8nResponse.status === "MANUAL_ONLY";
    if (isSuccess) {
      const intake = recordWf1Intake({
        contentText: parsed.data.content_text,
        assetId: parsed.data.asset_id,
        approvalId: parsed.data.approval_id,
        approvalStatus: parsed.data.approval_status,
        g4ReviewId: parsed.data.g4_review_id,
        mediaUrl: parsed.data.media_url,
        mediaPreviewUrl: parsed.data.media_preview_url ?? null,
        accountId: parsed.data.account_id,
        scheduledAt: parsed.data.scheduled_at,
        actor,
        requestId: n8nResponse.request_id,
        responseType: n8nResponse.response_type || undefined,
      });

      return jsonResponse(
        {
          status: n8nResponse.status,
          message: n8nResponse.message || "WF1 intake created.",
          workflow: getWf1Summary(),
          queueItem: intake.queueItem,
          approval: intake.approval,
          log: intake.log,
          response_type: n8nResponse.response_type ?? null,
          fail_reason: n8nResponse.fail_reason ?? null,
          handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
          request_id: n8nResponse.request_id,
        },
        200,
      );
    }

    return jsonResponse(
      {
        status: n8nResponse.status,
        message: n8nResponse.message,
        fail_reason: n8nResponse.fail_reason ?? null,
        failure_reasons: n8nResponse.failure_reasons ?? null,
        workflow: getWf1Summary(),
        response_type: n8nResponse.response_type ?? null,
        handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
        request_id: n8nResponse.request_id,
      },
      200,
    );
  }

  if (action === "approve" || action === "reject" || action === "request-changes") {
    const parsed = approvalDecisionSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const approvalId = parsed.data.approval_id;
    const queueId = parsed.data.queue_id ?? getWf1ApprovalItem(approvalId)?.queueId ?? null;
    const decision = parsed.data.decision || coerceActionDecision(action);

    const approvalRecord = getWf1ApprovalItem(approvalId);
    if (!approvalRecord) {
      return jsonResponse({ status: "BLOCK", message: "Approval not found." }, 200);
    }

    const n8nResponse = await postN8nWebhook({
      path: env.n8nG5ApprovalDecisionPath,
      payload: {
        approval_id: approvalId,
        queue_id: queueId,
        workflow_id: "WF1",
        decision,
        decision_source: "admin-panel",
        actor: "admin",
        note: parsed.data.note ?? null,
        route_path: routePath,
        live_publishing_enabled: false,
      },
      dryRun: true,
    });

    const success = n8nResponse.status === "PASS" || n8nResponse.status === "MANUAL_ONLY";
    if (success) {
      const updated = recordWf1ApprovalDecision({
        approvalId,
        decision,
        actor: "admin",
        requestId: n8nResponse.request_id,
        responseType: n8nResponse.response_type ?? undefined,
        note: parsed.data.note ?? null,
      });

      return jsonResponse(
        {
          status: n8nResponse.status,
          message:
            action === "approve"
              ? "Approval recorded."
              : action === "reject"
                ? "Rejection recorded."
                : "Changes requested.",
          workflow: getWf1Summary(),
          approval: updated?.approval ?? null,
          log: updated?.log ?? null,
          response_type: n8nResponse.response_type ?? null,
          fail_reason: n8nResponse.fail_reason ?? null,
          handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
          request_id: n8nResponse.request_id,
          guidance: getWf1ActionGuidance(n8nResponse.fail_reason, "Review the item and continue when it is ready."),
        },
        200,
      );
    }

    return jsonResponse(
      {
        status: n8nResponse.status,
        message: n8nResponse.message,
        fail_reason: n8nResponse.fail_reason ?? null,
        workflow: getWf1Summary(),
        response_type: n8nResponse.response_type ?? null,
        handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
        request_id: n8nResponse.request_id,
        guidance: getWf1ActionGuidance(n8nResponse.fail_reason, "Review the item and continue when it is ready."),
      },
      200,
    );
  }

  if (action === "dry-run") {
    const parsed = dryRunSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const queueId =
      parsed.data.queue_id ||
      getWf1ApprovalItem(parsed.data.approval_id)?.queueId ||
      getWf1Queue().find((item) => item.technical.approvalId === parsed.data.approval_id)?.id ||
      null;
    if (!queueId) {
      return jsonResponse({ status: "BLOCK", message: "Queue item not found." }, 200);
    }

    const queueItem = getWf1QueueItem(queueId);
    if (!queueItem) {
      return jsonResponse({ status: "BLOCK", message: "Queue item not found." }, 200);
    }

    const n8nResponse = await postN8nWebhook({
      path: env.n8nWf1DryRunPath,
      payload: {
        asset_id: parsed.data.asset_id,
        approval_id: parsed.data.approval_id,
        approval_status: parsed.data.approval_status,
        g4_review_id: parsed.data.g4_review_id,
        content_text: parsed.data.content_text,
        media_url: parsed.data.media_url,
        account_id: parsed.data.account_id,
        scheduled_at: parsed.data.scheduled_at,
        actor: parsed.data.actor || "admin",
        workflow_id: "WF1",
        route_path: routePath,
      },
      dryRun: true,
    });

    const wf1Status =
      n8nResponse.status === "PASS" ||
      n8nResponse.status === "MANUAL_ONLY" ||
      n8nResponse.status === "RECOMMENDATION_ONLY" ||
      n8nResponse.status === "DRY_RUN" ||
      n8nResponse.status === "DO_NOT_SCALE" ||
      n8nResponse.status === "FIX_FIRST"
        ? "PASS"
        : n8nResponse.status === "PENDING_APPROVAL" ||
            n8nResponse.status === "NEEDS_EVIDENCE" ||
            n8nResponse.status === "BLOCK" ||
            n8nResponse.status === "ERROR"
          ? n8nResponse.status
          : "ERROR";
    const success = wf1Status === "PASS";
    const dryRun = recordWf1DryRunResult({
      queueId,
      result:
        success && wf1Status === "PASS"
          ? "No Instagram post was published. This was only a safe dry-run."
          : getWf1FailureReason(n8nResponse.fail_reason, "Dry-run could not be completed."),
      notExecuted: !success,
      status: success && wf1Status === "PASS" ? "PASS" : wf1Status,
      responseType: n8nResponse.response_type ?? null,
      requestId: n8nResponse.request_id,
      actor: (parsed.data.actor || "admin") as "admin" | "system" | "website",
      failureReason: n8nResponse.fail_reason ?? null,
    });

    if (!dryRun) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Failed to record the dry-run.",
          workflow: getWf1Summary(),
          fail_reason: n8nResponse.fail_reason ?? null,
          response_type: n8nResponse.response_type ?? null,
          handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
          request_id: n8nResponse.request_id,
        },
        200,
      );
    }

    return jsonResponse(
      {
        status: n8nResponse.status,
        message:
          success && n8nResponse.status === "PASS"
            ? "Dry-run prepared successfully. No live Instagram post was published."
            : n8nResponse.message,
        fail_reason: n8nResponse.fail_reason ?? null,
        workflow: getWf1Summary(),
        dryRun: dryRun.dryRun,
        log: dryRun.log,
        response_type: n8nResponse.response_type ?? null,
        handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
        request_id: n8nResponse.request_id,
        guidance: getWf1ActionGuidance(n8nResponse.fail_reason, "Review the item and continue when it is ready."),
      },
      200,
    );
  }

  if (action === "buffer-health") {
    const parsed = bufferHealthSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const currentHealth = getWf1BufferHealth();
    const payload = {
      approved_buffer_days: parsed.data.approved_buffer_days ?? currentHealth.approvedBufferDays,
      evergreen_fallback_count: parsed.data.evergreen_fallback_count ?? currentHealth.evergreenFallbackCount,
      token_expires_at: parsed.data.token_expires_at ?? currentHealth.tokenExpiresAt,
      account_health: parsed.data.account_health ?? currentHealth.accountHealth,
      missing_content_warnings: parsed.data.missing_content_warnings ?? currentHealth.missingContentWarnings,
      urgent_action: parsed.data.urgent_action ?? currentHealth.urgentAction,
      recent_dry_run_completed_at: parsed.data.recent_dry_run_completed_at ?? currentHealth.recentDryRunCompletedAt,
      workflow_id: "WF1",
      route_path: routePath,
    };

    const n8nResponse = await postN8nWebhook({
      path: env.n8nWf1BufferHealthPath,
      payload,
      dryRun: true,
    });

    const updated = recordWf1BufferHealth({
      approvedBufferDays: payload.approved_buffer_days,
      evergreenFallbackCount: payload.evergreen_fallback_count,
      tokenExpiresAt: payload.token_expires_at,
      accountHealth: payload.account_health,
      missingContentWarnings: payload.missing_content_warnings,
      urgentAction: payload.urgent_action,
      recentDryRunCompletedAt: payload.recent_dry_run_completed_at,
      actor: "admin",
      requestId: n8nResponse.request_id,
      responseType: n8nResponse.response_type ?? undefined,
    });

    return jsonResponse(
      {
        status: n8nResponse.status,
        message: n8nResponse.message || "WF1 buffer health loaded.",
        fail_reason: n8nResponse.fail_reason ?? null,
        workflow: getWf1Summary(),
        bufferHealth: updated.bufferHealth,
        log: updated.log,
        response_type: n8nResponse.response_type ?? null,
        handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
        request_id: n8nResponse.request_id,
        guidance: getWf1ActionGuidance(n8nResponse.fail_reason, "Review the item and continue when it is ready."),
      },
      200,
    );
  }

  if (action === "reschedule") {
    const parsed = rescheduleSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const updated = rescheduleWf1QueueItem(parsed.data.queue_id, parsed.data.scheduled_at);
    if (!updated) {
      return jsonResponse({ status: "BLOCK", message: "Queue item not found." }, 200);
    }

    const log = appendWf1Log({
      event: "Post rescheduled",
      status: "Waiting",
      message: parsed.data.note || `The post was moved to ${parsed.data.scheduled_at}.`,
      actor: "admin",
      queueId: updated.id,
      severity: "info",
      technical: updated.technical,
    });

    return jsonResponse(
      {
        status: "PASS",
        message: "Post rescheduled.",
        workflow: getWf1Summary(),
        queueItem: updated,
        log,
        guidance: "Check the new time and keep the post in review until it is ready.",
      },
      200,
    );
  }

  if (action === "cancel") {
    const parsed = cancelSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const updated = cancelWf1QueueItem(parsed.data.queue_id, parsed.data.reason ?? null);
    if (!updated) {
      return jsonResponse({ status: "BLOCK", message: "Queue item not found." }, 200);
    }

    const log = appendWf1Log({
      event: "Post cancelled",
      status: "Cancelled",
      message: parsed.data.reason || "The post was cancelled from the admin panel.",
      actor: "admin",
      queueId: updated.id,
      severity: "warning",
      technical: updated.technical,
    });

    return jsonResponse(
      {
        status: "PASS",
        message: "Post cancelled.",
        workflow: getWf1Summary(),
        queueItem: updated,
        log,
      },
      200,
    );
  }

  if (action === "mark-fallback") {
    const parsed = fallbackSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const updated = markWf1QueueFallback(parsed.data.queue_id, parsed.data.fallback ?? true);
    if (!updated) {
      return jsonResponse({ status: "BLOCK", message: "Queue item not found." }, 200);
    }

    const log = appendWf1Log({
      event: "Marked as fallback",
      status: "Safe",
      message: parsed.data.fallback === false ? "Fallback flag removed." : "The post is marked as fallback content.",
      actor: "admin",
      queueId: updated.id,
      severity: "info",
      technical: updated.technical,
    });

    return jsonResponse(
      {
        status: "PASS",
        message: parsed.data.fallback === false ? "Fallback removed." : "Marked as fallback content.",
        workflow: getWf1Summary(),
        queueItem: updated,
        log,
      },
      200,
    );
  }

  if (action === "publish-result") {
    const parsed = publishResultSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonResponse({ status: "BLOCK", message: parsed.error.issues[0]?.message || "Invalid payload." }, 200);
    }

    const queueId = parsed.data.queue_id ?? null;
    const queueItem = queueId ? getWf1QueueItem(queueId) : null;
    const n8nResponse = await postN8nWebhook({
      path: env.n8nWf1PublishResultPath,
      payload: {
        workflow_id: "WF1",
        queue_id: queueId,
        result: parsed.data.result,
        route_path: routePath,
        live_publishing_enabled: false,
      },
      dryRun: true,
    });

    const record = recordWf1PublishResult({
      queueId,
      result:
        n8nResponse.status === "PASS"
          ? parsed.data.result
          : getWf1FailureReason(n8nResponse.fail_reason, parsed.data.result),
      actor: "admin",
      requestId: n8nResponse.request_id,
      responseType: n8nResponse.response_type ?? undefined,
    });

    return jsonResponse(
      {
        status: n8nResponse.status,
        message: n8nResponse.message || parsed.data.result,
        fail_reason: n8nResponse.fail_reason ?? null,
        workflow: getWf1Summary(),
        log: record.log,
        queueItem,
        response_type: n8nResponse.response_type ?? null,
        handled_at: n8nResponse.handled_at ?? new Date().toISOString(),
        request_id: n8nResponse.request_id,
      },
      200,
    );
  }

  return jsonResponse({ message: "Not found" }, 404);
};
