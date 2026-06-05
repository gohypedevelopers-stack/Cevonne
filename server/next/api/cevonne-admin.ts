import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  CEVONNE_MANUAL_REVIEW_MESSAGE,
  CEVONNE_SAFE_RESPONSE_MESSAGE,
  CEVONNE_TEMPORARY_FAILURE_MESSAGE,
  type CevonneResponse,
} from "@/lib/cevonne/response";
import {
  type CevonneApprovalDecision,
  type CevonneHealthStatus,
  type CevonneWorkflowGroup,
  getWorkflowDirectoryEntry,
} from "@/lib/cevonne/admin-model";
import { env } from "@/server/config";
import { getAuthUser, jsonResponse, readJsonBody } from "@/server/next/route-utils";
import {
  getCevonneAdminApprovals,
  getCevonneAdminAuditLogs,
  getCevonneAdminExecutions,
  getCevonneAdminOverview,
  getCevonneAdminWorkflowCounts,
  getCevonneAdminWorkflowDetail,
  recordCevonneAdminApproval,
  recordCevonneAdminG2Update,
  recordCevonneAdminManualReview,
  recordCevonneAdminRouteView,
  recordCevonneAdminSafeTest,
} from "@/server/next/api/cevonne-admin-store";

const ADMIN_ROUTE_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_ROUTE_RATE_LIMIT_MAX_GETS = 60;
const ADMIN_ROUTE_RATE_LIMIT_MAX_POSTS = 20;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const adminRouteRateLimits = new Map<string, RateLimitBucket>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const adminApprovalDecisionSchema = z
  .object({
    approval_id: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    approvalId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    workflow_group: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    workflowGroup: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES", "APPROVED", "REJECTED"]),
    notes: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    reviewer_note: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    reviewerNote: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    confirmation_acknowledged: z.boolean().optional(),
    confirmed: z.boolean().optional(),
  })
  .strict();

const adminSafeTestSchema = z
  .object({
    workflow_group: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
  })
  .strict();

