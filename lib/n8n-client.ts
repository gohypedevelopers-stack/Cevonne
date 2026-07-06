import "server-only";

import { randomUUID } from "node:crypto";

import {
  CEVONNE_MANUAL_REVIEW_MESSAGE,
  CEVONNE_SAFE_RESPONSE_MESSAGE,
  CEVONNE_TEMPORARY_FAILURE_MESSAGE,
} from "@/lib/cevonne/response";
import { env } from "@/server/config";

export type N8nWebhookStatus =
  | "PASS"
  | "BLOCK"
  | "MANUAL_ONLY"
  | "PENDING_APPROVAL"
  | "DRY_RUN"
  | "RECOMMENDATION_ONLY"
  | "DO_NOT_SCALE"
  | "FIX_FIRST"
  | "NEEDS_EVIDENCE"
  | "NOT_RUN_YET"
  | "ERROR";

export type N8nWebhookResult = {
  status: N8nWebhookStatus;
  message: string;
  response_type?: string | null;
  fail_reason?: string | null;
  failure_reasons?: string[] | null;
  id?: string | null;
  event_id?: string | null;
  review_id?: string | null;
  draft_id?: string | null;
  content_review_id?: string | null;
  content_draft_id?: string | null;
  dry_run?: boolean | null;
  not_executed?: boolean | null;
  handled_at?: string | null;
  http_status?: number | null;
  response_text?: string | null;
  request_id: string;
  sent_at: string;
  webhook_url: string;
  raw?: Record<string, unknown> | null;
};

export type PostN8nWebhookInput = {
  path?: string;
  url?: string;
  payload?: Record<string, unknown>;
  requestId?: string;
  timeoutMs?: number;
  source?: string;
  dryRun?: boolean;
};

const DEFAULT_TIMEOUT_MS = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizePath = (value: string) => value.trim().replace(/^\/+/, "");

const buildWebhookUrl = (input: Pick<PostN8nWebhookInput, "path" | "url">) => {
  if (input.url && input.url.trim()) {
    return input.url.trim();
  }

  const baseUrl = env.n8nBaseUrl.trim();
  const path = input.path?.trim() || "";
  if (!baseUrl || !path) {
    return "";
  }

  return `${baseUrl.replace(/\/+$/, "")}/${normalizePath(path)}`;
};

const normalizeStatus = (value: unknown): N8nWebhookStatus => {
  if (
    value === "PASS" ||
    value === "BLOCK" ||
    value === "MANUAL_ONLY" ||
    value === "PENDING_APPROVAL" ||
    value === "DRY_RUN" ||
    value === "RECOMMENDATION_ONLY" ||
    value === "DO_NOT_SCALE" ||
    value === "FIX_FIRST" ||
    value === "NEEDS_EVIDENCE" ||
    value === "NOT_RUN_YET" ||
    value === "ERROR"
  ) {
    return value;
  }

  return "ERROR";
};

const normalizeMessage = (status: N8nWebhookStatus, value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  switch (status) {
    case "PASS":
      return "Recorded.";
    case "BLOCK":
      return CEVONNE_SAFE_RESPONSE_MESSAGE;
    case "MANUAL_ONLY":
      return CEVONNE_MANUAL_REVIEW_MESSAGE;
    case "PENDING_APPROVAL":
      return "Waiting for human approval.";
    case "DRY_RUN":
    case "RECOMMENDATION_ONLY":
    case "DO_NOT_SCALE":
    case "FIX_FIRST":
      return "Recommendation created. Nothing was executed.";
    case "NEEDS_EVIDENCE":
      return "More evidence is required before this can continue.";
    case "NOT_RUN_YET":
      return "Workflow has not run yet.";
    case "ERROR":
    default:
      return CEVONNE_TEMPORARY_FAILURE_MESSAGE;
  }
};

