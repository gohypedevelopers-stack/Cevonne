import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import {
  G9_RECOMMENDATION_LABELS,
  G9_ATTENTION_STATUSES,
  G9_OPEN_STATUSES,
  G9_STATUS_LABELS,
  getFriendlyG9Reason,
  type G9Activity,
  type G9ActivityItem,
  type G9DateRange,
  type G9Metrics,
  type G9Overview,
  type G9Recommendation,
  type G9RecommendationFilter,
  type G9RecommendationKind,
  type G9RecommendationStatus,
  type G9SafetyCheck,
  type G9SafetyState,
  type G9StatusFilter,
} from "@/lib/admin/g9-ads-optimizer";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { env } from "@/server/config";
import {
  buildG9ApprovalPayload,
  buildG9DryRunPayload,
  canG9ReviewAndDecide,
  canG9RunDryRun,
  deriveG9UiState,
  getG9DryRunSignals,
  G9_ALREADY_COMPLETED_MESSAGE,
  isG9DryRunComplete,
  type G9ApprovalUiDecision,
  type G9DerivedState,
} from "./g9-state";

type JsonRecord = Record<string, unknown>;
type RecommendationRow = JsonRecord & {
  recommendation_id?: string;
  recommendation_type?: string;
  recommendation_summary?: string;
  platform?: string;
  action_type?: string;
  approval_status?: string;
  compliance_status?: string;
  risk_level?: string;
  raw_payload?: unknown;
  reason_json?: unknown;
  rollback_payload?: unknown;
  created_at?: string;
  created_by?: string;
};
type ApprovalRow = JsonRecord & {
  approval_id?: string;
  recommendation_id?: string;
  approval_status?: string;
  requested_at?: string;
  decided_at?: string;
  reviewer_id?: string;
  reviewer_note?: string;
  rejection_reason?: string;
};
type ExecutionRow = JsonRecord & {
  execution_id?: string;
  recommendation_id?: string;
  approval_id?: string;
  status?: string;
  executed_at?: string;
  request_payload?: unknown;
  api_response?: unknown;
  executed_by?: string;
};

type Snapshot = {
  recommendations: RecommendationRow[];
  approvals: ApprovalRow[];
  executions: ExecutionRow[];
};

type ActionReference = {
  recommendationId: string;
  approvalId: string | null;
  issuedAt: number;
};

type WebhookLane = "REVIEW" | "APPROVAL" | "DRY_RUN";

export class G9ServiceError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "G9ServiceError";
    this.status = status;
  }
}

