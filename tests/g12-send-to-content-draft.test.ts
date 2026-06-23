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

import { sendG12TrendToContentDraft } from "../server/next/api/g12-send-to-content-draft";

type InsightRow = Record<string, unknown> | null;
type G4ReviewRow = Record<string, unknown> | null;

const makeInsightRow = (): Record<string, unknown> => ({
  id: "insight-1",
  asset_id: "g12_trend_asmr_lipstick_001",
  trend_id: "trend-1",
  insight_id: "insight-1",
  fetch_run_id: "run-1",
  platform: "INSTAGRAM",
  trend_topic: "Summer gloss",
  hook_angle: "Three ways to style it",
  clean_summary: "A safe trend note.",
  content_recommendation: "Create a short reel about this trend.",
  brand_fit_reason: "Strong fit for beauty products.",
  risk_notes: "Avoid copying any creator wording.",
  insight_title: "Summer gloss hook",
  summary: "Safe summary",
  source_url: "https://example.com/trend/summer-gloss",
  approval_status: null,
  g4_review_id: null,
  created_at: "2026-06-23T10:00:00.000Z",
});

const createSelectChain = (
  selectResult: unknown,
  state?: { lastUpdate: Record<string, unknown> | null; updateError: { message: string } | null },
) => {
  const results = Array.isArray(selectResult) ? [...selectResult] : [selectResult];
  let callIndex = 0;

  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      const result = callIndex < results.length ? results[callIndex] : results[results.length - 1];
      callIndex += 1;
      return { data: result, error: null };
    }),
  };

  if (state) {
    chain.update = vi.fn((update: Record<string, unknown>) => {
      state.lastUpdate = update;
      return {
        eq: vi.fn(async () => ({ data: null, error: state.updateError })),
      };
    });
  }

  return chain;
};

const setupSupabase = (
  insightRow: InsightRow,
  g4ReviewRow: G4ReviewRow | G4ReviewRow[],
  updateError: { message: string } | null = null,
) => {
  const state = {
    lastUpdate: null as Record<string, unknown> | null,
    updateError,
  };

  const insightsChain = createSelectChain(insightRow, state);
  const g4Chain = createSelectChain(g4ReviewRow);

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "g12_public_trend_insights") {
      return insightsChain;
    }

    if (table === "g4_content_reviews") {
      return g4Chain;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { state, insightsChain, g4Chain };
};

