import "server-only";

import { randomUUID } from "node:crypto";

import type {
  G8ActionName,
  G8ActionResponse,
  G8CreatorPerformance,
  G8DashboardData,
  G8DashboardSummary,
  G8FriendlyStatus,
  G8StepState,
  G8UgcItem,
  G8WorkflowStep,
} from "@/lib/admin/g8-creator-proof";
import { buildN8nWebhookUrl } from "@/lib/n8n-client";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { env } from "@/server/config";
import { callG2Webhook } from "@/server/next/api/g2-proxy";

type JsonRecord = Record<string, unknown>;

type UgcRow = {
  ugc_id: string;
  source_event: string | null;
  creator_username: string | null;
  creator_display_name: string | null;
  source_url: string | null;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  attribution_text: string | null;
  permission_status: string | null;
  rights_status: string | null;
  allowed_uses: string[] | null;
  ad_usage_allowed: boolean | null;
  editing_allowed: boolean | null;
  territory: string | null;
  rights_end_at: string | null;
  brand_safety_status: string | null;
  disclosure_status: string | null;
  relationship_type: string | null;
  asset_status: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

type PermissionRow = {
  ugc_id: string;
  decision: string | null;
  status: string | null;
  rights_end_at: string | null;
  allowed_uses: string[] | null;
  ad_usage_allowed: boolean | null;
  editing_allowed: boolean | null;
  territory: string | null;
  attribution_text: string | null;
  created_at: string;
};

type SafetyRow = {
  ugc_id: string;
  safety_decision: string | null;
  failure_reasons: string[] | null;
  created_at: string;
};

type DisclosureRow = {
  ugc_id: string;
  relationship_type: string | null;
  disclosure_status: string | null;
  failure_reasons: string[] | null;
  created_at: string;
};

type HandoffRow = {
  handoff_id: string;
  ugc_id: string;
  handoff_status: string | null;
  g4_status: string | null;
  g5_status: string | null;
  g5_asset_id: string | null;
  g5_approval_id: string | null;
  failure_reasons: string[] | null;
  created_at: string;
  updated_at: string | null;
};

type ManualTaskRow = {
  ugc_id: string;
  task_type: string | null;
  status: string | null;
  instructions: string | null;
  created_at: string;
};

type TrackingRow = {
  tracking_id: string;
  creator_username: string | null;
  creator_fee: number | string | null;
  currency: string | null;
  clicks: number | string | null;
  leads: number | string | null;
  purchases: number | string | null;
  revenue: number | string | null;
  roi: number | string | null;
};

type PerformanceEventRow = {
  tracking_id: string | null;
  creator_platform_id: string | null;
  event_type: string | null;
  value: number | string | null;
  currency: string | null;
};

type G8Source = {
  ugcRows: UgcRow[];
  permissionRows: PermissionRow[];
  safetyRows: SafetyRow[];
  disclosureRows: DisclosureRow[];
  handoffRows: HandoffRow[];
  manualTaskRows: ManualTaskRow[];
  trackingRows: TrackingRow[];
  performanceRows: PerformanceEventRow[];
};

type G8WebhookResult = {
  httpStatus: number;
  workflowStatus: string;
  message: string | null;
  failureReasons: string[];
  raw: JsonRecord;
};

export type G8IntakeInput = {
  mediaId: string | null;
  sourceUrl: string | null;
  creatorUsername: string;
  creatorDisplayName: string | null;
  mentionedBrand: boolean;
  taggedBrand: boolean;
  mediaType: string;
  caption: string;
};

export type G8PermissionInput = {
  itemKey: string;
  reviewerNote: string | null;
};

export type G8SafetyInput = {
  itemKey: string;
  musicRights: "PASS" | "NOT_APPLICABLE" | "BLOCK";
  reviewerNote: string | null;
  blockReason: string | null;
};

export type G8DisclosureInput = {
  itemKey: string;
  relationshipType: "ORGANIC" | "GIFTED" | "PAID" | "AFFILIATE";
  disclosureText: string | null;
  disclosureVisible: boolean;
  evidenceUrl: string | null;
  paidPartnershipLabel: boolean;
  reviewerNote: string | null;
};

export type G8ApprovalInput = {
  itemKey: string;
  assetTitle: string;
  contentText: string;
};

export type G8RevocationInput = {
  itemKey: string;
  reason: string;
  evidenceUrl: string;
};

export type G8ActionInput =
  | ({ action: "INTAKE" } & G8IntakeInput)
  | ({ action: "PERMISSION_YES" | "PERMISSION_NO" } & G8PermissionInput)
  | ({ action: "SAFETY_PASS" | "SAFETY_BLOCK" } & G8SafetyInput)
  | ({ action: "DISCLOSURE" } & G8DisclosureInput)
  | ({ action: "SEND_FOR_APPROVAL" } & G8ApprovalInput)
  | ({ action: "REVOKE_PERMISSION" } & G8RevocationInput);

const G8_TIMEOUT_MS = 30_000;
const pendingActions = new Map<string, Promise<G8ActionResponse>>();
const pendingG5Callbacks = new Map<string, Promise<void>>();

const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase();
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const textOrNull = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const latestByUgc = <T extends { ugc_id: string; created_at: string }>(rows: T[]) => {
  const output = new Map<string, T>();
  [...rows]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .forEach((row) => {
      if (!output.has(row.ugc_id)) output.set(row.ugc_id, row);
    });
  return output;
};

const friendlyFailureMessages: Record<string, string> = {
  VALID_UGC_ID_REQUIRED: "We could not identify this UGC item.",
  CHILDREN_VISIBLE_BLOCKED: "This content cannot be reused because a child or minor is visible.",
  COMPETITOR_PRODUCT_VISIBLE_BLOCKED: "A competitor product is visible in this content.",
  CLAIM_RISK_NOT_PASS: "The content contains claims that require review.",
  COPYRIGHT_STATUS_NOT_PASS: "Copyright clearance has not been confirmed.",
  MUSIC_RIGHTS_STATUS_NOT_PASS: "Music usage rights have not been confirmed.",
  PERMISSION_NOT_GRANTED: "Creator permission is required before this can continue.",
  RIGHTS_NOT_ACTIVE: "Creator rights are not currently active.",
  RIGHTS_EXPIRED: "Creator permission has expired.",
  DISCLOSURE_NOT_PASS: "The disclosure review must be completed first.",
  BRAND_SAFETY_NOT_PASS: "The safety review must be completed first.",
  G4_BLOCK: "The content review found an issue that needs attention.",
  G5_REJECTED: "The content was declined during human approval.",
};

const safetyBlockNotes: Record<string, string> = {
  CHILD_VISIBLE: "A child or minor is visible.",
  COMPETITOR_VISIBLE: "A competitor product is visible.",
  PRIVATE_CONTENT: "Private or sensitive content is visible.",
  PROHIBITED_CONTENT: "Prohibited or sexual content is visible.",
  CLAIM_RISK: "Product or beauty claims require review.",
  COPYRIGHT_NOT_CLEARED: "Copyright use has not been cleared.",
  MUSIC_NOT_CLEARED: "Music rights have not been cleared.",
};

const friendlyFailure = (values: Array<string | null | undefined>, fallback: string) => {
  for (const value of values) {
    const code = normalize(value);
    if (!code) continue;
    if (friendlyFailureMessages[code]) return friendlyFailureMessages[code];
    for (const [knownCode, message] of Object.entries(friendlyFailureMessages)) {
      if (code.includes(knownCode)) return message;
    }
  }
  return fallback;
};

const mapSourceType = (row: UgcRow) => {
  const source = `${row.source_event ?? ""} ${row.media_type ?? ""}`.toUpperCase();
  if (source.includes("STORY")) return "Story mention";
  if (source.includes("REEL") || source.includes("VIDEO")) return "Reel";
  if (source.includes("FEED") || source.includes("POST")) return "Feed post";
  return "Manual intake";
};

const relationType = (value: unknown): G8UgcItem["relationshipType"] => {
  const normalized = normalize(value);
  if (normalized === "GIFTED" || normalized === "PAID" || normalized === "AFFILIATE") return normalized;
  return "ORGANIC";
};

const rightsAreExpired = (value: string | null) => Boolean(value && Date.parse(value) <= Date.now());
const permissionGranted = (permission: string, rights: string) =>
  ["APPROVED", "GRANTED", "YES", "PASS"].includes(permission) && rights === "ACTIVE";
const permissionDeclined = (permission: string) => ["DECLINED", "DENIED", "NO", "REJECTED"].includes(permission);
const safetyPassed = (value: string) => value === "PASS";
const disclosurePassed = (value: string) => ["PASS", "NOT_REQUIRED"].includes(value);
const isBlockedStatus = (value: string) => ["BLOCK", "BLOCKED", "DECLINED", "DENIED", "REJECTED", "REVOKED"].includes(value);

const makeStep = (label: string, state: G8StepState): G8WorkflowStep => ({ label, state });

const deriveItem = (
  row: UgcRow,
  permissionRow: PermissionRow | undefined,
  safetyRow: SafetyRow | undefined,
  disclosureRow: DisclosureRow | undefined,
  handoff: HandoffRow | undefined,
): G8UgcItem => {
  const permission = normalize(permissionRow?.decision || permissionRow?.status || row.permission_status);
  const rights = normalize(row.rights_status);
  const safety = normalize(safetyRow?.safety_decision || row.brand_safety_status);
  const disclosure = normalize(disclosureRow?.disclosure_status || row.disclosure_status);
  const overall = normalize(row.status);
  const asset = normalize(row.asset_status);
  const handoffStatus = normalize(handoff?.handoff_status);
  const g4Status = normalize(handoff?.g4_status);
  const g5Status = normalize(handoff?.g5_status);
  const expiresAt = permissionRow?.rights_end_at || row.rights_end_at;
  const expired = rights === "EXPIRED" || rightsAreExpired(expiresAt);
  const revoked = rights === "REVOKED";
  const declined = permissionDeclined(permission);
  const granted = permissionGranted(permission, rights) && !expired && !revoked;
  const safetyBlock = isBlockedStatus(safety);
  const approvalBlock = isBlockedStatus(handoffStatus) || isBlockedStatus(g4Status) || isBlockedStatus(g5Status) || isBlockedStatus(asset);
  const terminalBlock = declined || revoked || expired || safetyBlock || approvalBlock || overall === "BLOCK";
  const pendingApproval = [handoffStatus, g5Status, asset, overall].some((value) => ["PENDING", "PENDING_APPROVAL", "WAITING_APPROVAL", "AWAITING_APPROVAL"].includes(value));
  const ready = [g5Status, asset, overall].some((value) => ["APPROVED", "READY", "PASS"].includes(value));

  let currentStatus: G8FriendlyStatus;
  let nextAction: string;
  if (revoked) {
    currentStatus = "Rights Revoked";
    nextAction = "No further use is allowed";
  } else if (declined) {
    currentStatus = "Permission Declined";
    nextAction = "No further action";
  } else if (expired) {
    currentStatus = "Rights Expired";
    nextAction = "Request new permission";
  } else if (safetyBlock) {
    currentStatus = "Safety Blocked";
    nextAction = "Keep content blocked";
  } else if (approvalBlock || overall === "BLOCK") {
    currentStatus = "Blocked";
    nextAction = "Review the content decision";
  } else if (!granted) {
    currentStatus = permission === "PENDING" || overall === "MANUAL_ONLY" ? "Awaiting Permission" : "Permission Required";
    nextAction = "Record creator response";
  } else if (!safetyPassed(safety)) {
    currentStatus = "Safety Review Needed";
    nextAction = "Complete safety review";
  } else if (!disclosurePassed(disclosure)) {
    currentStatus = "Disclosure Review Needed";
    nextAction = "Complete disclosure review";
  } else if (pendingApproval) {
    currentStatus = "Waiting for Approval";
    nextAction = "Wait for human approval";
  } else if (ready) {
    currentStatus = "Ready";
    nextAction = "Ready for approved reuse";
  } else if (overall === "ERROR") {
    currentStatus = "Could Not Complete";
    nextAction = "Retry the current step";
  } else if (overall === "NEEDS_EVIDENCE") {
    currentStatus = "Needs Review";
    nextAction = "Review the missing requirement";
  } else {
    currentStatus = disclosure === "NOT_REQUIRED" ? "Disclosure Not Required" : "Disclosure Passed";
    nextAction = "Send for content approval";
  }

  const permissionState: G8StepState = terminalBlock ? "BLOCKED" : granted ? "COMPLETE" : "CURRENT";
  const safetyState: G8StepState = safetyBlock ? "BLOCKED" : safetyPassed(safety) ? "COMPLETE" : granted ? "CURRENT" : "NOT_STARTED";
  const disclosureState: G8StepState = terminalBlock && !safetyPassed(safety) ? "BLOCKED" : disclosurePassed(disclosure) ? "COMPLETE" : safetyPassed(safety) ? "CURRENT" : "NOT_STARTED";
  const contentState: G8StepState = approvalBlock && g4Status !== "PASS" ? "BLOCKED" : g4Status === "PASS" || ready || pendingApproval ? "COMPLETE" : disclosurePassed(disclosure) ? "CURRENT" : "NOT_STARTED";
  const approvalState: G8StepState = isBlockedStatus(g5Status) ? "BLOCKED" : ready ? "COMPLETE" : pendingApproval ? "CURRENT" : "NOT_STARTED";
  const readyState: G8StepState = ready ? "COMPLETE" : terminalBlock ? "BLOCKED" : "NOT_STARTED";

  const latestFailures = [
    ...(safetyRow?.failure_reasons ?? []),
    ...(disclosureRow?.failure_reasons ?? []),
    ...(handoff?.failure_reasons ?? []),
  ];

  return {
    itemKey: row.ugc_id,
    creatorUsername: row.creator_username?.trim() || "Creator",
    creatorDisplayName: textOrNull(row.creator_display_name),
    caption: row.caption?.trim() || "No caption provided.",
    mediaUrl: textOrNull(row.media_url),
    sourceUrl: textOrNull(row.source_url),
    mediaType: row.media_type?.trim() || "UNKNOWN",
    sourceType: mapSourceType(row),
    receivedAt: row.created_at,
    currentStatus,
    nextAction,
    permissionLabel: declined ? "Permission Declined" : granted ? "Permission Granted" : "Awaiting Permission",
    rightsLabel: revoked ? "Rights Revoked" : expired ? "Rights Expired" : rights === "ACTIVE" ? "Active" : "Permission Required",
    rightsExpiresAt: expiresAt || null,
    safetyLabel: safetyBlock ? "Safety Blocked" : safetyPassed(safety) ? "Safety Passed" : "Safety Review Needed",
    disclosureLabel: disclosure === "NOT_REQUIRED" ? "Disclosure Not Required" : disclosure === "PASS" ? "Disclosure Passed" : "Disclosure Review Needed",
    approvalLabel: ready ? "Approved" : pendingApproval ? "Waiting for Approval" : approvalBlock ? "Declined" : "Not submitted",
    relationshipType: relationType(disclosureRow?.relationship_type || row.relationship_type),
    allowedUses: permissionRow?.allowed_uses || row.allowed_uses || [],
    adUsageAllowed: Boolean(permissionRow?.ad_usage_allowed ?? row.ad_usage_allowed),
    editingAllowed: Boolean(permissionRow?.editing_allowed ?? row.editing_allowed),
    territory: textOrNull(permissionRow?.territory || row.territory),
    attributionText: textOrNull(permissionRow?.attribution_text || row.attribution_text || row.creator_username),
    progress: [
      makeStep("UGC Received", "COMPLETE"),
      makeStep("Creator Permission", permissionState),
      makeStep("Safety Review", safetyState),
      makeStep("Disclosure Review", disclosureState),
      makeStep("Content Review", contentState),
      makeStep("Human Approval", approvalState),
      makeStep("Ready", readyState),
    ],
    canRecordPermission: !granted && !terminalBlock,
    canReviewSafety: granted && !safetyPassed(safety) && !terminalBlock,
    canReviewDisclosure: granted && safetyPassed(safety) && !disclosurePassed(disclosure) && !terminalBlock,
    canSendForApproval: granted && safetyPassed(safety) && disclosurePassed(disclosure) && !pendingApproval && !ready && !terminalBlock,
    canRevokePermission: granted,
    isTerminallyBlocked: terminalBlock,
    latestMessage: latestFailures.length ? friendlyFailure(latestFailures, "This item needs a manual review before it can continue.") : null,
  };
};

const queryRows = async <T>(table: string, select: string, orderBy = "created_at", limit = 500): Promise<T[]> => {
  const client = getN8nSupabaseAdmin();
  if (!client) throw new Error("G8 data connection is not configured.");

  const { data, error } = await client.from(table).select(select).order(orderBy, { ascending: false, nullsFirst: false }).limit(limit);
  if (error) {
    console.error("[g8] Supabase query failed", { table, message: error.message });
    throw new Error("G8 data could not be loaded.");
  }
  return (data ?? []) as T[];
};

const loadSource = async (): Promise<G8Source> => {
  const [ugcRows, permissionRows, safetyRows, disclosureRows, handoffRows, manualTaskRows, trackingRows, performanceRows] = await Promise.all([
    queryRows<UgcRow>("g8_v2_ugc_items", "ugc_id, source_event, creator_username, creator_display_name, source_url, media_url, media_type, caption, attribution_text, permission_status, rights_status, allowed_uses, ad_usage_allowed, editing_allowed, territory, rights_end_at, brand_safety_status, disclosure_status, relationship_type, asset_status, status, created_at, updated_at"),
    queryRows<PermissionRow>("g8_v2_permission_evidence", "ugc_id, decision, status, rights_end_at, allowed_uses, ad_usage_allowed, editing_allowed, territory, attribution_text, created_at"),
    queryRows<SafetyRow>("g8_v2_brand_safety_reviews", "ugc_id, safety_decision, failure_reasons, created_at"),
    queryRows<DisclosureRow>("g8_v2_disclosure_reviews", "ugc_id, relationship_type, disclosure_status, failure_reasons, created_at"),
    queryRows<HandoffRow>("g8_v2_asset_handoffs", "handoff_id, ugc_id, handoff_status, g4_status, g5_status, g5_asset_id, g5_approval_id, failure_reasons, created_at, updated_at"),
    queryRows<ManualTaskRow>("g8_v2_manual_tasks", "ugc_id, task_type, status, instructions, created_at"),
    queryRows<TrackingRow>("g8_v2_creator_tracking", "tracking_id, creator_username, creator_fee, currency, clicks, leads, purchases, revenue, roi"),
    queryRows<PerformanceEventRow>("g8_v2_performance_events", "tracking_id, creator_platform_id, event_type, value, currency"),
  ]);

  return { ugcRows, permissionRows, safetyRows, disclosureRows, handoffRows, manualTaskRows, trackingRows, performanceRows };
};

const buildPerformance = (trackingRows: TrackingRow[], events: PerformanceEventRow[]): G8CreatorPerformance[] => {
  const eventsByTracking = new Map<string, PerformanceEventRow[]>();
  events.forEach((event) => {
    if (!event.tracking_id) return;
    const current = eventsByTracking.get(event.tracking_id) ?? [];
    current.push(event);
    eventsByTracking.set(event.tracking_id, current);
  });

  return trackingRows
    .map((row) => {
      const rowEvents = eventsByTracking.get(row.tracking_id) ?? [];
      const eventCount = (type: string) => rowEvents.filter((event) => normalize(event.event_type).includes(type)).length;
      const eventValue = (type: string) => rowEvents.filter((event) => normalize(event.event_type).includes(type)).reduce((sum, event) => sum + toNumber(event.value), 0);
      const revenue = toNumber(row.revenue) || eventValue("REVENUE");
      const cost = toNumber(row.creator_fee);
      const storedRoi = row.roi === null ? null : toNumber(row.roi);
      return {
        creatorUsername: row.creator_username?.trim() || "Creator",
        clicks: toNumber(row.clicks) || eventCount("CLICK"),
        leads: toNumber(row.leads) || eventCount("LEAD"),
        purchases: toNumber(row.purchases) || eventCount("PURCHASE"),
        revenue,
        creatorCost: cost,
        roi: storedRoi ?? (cost > 0 ? ((revenue - cost) / cost) * 100 : null),
        currency: row.currency?.trim() || rowEvents.find((event) => event.currency)?.currency || "INR",
      };
    })
    .filter((row) => row.clicks > 0 || row.leads > 0 || row.purchases > 0 || row.revenue > 0 || row.creatorCost > 0);
};

const buildSummary = (items: G8UgcItem[]): G8DashboardSummary => ({
  total: items.length,
  awaitingPermission: items.filter((item) => item.currentStatus === "Awaiting Permission" || item.currentStatus === "Permission Required").length,
  needsReview: items.filter((item) => ["Safety Review Needed", "Disclosure Review Needed", "Needs Review", "Could Not Complete"].includes(item.currentStatus)).length,
  pendingApproval: items.filter((item) => item.currentStatus === "Waiting for Approval").length,
  readyApproved: items.filter((item) => item.currentStatus === "Ready").length,
});

export async function getG8DashboardData(actor = "website_admin", includeRemoteSummary = true): Promise<G8DashboardData> {
  const [source, remoteSummary] = await Promise.all([
    loadSource(),
    includeRemoteSummary
      ? postG8Webhook(env.n8nG8DashboardSummaryPath, { days: 30, actor }).catch((error) => {
          console.warn("[g8] dashboard summary webhook unavailable; using table counts", { message: error instanceof Error ? error.message : String(error) });
          return null;
        })
      : Promise.resolve(null),
  ]);
  const permissionMap = latestByUgc(source.permissionRows);
  const safetyMap = latestByUgc(source.safetyRows);
  const disclosureMap = latestByUgc(source.disclosureRows);
  const handoffMap = latestByUgc(source.handoffRows);
  const items = source.ugcRows.map((row) => deriveItem(row, permissionMap.get(row.ugc_id), safetyMap.get(row.ugc_id), disclosureMap.get(row.ugc_id), handoffMap.get(row.ugc_id)));

  const localSummary = buildSummary(items);
  const remoteRaw = remoteSummary?.httpStatus === 200 ? remoteSummary.raw : null;
  const remoteCount = (key: string, fallback: number) => typeof remoteRaw?.[key] === "number" ? Number(remoteRaw[key]) : fallback;

  return {
    summary: {
      ...localSummary,
      total: remoteCount("total_ugc", localSummary.total),
      awaitingPermission: remoteCount("pending_permission", localSummary.awaitingPermission),
      pendingApproval: remoteCount("pending_g5_approval", localSummary.pendingApproval),
    },
    items,
    performance: buildPerformance(source.trackingRows, source.performanceRows),
    refreshedAt: new Date().toISOString(),
  };
}

const parseWebhookBody = async (response: Response): Promise<JsonRecord | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const postG8Webhook = async (path: string, payload: JsonRecord): Promise<G8WebhookResult> => {
  const url = buildN8nWebhookUrl(path);
  if (!url) throw new Error("G8 webhook configuration is missing.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), G8_TIMEOUT_MS);
  const requestId = randomUUID();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cevonne-Source": "website-admin",
        "X-Cevonne-Request-Id": requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    const parsedBody = await parseWebhookBody(response);
    if (!parsedBody && ![202, 400, 422].includes(response.status)) {
      console.error("[g8] webhook returned an unreadable response", { path, httpStatus: response.status, requestId });
      throw new Error("G8 received an unreadable workflow response. Please try again.");
    }
    const raw = parsedBody ?? {};
    const failures = Array.isArray(raw.failure_reasons) ? raw.failure_reasons.filter((value): value is string => typeof value === "string") : [];
    const singleFailure = textOrNull(raw.fail_reason);
    if (singleFailure) failures.unshift(singleFailure);
    const workflowStatus = normalize(raw.status || raw.result || raw.decision || (response.status === 202 ? "PENDING" : response.ok ? "PASS" : "ERROR"));

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      console.error("[g8] webhook request failed", { path, httpStatus: response.status, workflowStatus, requestId });
      throw new Error("G8 could not reach the workflow service.");
    }

    return {
      httpStatus: response.status,
      workflowStatus,
      message: textOrNull(raw.message),
      failureReasons: failures,
      raw,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("G8 took longer than expected. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const mapWebhookResult = (result: G8WebhookResult, messages: { success: string; pending?: string; blocked: string }): G8ActionResponse => {
  const blocked = result.httpStatus === 400 || result.httpStatus === 422 || ["BLOCK", "BLOCKED", "DECLINED", "DENIED", "REJECTED", "ERROR"].includes(result.workflowStatus);
  if (blocked) {
    return {
      status: "BLOCKED",
      message: friendlyFailure(result.failureReasons, messages.blocked),
    };
  }
  if (result.httpStatus === 202 || ["PENDING", "PENDING_APPROVAL", "MANUAL_ONLY"].includes(result.workflowStatus)) {
    return { status: "PENDING", message: messages.pending || messages.success };
  }
  return { status: "SUCCESS", message: messages.success };
};

const resolveInstagramAccountId = async () => {
  if (env.metaInstagramAccountId.trim()) return env.metaInstagramAccountId.trim();
  try {
    const response = await callG2Webhook<JsonRecord>(env.n8nG2ListAccountsPath, {
      monitoring_enabled_only: false,
      requested_by: "g8_website_admin",
    });
    const accounts = Array.isArray(response.accounts) ? response.accounts.filter(isRecord) : [];
    const account = accounts.find((entry) => ["INSTAGRAM", "META"].includes(normalize(entry.platform)) && textOrNull(entry.account_id));
    const configuredId = textOrNull(account?.account_id);
    if (configuredId) return configuredId;
  } catch (error) {
    console.warn("[g8] Instagram account lookup through G2 failed", { message: error instanceof Error ? error.message : String(error) });
  }
  if (env.metaBusinessAccountId.trim()) return env.metaBusinessAccountId.trim();
  throw new Error("The Instagram publishing account is not configured yet.");
};

const getItem = async (itemKey: string) => {
  const dashboard = await getG8DashboardData("website_admin_action", false);
  const item = dashboard.items.find((entry) => entry.itemKey === itemKey);
  if (!item) throw new Error("We could not identify this UGC item.");
  return item;
};

const executeAction = async (input: G8ActionInput, actor: string): Promise<G8ActionResponse> => {
  if (input.action === "INTAKE") {
    const result = await postG8Webhook(env.n8nG8UgcIntakePath, {
      ugc_external_id: input.mediaId,
      source_url: input.sourceUrl,
      source_evidence_url: input.sourceUrl,
      creator_username: input.creatorUsername,
      creator_display_name: input.creatorDisplayName,
      mentioned_brand: input.mentionedBrand,
      tagged_brand: input.taggedBrand,
      media_type: input.mediaType,
      caption: input.caption,
      received_from: "WEBSITE_ADMIN",
      verified_by: actor,
      actor,
    });
    return mapWebhookResult(result, {
      success: "UGC saved. Creator permission is required before reuse.",
      pending: "UGC saved. Creator permission is required before reuse.",
      blocked: "This UGC could not be saved. Check the creator and source details.",
    });
  }

  const item = await getItem(input.itemKey);

  if (input.action === "PERMISSION_YES" || input.action === "PERMISSION_NO") {
    if (!item.canRecordPermission) throw new Error("A creator response cannot be recorded for this item now.");
    const yes = input.action === "PERMISSION_YES";
    const result = await postG8Webhook(env.n8nG8PermissionDecisionPath, {
      ugc_id: item.itemKey,
      creator_username: item.creatorUsername,
      decision: yes ? "YES" : "NO",
      proof_source: "MANYCHAT_FREE_ADMIN_CONFIRMED",
      reviewer_id: actor,
      reviewer_note: input.reviewerNote || `ManyChat ${yes ? "YES" : "NO"} response manually confirmed by admin.`,
      recorded_at: new Date().toISOString(),
      actor,
    });
    if (!yes && result.httpStatus < 400) {
      return { status: "SUCCESS", message: "Permission declined. This content will not be used." };
    }
    return mapWebhookResult(result, {
      success: yes ? "Permission granted." : "Permission declined. This content will not be used.",
      blocked: "The creator response could not be recorded. Please check the item and try again.",
    });
  }

  if (input.action === "SAFETY_PASS" || input.action === "SAFETY_BLOCK") {
    if (!item.canReviewSafety) throw new Error("Complete creator permission before the safety review.");
    const pass = input.action === "SAFETY_PASS";
    const blockCode = normalize(input.blockReason);
    const result = await postG8Webhook(env.n8nG8BrandSafetyCheckPath, {
      ugc_id: item.itemKey,
      safety_decision: pass ? "PASS" : "BLOCK",
      safety_score: pass ? 100 : 0,
      children_visible: blockCode === "CHILD_VISIBLE",
      competitor_product_visible: blockCode === "COMPETITOR_VISIBLE",
      private_or_sensitive_content: blockCode === "PRIVATE_CONTENT",
      prohibited_or_sexual_content: blockCode === "PROHIBITED_CONTENT",
      claim_risk_status: pass ? "PASS" : blockCode === "CLAIM_RISK" ? "BLOCK" : "PASS",
      copyright_status: pass ? "PASS" : blockCode === "COPYRIGHT_NOT_CLEARED" ? "BLOCK" : "PASS",
      music_rights_status: pass ? input.musicRights : blockCode === "MUSIC_NOT_CLEARED" ? "BLOCK" : input.musicRights,
      evidence_url: item.sourceUrl || item.mediaUrl,
      reviewer_id: actor,
      reviewer_note: input.reviewerNote || safetyBlockNotes[blockCode] || null,
      actor,
    });
    if (!pass && result.httpStatus < 400) {
      return { status: "SUCCESS", message: "Content blocked from reuse." };
    }
    return mapWebhookResult(result, {
      success: pass ? "Safety review passed." : "Content blocked from reuse.",
      blocked: pass ? "The safety review needs more attention before this can continue." : "Content blocked from reuse.",
    });
  }

  if (input.action === "DISCLOSURE") {
    if (!item.canReviewDisclosure) throw new Error("Complete the safety review before disclosure.");
    const organic = input.relationshipType === "ORGANIC";
    const result = await postG8Webhook(env.n8nG8DisclosureCheckPath, {
      ugc_id: item.itemKey,
      relationship_type: input.relationshipType,
      disclosure_required: !organic,
      disclosure_text: organic ? null : input.disclosureText,
      paid_partnership_label_present: input.relationshipType === "PAID" ? input.paidPartnershipLabel : false,
      disclosure_visible: organic ? false : input.disclosureVisible,
      evidence_url: organic ? item.sourceUrl || item.mediaUrl : input.evidenceUrl,
      reviewer_id: actor,
      reviewer_note: input.reviewerNote,
      actor,
    });
    return mapWebhookResult(result, {
      success: organic ? "Disclosure marked as not required." : "Disclosure review passed.",
      blocked: "The disclosure details need review before this can continue.",
    });
  }

  if (input.action === "SEND_FOR_APPROVAL") {
    if (!item.canSendForApproval) throw new Error("Complete permission, safety and disclosure before sending this content.");
    const accountId = await resolveInstagramAccountId();
    const result = await postG8Webhook(env.n8nG8CreateApprovedAssetPath, {
      ugc_id: item.itemKey,
      requested_use: "ORGANIC_SOCIAL",
      asset_type: "UGC_REEL_DRAFT",
      platform: "INSTAGRAM",
      account_id: accountId,
      asset_title: input.assetTitle,
      content_text: input.contentText,
      media_url: item.mediaUrl,
      source_url: item.sourceUrl,
      relationship_type: item.relationshipType,
      actor,
    });
    return mapWebhookResult(result, {
      success: "Content is ready.",
      pending: "Sent to human approval.",
      blocked: "Content could not move forward. Review the content requirements and try again.",
    });
  }

  if (input.action !== "REVOKE_PERMISSION") throw new Error("This G8 action is not supported.");
  if (!item.canRevokePermission) throw new Error("There are no active rights to revoke for this item.");
  const result = await postG8Webhook(env.n8nG8PermissionRevokePath, {
    ugc_id: item.itemKey,
    revocation_reason: input.reason,
    evidence_url: input.evidenceUrl,
    reviewer_id: actor,
    revoked_at: new Date().toISOString(),
    actor,
  });
  return mapWebhookResult(result, {
    success: "Permission revoked. This content can no longer be used.",
    blocked: "Permission could not be revoked. Please try again.",
  });
};

export async function performG8Action(input: G8ActionInput, actor: string): Promise<G8ActionResponse> {
  const action = input.action as G8ActionName;
  const itemKey = "itemKey" in input ? input.itemKey : `${input.creatorUsername}:${input.mediaId || input.sourceUrl}`;
  const dedupeKey = `${action}:${itemKey}`;
  const existing = pendingActions.get(dedupeKey);
  if (existing) return existing;

  const promise = executeAction(input, actor).finally(() => pendingActions.delete(dedupeKey));
  pendingActions.set(dedupeKey, promise);
  return promise;
}

export async function notifyG8OfG5Decision(input: {
  assetId: string;
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  reviewerId: string;
  reviewerNote: string | null;
}) {
  const callbackKey = `${input.assetId}:${input.approvalId}:${input.decision}`;
  const pending = pendingG5Callbacks.get(callbackKey);
  if (pending) return pending;

  const callback = notifyG8OfG5DecisionOnce(input).finally(() => pendingG5Callbacks.delete(callbackKey));
  pendingG5Callbacks.set(callbackKey, callback);
  return callback;
}

async function notifyG8OfG5DecisionOnce(input: {
  assetId: string;
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  reviewerId: string;
  reviewerNote: string | null;
}) {
  const client = getN8nSupabaseAdmin();
  if (!client) return;
  const select = "handoff_id, ugc_id, g5_asset_id, g5_approval_id, g5_status";
  const byAsset = await client
    .from("g8_v2_asset_handoffs")
    .select(select)
    .eq("g5_asset_id", input.assetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const byApproval = byAsset.data ? null : await client
    .from("g8_v2_asset_handoffs")
    .select(select)
    .eq("g5_approval_id", input.approvalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const data = byAsset.data || byApproval?.data;
  const error = byAsset.error || byApproval?.error;

  if (error) {
    console.error("[g8] G5 callback lookup failed", { message: error.message });
    return;
  }
  if (!data) return;
  if (normalize(data.g5_status) === input.decision) return;

  const result = await postG8Webhook(env.n8nG8G5ApprovalResultPath, {
    handoff_id: data.handoff_id,
    ugc_id: data.ugc_id,
    g5_asset_id: data.g5_asset_id || input.assetId,
    g5_approval_id: data.g5_approval_id || input.approvalId,
    approval_status: input.decision,
    reviewer_id: input.reviewerId,
    reviewer_note: input.reviewerNote,
    actor: input.reviewerId,
  });

  if (result.httpStatus >= 400) {
    console.error("[g8] G5 approval callback was not accepted", { httpStatus: result.httpStatus, workflowStatus: result.workflowStatus });
  }
}

export async function registerG8CreatorTracking(payload: JsonRecord, actor: string) {
  return postG8Webhook(env.n8nG8CreatorTrackingRegisterPath, { ...payload, actor });
}

export async function recordG8CreatorPerformanceEvent(payload: JsonRecord, actor: string) {
  return postG8Webhook(env.n8nG8CreatorPerformanceEventPath, { ...payload, actor });
}
