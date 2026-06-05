import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetAuthUser = vi.fn();

vi.mock("@/server/next/route-utils", async () => {
  const actual = await vi.importActual<typeof import("@/server/next/route-utils")>(
    "@/server/next/route-utils",
  );

  return {
    ...actual,
    getAuthUser: mockGetAuthUser,
  };
});

const testEnv = {
  CEVONNE_N8N_ENABLED: "true",
  CEVONNE_N8N_DRY_RUN: "false",
  CEVONNE_SITE_SOURCE: "website",
  CEVONNE_PRIVACY_POLICY_VERSION: "2026-website-v1",
  N8N_G11_WEEKLY_DIGEST_URL: "https://n8n.local/cevonne/g11-digest",
  N8N_G11_DECISION_RECOMMENDATION_URL: "https://n8n.local/cevonne/g11-recommendation",
  N8N_G11_DRAFT_ACTION_PACKET_URL: "https://n8n.local/cevonne/g11-action-draft",
} as const;

const envKeys = Object.keys(testEnv) as Array<keyof typeof testEnv>;
const previousEnv = new Map<string, string | undefined>();
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

const adminUser = {
  id: "admin-1",
  email: "admin@cevonne.com",
  role: "ADMIN",
  name: "Admin",
};

const customerUser = {
  id: "customer-1",
  email: "customer@example.com",
  role: "CUSTOMER",
  name: "Customer",
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const makeJsonRequest = (path: string, body: Record<string, unknown>) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const createWebhookFetchMock = () =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    const allowedUrls = new Set<string>(
      Object.values(testEnv).filter((value) => value.startsWith("https://")),
    );
    if (!allowedUrls.has(url)) {
      throw new Error(`Unexpected webhook URL: ${url}`);
    }

    return jsonResponse({
      status: "PASS",
      id: body.request_id || "g11-recorded",
      message: "Recorded.",
      recommendation_only: true,
    });
  });

async function loadAdminRoutes() {
  vi.resetModules();

  const [digestRoute, recommendationRoute, actionDraftRoute] = await Promise.all([
    import("../app/api/cevonne/admin/g11-digest/route"),
    import("../app/api/cevonne/admin/g11-recommendation/route"),
    import("../app/api/cevonne/admin/g11-action-draft/route"),
  ]);

  return {
    digest: digestRoute.POST,
    recommendation: recommendationRoute.POST,
    actionDraft: actionDraftRoute.POST,
  };
}

describe("G11 admin routes", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = testEnv[key] as string;
    }

    mockGetAuthUser.mockReset();
    vi.stubGlobal("fetch", createWebhookFetchMock());
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previousValue = previousEnv.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue as string;
      }
    }

    previousEnv.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects anonymous requests", async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);

    const { digest } = await loadAdminRoutes();
    const response = await digest(
      makeJsonRequest("/api/cevonne/admin/g11-digest", {
        period: "7d",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(fetch).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();

    const logEntry = consoleInfoSpy.mock.calls.find(([tag]) => tag === "[Cevonne]")?.[1] as Record<
      string,
      unknown
    >;

    expect(logEntry.route_name).toBe("/api/cevonne/admin/g11-digest");
    expect(logEntry.n8n_response_status).toBe("NOT_SENT");
    expect(logEntry.fail_reason).toBe("Unauthorized");
  });

  it("rejects customer requests", async () => {
    mockGetAuthUser.mockResolvedValueOnce(customerUser);

    const { recommendation } = await loadAdminRoutes();
    const response = await recommendation(
      makeJsonRequest("/api/cevonne/admin/g11-recommendation", {
        scope: "content",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body.message).toBe("Forbidden");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Respects staging dry run mode on admin routes", async () => {
    process.env.CEVONNE_N8N_DRY_RUN = "true";
    mockGetAuthUser.mockResolvedValueOnce(adminUser);

    const { digest } = await loadAdminRoutes();
    const response = await digest(
      makeJsonRequest("/api/cevonne/admin/g11-digest", {
        period: "7d",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    const [calledUrl, calledOptions] = vi.mocked(fetch).mock.calls[0];
    const sentBody = JSON.parse(String((calledOptions as RequestInit).body)) as Record<string, unknown>;
    const headers = (calledOptions as RequestInit).headers as Record<string, string>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("PASS");
    expect(String(calledUrl)).toBe(testEnv.N8N_G11_WEEKLY_DIGEST_URL);
    expect(sentBody.dry_run).toBe(true);
    expect(headers["X-Cevonne-Dry-Run"]).toBe("true");
  });

  it.each([
    {
      label: "digest",
      handler: "digest" as const,
      path: "/api/cevonne/admin/g11-digest",
      url: testEnv.N8N_G11_WEEKLY_DIGEST_URL,
      eventType: "G11_WEEKLY_DIGEST_REQUEST",
      sourceEvent: "g11_weekly_digest_request",
    },
    {
      label: "recommendation",
      handler: "recommendation" as const,
      path: "/api/cevonne/admin/g11-recommendation",
      url: testEnv.N8N_G11_DECISION_RECOMMENDATION_URL,
      eventType: "G11_DECISION_RECOMMENDATION_REQUEST",
      sourceEvent: "g11_decision_recommendation_request",
    },
    {
      label: "action draft",
      handler: "actionDraft" as const,
      path: "/api/cevonne/admin/g11-action-draft",
      url: testEnv.N8N_G11_DRAFT_ACTION_PACKET_URL,
      eventType: "G11_DRAFT_ACTION_PACKET_REQUEST",
      sourceEvent: "g11_draft_action_packet_request",
    },
  ])("admin $label route returns PASS and only calls the G11 webhook", async ({ handler, path, url, eventType, sourceEvent }) => {
    mockGetAuthUser.mockResolvedValueOnce(adminUser);

    const routes = await loadAdminRoutes();
    const response = await routes[handler](
      makeJsonRequest(path, {
        scope: "admin_dashboard",
        period: "7d",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("PASS");
    expect(body.recommendation_only).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = vi.mocked(fetch).mock.calls[0];
    expect(String(calledUrl)).toBe(url);
    const sentBody = JSON.parse(String((calledOptions as RequestInit).body)) as Record<string, unknown>;
    expect(sentBody.workflow_group).toBe("G11");
    expect(sentBody.event_type).toBe(eventType);
    expect(sentBody.source_event).toBe(sourceEvent);
    expect(sentBody.admin_requester_id).toBe(adminUser.id);
    expect(sentBody.admin_requester_email).toBe(adminUser.email);
    expect(sentBody.admin_requester_role).toBe("ADMIN");
  });
});