describe("sendG12TrendToContentDraft", () => {
  beforeEach(() => {
    mockSupabaseFrom.mockReset();
    mockPostN8nWebhook.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends a clean payload and updates the G12 insight on success", async () => {
    const { state } = setupSupabase(makeInsightRow(), [
      null,
      {
        review_id: "review-1",
        status: "PASS",
        approval_state: "PENDING_HUMAN_APPROVAL",
        asset_id: "g12_trend_asmr_lipstick_001",
        ai_safe_rewrite: "Use a short caption that focuses on the trend instead of the creator wording.",
        ai_caption_suggestions: ["Try a quick trend recap.", "Keep the caption clean and clear."],
        ai_hook_suggestions: ["Hook: a safe trend note worth trying."],
        ai_human_review_recommendation: "Send for Human Approval",
        created_at: "2026-06-23T10:01:00.000Z",
        safe_summary: "Content check passed. Human approval is still required before this can be used.",
      },
    ]);
    mockPostN8nWebhook.mockResolvedValueOnce({
      status: "PASS",
      message: "Recorded.",
      review_id: "review-1",
      request_id: "req-1",
      sent_at: "2026-06-23T10:00:30.000Z",
      handled_at: "2026-06-23T10:01:00.000Z",
      http_status: 200,
      response_text: JSON.stringify({ status: "PASS", review_id: "review-1" }),
      webhook_url: "https://n8n.example/webhook/g4-content-landing-check",
      raw: {
        status: "PASS",
        review_id: "review-1",
      },
    });

    const result = await sendG12TrendToContentDraft({
      insight_id: "insight-1",
      fetch_run_id: "run-1",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      status: "PASS",
      message: "Content check passed. Human approval is still required before this can be used.",
      summary: null,
      already_sent: false,
      review_id: "review-1",
      g4_review_id: "review-1",
      content_draft_id: "review-1",
      asset_id: "g12_trend_asmr_lipstick_001",
      approval_state: "PENDING_HUMAN_APPROVAL",
      action_needed: "Send for Human Approval",
      safe_rewrite: "Use a short caption that focuses on the trend instead of the creator wording.",
      caption_suggestions: ["Try a quick trend recap.", "Keep the caption clean and clear."],
      hook_suggestions: ["Hook: a safe trend note worth trying."],
      insight_id: "insight-1",
      fetch_run_id: "run-1",
      g4_detail_href: "/dashboard/n8n-automations/g4",
    });
    expect(mockPostN8nWebhook).toHaveBeenCalledTimes(1);

    const [input] = mockPostN8nWebhook.mock.calls[0] as [Record<string, unknown>];
    expect(input.path).toBe("g4-content-landing-check");
    expect(input.payload).toMatchObject({
      workflow_group: "G4",
      workflow_id: "G12",
      source_workflow_group: "G12",
      source_workflow_id: "G12",
      source_platform: "G12",
      source_event: "SAFE_TREND_TO_CONTENT_REVIEW",
      source_type: "PUBLIC_TREND_CLEAN_INSIGHT",
      action_type: "CONTENT_DRAFT_CHECK",
      asset_id: "g12_trend_asmr_lipstick_001",
      asset_type: "TREND_CONTENT_IDEA",
      content_format: "SHORT_VIDEO_CAPTION",
      headline: "Summer gloss hook",
      content_text: "A safe trend note. Recommendation: Create a short reel about this trend. Hook: Three ways to style it",
      platform: "INSTAGRAM",
      source_trend_id: "trend-1",
      source_url: "https://example.com/trend/summer-gloss",
      actor: "website_admin",
      requested_by: "website_admin",
      insight_id: "insight-1",
      fetch_run_id: "run-1",
      idempotency_key: "g12_to_g4:g12_trend_asmr_lipstick_001",
      trend_topic: "Summer gloss",
      insight_title: "Summer gloss hook",
      trend_meaning: "A safe trend note. Recommendation: Create a short reel about this trend. Hook: Three ways to style it",
      hook_angle: "Three ways to style it",
      clean_summary: "A safe trend note.",
      content_recommendation: "Create a short reel about this trend.",
      quarantine_notice: "Raw scraped content is quarantined and must not be reused directly.",
      requires_g4_review: true,
      requires_g5_approval: true,
    });
    expect((input.payload as Record<string, unknown>).caption_preview).toBeUndefined();
    expect((input.payload as Record<string, unknown>).source_url).toBe("https://example.com/trend/summer-gloss");
    expect(state.lastUpdate).toMatchObject({
      approval_status: "DRAFT_CREATED",
      g4_review_id: "review-1",
      updated_at: "2026-06-23T10:01:00.000Z",
    });
  });

  it("returns already sent without calling n8n when a matching G4 review already exists", async () => {
    const { state } = setupSupabase(makeInsightRow(), {
      review_id: "review-dup-1",
      status: "PASS",
      created_at: "2026-06-23T10:02:00.000Z",
      safe_summary: "Already created in G4.",
      raw_payload: {
        idempotency_key: "g12_to_g4:insight-1",
      },
    });

    const result = await sendG12TrendToContentDraft({
      insight_id: "insight-1",
      fetch_run_id: "run-1",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      status: "PASS",
      message: "Content draft/check already exists in G4.",
      summary: "The insight already has a G4 review record.",
      already_sent: true,
      g4_review_id: "review-dup-1",
      content_draft_id: "review-dup-1",
    });
    expect(mockPostN8nWebhook).not.toHaveBeenCalled();
    expect(state.lastUpdate).toMatchObject({
      approval_status: "DRAFT_CREATED",
      g4_review_id: "review-dup-1",
    });
  });

  it("maps a missing G4 webhook to a friendly connected message", async () => {
    const { state } = setupSupabase(makeInsightRow(), null);
    mockPostN8nWebhook.mockResolvedValueOnce({
      status: "ERROR",
      message: "n8n returned invalid JSON.",
      request_id: "req-2",
      sent_at: "2026-06-23T10:00:30.000Z",
      http_status: 404,
      response_text: "The requested webhook 'POST g4-content-check' is not registered.",
      webhook_url: "https://n8n.example/webhook/g4-content-check",
      raw: {
        error: "Not found",
      },
    });

    const result = await sendG12TrendToContentDraft({
      insight_id: "insight-1",
      fetch_run_id: "run-1",
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: "ERROR",
      message: "G4 content check is not connected yet. Activate the G4 n8n workflow or update the G4 webhook path.",
      action_needed: "Connect G4 content check endpoint.",
      already_sent: false,
    });
    expect(state.lastUpdate).toBeNull();
  });

  it("returns a friendly not found message for a missing insight", async () => {
    setupSupabase(null, null);

    const result = await sendG12TrendToContentDraft({
      insight_id: "missing-insight",
      fetch_run_id: "run-1",
    });

    expect(result.httpStatus).toBe(404);
    expect(result.body).toMatchObject({
      status: "ERROR",
      message: "This saved insight could not be found.",
      already_sent: false,
    });
    expect(mockPostN8nWebhook).not.toHaveBeenCalled();
  });

  it("keeps blocked responses safe and returns a simple reason", async () => {
    const { state } = setupSupabase(makeInsightRow(), {
      review_id: "review-block-1",
      status: "BLOCK",
      approval_state: null,
      asset_id: "g12_trend_asmr_lipstick_001",
      ai_safe_rewrite: null,
      ai_caption_suggestions: [],
      ai_hook_suggestions: [],
      ai_human_review_recommendation: "Fix content",
      created_at: "2026-06-23T10:00:31.000Z",
      safe_summary: "This content was blocked because it includes an unsupported beauty or health claim.",
      failure_reasons: ["UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM"],
    });
    mockPostN8nWebhook.mockResolvedValueOnce({
      status: "BLOCK",
      message: "Blocked safely.",
      fail_reason: "UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM",
      failure_reasons: ["UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM"],
      review_id: "review-block-1",
      request_id: "req-3",
      sent_at: "2026-06-23T10:00:30.000Z",
      handled_at: "2026-06-23T10:00:31.000Z",
      http_status: 200,
      response_text: JSON.stringify({
        status: "BLOCK",
        fail_reason: "UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM",
        review_id: "review-block-1",
      }),
      webhook_url: "https://n8n.example/webhook/g4-content-landing-check",
      raw: {
        status: "BLOCK",
        fail_reason: "UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM",
        review_id: "review-block-1",
      },
    });

    const result = await sendG12TrendToContentDraft({
      insight_id: "insight-1",
      fetch_run_id: "run-1",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      status: "BLOCK",
      message: "Blocked safely.",
      already_sent: true,
      g4_review_id: "review-block-1",
    });
    expect(String(result.body.summary).toLowerCase()).toContain("beauty or health");
    expect(state.lastUpdate).toMatchObject({
      approval_status: "G4_BLOCKED",
    });
  });
});
