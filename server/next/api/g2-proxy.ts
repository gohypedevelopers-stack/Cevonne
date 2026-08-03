import "server-only";

import { env } from "@/server/config";

export type ProxyResult<T = unknown> = {
  data: T;
  status: number;
};

const normalizePath = (value: string) => value.trim().replace(/^\/+/, "");

const buildProxyUrl = (path: string) => {
  const baseUrl = env.n8nBaseUrl || process.env.N8N_BASE_URL || "https://n8n.cevonne.com/webhook";
  return `${baseUrl.replace(/\/+$/, "")}/${normalizePath(path)}`;
};

const buildHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cevonne-Source": "website-admin",
  };

  const secret = (env.n8nWebhookSecret || process.env.N8N_WEBHOOK_SHARED_SECRET || "").trim();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Cevonne-Webhook-Secret"] = secret;
  }

  return headers;
};

export async function callG2Webhook<T = unknown>(
  path: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const url = buildProxyUrl(path);

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    throw new Error("G2 returned an empty response");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("G2 returned an invalid response");
  }

  if (!response.ok) {
    const errorMsg =
      typeof data === "object" && data !== null && "message" in data && typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `G2 request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const proxyG2Webhook = async (path: string, payload: unknown): Promise<ProxyResult> => {
  try {
    const data = await callG2Webhook(path, (payload && typeof payload === "object") ? (payload as Record<string, unknown>) : {});
    return {
      data,
      status: 200,
    };
  } catch (err) {
    return {
      data: {
        status: "ERROR",
        response_type: "G2_PROXY_REQUEST_FAILED",
        message: err instanceof Error ? err.message : "G2 request failed.",
      },
      status: 502,
    };
  }
};