const adminManualReviewSchema = z
  .object({
    workflow_group: z.preprocess(emptyToUndefined, z.string().trim().min(1)),
    reason: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const adminG2UpdateSchema = z
  .object({
    health_status: z.enum(["OK", "WARNING", "BLOCKED"]),
    notes: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  })
  .strict();

const blockedResponse = (failReason: string, extra: Record<string, unknown> = {}) =>
  jsonResponse(
    {
      status: "BLOCK",
      message: CEVONNE_SAFE_RESPONSE_MESSAGE,
      fail_reason: failReason,
      not_executed: true,
      ...extra,
    },
    200,
  );

const manualOnlyResponse = (message = CEVONNE_MANUAL_REVIEW_MESSAGE, extra: Record<string, unknown> = {}) =>
  jsonResponse(
    {
      status: "MANUAL_ONLY",
      message,
      not_executed: true,
      ...extra,
    },
    200,
  );

const passResponse = (responseType: string, extra: Record<string, unknown> = {}, message = "Recorded.") =>
  jsonResponse(
    {
      status: "PASS",
      response_type: responseType,
      message,
      handled_at: new Date().toISOString(),
      ...extra,
    },
    200,
  );

const errorResponse = (message = CEVONNE_TEMPORARY_FAILURE_MESSAGE, extra: Record<string, unknown> = {}) =>
  jsonResponse(
    {
      status: "ERROR",
      message,
      not_executed: true,
      ...extra,
    },
    200,
  );

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const getIpAddress = (request: Request) => {
  const headerValues = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
  ];

  for (const headerValue of headerValues) {
    if (!headerValue) continue;
    const firstIp = headerValue.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "unknown";
};

const getRequestFingerprintHash = (request: Request) => {
  const payload = `${getIpAddress(request)}|${request.headers.get("user-agent") || ""}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
};

const consumeAdminRouteQuota = (request: Request, routePath: string, method: string) => {
  const auth = request.headers.get("authorization") || "anonymous";
  const key = `${routePath}:${method}:${auth}:${getIpAddress(request)}`;
  const now = Date.now();
  const limit = method === "POST" ? ADMIN_ROUTE_RATE_LIMIT_MAX_POSTS : ADMIN_ROUTE_RATE_LIMIT_MAX_GETS;
  const bucket = adminRouteRateLimits.get(key);

  if (!bucket || bucket.resetAt <= now) {
    adminRouteRateLimits.set(key, { count: 1, resetAt: now + ADMIN_ROUTE_RATE_LIMIT_WINDOW_MS });
    return { allowed: true as const };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true as const };
};

const ensureAdmin = async (request: Request) => {
  const auth = await getAuthUser(request);
  if (!auth) {
    return { response: unauthorizedResponse() } as const;
  }

  if (auth.role !== "ADMIN") {
    return { response: forbiddenResponse() } as const;
  }

  return { auth } as const;
};

const parseBody = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return { response: body } as const;
  }

  if (!isRecord(body)) {
    return { response: blockedResponse("Invalid payload") } as const;
  }

  return { body } as const;
};

const normalizeApprovalDecision = (decision: z.infer<typeof adminApprovalDecisionSchema>["decision"]) => {
  if (decision === "APPROVED") {
    return "APPROVE" as const;
  }

  if (decision === "REJECTED") {
    return "REJECT" as const;
  }

  return decision;
};

const toWorkflowGroup = (value: unknown): CevonneWorkflowGroup | null => {
  if (typeof value !== "string") {
    return null;
  }

  const entry = getWorkflowDirectoryEntry(value.trim());
  return entry ? entry.group : null;
};

const buildRouteSummary = (label: string, routePath: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    label,
    route_path: routePath,
    ...extra,
  });

const recordView = (input: {
  request: Request;
  routePath: string;
  actionType: "VIEW_WORKFLOWS" | "VIEW_WORKFLOW_DETAIL" | "VIEW_EXECUTIONS" | "VIEW_AUDIT_LOGS" | "VIEW_APPROVALS";
  workflowGroup?: CevonneWorkflowGroup | "GLOBAL";
  resultStatus: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR" | "PENDING" | "NOT_BUILT" | "DRY_RUN" | "RECOMMENDATION_ONLY";
  responseType: string;
  payloadSummary: string;
  failureReason?: string | null;
  auth?: { id: string; email: string | null };
}) => {
  recordCevonneAdminRouteView({
    workflowGroup: input.workflowGroup,
    actionType: input.actionType,
    routeName: input.routePath,
    resultStatus: input.resultStatus,
    responseType: input.responseType,
    payloadSummary: input.payloadSummary,
    failureReason: input.failureReason ?? null,
    adminUserId: input.auth?.id ?? null,
    adminEmail: input.auth?.email ?? null,
    ipUserAgentHash: getRequestFingerprintHash(input.request),
  });
};

const workflowResponse = (workflowGroup: CevonneWorkflowGroup) => {
  const detail = getCevonneAdminWorkflowDetail(workflowGroup);
  return detail;
};

export const dispatchCevonneAdminWorkflowsRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const rateLimit = consumeAdminRouteQuota(request, "/api/cevonne/admin/workflows", request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const overview = getCevonneAdminOverview();
  recordView({
    request,
    routePath: "/api/cevonne/admin/workflows",
    actionType: "VIEW_WORKFLOWS",
    workflowGroup: "GLOBAL",
    resultStatus: "PASS",
    responseType: "WORKFLOW_OVERVIEW_READY",
    payloadSummary: buildRouteSummary("workflow_overview", "/api/cevonne/admin/workflows"),
    auth: authResult.auth,
  });

  return passResponse("WORKFLOW_OVERVIEW_READY", {
    id: createHash("sha256").update("cevonne-overview").digest("hex").slice(0, 12),
    summary: getCevonneAdminWorkflowCounts(),
    workflows: overview.workflows,
  });
};

export const dispatchCevonneAdminWorkflowDetailRoute = async (request: Request, workflowGroupInput: string) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const workflowGroup = toWorkflowGroup(workflowGroupInput);
  if (!workflowGroup) {
    return blockedResponse("Unknown workflow group.");
  }

  const routePath = `/api/cevonne/admin/workflows/${workflowGroup}`;
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const detail = workflowResponse(workflowGroup);
  if (!detail) {
    return blockedResponse("Unknown workflow group.");
  }

  recordView({
    request,
    routePath,
    actionType: "VIEW_WORKFLOW_DETAIL",
    workflowGroup,
    resultStatus: "PASS",
    responseType: "WORKFLOW_DETAIL_READY",
    payloadSummary: buildRouteSummary("workflow_detail", routePath, { workflow_group: workflowGroup }),
    auth: authResult.auth,
  });

  return passResponse("WORKFLOW_DETAIL_READY", {
    id: detail.workflow.latestPublicId,
    workflow: detail.workflow,
    latest_executions: detail.latest_executions,
    approvals: detail.approvals,
    audit_logs: detail.audit_logs,
    related_g1_compliance_runs: detail.related_g1_compliance_runs,
  });
};

export const dispatchCevonneAdminExecutionsRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const url = new URL(request.url);
  const workflowGroup = toWorkflowGroup(url.searchParams.get("workflowGroup"));
  const routePath = "/api/cevonne/admin/executions";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const executions = getCevonneAdminExecutions(workflowGroup || undefined);
  recordView({
    request,
    routePath,
    actionType: "VIEW_EXECUTIONS",
    workflowGroup: workflowGroup || "GLOBAL",
    resultStatus: "PASS",
    responseType: "WORKFLOW_EXECUTIONS_READY",
    payloadSummary: buildRouteSummary("executions", routePath, { workflow_group: workflowGroup ?? "ALL" }),
    auth: authResult.auth,
  });

  return passResponse("WORKFLOW_EXECUTIONS_READY", {
    id: executions[0]?.publicId ?? "cevonne-executions",
    executions,
  });
};

export const dispatchCevonneAdminAuditLogsRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const url = new URL(request.url);
  const workflowGroup = toWorkflowGroup(url.searchParams.get("workflowGroup"));
  const routePath = "/api/cevonne/admin/audit-logs";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const auditLogs = getCevonneAdminAuditLogs(workflowGroup || undefined);
  recordView({
    request,
    routePath,
    actionType: "VIEW_AUDIT_LOGS",
    workflowGroup: workflowGroup || "GLOBAL",
    resultStatus: "PASS",
    responseType: "WORKFLOW_AUDIT_LOGS_READY",
    payloadSummary: buildRouteSummary("audit_logs", routePath, { workflow_group: workflowGroup ?? "ALL" }),
    auth: authResult.auth,
  });

  return passResponse("WORKFLOW_AUDIT_LOGS_READY", {
    id: auditLogs[0]?.publicId ?? "cevonne-audit-logs",
    audit_logs: auditLogs,
  });
};

export const dispatchCevonneAdminApprovalsRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const url = new URL(request.url);
  const workflowGroup = toWorkflowGroup(url.searchParams.get("workflowGroup"));
  const routePath = "/api/cevonne/admin/approvals";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const approvals = getCevonneAdminApprovals(workflowGroup || undefined);
  recordView({
    request,
    routePath,
    actionType: "VIEW_APPROVALS",
    workflowGroup: workflowGroup || "GLOBAL",
    resultStatus: "PASS",
    responseType: "WORKFLOW_APPROVALS_READY",
    payloadSummary: buildRouteSummary("approvals", routePath, { workflow_group: workflowGroup ?? "ALL" }),
    auth: authResult.auth,
  });

  return passResponse("WORKFLOW_APPROVALS_READY", {
    id: approvals[0]?.publicId ?? "cevonne-approvals",
    approvals,
  });
};

export const dispatchCevonneAdminApprovalDecisionRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const routePath = "/api/cevonne/admin/approval-decision";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const parsedBody = await parseBody(request);
  if ("response" in parsedBody) return parsedBody.response;

  const parsed = adminApprovalDecisionSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return blockedResponse(parsed.error.issues[0]?.message || "Invalid payload");
  }

  const approvalId = parsed.data.approval_id ?? parsed.data.approvalId;
  if (!approvalId) {
    return blockedResponse("approval_id is required.");
  }

  const workflowGroup = parsed.data.workflow_group ?? parsed.data.workflowGroup ?? null;
  const reviewerNote = parsed.data.notes ?? parsed.data.reviewer_note ?? parsed.data.reviewerNote ?? null;
  const confirmed = Boolean(parsed.data.confirmation_acknowledged ?? parsed.data.confirmed ?? false);
  const normalizedDecision = normalizeApprovalDecision(parsed.data.decision);
  const approvalRecord = getCevonneAdminApprovals().find((record) => record.approvalId === approvalId);
  if (!approvalRecord) {
    return blockedResponse("Approval record not found.");
  }

  if (workflowGroup && approvalRecord.workflowGroup !== workflowGroup) {
    return blockedResponse("Approval does not belong to the selected workflow.");
  }

  if (approvalRecord.status !== "PENDING") {
    return blockedResponse("Approval has already been resolved.");
  }

  if (
    normalizedDecision === "APPROVE" &&
    (approvalRecord.requireConfirmation || approvalRecord.riskLevel === "HIGH" || approvalRecord.riskLevel === "CRITICAL") &&
    !confirmed
  ) {
    return blockedResponse("Confirmation is required for high-risk approvals.");
  }

  const storeResponse = recordCevonneAdminApproval({
    approvalId,
    decision: normalizedDecision as CevonneApprovalDecision,
    adminUserId: authResult.auth.id,
    adminEmail: authResult.auth.email,
    notes: reviewerNote ?? null,
    ipUserAgentHash: getRequestFingerprintHash(request),
  });

  if (!storeResponse) {
    return blockedResponse("Approval record not found.");
  }

  const approval = storeResponse.approval;
  const responseStatus =
    approval.status === "APPROVED" ? "PASS" : approval.status === "REJECTED" ? "BLOCK" : "MANUAL_ONLY";

  return jsonResponse(
    {
      status: responseStatus,
      response_type: "APPROVAL_DECISION_RECORDED",
      message:
        responseStatus === "PASS"
          ? "Approval recorded."
          : responseStatus === "BLOCK"
            ? CEVONNE_SAFE_RESPONSE_MESSAGE
            : CEVONNE_MANUAL_REVIEW_MESSAGE,
      handled_at: new Date().toISOString(),
      id: approval.publicId,
      approval,
      reviewer_action: approval.reviewerAction,
    },
    200,
  );
};

export const dispatchCevonneAdminG2AccountHealthUpdateRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const routePath = "/api/cevonne/admin/g2-account-health-update";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const parsedBody = await parseBody(request);
  if ("response" in parsedBody) return parsedBody.response;

  const parsed = adminG2UpdateSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return blockedResponse(parsed.error.issues[0]?.message || "Invalid payload");
  }

  const updated = recordCevonneAdminG2Update({
    healthStatus: parsed.data.health_status as CevonneHealthStatus,
    notes: parsed.data.notes ?? null,
    adminUserId: authResult.auth.id,
    adminEmail: authResult.auth.email,
    ipUserAgentHash: getRequestFingerprintHash(request),
  });

  if (!updated) {
    return errorResponse("Failed to update G2 account health.");
  }

  return jsonResponse(
    {
      status: updated.execution?.status ?? "PASS",
      response_type: updated.execution?.responseType ?? "G2_ACCOUNT_HEALTH_UPDATED",
      message:
        updated.execution?.status === "PASS"
          ? "G2 account health updated."
          : updated.execution?.status === "BLOCK"
            ? CEVONNE_SAFE_RESPONSE_MESSAGE
            : CEVONNE_MANUAL_REVIEW_MESSAGE,
      handled_at: new Date().toISOString(),
      id: updated.execution?.publicId ?? updated.workflow.latestPublicId,
      workflow: updated.workflow,
      execution: updated.execution,
    },
    200,
  );
};

export const dispatchCevonneAdminSafeTestRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const routePath = "/api/cevonne/admin/safe-test";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const parsedBody = await parseBody(request);
  if ("response" in parsedBody) return parsedBody.response;

  const parsed = adminSafeTestSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return blockedResponse(parsed.error.issues[0]?.message || "Invalid payload");
  }

  const workflowGroup = toWorkflowGroup(parsed.data.workflow_group);
  if (!workflowGroup) {
    return blockedResponse("Unknown workflow group.");
  }

  const updated = recordCevonneAdminSafeTest({
    workflowGroup,
    adminUserId: authResult.auth.id,
    adminEmail: authResult.auth.email,
    ipUserAgentHash: getRequestFingerprintHash(request),
  });

  if (!updated) {
    return errorResponse("Failed to run safe test.");
  }

  return jsonResponse(
    {
      status: "PASS",
      response_type: "WORKFLOW_SAFE_TEST_COMPLETED",
      message: "Workflow safe test completed.",
      handled_at: new Date().toISOString(),
      dry_run: true,
      not_executed: true,
      id: updated.execution?.publicId ?? updated.workflow.latestPublicId,
      workflow: updated.workflow,
      execution: updated.execution,
    },
    200,
  );
};

export const dispatchCevonneAdminManualReviewRoute = async (request: Request) => {
  const authResult = await ensureAdmin(request);
  if ("response" in authResult) return authResult.response;

  const routePath = "/api/cevonne/admin/manual-review";
  const rateLimit = consumeAdminRouteQuota(request, routePath, request.method);
  if (!rateLimit.allowed) {
    return blockedResponse("Rate limit exceeded.", { retry_after_seconds: rateLimit.retryAfterSeconds });
  }

  const parsedBody = await parseBody(request);
  if ("response" in parsedBody) return parsedBody.response;

  const parsed = adminManualReviewSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return blockedResponse(parsed.error.issues[0]?.message || "Invalid payload");
  }

  const workflowGroup = toWorkflowGroup(parsed.data.workflow_group);
  if (!workflowGroup) {
    return blockedResponse("Unknown workflow group.");
  }

  const updated = recordCevonneAdminManualReview({
    workflowGroup,
    reason: parsed.data.reason ?? null,
    adminUserId: authResult.auth.id,
    adminEmail: authResult.auth.email,
    ipUserAgentHash: getRequestFingerprintHash(request),
  });

  if (!updated) {
    return errorResponse("Failed to record manual review.");
  }

  return manualOnlyResponse(CEVONNE_MANUAL_REVIEW_MESSAGE, {
    response_type: "WORKFLOW_MANUAL_REVIEW_RECORDED",
    handled_at: new Date().toISOString(),
    id: updated.execution?.publicId ?? updated.workflow.latestPublicId,
    workflow: updated.workflow,
    execution: updated.execution,
  });
};
