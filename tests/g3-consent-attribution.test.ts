import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSupabaseFrom, mockPostN8nWebhook } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockPostN8nWebhook: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

vi.mock("@/lib/n8n-client", () => ({
  postN8nWebhook: mockPostN8nWebhook,
}));

const testEnv = {
  CEVONNE_N8N_DRY_RUN: "false",
  CEVONNE_PRIVACY_POLICY_VERSION: "2026-website-v1",
  N8N_BASE_URL: "https://n8n.example/webhook",
  N8N_G3_CONSENT_INGEST_URL: "https://n8n.example/g3/consent",
  N8N_G3_OPT_OUT_URL: "https://n8n.example/g3/opt-out",
  N8N_G3_ATTRIBUTION_EVENT_URL: "https://n8n.example/g3/attribution",
  N8N_G3_PURCHASE_EVENT_URL: "https://n8n.example/g3/purchase",
  N8N_G3_PRIVACY_REQUEST_URL: "https://n8n.example/g3/privacy-request",
} as const;

const envKeys = Object.keys(testEnv) as Array<keyof typeof testEnv>;
const previousEnv = new Map<string, string | undefined>();

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

const makeQueryChain = (rows: Record<string, unknown>[]) => {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async (): Promise<QueryResult> => ({ data: rows, error: null })),
  };

  return chain;
};

const consentRows: Record<string, Record<string, unknown>[]> = {
  cevonne_g3_consent_sync: [],
  cevonne_g3_opt_out_sync: [],
  cevonne_g3_purchase_events: [],
  cevonne_g3_privacy_requests: [],
  cevonne_g3_privacy_execution_requests: [],
  cevonne_g3_recovery_suppression: [],
};

const setupSupabaseMock = () => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const rows = consentRows[table as keyof typeof consentRows];
    if (!rows) {
      throw new Error(`Unexpected table: ${table}`);
    }

    return makeQueryChain(rows);
  });
};

async function loadModules() {
  vi.resetModules();

  const [adapterModule, recordModule] = await Promise.all([
    import("../server/next/api/g3-consent-attribution-adapter"),
    import("../server/next/api/g3-record-event"),
  ]);

  return {
    getG3WorkflowDetail: adapterModule.getG3WorkflowDetail,
    recordG3Event: recordModule.recordG3Event,
  };
}

