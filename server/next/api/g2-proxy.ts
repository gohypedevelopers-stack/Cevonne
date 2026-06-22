import "server-only";

import { env } from "@/server/config";

type ProxyResult = {
  data: unknown;
  status: number;
};

const normalizePath = (value: string) => value.trim().replace(/^\/+/, "");

const buildProxyUrl = (path: string) => {
  return `${env.n8nBaseUrl.replace(/\/+$/, "")}/${normalizePath(path)}`;
};

const buildHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cevonne-Source": "admin-panel",
  };

  if (env.n8nWebhookSecret.trim()) {
    headers.Authorization = `Bearer ${env.n8nWebhookSecret.trim()}`;
    headers["X-Cevonne-Webhook-Secret"] = env.n8nWebhookSecret.trim();
  }

  return headers;
};

export const proxyG2Webhook = async (path: string, payload: unknown): Promise<ProxyResult> => {
  const response = await fetch(buildProxyUrl(path), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return {
      data: {
        status: "ERROR",
        response_type: "G2_PROXY_RESPONSE_EMPTY",
        message: "G2 returned an empty response.",
      },
      status: 502,
    };
  }

  try {
    return {
      data: JSON.parse(text) as unknown,
      status: response.status,
    };
  } catch {
    return {
      data: {
        status: "ERROR",
        response_type: "G2_PROXY_RESPONSE_NOT_JSON",
        message: "G2 returned an invalid response.",
      },
      status: 502,
    };
  }
};
