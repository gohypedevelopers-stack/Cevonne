import "server-only";

import { randomUUID } from "node:crypto";

export type CevonneN8nStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";

export type CevonneN8nResponse = {
  status: CevonneN8nStatus;
  response_type?: string;
  fail_reason?: string | null;
  failure_reasons?: string[];
  message?: string;
  id?: string;
  recommendation_only?: boolean;
  dry_run?: boolean;
  not_executed?: boolean;
  handled_at?: string;
  [key: string]: unknown;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const CEVONNE_SOURCE = "website";
const ALLOWED_STATUSES = new Set<CevonneN8nStatus>(["PASS", "BLOCK", "MANUAL_ONLY", "ERROR"]);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isAllowedStatus = (value: unknown): value is CevonneN8nStatus => {
  return typeof value === "string" && ALLOWED_STATUSES.has(value as CevonneN8nStatus);
};

const createErrorResponse = (
  message: string,
  extra: Record<string, unknown> = {},
): CevonneN8nResponse => ({
  status: "ERROR",
  message,
  ...extra,
});

const buildTimeoutController = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
};

export async function postN8nWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<CevonneN8nResponse> {
  if (typeof webhookUrl !== "string" || webhookUrl.trim().length === 0) {
    return createErrorResponse("Invalid n8n webhook URL.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return createErrorResponse("Invalid n8n webhook URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return createErrorResponse("Invalid n8n webhook URL protocol.");
  }

  const requestId =
    typeof payload.request_id === "string" && payload.request_id.trim().length > 0
      ? payload.request_id
      : randomUUID();
  const receivedAt =
    typeof payload.received_at === "string" && payload.received_at.trim().length > 0
      ? payload.received_at
      : new Date().toISOString();

  const requestBody = {
    ...payload,
    request_id: requestId,
    received_at: receivedAt,
  };

  const { controller, cleanup } = buildTimeoutController(DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cevonne-Source": CEVONNE_SOURCE,
        "X-Cevonne-Request-Id": requestId,
        "X-Cevonne-Timestamp": receivedAt,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!responseText.trim()) {
      return createErrorResponse("n8n returned an empty response.");
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      return createErrorResponse("n8n returned invalid JSON.");
    }

    if (!isRecord(parsedResponse)) {
      return createErrorResponse("n8n response must be a JSON object.");
    }

    if (!isAllowedStatus(parsedResponse.status)) {
      return createErrorResponse("n8n response returned an unsupported status.", {
        response: parsedResponse,
      });
    }

    return parsedResponse as CevonneN8nResponse;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return createErrorResponse("n8n request timed out.");
    }

    return createErrorResponse("Failed to call n8n webhook.", {
      error: error?.message || String(error),
    });
  } finally {
    cleanup();
  }
}