describe("G3 consent + attribution admin backend", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = testEnv[key];
    }

    for (const key of Object.keys(consentRows) as Array<keyof typeof consentRows>) {
      consentRows[key] = [];
    }

    mockSupabaseFrom.mockReset();
    mockPostN8nWebhook.mockReset();
    setupSupabaseMock();
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
    vi.restoreAllMocks();
  });

  it("returns a safe empty state when no G3 rows exist", async () => {
    const { getG3WorkflowDetail } = await loadModules();

    const detail = await getG3WorkflowDetail();

    expect(detail.workflowGroup).toBe("G3");
    expect(detail.status).toBe("NOT_RUN_YET");
    expect(detail.latestOutcome).toBeNull();
    expect(detail.recentOutcomes).toEqual([]);
    expect(detail.emptyStateCopy).toContain("No consent, opt-out, purchase, attribution, or privacy events");
    expect(detail.mainActionNeeded).toContain("Record the first consent event");
    expect(detail.counts.totalEvents).toBe(0);
  });

  it("builds masked, real G3 outcomes from Supabase rows", async () => {
    consentRows.cevonne_g3_consent_sync = [
      {
        synced_at: "2026-06-23T10:00:00.000Z",
        contact_id: "alice@example.com",
        channel: "WHATSAPP",
        consent_status: "YES",
        source_event: "newsletter_signup",
        payload: {
          contact_id: "alice@example.com",
          channel: "WHATSAPP",
          consent_status: "YES",
          source_event: "newsletter_signup",
        },
      },
    ];
    consentRows.cevonne_g3_opt_out_sync = [
      {
        synced_at: "2026-06-23T10:05:00.000Z",
        contact_id: "+91 98765 43210",
        channel: "WHATSAPP",
        source_event: "STOP",
        opt_out_keyword: "STOP",
        payload: {
          contact_id: "+91 98765 43210",
          channel: "WHATSAPP",
          source_event: "STOP",
          opt_out_keyword: "STOP",
        },
      },
    ];
    consentRows.cevonne_g3_consent_sync.push({
      synced_at: "2026-06-23T10:10:00.000Z",
      contact_id: "crm_123456",
      channel: "WEBSITE",
      consent_status: "YES",
      source_event: "ATTRIBUTION_EVENT",
      payload: {
        contact_id: "crm_123456",
        channel: "WEBSITE",
        consent_status: "YES",
        source_event: "ATTRIBUTION_EVENT",
        tracking_consent_status: "YES",
        event_name: "instagram_click",
        utm_source: "instagram",
        utm_campaign: "summer_launch",
      },
    });
    consentRows.cevonne_g3_purchase_events = [
      {
        created_at: "2026-06-23T10:15:00.000Z",
        contact_id: "bob@example.com",
        order_id: "order-123",
        purchase_value: "2499",
        source_platform: "ADMIN",
        payload: {
          contact_id: "bob@example.com",
          order_id: "order-123",
          purchase_value: 2499,
        },
      },
    ];
    consentRows.cevonne_g3_recovery_suppression = [
      {
        created_at: "2026-06-23T10:20:00.000Z",
        contact_id: "bob@example.com",
        suppression_reason: "duplicate recovery attempt",
        source: "recovery_cleanup",
        payload: {
          contact_id: "bob@example.com",
          suppression_reason: "duplicate recovery attempt",
          source: "recovery_cleanup",
        },
      },
    ];
    consentRows.cevonne_g3_privacy_requests = [
      {
        created_at: "2026-06-23T10:30:00.000Z",
        contact_id: "bob@example.com",
        request_type: "DELETE",
        verification_status: "PENDING",
        payload: {
          contact_id: "bob@example.com",
          request_type: "DELETE",
          verification_status: "PENDING",
        },
      },
    ];

    const { getG3WorkflowDetail } = await loadModules();
    const detail = await getG3WorkflowDetail();

    expect(detail.status).toBe("MANUAL_ONLY");
    expect(detail.latestOutcome?.eventType).toBe("MANUAL_ONLY_PRIVACY_REVIEW");
    expect(detail.latestOutcome?.details.contactIdentifierMasked).toBe("bo***@example.com");
    expect(detail.latestOutcome?.details.verificationStatus).toBe("PENDING");
    expect(detail.recentOutcomes.map((outcome) => outcome.eventType)).toEqual([
      "MANUAL_ONLY_PRIVACY_REVIEW",
      "RECOVERY_SUPPRESSED",
      "PURCHASE_RECORDED",
      "ATTRIBUTION_RECORDED",
      "BLOCKED_STOP_OPT_OUT",
      "CONSENT_RECORDED",
    ]);
    expect(detail.recentOutcomes.some((outcome) => outcome.details.contactIdentifierMasked === "al***@example.com")).toBe(true);
    expect(detail.recentOutcomes.some((outcome) => outcome.details.orderIdMasked === "ord***123")).toBe(true);
    expect(detail.counts.totalEvents).toBe(6);
    expect(detail.counts.blockedEvents).toBe(1);
    expect(detail.counts.manualReviewEvents).toBe(1);
    expect(detail.message).toBe("G3 event history loaded safely.");
  });

  it("blocks safely when contact identifiers are missing", async () => {
    const { recordG3Event } = await loadModules();

    const result = await recordG3Event({
      eventType: "CONSENT_RECORDED",
      contactIdentifier: "",
      channel: "WHATSAPP",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("BLOCK");
    expect(result.body.message).toBe("Blocked safely because the contact identifier was missing.");
    expect(result.body.contact_identifier_masked).toBeNull();
    expect(mockPostN8nWebhook).not.toHaveBeenCalled();
  });

  it("sends consent events to the configured G3 consent webhook", async () => {
    mockPostN8nWebhook.mockResolvedValueOnce({
      status: "PASS",
      message: "Recorded.",
      request_id: "req-consent-1",
      sent_at: "2026-06-23T10:01:00.000Z",
      webhook_url: testEnv.N8N_G3_CONSENT_INGEST_URL,
      http_status: 200,
      response_text: JSON.stringify({ status: "PASS" }),
      raw: { status: "PASS" },
    });

    const { recordG3Event } = await loadModules();
    const result = await recordG3Event({
      eventType: "CONSENT_RECORDED",
      contactIdentifier: "user@example.com",
      channel: "WHATSAPP",
      consentStatus: "YES",
      consentText: "User agreed to receive WhatsApp updates.",
      source: "ADMIN_TEST",
      workflowGroup: "G3",
      workflowId: "G3",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("PASS");
    expect(result.body.message).toContain("Consent was recorded safely");
    expect(result.body.contact_identifier_masked).toBe("us***@example.com");
    expect(mockPostN8nWebhook).toHaveBeenCalledTimes(1);

    const [request] = mockPostN8nWebhook.mock.calls[0] as [Record<string, unknown>];
    expect(request).toMatchObject({
      url: testEnv.N8N_G3_CONSENT_INGEST_URL,
      requestId: result.body.request_id,
      dryRun: false,
    });
    expect(request.payload).toMatchObject({
      workflow_group: "G3",
      workflow_id: "G3",
      event_type: "CONSENT_INGEST",
      source_platform: "ADMIN",
      source_event: "ADMIN_TEST",
      source: "ADMIN_TEST",
      actor: "admin",
      requested_by: "admin",
      contact_id: "user@example.com",
      email: "user@example.com",
      channel: "WHATSAPP",
      consent_status: "YES",
      explicit_consent: true,
      consent_text: "User agreed to receive WhatsApp updates.",
      privacy_policy_version: "2026-website-v1",
    });
  });

  it("returns a friendly backend failure when the G3 webhook is not connected", async () => {
    mockPostN8nWebhook.mockResolvedValueOnce({
      status: "ERROR",
      message: "n8n returned invalid JSON.",
      request_id: "req-error-1",
      sent_at: "2026-06-23T10:01:00.000Z",
      webhook_url: testEnv.N8N_G3_CONSENT_INGEST_URL,
      http_status: 404,
      response_text: "The requested webhook is not registered.",
      raw: { error: "Not found" },
    });

    const { recordG3Event } = await loadModules();
    const result = await recordG3Event({
      eventType: "CONSENT_RECORDED",
      contactIdentifier: "user@example.com",
      channel: "WHATSAPP",
      consentStatus: "YES",
      source: "ADMIN_TEST",
      workflowGroup: "G3",
      workflowId: "G3",
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("ERROR");
    expect(result.body.message).toBe(
      "G3 consent logging is not connected yet. Connect the G3 endpoint or check the server logs.",
    );
    expect(result.body.contact_identifier_masked).toBeNull();
  });
});