const SNAPSHOT_TTL_MS = 5_000;
const ACTION_REFERENCE_TTL_MS = 24 * 60 * 60 * 1_000;
const CONTROLLED_MARKERS = ["g9_controlled_", "controlled_review_test", "execution_test"];
const pendingActions = new Map<string, Promise<{ message: string }>>();
const completedActionCooldowns = new Map<string, number>();
const requestWindows = new Map<string, number[]>();
let snapshotCache: { expiresAt: number; value: Snapshot } | null = null;
let snapshotPromise: Promise<Snapshot> | null = null;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const asRecord = (value: unknown) => (isRecord(value) ? value : {});
const asText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const toUpper = (value: unknown) => asText(value)?.toUpperCase() ?? "";
const toIso = (value: unknown) => {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const pickText = (...values: unknown[]) => values.map(asText).find(Boolean) ?? null;
const pickNumber = (...values: unknown[]) => values.map(asNumber).find((value) => value !== null) ?? null;
const isControlled = (row: JsonRecord) => {
  const text = JSON.stringify(row).toLowerCase();
  return CONTROLLED_MARKERS.some((marker) => text.includes(marker));
};

const invalidateSnapshot = () => {
  snapshotCache = null;
  snapshotPromise = null;
};

const fetchSnapshot = async (): Promise<Snapshot> => {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) return snapshotCache.value;
  if (snapshotPromise) return snapshotPromise;

  const client = getN8nSupabaseAdmin();
  if (!client) throw new G9ServiceError("The ads data connection is not configured.", 503);

  snapshotPromise = Promise.all([
    client.from("ad_recommendations").select("recommendation_id,recommendation_type,recommendation_summary,platform,action_type,approval_status,compliance_status,risk_level,raw_payload,reason_json,rollback_payload,created_at,created_by").order("created_at", { ascending: false }).limit(50),
    client.from("ad_approval_requests").select("approval_id,recommendation_id,approval_status,requested_at,decided_at,reviewer_id,reviewer_note,rejection_reason").limit(150),
    client.from("ad_execution_logs").select("execution_id,recommendation_id,approval_id,status,executed_at,request_payload,api_response,executed_by").order("executed_at", { ascending: false }).limit(100),
  ]).then(([recommendationsResult, approvalsResult, executionsResult]) => {
    const error = recommendationsResult.error || approvalsResult.error || executionsResult.error;
    if (error) {
      console.error("[g9] data load failed", { code: error.code || "unknown" });
      throw new G9ServiceError("Ads recommendations could not be loaded. Check the connection and try again.", 502);
    }

    const value: Snapshot = {
      recommendations: ((recommendationsResult.data ?? []) as RecommendationRow[]).filter((row) => !isControlled(row)),
      approvals: ((approvalsResult.data ?? []) as ApprovalRow[]).filter((row) => !isControlled(row)),
      executions: ((executionsResult.data ?? []) as ExecutionRow[]).filter((row) => !isControlled(row)),
    };
    snapshotCache = { expiresAt: Date.now() + SNAPSHOT_TTL_MS, value };
    return value;
  }).finally(() => {
    snapshotPromise = null;
  });

  return snapshotPromise;
};

const getReferenceKey = () => createHash("sha256").update(`g9:${env.jwtSecret}`).digest();

const createActionReference = (value: ActionReference) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getReferenceKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
};