const createErrorResult = (
  message: string,
  input: Pick<PostN8nWebhookInput, "requestId" | "path" | "url">,
  extra: Partial<N8nWebhookResult> = {},
): N8nWebhookResult => {
  const requestId = input.requestId || randomUUID();
  const webhookUrl = buildWebhookUrl(input);
  return {
    status: "ERROR",
    message,
    request_id: requestId,
    sent_at: new Date().toISOString(),
    webhook_url: webhookUrl,
    ...extra,
  };
};

const buildHeaders = (requestId: string, sentAt: string, dryRun: boolean) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cevonne-Source": "admin-panel",
    "X-Cevonne-Request-Id": requestId,
    "X-Cevonne-Timestamp": sentAt,
    "X-Cevonne-Dry-Run": dryRun ? "true" : "false",
  };

  if (env.n8nWebhookSecret.trim()) {
    headers.Authorization = `Bearer ${env.n8nWebhookSecret.trim()}`;
    headers["X-Cevonne-Webhook-Secret"] = env.n8nWebhookSecret.trim();
  }

  return headers;
};

export const postN8nWebhook = async (input: PostN8nWebhookInput): Promise<N8nWebhookResult> => {
  const requestId = input.requestId || randomUUID();
  const sentAt = new Date().toISOString();
  const webhookUrl = buildWebhookUrl(input);
  const payload = input.payload || {};
  const dryRun = Boolean(input.dryRun ?? payload.dry_run ?? false);

  if (!webhookUrl) {
    return createErrorResult("Missing n8n webhook configuration.", input, {
      request_id: requestId,
      sent_at: sentAt,
    });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return createErrorResult("Invalid n8n webhook URL.", input, {
      request_id: requestId,
      sent_at: sentAt,
    });
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return createErrorResult("Invalid n8n webhook URL protocol.", input, {
      request_id: requestId,
      sent_at: sentAt,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: buildHeaders(requestId, sentAt, dryRun),
      body: JSON.stringify({
        ...payload,
        request_id: requestId,
        received_at: sentAt,
        dry_run: dryRun,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    if (!text.trim()) {
      return createErrorResult("n8n returned an empty response.", input, {
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: text,
      });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return createErrorResult("n8n returned invalid JSON.", input, {
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: text,
      });
    }

    if (!isRecord(raw)) {
      return createErrorResult("n8n response must be a JSON object.", input, {
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: text,
      });
    }

    const status = normalizeStatus(raw.status);
    const message = normalizeMessage(status, raw.message);
    return {
      status,
      message,
      response_type: typeof raw.response_type === "string" ? raw.response_type : null,
      fail_reason: typeof raw.fail_reason === "string" ? raw.fail_reason : null,
      failure_reasons: Array.isArray(raw.failure_reasons)
        ? raw.failure_reasons.filter((entry): entry is string => typeof entry === "string")
        : null,
      id: typeof raw.id === "string" ? raw.id : null,
      event_id: typeof raw.event_id === "string" ? raw.event_id : null,
      review_id: typeof raw.review_id === "string" ? raw.review_id : null,
      draft_id: typeof raw.draft_id === "string" ? raw.draft_id : null,
      content_review_id: typeof raw.content_review_id === "string" ? raw.content_review_id : null,
      content_draft_id: typeof raw.content_draft_id === "string" ? raw.content_draft_id : null,
      dry_run: typeof raw.dry_run === "boolean" ? raw.dry_run : null,
      not_executed: typeof raw.not_executed === "boolean" ? raw.not_executed : null,
      handled_at: typeof raw.handled_at === "string" ? raw.handled_at : null,
      http_status: response.status,
      response_text: text,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      raw,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return createErrorResult("n8n request timed out.", input, {
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: null,
      });
    }

    return createErrorResult("Failed to call n8n webhook.", input, {
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: null,
      raw: {
        error: error?.message || String(error),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const buildN8nWebhookUrl = (path: string) => buildWebhookUrl({ path });
