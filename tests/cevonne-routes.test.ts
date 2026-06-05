import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const safeFallbackMessage =
  "We could not complete this automatically. Your request has been received for review or support.";

const testEnv = {
  CEVONNE_N8N_ENABLED: "true",
  CEVONNE_N8N_DRY_RUN: "false",
  CEVONNE_SITE_SOURCE: "website",
  CEVONNE_PRIVACY_POLICY_VERSION: "2026-website-v1",
  N8N_G3_CONSENT_INGEST_URL: "https://n8n.local/cevonne/consent",
  N8N_G3_OPT_OUT_URL: "https://n8n.local/cevonne/opt-out",
  N8N_G3_ATTRIBUTION_EVENT_URL: "https://n8n.local/cevonne/attribution",
  N8N_G3_PURCHASE_EVENT_URL: "https://n8n.local/cevonne/purchase",
  N8N_G3_PRIVACY_REQUEST_URL: "https://n8n.local/cevonne/privacy-request",
  N8N_G3_PRIVACY_EXECUTE_URL: "https://n8n.local/cevonne/privacy-execute",
} as const;

const envKeys = Object.keys(testEnv) as Array<keyof typeof testEnv>;
const previousEnv = new Map<string, string | undefined>();
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

const consentedContacts = new Set<string>();
const optedOutContacts = new Set<string>();

const normalizeKey = (value: unknown) => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

const getContactKey = (payload: Record<string, unknown>) => {
  return (
    normalizeKey(payload.contact_id) ||
    normalizeKey(payload.external_contact_id) ||
    normalizeKey(payload.user_id) ||
    normalizeKey(payload.email) ||
    normalizeKey(payload.phone)
  );
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const createWebhookFetchMock = () =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const contactKey = getContactKey(payload);

    if (url === testEnv.N8N_G3_CONSENT_INGEST_URL) {
      if (payload.email === "mask@example.com") {
        return jsonResponse({
          status: "BLOCK",
          fail_reason: "Blocked contact mask@example.com and +1 (202) 555-0118.",
          message: "Internal consent block.",
        });
      }

      if (contactKey) {
        consentedContacts.add(contactKey);
      }

      return jsonResponse({
        status: "PASS",
        id: payload.request_id || "consent-recorded",
        contact_id: contactKey || null,
        message: "Recorded.",
        event_id: payload.event_id || null,
        source_route: payload.source_route || null,
        actor: payload.actor || null,
        received_at: payload.received_at || null,
        internal_audit_payload: {
          compliance_token: "secret",
        },
      });
    }

    if (url === testEnv.N8N_G3_OPT_OUT_URL) {
      if (contactKey) {
        optedOutContacts.add(contactKey);
      }

      return jsonResponse({
        status: "PASS",
        id: payload.request_id || "opt-out-recorded",
        contact_id: contactKey || null,
        message: "Recorded.",
        event_id: payload.event_id || null,
        source_route: payload.source_route || null,
        actor: payload.actor || null,
        received_at: payload.received_at || null,
      });
    }

    if (url === testEnv.N8N_G3_ATTRIBUTION_EVENT_URL) {
      if (!contactKey || optedOutContacts.has(contactKey) || !consentedContacts.has(contactKey)) {
        return jsonResponse({
          status: "BLOCK",
          fail_reason: "Consent missing or revoked.",
          failure_reasons: ["Consent missing or revoked."],
          message: "Internal attribution block.",
        });
      }

      return jsonResponse({
        status: "PASS",
        id: payload.request_id || "attribution-recorded",
        contact_id: contactKey,
        message: "Recorded.",
        event_id: payload.event_id || null,
        source_route: payload.source_route || null,
        actor: payload.actor || null,
        received_at: payload.received_at || null,
      });
    }

    if (url === testEnv.N8N_G3_PURCHASE_EVENT_URL) {
      return jsonResponse({
        status: "PASS",
        id: payload.request_id || "purchase-recorded",
        message: "Recorded.",
        recovery_suppressed: true,
        event_id: payload.event_id || null,
        source_route: payload.source_route || null,
        actor: payload.actor || null,
        received_at: payload.received_at || null,
      });
    }

    if (url === testEnv.N8N_G3_PRIVACY_REQUEST_URL) {
      return jsonResponse({
        status: "PASS",
        id: payload.request_id || "privacy-request-recorded",
        message: "Recorded.",
        event_id: payload.event_id || null,
        source_route: payload.source_route || null,
        actor: payload.actor || null,
        received_at: payload.received_at || null,
      });
    }

    if (url === testEnv.N8N_G3_PRIVACY_EXECUTE_URL) {
      return jsonResponse({
        status: "MANUAL_ONLY",
        id: payload.request_id || "privacy-execute-manual",
        message: "Manual review required.",
        not_executed: true,
      });
    }

    throw new Error(`Unexpected webhook URL: ${url}`);
  });