const readActionReference = (reference: string): ActionReference => {
  try {
    const payload = Buffer.from(reference, "base64url");
    if (payload.length < 29) throw new Error("invalid");
    const decipher = createDecipheriv("aes-256-gcm", getReferenceKey(), payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const parsed = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8")) as ActionReference;
    if (!parsed.recommendationId || !parsed.issuedAt || Date.now() - parsed.issuedAt > ACTION_REFERENCE_TTL_MS) throw new Error("expired");
    return parsed;
  } catch {
    throw new G9ServiceError("This recommendation has changed. Refresh the page and try again.", 409);
  }
};

const opaqueKey = (value: string) => createHash("sha256").update(`g9-activity:${env.jwtSecret}:${value}`).digest("base64url").slice(0, 18);

const rowTimestamp = (row: JsonRecord, fields: string[]) => {
  for (const field of fields) {
    const value = toIso(row[field]);
    if (value) return new Date(value).getTime();
  }
  return 0;
};

const getLatestByRecommendation = <T extends { recommendation_id?: string }>(rows: T[], timestampFields: string[]) => {
  const latest = new Map<string, T>();
  rows.forEach((row) => {
    const id = asText(row.recommendation_id);
    if (!id) return;
    const current = latest.get(id);
    if (!current || rowTimestamp(row, timestampFields) > rowTimestamp(current, timestampFields)) latest.set(id, row);
  });
  return latest;
};

const getLatestCompletedDryRunByRecommendation = (rows: ExecutionRow[]) =>
  getLatestByRecommendation(rows.filter((row) => isG9DryRunComplete(row)), ["executed_at"]);

const getRecommendationKind = (row: RecommendationRow): G9RecommendationKind => {
  const raw = asRecord(row.raw_payload);
  const source = [row.recommendation_type, row.action_type, raw.recommended_action, raw.recommendation_type].map(toUpper).join(" ");
  if (source.includes("PAUSE")) return "PAUSE";
  if (source.includes("DO_NOT_SCALE")) return "DO_NOT_SCALE";
  if (source.includes("FIX_FIRST") || source.includes("FIX")) return "FIX_FIRST";
  if (source.includes("BUDGET") || source.includes("SCALE")) return "INCREASE_BUDGET";
  if (source.includes("TEST")) return "TEST";
  if (source.includes("NO_ACTION") || source.includes("REVIEW_ONLY")) return "NO_ACTION";
  return "TEST";
};

const safetyState = (value: unknown): G9SafetyState => {
  const status = toUpper(value);
  if (["PASS", "PASSED", "APPROVED", "ACTIVE", "CLEAN", "OK"].includes(status)) return "PASSED";
  if (["BLOCK", "BLOCKED", "FAILED", "ERROR", "MANUAL_ONLY", "NEEDS_REVIEW", "MISSING", "UNKNOWN"].includes(status)) return "NEEDS_ATTENTION";
  return "NOT_AVAILABLE";
};

const safetyDetail = (state: G9SafetyState) => state === "PASSED" ? "Check passed" : state === "NEEDS_ATTENTION" ? "Review required" : "No result available";

const buildSafetyChecks = (row: RecommendationRow): G9SafetyCheck[] => {
  const raw = asRecord(row.raw_payload);
  const checks: Array<[string, unknown]> = [
    ["Compliance guard", row.compliance_status],
    ["Account health", raw.account_health_status ?? raw.g2_status],
    ["Audience consent", raw.consent_status ?? raw.g3_status],
    ["Creative approval", raw.creative_approval_status ?? raw.g4_status ?? raw.g5_status],
    ["Offer proof", raw.offer_proof_status ?? raw.g7_status],
    ["Creator rights", raw.creator_rights_status ?? raw.g8_status],
  ];
  return checks.map(([label, value]) => {
    const state = safetyState(value);
    return { label, state, detail: safetyDetail(state) };
  });
};

const collectReasonCodes = (row: RecommendationRow) => {
  const raw = asRecord(row.raw_payload);
  const reason = asRecord(row.reason_json);
  const candidates: unknown[] = [raw.reason_code, raw.block_reason, raw.compliance_reason, reason.reason_code, reason.code];
  [raw.reason_codes, raw.block_reasons, reason.reason_codes, reason.codes].forEach((value) => {
    if (Array.isArray(value)) candidates.push(...value);
  });
  const friendly = candidates.map(getFriendlyG9Reason).filter((value, index, all) => all.indexOf(value) === index);
  return friendly.length ? friendly : ["AI analysis prepared this recommendation from the available performance and safety checks."];
};

const buildMetrics = (row: RecommendationRow): G9Metrics => {
  const raw = asRecord(row.raw_payload);
  const metrics = asRecord(raw.metrics);
  const rollback = asRecord(row.rollback_payload);
  return {
    spend: pickNumber(metrics.spend, raw.spend),
    impressions: pickNumber(metrics.impressions, raw.impressions),
    clicks: pickNumber(metrics.clicks, raw.clicks),
    ctr: pickNumber(metrics.ctr, raw.ctr),
    cpc: pickNumber(metrics.cpc, raw.cpc),
    cpm: pickNumber(metrics.cpm, raw.cpm),
    purchases: pickNumber(metrics.purchases, raw.purchases),
    purchaseValue: pickNumber(metrics.purchase_value, raw.purchase_value),
    roas: pickNumber(metrics.roas, raw.roas),
    currentDailyBudget: pickNumber(raw.current_daily_budget, rollback.previous_daily_budget),
    suggestedDailyBudget: pickNumber(raw.proposed_daily_budget, rollback.proposed_daily_budget),
    currency: pickText(metrics.currency, raw.currency, process.env.STORE_CURRENCY) || "INR",
  };
};

const getPerformanceLabel = (metrics: G9Metrics) => {
  if (metrics.roas !== null) return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(metrics.roas)}× ROAS`;
  if (metrics.ctr !== null) return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(metrics.ctr)}% CTR`;
  if (metrics.clicks !== null) return `${new Intl.NumberFormat("en-IN").format(metrics.clicks)} clicks`;
  return "Not available";
};

const sanitizeRecommendation = (row: RecommendationRow, approval?: ApprovalRow, successfulExecution?: ExecutionRow): G9Recommendation | null => {
  const recommendationId = asText(row.recommendation_id);
  const createdAt = toIso(row.created_at);
  if (!recommendationId || !createdAt || toUpper(row.platform) !== "META") return null;
  const raw = asRecord(row.raw_payload);
  const kind = getRecommendationKind(row);
  const state = deriveG9UiState(row, approval, successfulExecution);
  const status = state.status;
  const metrics = buildMetrics(row);
  const reasons = collectReasonCodes(row);

  return {
    key: opaqueKey(`recommendation:${recommendationId}`),
    reference: createActionReference({ recommendationId, approvalId: asText(approval?.approval_id), issuedAt: Date.now() }),
    kind,
    kindLabel: G9_RECOMMENDATION_LABELS[kind],
    subjectLabel: pickText(raw.ad_name, raw.campaign_name, raw.adset_name) || (asText(row.ad_id) ? "Meta ad" : "Meta campaign"),
    mainReason: reasons[0],
    reasons,
    status,
    statusLabel: G9_STATUS_LABELS[status],
    performanceLabel: getPerformanceLabel(metrics),
    createdAt,
    requiresApproval: state.requiresApproval,
    canReview: canG9ReviewAndDecide(state, approval),
    canDryRun: canG9RunDryRun(state, approval),
    metrics,
    safetyChecks: buildSafetyChecks(row),
  };
};

const buildRecommendations = (snapshot: Snapshot) => {
  const approvals = getLatestByRecommendation(snapshot.approvals, ["decided_at", "requested_at"]);
  const executions = getLatestCompletedDryRunByRecommendation(snapshot.executions);
  return snapshot.recommendations
    .map((row) => sanitizeRecommendation(row, approvals.get(row.recommendation_id || ""), executions.get(row.recommendation_id || "")))
    .filter((item): item is G9Recommendation => Boolean(item));
};

export const getG9Recommendations = async (filters: { recommendation: G9RecommendationFilter; status: G9StatusFilter; dateRange: G9DateRange }) => {
  const recommendations = buildRecommendations(await fetchSnapshot());
  const days = filters.dateRange === "LAST_7_DAYS" ? 7 : filters.dateRange === "LAST_30_DAYS" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1_000;
  const matchesStatus = (item: G9Recommendation) => filters.status === "ALL" ||
    (filters.status === "OPEN" && G9_OPEN_STATUSES.includes(item.status)) ||
    (filters.status === "NEEDS_ATTENTION" && G9_ATTENTION_STATUSES.includes(item.status)) ||
    item.status === filters.status;
  return recommendations.filter((item) =>
    new Date(item.createdAt).getTime() >= cutoff &&
    (filters.recommendation === "ALL" || item.kind === filters.recommendation) &&
    matchesStatus(item)
  );
};

export const getG9Overview = async (): Promise<G9Overview> => {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1_000;
  const recommendations = buildRecommendations(await fetchSnapshot()).filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  const statusCount = (statuses: G9RecommendationStatus[]) => recommendations.filter((item) => statuses.includes(item.status)).length;
  return {
    counts: {
      openRecommendations: statusCount(G9_OPEN_STATUSES),
      pendingApproval: statusCount(["PENDING_APPROVAL"]),
      needsAttention: statusCount(G9_ATTENTION_STATUSES),
      dryRunsCompleted: statusCount(["DRY_RUN_COMPLETE"]),
    },
    connection: {
      metaAds: env.metaAccessToken && env.metaAdAccountId ? "CONNECTED" : "UNAVAILABLE",
      aiAnalysis: env.n8nBaseUrl && env.n8nG9ReviewPath ? "READY" : "UNAVAILABLE",
      executionMode: "SAFE_DRY_RUN",
      accountLabel: "Cevonne ad account",
    },
    lastUpdatedAt: recommendations[0]?.createdAt ?? null,
  };
};

const activityTime = (item: G9ActivityItem) => new Date(item.occurredAt).getTime();