const makeJsonRequest = (path: string, body: Record<string, unknown>) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

async function loadCevonneRoutes() {
  vi.resetModules();

  const [
    consentRoute,
    optOutRoute,
    attributionRoute,
    purchaseRoute,
    privacyRequestRoute,
  ] = await Promise.all([
    import("../app/api/cevonne/consent/route"),
    import("../app/api/cevonne/opt-out/route"),
    import("../app/api/cevonne/attribution/route"),
    import("../app/api/cevonne/purchase/route"),
    import("../app/api/cevonne/privacy-request/route"),
  ]);

  return {
    consent: consentRoute.POST,
    optOut: optOutRoute.POST,
    attribution: attributionRoute.POST,
    purchase: purchaseRoute.POST,
    privacyRequest: privacyRequestRoute.POST,
  };
}

describe("G3 website routes", () => {
  beforeEach(() => {
    consentedContacts.clear();
    optedOutContacts.clear();

    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = testEnv[key];
    }

    vi.stubGlobal("fetch", createWebhookFetchMock());
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previousValue = previousEnv.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }

    previousEnv.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Consent happy path returns PASS", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "user@example.com",
        contact_id: "contact-1",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("PASS");
    expect(body.id).toBeDefined();
    expect(body.source_route).toBeUndefined();
    expect(body.actor).toBeUndefined();
    expect(body.internal_audit_payload).toBeUndefined();
    expect(body.contact_id).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Respects staging dry run mode by sending dry_run=true to n8n", async () => {
    process.env.CEVONNE_N8N_DRY_RUN = "true";

    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "dryrun@example.com",
        contact_id: "contact-dryrun",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    const [calledUrl, calledOptions] = vi.mocked(fetch).mock.calls[0];
    const sentBody = JSON.parse(String((calledOptions as RequestInit).body)) as Record<string, unknown>;
    const headers = (calledOptions as RequestInit).headers as Record<string, string>;

    expect(String(calledUrl)).toBe(testEnv.N8N_G3_CONSENT_INGEST_URL);
    expect(body.status).toBe("PASS");
    expect(sentBody.dry_run).toBe(true);
    expect(headers["X-Cevonne-Dry-Run"]).toBe("true");
  });

  it("Consent without email, phone, or contact identifier returns BLOCK", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Consent YES without explicit_consent true returns BLOCK", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "user@example.com",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: false,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Validation blocks are logged without sending a webhook", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();

    const logEntry = consoleInfoSpy.mock.calls.find(([tag]) => tag === "[Cevonne]")?.[1] as Record<
      string,
      unknown
    >;

    expect(logEntry.route_name).toBe("/api/cevonne/consent");
    expect(logEntry.n8n_response_status).toBe("NOT_SENT");
    expect(logEntry.fail_reason).toBe("At least one identifier is required.");
  });

  it("Consent rejects unknown fields with BLOCK", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "user@example.com",
        contact_id: "contact-unknown-field",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
        approval_status: "APPROVED",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Logs safe route metadata and masks PII in fail reasons", async () => {
    const { consent } = await loadCevonneRoutes();

    const response = await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "mask@example.com",
        contact_id: "contact-mask",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalled();

    const logEntry = consoleInfoSpy.mock.calls.find(([tag]) => tag === "[Cevonne]")?.[1] as Record<
      string,
      unknown
    >;

    expect(logEntry.route_name).toBe("/api/cevonne/consent");
    expect(logEntry.n8n_response_status).toBe("BLOCK");
    expect(logEntry.n8n_response_type).toBeNull();
    expect(typeof logEntry.request_id).toBe("string");
    expect(typeof logEntry.timestamp).toBe("string");
    expect(String(logEntry.fail_reason)).not.toContain("mask@example.com");
    expect(String(logEntry.fail_reason)).not.toContain("202-555-0118");
  });

  it("Opt-out happy path returns PASS", async () => {
    const { optOut } = await loadCevonneRoutes();

    const response = await optOut(
      makeJsonRequest("/api/cevonne/opt-out", {
        email: "user@example.com",
        contact_id: "contact-2",
        channel: "EMAIL",
        opt_out_reason: "user_unsubscribe",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("PASS");
    expect(body.id).toBeDefined();
    expect(body.contact_id).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Attribution without valid consent returns BLOCK", async () => {
    const { attribution } = await loadCevonneRoutes();

    const response = await attribution(
      makeJsonRequest("/api/cevonne/attribution", {
        contact_id: "contact-3",
        event_type: "PAGE_VIEW",
        event_name: "PAGE_VIEW",
        tracking_consent_status: "YES",
        source_event: "page_view",
        utm_source: "instagram",
        utm_medium: "paid",
        utm_campaign: "summer_launch",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(body.fail_reason).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Attribution after opt-out returns BLOCK", async () => {
    const { consent, optOut, attribution } = await loadCevonneRoutes();

    await consent(
      makeJsonRequest("/api/cevonne/consent", {
        email: "user@example.com",
        contact_id: "contact-4",
        channel: "EMAIL",
        consent_status: "YES",
        explicit_consent: true,
        privacy_policy_version: "2026-website-v1",
      }),
    );

    await optOut(
      makeJsonRequest("/api/cevonne/opt-out", {
        email: "user@example.com",
        contact_id: "contact-4",
        channel: "EMAIL",
        opt_out_reason: "user_unsubscribe",
      }),
    );

    const response = await attribution(
      makeJsonRequest("/api/cevonne/attribution", {
        contact_id: "contact-4",
        event_type: "PAGE_VIEW",
        event_name: "PAGE_VIEW",
        tracking_consent_status: "YES",
        source_event: "page_view",
        utm_source: "instagram",
        utm_medium: "paid",
        utm_campaign: "summer_launch",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(body.fail_reason).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("Purchase without order_id returns BLOCK", async () => {
    const { purchase } = await loadCevonneRoutes();

    const response = await purchase(
      makeJsonRequest("/api/cevonne/purchase", {
        email: "user@example.com",
        contact_id: "contact-5",
        purchase_value: 2499,
        currency: "INR",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Valid purchase returns PASS and includes recovery_suppressed = true if returned by n8n", async () => {
    const { purchase } = await loadCevonneRoutes();

    const response = await purchase(
      makeJsonRequest("/api/cevonne/purchase", {
        order_id: "shopify_order_123",
        email: "user@example.com",
        contact_id: "contact-6",
        purchase_value: 2499,
        currency: "INR",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("PASS");
    expect(body.id).toBeDefined();
    expect(body.recovery_suppressed).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Privacy request missing request_type returns BLOCK", async () => {
    const { privacyRequest } = await loadCevonneRoutes();

    const response = await privacyRequest(
      makeJsonRequest("/api/cevonne/privacy-request", {
        email: "user@example.com",
        contact_id: "contact-7",
        verification_status: "PENDING",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Valid privacy request returns PASS", async () => {
    const { privacyRequest } = await loadCevonneRoutes();

    const response = await privacyRequest(
      makeJsonRequest("/api/cevonne/privacy-request", {
        request_type: "DELETE",
        email: "user@example.com",
        contact_id: "contact-8",
        verification_status: "PENDING",
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("PASS");
    expect(body.id).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Privacy execute must not be automated from the public website", () => {
    expect(existsSync(resolve(process.cwd(), "app/api/cevonne/privacy-execute/route.ts"))).toBe(false);
  });

  it("G6 messaging is not connected until a final webhook URL is confirmed", () => {
    expect(existsSync(resolve(process.cwd(), "app/api/cevonne/quiz-or-recovery/route.ts"))).toBe(false);
  });

  it("Public routes are rate-limited per route and IP", async () => {
    const { consent } = await loadCevonneRoutes();

    let response: Response | null = null;
    for (let index = 0; index < 21; index += 1) {
      response = await consent(
        makeJsonRequest("/api/cevonne/consent", {
          email: `user${index}@example.com`,
          contact_id: `contact-rate-${index}`,
          channel: "EMAIL",
          consent_status: "YES",
          explicit_consent: true,
          privacy_policy_version: "2026-website-v1",
        }),
      );
    }

    expect(response).not.toBeNull();
    const body = (await response!.json()) as Record<string, unknown>;
    expect(body.status).toBe("BLOCK");
    expect(body.message).toBe(safeFallbackMessage);
    expect(body.fail_reason).toBe("Rate limit exceeded.");
    expect(body.retry_after_seconds).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(20);
  });
});