export const getG9Activity = async (limit: number): Promise<G9Activity> => {
  const snapshot = await fetchSnapshot();
  const latestApprovals = getLatestByRecommendation(snapshot.approvals, ["decided_at", "requested_at"]);
  const latestExecutions = getLatestCompletedDryRunByRecommendation(snapshot.executions);
  const recommendationsById = new Map<string, G9Recommendation>();
  snapshot.recommendations.forEach((row) => {
    const recommendationId = asText(row.recommendation_id);
    if (!recommendationId) return;
    const recommendation = sanitizeRecommendation(row, latestApprovals.get(recommendationId), latestExecutions.get(recommendationId));
    if (recommendation) recommendationsById.set(recommendationId, recommendation);
  });
  const activityLink = (recommendationId: string | null) => {
    const recommendation = recommendationId ? recommendationsById.get(recommendationId) : null;
    const action = recommendation?.canDryRun ? "DRY_RUN" : recommendation?.canReview ? "REVIEW" : recommendation ? "VIEW" : null;
    return { recommendationKey: recommendation?.key ?? null, action } as const;
  };
  const recommendationItems: G9ActivityItem[] = snapshot.recommendations.flatMap((row) => {
    const occurredAt = toIso(row.created_at);
    const id = asText(row.recommendation_id);
    if (!occurredAt || !id) return [];
    const recommendation = recommendationsById.get(id);
    return [{
      key: opaqueKey(`rec:${id}`),
      ...activityLink(id),
      title: "Ad recommendation created",
      description: "Performance and safety checks produced a new recommendation.",
      statusLabel: recommendation?.statusLabel ?? "Ready for review",
      occurredAt,
    }];
  });
  const approvalItems: G9ActivityItem[] = snapshot.approvals.flatMap((row) => {
    const occurredAt = toIso(row.decided_at || row.requested_at);
    const id = asText(row.approval_id);
    const recommendationId = asText(row.recommendation_id);
    if (!occurredAt || !id || !recommendationId) return [];
    const status = toUpper(row.approval_status);
    const latest = latestApprovals.get(recommendationId);
    const recommendation = recommendationsById.get(recommendationId);
    const requestWasResolved = status === "PENDING" && asText(latest?.approval_id) !== id;
    const pendingCanBeReviewed = status === "PENDING" && !requestWasResolved && Boolean(recommendation?.canReview);
    const currentStateSupersedesPending = status === "PENDING" && !pendingCanBeReviewed && Boolean(recommendation);
    const label = requestWasResolved ? "Request resolved" : status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : status === "NEEDS_CHANGES" ? "Changes requested" : "Pending approval";
    return [{
      key: opaqueKey(`approval:${id}`),
      ...activityLink(recommendationId),
      title: currentStateSupersedesPending && recommendation?.status === "BLOCKED"
        ? "Recommendation blocked"
        : currentStateSupersedesPending && recommendation?.status === "NO_ACTION"
          ? "No action needed"
          : status === "PENDING"
            ? "Approval requested"
            : status === "APPROVED"
              ? "Recommendation approved"
              : status === "REJECTED"
                ? "Recommendation rejected"
                : "Changes requested",
      description: currentStateSupersedesPending && recommendation?.status === "BLOCKED"
        ? "Safety checks stopped this recommendation before an approval decision."
        : currentStateSupersedesPending && recommendation?.status === "NO_ACTION"
          ? "This recommendation is advisory only and does not require approval."
          : requestWasResolved
            ? "This approval request has already received a decision."
            : "A human review updated an ad recommendation.",
      statusLabel: currentStateSupersedesPending ? recommendation!.statusLabel : label,
      occurredAt,
    }];
  });
  const executionItems: G9ActivityItem[] = snapshot.executions.flatMap((row) => {
    const occurredAt = toIso(row.executed_at);
    const id = asText(row.execution_id);
    const recommendationId = asText(row.recommendation_id);
    if (!occurredAt || !id) return [];
    const dryRun = isG9DryRunComplete(row);
    const latestCompleted = recommendationId ? latestExecutions.get(recommendationId) : null;
    if (dryRun && latestCompleted && asText(latestCompleted.execution_id) !== id) return [];
    return [{
      key: opaqueKey(`execution:${id}`),
      ...activityLink(recommendationId),
      title: dryRun ? "Dry run completed" : "Execution reviewed",
      description: dryRun ? "The approved change was safely simulated. No live ad was changed." : "The execution record requires review.",
      statusLabel: dryRun ? "Dry run complete" : "Needs review",
      occurredAt,
    }];
  });
  const all = [...recommendationItems, ...approvalItems, ...executionItems]
    .filter((item) => Boolean(item.recommendationKey))
    .sort((a, b) => activityTime(b) - activityTime(a));
  return { items: all.slice(0, limit), hasMore: all.length > limit };
};

const webhookPath = (lane: WebhookLane) => lane === "REVIEW" ? env.n8nG9ReviewPath : lane === "APPROVAL" ? env.n8nG9ApprovalDecisionPath : env.n8nG9ExecuteApprovedActionPath;

const findReasonCode = (value: unknown, depth = 0): string | null => {
  if (depth > 3) return null;
  if (typeof value === "string" && /^[A-Z][A-Z0-9_]{5,}$/.test(value.trim())) return value.trim();
  if (Array.isArray(value)) return value.map((item) => findReasonCode(item, depth + 1)).find(Boolean) ?? null;
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (["reason", "reason_code", "code", "block_reason"].includes(key.toLowerCase())) {
        const found = findReasonCode(nested, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
};

const findResponseField = (value: unknown, fieldNames: string[], depth = 0): string | null => {
  if (depth > 3) return null;
  if (Array.isArray(value)) return value.map((item) => findResponseField(item, fieldNames, depth + 1)).find(Boolean) ?? null;
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (fieldNames.includes(key.toLowerCase())) {
      const text = asText(nested);
      if (text) return text;
    }
  }
  return Object.values(value).map((nested) => findResponseField(nested, fieldNames, depth + 1)).find(Boolean) ?? null;
};

const responseSignalsFailure = (value: unknown, depth = 0): boolean => {
  if (depth > 3) return false;
  if (Array.isArray(value)) return value.some((item) => responseSignalsFailure(item, depth + 1));
  if (!isRecord(value)) return false;
  if (value.success === false || value.ok === false) return true;
  const responseType = toUpper(value.response_type || value.type || value.status);
  if (["ERROR", "FAILED", "FAILURE", "BLOCKED"].includes(responseType)) return true;
  return Object.values(value).some((nested) => responseSignalsFailure(nested, depth + 1));
};

const postG9Webhook = async (lane: WebhookLane, payload: JsonRecord) => {
  const base = env.n8nBaseUrl.trim().replace(/\/+$/, "");
  const path = webhookPath(lane).trim().replace(/^\/+/, "");
  if (!base || !path || /^https?:/i.test(path)) throw new G9ServiceError("The ads automation connection is not configured.", 503);
  try {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text.trim()) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok || responseSignalsFailure(data)) {
      const failReason = findResponseField(data, ["fail_reason", "reason_code", "reason", "code", "message", "error"]);
      const reasonCode = findReasonCode(data);
      const reason = reasonCode || failReason;
      const responseType = findResponseField(data, ["response_type", "type", "status"]);
      console.error("[g9] automation request failed", {
        lane,
        status: response.status,
        responseType: responseType ? responseType.slice(0, 80) : null,
        reasonCode: reasonCode ?? "unclassified",
      });
      throw new G9ServiceError(reason ? getFriendlyG9Reason(reason) : "This recommendation requires technical review.", response.status === 429 ? 429 : 502);
    }
  } catch (error) {
    if (error instanceof G9ServiceError) throw error;
    console.error("[g9] automation connection failed", { lane, name: error instanceof Error ? error.name : "unknown" });
    throw new G9ServiceError("The ads automation could not be reached. Check the connection and try again.", 502);
  }
};

const enforceRateLimit = (actor: string, action: string, limit: number) => {
  const key = `${actor}:${action}`;
  const cutoff = Date.now() - 5 * 60 * 1_000;
  const recent = (requestWindows.get(key) ?? []).filter((time) => time >= cutoff);
  if (recent.length >= limit) throw new G9ServiceError("Please wait a few minutes before trying this action again.", 429);
  recent.push(Date.now());
  requestWindows.set(key, recent);
};

const dedupeAction = (key: string, duplicateMessage: string, task: () => Promise<{ message: string }>) => {
  const cooldownUntil = completedActionCooldowns.get(key) ?? 0;
  if (cooldownUntil > Date.now()) return Promise.resolve({ message: duplicateMessage });
  const existing = pendingActions.get(key);
  if (existing) return existing;
  const pending = task()
    .then((result) => {
      completedActionCooldowns.set(key, Date.now() + 60_000);
      return result;
    })
    .finally(() => pendingActions.delete(key));
  pendingActions.set(key, pending);
  return pending;
};

const loadG9ActionContext = async (recommendationId: string) => {
  const client = getN8nSupabaseAdmin();
  if (!client) throw new G9ServiceError("The ads data connection is not configured.", 503);
  const [recommendationResult, approvalsResult, executionsResult] = await Promise.all([
    client.from("ad_recommendations").select("recommendation_id,recommendation_type,action_type,platform,approval_status,compliance_status,risk_level,raw_payload,created_at,created_by").eq("recommendation_id", recommendationId).maybeSingle(),
    client.from("ad_approval_requests").select("approval_id,recommendation_id,approval_status,requested_at,decided_at,reviewer_id,reviewer_note,rejection_reason").eq("recommendation_id", recommendationId).limit(50),
    client.from("ad_execution_logs").select("execution_id,recommendation_id,approval_id,status,executed_at,request_payload,api_response,executed_by").eq("recommendation_id", recommendationId).order("executed_at", { ascending: false }).limit(50),
  ]);
  if (recommendationResult.error || approvalsResult.error || executionsResult.error) {
    console.error("[g9] action lookup failed", {
      recommendationFound: Boolean(recommendationResult.data),
      approvalLookupFailed: Boolean(approvalsResult.error),
      executionLookupFailed: Boolean(executionsResult.error),
    });
    throw new G9ServiceError("This recommendation could not be verified. Refresh and try again.", 502);
  }
  const row = recommendationResult.data as RecommendationRow | null;
  if (!row || isControlled(row) || toUpper(row.platform) !== "META") throw new G9ServiceError("This recommendation is no longer available.", 404);
  const approvals = ((approvalsResult.data ?? []) as ApprovalRow[]).filter((item) => !isControlled(item));
  const executions = ((executionsResult.data ?? []) as ExecutionRow[]).filter((item) => !isControlled(item));
  const approval = getLatestByRecommendation(approvals, ["decided_at", "requested_at"]).get(recommendationId);
  const successfulExecution = getLatestCompletedDryRunByRecommendation(executions).get(recommendationId);
  const state = deriveG9UiState(row, approval, successfulExecution);
  if (process.env.NODE_ENV !== "production") {
    const signals = getG9DryRunSignals(successfulExecution);
    console.info("[g9-state]", {
      recommendationFound: true,
      latestApprovalFound: Boolean(approval),
      latestApprovalDecision: toUpper(approval?.approval_status) || null,
      latestExecutionFound: Boolean(successfulExecution),
      executionResponseType: signals.responseType || null,
      executionMode: signals.executionMode || null,
      dryRun: signals.dryRun,
      notExecuted: signals.notExecuted,
      externalActionAttempted: signals.externalActionAttempted,
      derivedState: state.status,
    });
  }
  return { row, approval, successfulExecution, state };
};

export const runG9Review = async (input: { dateRange: G9DateRange; note: string | null }, actor: string) => {
  enforceRateLimit(actor, "review", 3);
  if (!env.metaAdAccountId) throw new G9ServiceError("The Cevonne ad account is not configured.", 503);
  const presets: Record<G9DateRange, string> = { LAST_7_DAYS: "last_7d", LAST_30_DAYS: "last_30d", LAST_90_DAYS: "last_90d" };
  return dedupeAction(`review:${actor}:${input.dateRange}`, "This ad review is already in progress. Refresh in a moment.", async () => {
    await postG9Webhook("REVIEW", {
      platform: "META",
      action_type: "ADS_REVIEW",
      fetch_live_metrics: true,
      account_id: env.metaAdAccountId,
      date_preset: presets[input.dateRange],
      requested_by: actor,
      reviewer_note: input.note,
    });
    invalidateSnapshot();
    return { message: "Ad performance analysis started. New recommendations will appear when the review finishes." };
  });
};

export const decideG9Recommendation = async (input: { reference: string; decision: G9ApprovalUiDecision; note: string | null }, actor: string) => {
  enforceRateLimit(actor, "approval", 10);
  const reference = readActionReference(input.reference);
  const context = await loadG9ActionContext(reference.recommendationId);
  if (!canG9ReviewAndDecide(context.state, context.approval)) {
    if (context.state.status === "NO_ACTION") throw new G9ServiceError("No action is needed for this recommendation.", 409);
    if (context.state.status === "BLOCKED" || context.state.status === "NEEDS_REVIEW") throw new G9ServiceError("This recommendation is not eligible for an approval decision.", 409);
    throw new G9ServiceError("The approval request is no longer available. Refresh the recommendation.", 409);
  }
  const approvalId = asText(context.approval?.approval_id);
  if (!approvalId) throw new G9ServiceError("The approval request could not be found. Refresh the recommendation.", 409);
  return dedupeAction(`approval:${reference.recommendationId}:${input.decision}`, "This decision was already submitted. Refresh to see the latest status.", async () => {
    await postG9Webhook("APPROVAL", buildG9ApprovalPayload({
      recommendationId: reference.recommendationId,
      approvalId,
      decision: input.decision,
      reviewerId: actor,
      note: input.note,
    }));
    invalidateSnapshot();
    if (input.decision === "APPROVE") return { message: "Approved for safe dry run." };
    if (input.decision === "REQUEST_CHANGES") return { message: "Changes requested." };
    return { message: "Recommendation rejected." };
  });
};

export const runG9DryRun = async (input: { reference: string }, actor: string) => {
  enforceRateLimit(actor, "dry-run", 10);
  const reference = readActionReference(input.reference);
  const context = await loadG9ActionContext(reference.recommendationId);
  if (context.state.status === "DRY_RUN_COMPLETE") {
    invalidateSnapshot();
    return { message: G9_ALREADY_COMPLETED_MESSAGE, alreadyCompleted: true, state: "DRY_RUN_COMPLETE" as const };
  }
  if (!canG9RunDryRun(context.state, context.approval)) {
    if (context.state.status === "NO_ACTION") throw new G9ServiceError("No action is needed for this recommendation.", 409);
    throw new G9ServiceError("This recommendation is not currently approved for a dry run.", 409);
  }
  const approvalId = asText(context.approval?.approval_id);
  const actionType = context.state.actionType;
  if (!approvalId || !actionType) throw new G9ServiceError("This recommendation is not currently approved for a dry run.", 409);
  return dedupeAction(`dry-run:${reference.recommendationId}:${approvalId}`, "This dry run was already submitted. Refresh to see the latest status.", async () => {
    try {
      await postG9Webhook("DRY_RUN", buildG9DryRunPayload({
        recommendationId: reference.recommendationId,
        approvalId,
        actionType,
        actor,
      }));
    } catch (error) {
      if (error instanceof G9ServiceError && /already.*(completed|executed)|dry run.*complete/i.test(error.message)) {
        invalidateSnapshot();
        return { message: G9_ALREADY_COMPLETED_MESSAGE, alreadyCompleted: true, state: "DRY_RUN_COMPLETE" as const };
      }
      throw error;
    }
    invalidateSnapshot();
    return { message: "Dry run completed. No live Meta ad was changed.", alreadyCompleted: false, state: "DRY_RUN_COMPLETE" as const };
  });
};
