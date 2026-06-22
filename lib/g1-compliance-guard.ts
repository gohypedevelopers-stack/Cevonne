import {
  formatDateTime,
  type N8nApprovalRecord,
  type N8nAuditLogRecord,
  type N8nExecutionRecord,
  type N8nWorkflowCard,
  type N8nWorkflowDetailResponse,
} from "@/components/admin-dashboard/n8n-automations-common";

export const G1_WORKFLOW_GROUP = "G1" as const;
export const G1_WORKFLOW_NAME = "Compliance Guard";
export const G1_CLIENT_DESCRIPTION =
  "G1 is the safety gate for all risky actions. Before any workflow publishes content, sends messages, changes ads, uploads audiences, reuses UGC, or changes website pages, G1 checks whether the action is safe, approved, and compliant.";

export type G1DecisionLabel =
  | "PASS"
  | "BLOCK"
  | "MANUAL_ONLY"
  | "PENDING_APPROVAL"
  | "DRY_RUN"
  | "RECOMMENDATION_ONLY"
  | "DO_NOT_SCALE"
  | "FIX_FIRST"
  | "ERROR"
  | "NEEDS_EVIDENCE";

export type G1CurrentStatus = "Active" | "Needs Review" | "Manual Only";

export type G1DecisionRecord = {
  time: string;
  requested_by: string;
  requested_by_workflow: string;
  requested_by_workflow_group: string | null;
  workflow_id: string | null;
  action: string;
  action_type: string;
  action_type_label: string;
  platform: string;
  decision: G1DecisionLabel;
  client_meaning: string;
  action_needed: string;
  technical_reason: string | null;
  failure_reason: string | null;
};

export type G1BlockedReasonRecord = {
  reason_code: string;
  client_reason: string;
  count: number;
};

export type G1PendingActionRecord = {
  title: string;
  description: string;
  action_needed: string;
  related_reason: string | null;
};

export type G1Summary = {
  pass_today: number;
  block_today: number;
  manual_only_today: number;
  pending_review: number;
  main_issue: string;
};

export type G1DeveloperRecords = {
  workflow: N8nWorkflowCard | null;
  latest_executions: N8nExecutionRecord[];
  approvals: N8nApprovalRecord[];
  audit_logs: N8nAuditLogRecord[];
  related_g1_compliance_runs: N8nExecutionRecord[];
  supabase_rows?: Record<string, unknown>[];
};

export type G1DeveloperDetails = {
  enabled: boolean;
  raw_records: G1DeveloperRecords | null;
};

export type G1ComplianceGuardSnapshot = {
  workflow_group: typeof G1_WORKFLOW_GROUP;
  workflow_name: string;
  client_description: string;
  current_status: G1CurrentStatus;
  last_checked_at: string | null;
  summary: G1Summary;
  latest_decisions: G1DecisionRecord[];
  blocked_reasons: G1BlockedReasonRecord[];
  pending_actions: G1PendingActionRecord[];
  developer_details: G1DeveloperDetails;
};

type DecisionSource = {
  time: string;
  requestedBy: string;
  requestedByWorkflow: string;
  requestedByWorkflowGroup: string | null;
  workflowId: string | null;
  action: string;
  actionType: string;
  actionTypeLabel: string;
  platform: string;
  decision: G1DecisionLabel;
  technicalReason: string | null;
  failureReason: string | null;
};

export type G1DecisionSource = DecisionSource;
type G1AuditRow = Record<string, unknown>;

const getTodayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const isToday = (value: string | null | undefined) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= getTodayStart();
};

const normalizeReasonCode = (value: string | null | undefined) => {
  if (!value) {
    return "UNKNOWN";
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "UNKNOWN";
  }

  if (normalized.includes("MISSING_REQUIRED_FIELD_ACTION_TYPE")) return "MISSING_REQUIRED_FIELD_ACTION_TYPE";
  if (normalized.includes("DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER")) return "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER";
  if (normalized.includes("GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES"))
    return "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES";
  if (normalized.includes("HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION"))
    return "HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION";
  if (normalized.includes("HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED")) return "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED";
  if (normalized.includes("ACCOUNT_HEALTH_NOT_CLEAN")) return "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN";
  if (normalized.includes("ACCOUNT_HEALTH_UNKNOWN")) return "ACCOUNT_HEALTH_UNKNOWN";
  if (normalized.includes("POLICY_CHANGED_NEEDS_REVIEW")) return "POLICY_CHANGED_NEEDS_REVIEW";
  if (normalized.includes("CONSENT_MISSING")) return "CONSENT_MISSING";
  if (normalized.includes("UGC_RIGHTS_MISSING")) return "UGC_RIGHTS_MISSING";
  if (normalized.includes("CLAIM_EVIDENCE_MISSING")) return "CLAIM_EVIDENCE_MISSING";

  return normalized;
};

const pickString = (row: G1AuditRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const pickJsonObject = (row: G1AuditRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        continue;
      }
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
};

const pickStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));

  return items.length ? items : null;
};

const normalizeActionTypeCode = (value: string | null | undefined) => {
  if (!value) {
    return "UNKNOWN";
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "UNKNOWN";
};

const workflowLabelsByGroup: Record<string, string> = {
  G1: "G1 Compliance Guard",
  G2: "G2 Policy + Account Health",
  G3: "G3 CRM + Consent",
  G4: "G4 Content Intelligence",
  G5: "G5 Publishing",
  G6: "G6 Messaging",
  G7: "G7 Inventory + Offer Safety",
  G8: "G8 UGC + Creator Proof",
  G9: "G9 Ads",
  G10: "G10 SEO + CRO",
  G11: "G11 Decision Engine",
};

const isInternalWorkflowReference = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toUpperCase();
  return /^WF\d+$/.test(normalized) || /^G\d+$/.test(normalized) || normalized === "UNKNOWN" || normalized === "UNKNOWN WORKFLOW";
};

const formatWorkflowGroupLabel = (value: string | null | undefined) => {
  const group = extractWorkflowGroupLabel(value);
  if (group && workflowLabelsByGroup[group]) {
    return workflowLabelsByGroup[group];
  }

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && !isInternalWorkflowReference(trimmed) ? trimmed : null;
};

const formatPlatformLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "META":
      return "Meta";
    case "INSTAGRAM":
      return "Instagram";
    case "GOOGLE":
      return "Google";
    case "WHATSAPP":
      return "WhatsApp";
    case "WEBSITE":
      return "Website";
    case "INTERNAL":
    case "INTERNAL SYSTEM":
      return "internal system";
    default:
      return value
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (match) => match.toUpperCase());
  }
};

const resolveWorkflowRequesterLabel = (input: {
  requestedByWorkflowRaw: string | null;
  requestedByWorkflowGroupRaw: string | null;
  workflowIdRaw: string | null;
  actionTypeRaw: string | null;
  haystack: string;
}) => {
  const explicitLabel = formatWorkflowGroupLabel(input.requestedByWorkflowRaw);
  if (explicitLabel) {
    return explicitLabel;
  }

  const workflowGroup =
    extractWorkflowGroupLabel(input.requestedByWorkflowGroupRaw) ??
    extractWorkflowGroupLabel(input.workflowIdRaw) ??
    extractWorkflowGroupLabel(input.requestedByWorkflowRaw);

  if (workflowGroup && workflowLabelsByGroup[workflowGroup]) {
    return workflowLabelsByGroup[workflowGroup];
  }

  return inferWorkflowLabelFromActionType(input.actionTypeRaw, workflowGroup, input.haystack) ?? "Unknown workflow";
};

const actionTypeLabels: Record<string, string> = {
  META_UPDATE_ADSET_BUDGET: "Meta budget change",
  META_CREATE_AD: "Meta ad creation",
  META_UPDATE_AD: "Meta ad update",
  META_PAUSE_AD: "Meta ad pause",
  META_DUPLICATE_AD: "Meta ad duplication",
  META_UPLOAD_CUSTOM_AUDIENCE: "Meta audience upload",
  IG_PUBLISH: "Instagram post publish",
  IG_SEND_DM: "Instagram DM send",
  DIRECT_N8N_IG_DM: "Instagram DM send",
  WHATSAPP_MESSAGE: "WhatsApp message",
  UGC_REUSE: "UGC/creator content reuse",
  SEO_PAGE_UPDATE: "Website SEO page update",
  CRO_EXPERIMENT_LAUNCH: "Website CRO test launch",
  GOOGLE_SCRAPE: "Google data collection",
  G1_BUDGET_CHANGE_PASS: "Meta budget change",
  G1_BUDGET_CHANGE_BLOCK: "Meta budget change",
  G1_BUDGET_CHANGE_MANUAL_ONLY: "Meta budget change",
  DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER: "Instagram DM send",
  GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES: "Google data collection",
  HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION: "Session recording",
  MANUAL_REVIEW: "Manual review",
  SAFE_TEST: "Safety check",
  WORKFLOW_ACTION: "Workflow action check",
  UNKNOWN: "Workflow action check",
};

const inferActionTypeLabel = (value: string | null | undefined, haystack?: string) => {
  const normalized = normalizeActionTypeCode(value);
  if (actionTypeLabels[normalized]) {
    return actionTypeLabels[normalized];
  }

  const text = `${normalized} ${haystack ?? ""}`.toUpperCase();
  if (text.includes("BUDGET")) return "Meta budget change";
  if (text.includes("IG_PUBLISH")) return "Instagram post publish";
  if (text.includes("IG_SEND_DM") || text.includes("DIRECT_N8N_IG_DM") || text.includes("INSTAGRAM DM")) return "Instagram DM send";
  if (text.includes("GOOGLE")) return "Google data collection";
  if (text.includes("HOTJAR")) return "Session recording";
  if (text.includes("MANUAL_REVIEW") || text.includes("REVIEW")) return "Manual review";
  if (text.includes("APPROVAL")) return "Approval check";
  if (text.includes("SAFE_TEST")) return "Safety check";
  if (text.includes("SEO")) return "Website SEO page update";
  if (text.includes("CRO")) return "Website CRO test launch";

  return "Workflow action check";
};

const inferWorkflowLabelFromActionType = (actionType: string | null | undefined, workflowGroup?: string | null, haystack?: string) => {
  const normalized = normalizeActionTypeCode(actionType);
  const text = `${normalized} ${haystack ?? ""}`.toUpperCase();

  if (workflowGroup && workflowGroup !== "G1" && workflowLabelsByGroup[workflowGroup]) {
    return workflowLabelsByGroup[workflowGroup];
  }

  if (text.includes("META") || text.includes("BUDGET") || text.includes("ADS")) return workflowLabelsByGroup.G9;
  if (text.includes("IG_PUBLISH") || text.includes("PUBLISH")) return workflowLabelsByGroup.G5;
  if (text.includes("IG_SEND_DM") || text.includes("DIRECT_N8N_IG_DM") || text.includes("MESSAGING") || text.includes("WHATSAPP"))
    return workflowLabelsByGroup.G6;
  if (text.includes("UGC") || text.includes("RIGHTS")) return workflowLabelsByGroup.G8;
  if (text.includes("SEO") || text.includes("CRO") || text.includes("GOOGLE")) return workflowLabelsByGroup.G10;
  if (text.includes("ACCOUNT_HEALTH") || text.includes("POLICY")) return workflowLabelsByGroup.G2;
  if (text.includes("CLAIM") || text.includes("CONTENT")) return workflowLabelsByGroup.G4;
  if (text.includes("CONSENT") || text.includes("CRM")) return workflowLabelsByGroup.G3;
  if (text.includes("INVENTORY") || text.includes("OFFER")) return workflowLabelsByGroup.G7;
  if (text.includes("DECISION")) return workflowLabelsByGroup.G11;

  return "Unknown workflow";
};

const inferWorkflowGroupCodeFromActionType = (actionType: string | null | undefined, haystack?: string) => {
  const normalized = normalizeActionTypeCode(actionType);
  const text = `${normalized} ${haystack ?? ""}`.toUpperCase();

  if (text.includes("META") || text.includes("BUDGET") || text.includes("ADS")) return "G9";
  if (text.includes("IG_PUBLISH") || text.includes("PUBLISH")) return "G5";
  if (text.includes("IG_SEND_DM") || text.includes("DIRECT_N8N_IG_DM") || text.includes("MESSAGING") || text.includes("WHATSAPP"))
    return "G6";
  if (text.includes("UGC") || text.includes("RIGHTS")) return "G8";
  if (text.includes("SEO") || text.includes("CRO") || text.includes("GOOGLE")) return "G10";
  if (text.includes("ACCOUNT_HEALTH") || text.includes("POLICY")) return "G2";
  if (text.includes("CLAIM") || text.includes("CONTENT")) return "G4";
  if (text.includes("CONSENT") || text.includes("CRM")) return "G3";
  if (text.includes("INVENTORY") || text.includes("OFFER")) return "G7";
  if (text.includes("DECISION")) return "G11";

  return null;
};

const inferPlatformLabel = (haystack: string, requestedByWorkflow: string) => {
  const text = haystack.toUpperCase();

  if (text.includes("META") || text.includes("ADS")) return "Meta";
  if (text.includes("INSTAGRAM") || text.includes("IG_")) return "Instagram";
  if (text.includes("GOOGLE")) return "Google";
  if (text.includes("HOTJAR")) return "Hotjar";
  if (text.includes("WHATSAPP")) return "WhatsApp";
  if (text.includes("SEO") || text.includes("CRO") || text.includes("WEBSITE")) return "Website";
  if (requestedByWorkflow.toLowerCase().includes("website")) return "Website";
  if (requestedByWorkflow.toLowerCase().includes("admin")) return "Admin panel";
  return "internal system";
};

const extractWorkflowGroupLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/\bG\d+\b/);
  return match?.[0] ?? null;
};

const normalizeDecisionLabelFromText = (value: string | null | undefined, technicalReason: string | null | undefined): G1DecisionLabel => {
  const text = `${value ?? ""} ${technicalReason ?? ""}`.toUpperCase();

  if (text.includes("PASS") || text.includes("ACTIVE") || text.includes("COMPLETE")) return "PASS";
  if (text.includes("MANUAL") || text.includes("REVIEW")) return "MANUAL_ONLY";
  if (text.includes("PENDING")) return "PENDING_APPROVAL";
  if (text.includes("DRY_RUN")) return "DRY_RUN";
  if (text.includes("RECOMMENDATION")) return "RECOMMENDATION_ONLY";
  if (text.includes("DO_NOT_SCALE")) return "DO_NOT_SCALE";
  if (text.includes("FIX_FIRST")) return "FIX_FIRST";
  if (text.includes("NEEDS_EVIDENCE") || text.includes("EVIDENCE")) return "NEEDS_EVIDENCE";
  if (text.includes("ERROR")) return "ERROR";
  if (text.includes("BLOCK") || text.includes("FAIL")) return "BLOCK";

  return technicalReason ? "BLOCK" : "PENDING_APPROVAL";
};

export const normalizeG1AuditRow = (row: G1AuditRow): DecisionSource | null => {
  const time =
    pickString(row, ["time", "timestamp", "created_at", "createdAt", "executed_at", "executedAt", "checked_at", "checkedAt"]) ??
    null;
  if (!time) {
    return null;
  }

  const actionPacket = pickJsonObject(row, ["action_packet", "actionPacket", "action_packet_json", "actionPacketJson", "payload", "data", "body"]);
  const packetRequestedByWorkflowRaw = actionPacket
    ? pickString(actionPacket, ["requested_by_workflow", "requestedByWorkflow"])
    : null;
  const packetWorkflowIdRaw = actionPacket ? pickString(actionPacket, ["workflow_id", "workflowId"]) : null;
  const packetWorkflowGroupRaw = actionPacket ? pickString(actionPacket, ["workflow_group", "workflowGroup", "group"]) : null;
  const packetActionTypeRaw = actionPacket ? pickString(actionPacket, ["action_type", "actionType"]) : null;
  const packetPlatformRaw = actionPacket ? pickString(actionPacket, ["platform", "platform_name", "platformName"]) : null;
  const packetFailureReasons = actionPacket
    ? pickStringArray(
        actionPacket.failure_reasons ??
          actionPacket.failureReasons ??
          actionPacket.g1_failure_reasons ??
          actionPacket.g1FailureReasons,
      )
    : null;
  const rowFailureReasons = pickStringArray(row.failure_reasons ?? row.failureReasons ?? row.g1_failure_reasons ?? row.g1FailureReasons);
  const packetFailureReason =
    actionPacket
      ? pickString(actionPacket, ["fail_reason", "failReason", "failure_reason", "failureReason", "reason_code", "reasonCode", "reason"]) ??
        packetFailureReasons?.[0] ??
        null
      : null;
  const rowRequestedByWorkflowRaw = pickString(row, [
    "requested_by_workflow",
    "requestedByWorkflow",
    "requested_workflow",
    "requestedWorkflow",
    "origin_workflow",
    "originWorkflow",
    "workflow_id",
    "workflowId",
  ]);
  const requestedByWorkflowGroupRaw =
    packetWorkflowGroupRaw ??
    pickString(row, [
      "requested_by_workflow_group",
      "requestedByWorkflowGroup",
      "workflow_group",
      "workflowGroup",
      "group",
      "group_name",
      "groupName",
    ]) ?? null;
  const actionTypeRaw =
    packetActionTypeRaw ??
    pickString(row, ["action_type", "actionType", "requested_action", "requestedAction", "response_type", "responseType"]) ??
    null;
  const platformRaw =
    packetPlatformRaw ??
    pickString(row, ["platform", "platform_name", "platformName", "source", "source_label", "sourceLabel", "channel"]) ??
    null;
  const technicalReason =
    packetFailureReason ??
    rowFailureReasons?.[0] ??
    pickString(row, ["technical_reason", "technicalReason", "failure_reason", "failureReason", "fail_reason", "failReason", "reason_code", "reasonCode", "reason"]) ??
    null;
  const failureReason =
    packetFailureReason ??
    rowFailureReasons?.[0] ??
    pickString(row, ["failure_reason", "failureReason", "fail_reason", "failReason", "reason_code", "reasonCode", "reason"]) ??
    technicalReason;
  const sourceHint = `${pickString(actionPacket ?? {}, ["source", "source_label", "sourceLabel", "route_name", "routeName"]) ?? ""} ${
    pickString(row, ["source", "source_label", "sourceLabel", "route_name", "routeName", "message"]) ?? ""
  }`;
  const actionTypeCode = normalizeActionTypeCode(actionTypeRaw);
  const platformLabelRaw = `${platformRaw ?? ""}`.toUpperCase();
  const sourceText = `${sourceHint} ${actionTypeRaw ?? ""} ${rowRequestedByWorkflowRaw ?? ""} ${platformRaw ?? ""} ${technicalReason ?? ""}`.toUpperCase();
  const isInternalRow =
    actionTypeCode === "COMPLIANCE_CHECK" ||
    actionTypeCode === "HEALTH_CHECK" ||
    actionTypeCode === "VIEW_WORKFLOW_DETAIL" ||
    actionTypeCode === "VIEW_EXECUTIONS" ||
    actionTypeCode === "VIEW_AUDIT_LOGS" ||
    actionTypeCode === "VIEW_APPROVALS" ||
    sourceText.includes("ADMIN PANEL REFRESH") ||
    sourceText.includes("G1_COMPLIANCE_GUARD_READY") ||
    sourceText.includes("WORKFLOW_DETAIL_READY") ||
    sourceText.includes("WORKFLOW_EXECUTIONS_READY") ||
    sourceText.includes("WORKFLOW_AUDIT_LOGS_READY") ||
    sourceText.includes("WORKFLOW_APPROVALS_READY") ||
    platformLabelRaw === "INTERNAL" ||
    platformLabelRaw === "INTERNAL SYSTEM";
  if (isInternalRow) {
    return null;
  }
  const decisionLabel = normalizeDecisionLabelFromText(
    pickString(row, ["decision", "status", "result", "result_status", "resultStatus", "response_type", "responseType", "outcome"]),
    technicalReason,
  );
  const actionTypeLabel = inferActionTypeLabel(actionTypeRaw, `${rowRequestedByWorkflowRaw ?? ""} ${platformRaw ?? ""} ${technicalReason ?? ""}`);
  const requestedByWorkflowGroup =
    extractWorkflowGroupLabel(requestedByWorkflowGroupRaw) ??
    extractWorkflowGroupLabel(rowRequestedByWorkflowRaw) ??
    inferWorkflowGroupCodeFromActionType(actionTypeRaw, `${actionTypeLabel} ${platformRaw ?? ""} ${technicalReason ?? ""}`) ??
    null;
  const requestedByWorkflow = resolveWorkflowRequesterLabel({
    requestedByWorkflowRaw: rowRequestedByWorkflowRaw ?? packetRequestedByWorkflowRaw ?? null,
    requestedByWorkflowGroupRaw: requestedByWorkflowGroupRaw ?? requestedByWorkflowGroup,
    workflowIdRaw: packetWorkflowIdRaw ?? pickString(row, ["workflow_id", "workflowId", "workflow_group_id", "workflowGroupId"]) ?? null,
    actionTypeRaw,
    haystack: `${actionTypeLabel} ${platformRaw ?? ""} ${technicalReason ?? ""}`,
  });
  const workflowId = packetWorkflowIdRaw ?? pickString(row, ["workflow_id", "workflowId", "workflow_group_id", "workflowGroupId"]) ?? null;
  const haystack = `${actionTypeLabel} ${platformRaw ?? ""} ${technicalReason ?? ""}`;

  return {
    time,
    requestedBy: requestedByWorkflow,
    requestedByWorkflow,
    requestedByWorkflowGroup,
    workflowId,
    action: actionTypeLabel,
    actionType: normalizeActionTypeCode(actionTypeRaw ?? actionTypeLabel),
    actionTypeLabel,
    platform: formatPlatformLabel(platformRaw) ?? inferPlatformLabel(haystack, requestedByWorkflow),
    decision: decisionLabel,
    technicalReason,
    failureReason,
  };
};

export const normalizeG1AuditRows = (rows: unknown[]) =>
  rows
    .map((row) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return null;
      }

      return normalizeG1AuditRow(row as G1AuditRow);
    })
    .filter(Boolean) as DecisionSource[];

const reasonTranslations: Record<string, string> = {
  MISSING_REQUIRED_FIELD_ACTION_TYPE: "The request was missing the action type.",
  DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER: "Instagram DM cannot be sent directly from n8n. Use the approved DM partner route.",
  GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES: "Google scraping is not allowed. Use approved Google sources only.",
  HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION:
    "Session recording needs consent, masking, and retention rules.",
  HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED: "This action needs human approval before it can run.",
  ACCOUNT_HEALTH_UNKNOWN: "The account health is unknown, so the action is paused for safety.",
  ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN: "The platform account is not confirmed clean, so the action is blocked.",
  POLICY_CHANGED_NEEDS_REVIEW: "A policy changed and needs review before automation can continue.",
  CONSENT_MISSING: "Required customer consent is missing.",
  UGC_RIGHTS_MISSING: "UGC or creator permission is missing.",
  CLAIM_EVIDENCE_MISSING: "The content claim needs proof before it can be used.",
  UNKNOWN: "Required safety proof is missing, so G1 blocked the action.",
};

const reasonActionNeeded: Record<string, string> = {
  MISSING_REQUIRED_FIELD_ACTION_TYPE: "Fix missing action type",
  DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER: "Use approved DM partner route",
  GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES: "Use approved Google source only",
  HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION: "Add consent, masking, and retention controls",
  HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED: "Human approval needed",
  ACCOUNT_HEALTH_UNKNOWN: "Check account health first",
  ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN: "Check account health first",
  POLICY_CHANGED_NEEDS_REVIEW: "Review updated policy first",
  CONSENT_MISSING: "Add valid customer consent",
  UGC_RIGHTS_MISSING: "Add creator/UGC permission proof",
  CLAIM_EVIDENCE_MISSING: "Add claim proof",
  UNKNOWN: "Fix missing safety proof",
};

const pendingActionMap: Record<
  string,
  {
    title: string;
    description: string;
    action_needed: string;
  }
> = {
  DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER: {
    title: "Use the approved DM partner route",
    description: "Instagram DM requests cannot go directly through n8n.",
    action_needed: "Move the request to the approved partner route and retry.",
  },
  GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES: {
    title: "Switch to approved Google sources",
    description: "Scraping is blocked because only approved sources are allowed.",
    action_needed: "Use the approved Google source and resubmit the request.",
  },
  HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION: {
    title: "Review Hotjar settings",
    description: "Session recording needs consent, masking, and retention rules.",
    action_needed: "Add consent, masking, and retention controls before continuing.",
  },
  HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED: {
    title: "Request human approval",
    description: "The action cannot continue until a reviewer signs off.",
    action_needed: "Ask a reviewer to approve the request.",
  },
  ACCOUNT_HEALTH_UNKNOWN: {
    title: "Check account health",
    description: "The account health has not been confirmed.",
    action_needed: "Review account health and clear the safety check.",
  },
  ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN: {
    title: "Confirm a clean account",
    description: "The platform account is not confirmed clean yet.",
    action_needed: "Resolve the account health issue before retrying.",
  },
  POLICY_CHANGED_NEEDS_REVIEW: {
    title: "Review the policy change",
    description: "A policy changed and the workflow needs a fresh review.",
    action_needed: "Update the policy notes and confirm the new rules.",
  },
  CONSENT_MISSING: {
    title: "Collect consent proof",
    description: "Required customer consent has not been recorded.",
    action_needed: "Add consent proof before the action continues.",
  },
  UGC_RIGHTS_MISSING: {
    title: "Confirm usage rights",
    description: "UGC or creator permission is missing.",
    action_needed: "Add the rights proof or remove the asset.",
  },
  CLAIM_EVIDENCE_MISSING: {
    title: "Add claim evidence",
    description: "The content claim needs proof before it can be used.",
    action_needed: "Attach supporting evidence and review again.",
  },
  UNKNOWN: {
    title: "Review missing proof",
    description: "Required safety proof is missing, so G1 blocked the action.",
    action_needed: "Fix missing safety proof.",
  },
};

const decisionMeaning: Record<G1DecisionLabel, string> = {
  PASS: "This action passed the safety check.",
  BLOCK: "This action was stopped because it was unsafe or missing required proof.",
  MANUAL_ONLY: "This action needs a human review before it can continue.",
  PENDING_APPROVAL: "This action is waiting for approval.",
  DRY_RUN: "This action was tested without making a live change.",
  RECOMMENDATION_ONLY: "This action is a recommendation only.",
  DO_NOT_SCALE: "This action should not be scaled yet.",
  FIX_FIRST: "This action needs a fix before it can continue.",
  ERROR: "The workflow hit an error and needs attention.",
  NEEDS_EVIDENCE: "This action is missing proof or supporting evidence.",
};

const decisionNeeded: Record<G1DecisionLabel, string> = {
  PASS: "No action needed.",
  BLOCK: "Fix missing safety proof.",
  MANUAL_ONLY: "Human review needed.",
  PENDING_APPROVAL: "Review approval.",
  DRY_RUN: "Review the dry-run result.",
  RECOMMENDATION_ONLY: "Review the recommendation when ready.",
  DO_NOT_SCALE: "Do not scale this action yet.",
  FIX_FIRST: "Fix missing proof.",
  ERROR: "Check the workflow details and retry.",
  NEEDS_EVIDENCE: "Fix missing proof.",
};

const getRequestedByWorkflowLabel = (execution: N8nExecutionRecord) => {
  const haystack = `${execution.actionType ?? ""} ${execution.responseType} ${execution.failureReason ?? ""} ${execution.summary} ${execution.routeName}`.toUpperCase();
  return (
    execution.requestedByWorkflow ??
    inferWorkflowLabelFromActionType(execution.actionType ?? execution.responseType, execution.requestedByWorkflowGroup ?? execution.workflowGroup, haystack) ??
    "Unknown workflow"
  );
};

const getRequestedByWorkflowGroupLabel = (execution: N8nExecutionRecord, workflowLabel: string) =>
  execution.requestedByWorkflowGroup ?? extractWorkflowGroupLabel(workflowLabel);

const getWorkflowIdLabel = (execution: N8nExecutionRecord) => execution.workflowId ?? null;

const getActionTypeLabelForExecution = (execution: N8nExecutionRecord) => {
  const haystack = `${execution.actionType ?? ""} ${execution.responseType} ${execution.failureReason ?? ""} ${execution.summary} ${execution.routeName}`;
  return inferActionTypeLabel(execution.actionType ?? execution.responseType, haystack);
};

const getActionTypeCodeForExecution = (execution: N8nExecutionRecord) =>
  normalizeActionTypeCode(execution.actionType ?? execution.responseType ?? execution.failureReason ?? execution.summary);

const getPlatformLabel = (execution: N8nExecutionRecord, workflowLabel: string) => {
  const haystack = `${execution.actionType ?? ""} ${execution.responseType} ${execution.failureReason ?? ""} ${execution.summary} ${execution.routeName}`.toUpperCase();

  return execution.platform ?? inferPlatformLabel(haystack, workflowLabel);
};

const normalizeDecisionLabel = (execution: N8nExecutionRecord): G1DecisionLabel => {
  switch (execution.status) {
    case "PASS":
    case "ACTIVE":
      return "PASS";
    case "BLOCK":
      return "BLOCK";
    case "MANUAL_ONLY":
      return "MANUAL_ONLY";
    case "PENDING":
      return "PENDING_APPROVAL";
    case "DRY_RUN":
      return "DRY_RUN";
    case "RECOMMENDATION_ONLY":
      return "RECOMMENDATION_ONLY";
    case "ERROR":
      return "ERROR";
    case "NOT_BUILT":
      return "FIX_FIRST";
    default:
      return execution.failureReason ? "NEEDS_EVIDENCE" : "BLOCK";
  }
};

const buildDecisionSource = (execution: N8nExecutionRecord): DecisionSource => ({
  time: execution.executedAt,
  requestedBy: getRequestedByWorkflowLabel(execution),
  requestedByWorkflow: getRequestedByWorkflowLabel(execution),
  requestedByWorkflowGroup: getRequestedByWorkflowGroupLabel(execution, getRequestedByWorkflowLabel(execution)),
  workflowId: getWorkflowIdLabel(execution),
  action: getActionTypeLabelForExecution(execution),
  actionType: getActionTypeCodeForExecution(execution),
  actionTypeLabel: getActionTypeLabelForExecution(execution),
  platform: getPlatformLabel(execution, getRequestedByWorkflowLabel(execution)),
  decision: normalizeDecisionLabel(execution),
  technicalReason: execution.failureReason ?? null,
  failureReason: execution.failureReason ?? null,
});

const buildDecisionRecord = (source: DecisionSource): G1DecisionRecord => {
  const reasonCode = normalizeReasonCode(source.technicalReason);
  const useSpecificReason =
    source.decision === "BLOCK" ||
    source.decision === "ERROR" ||
    source.decision === "NEEDS_EVIDENCE" ||
    source.decision === "FIX_FIRST" ||
    source.decision === "DO_NOT_SCALE";

  return {
    time: source.time,
    requested_by: source.requestedBy,
    requested_by_workflow: source.requestedByWorkflow,
    requested_by_workflow_group: source.requestedByWorkflowGroup,
    workflow_id: source.workflowId,
    action: source.action,
    action_type: source.actionType,
    action_type_label: source.actionTypeLabel,
    platform: source.platform,
    decision: source.decision,
    client_meaning: decisionMeaning[source.decision],
    action_needed:
      source.decision === "PASS"
        ? decisionNeeded.PASS
        : useSpecificReason
          ? reasonActionNeeded[reasonCode] ?? reasonActionNeeded.UNKNOWN
          : decisionNeeded[source.decision],
    technical_reason: source.technicalReason,
    failure_reason: source.failureReason,
  };
};

const buildBlockedReasonRecords = (decisions: G1DecisionRecord[]) => {
  const counts = new Map<string, { client_reason: string; count: number }>();

  for (const decision of decisions) {
    if (decision.decision !== "BLOCK" && decision.decision !== "ERROR" && decision.decision !== "NEEDS_EVIDENCE" && decision.decision !== "FIX_FIRST") {
      continue;
    }

    const reasonCode = normalizeReasonCode(decision.technical_reason);
    const clientReason = reasonTranslations[reasonCode] ?? reasonTranslations.UNKNOWN;
    const current = counts.get(reasonCode);
    counts.set(reasonCode, {
      client_reason: clientReason,
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...counts.entries()]
    .map(([reason_code, value]) => ({
      reason_code,
      client_reason: value.client_reason,
      count: value.count,
    }))
    .sort((left, right) => right.count - left.count || left.reason_code.localeCompare(right.reason_code));
};

const buildPendingActions = (summary: G1Summary, blockedReasons: G1BlockedReasonRecord[]) => {
  if (summary.manual_only_today > 0) {
    return [
      {
        title: "Review the manual-only items",
        description: "Some actions need a human to step in before they can continue.",
        action_needed: "Human review needed.",
        related_reason: "MANUAL_ONLY",
      },
      ...blockedReasons.slice(0, 2).map((reason) => {
        const mapped = pendingActionMap[reason.reason_code] ?? pendingActionMap.UNKNOWN;
        return {
          title: mapped.title,
          description: reason.client_reason,
          action_needed: mapped.action_needed,
          related_reason: reason.reason_code,
        };
      }),
    ];
  }

  if (blockedReasons.length === 0) {
    return [
      {
        title: "No immediate action needed",
        description: "G1 is not blocking anything right now.",
        action_needed: "Keep reviewing new requests as they come in.",
        related_reason: null,
      },
    ];
  }

  return blockedReasons.slice(0, 3).map((reason) => {
    const mapped = pendingActionMap[reason.reason_code] ?? pendingActionMap.UNKNOWN;
    return {
      title: mapped.title,
      description: reason.client_reason,
      action_needed: mapped.action_needed,
      related_reason: reason.reason_code,
    };
  });
};

const getCurrentStatus = (summary: G1Summary, latestDecisions: G1DecisionRecord[]): G1CurrentStatus => {
  if (summary.block_today > 0) {
    return "Needs Review";
  }

  if (summary.manual_only_today > 0 || latestDecisions.some((decision) => decision.decision === "MANUAL_ONLY")) {
    return "Manual Only";
  }

  return "Active";
};

const getMainIssue = (blockedReasons: G1BlockedReasonRecord[]) => {
  if (!blockedReasons.length) {
    return "No major issue";
  }

  return blockedReasons[0]?.client_reason ?? "No major issue";
};

const getLastCheckedAt = (decisions: G1DecisionRecord[]) => decisions[0]?.time ?? null;

const collectDecisionSources = (detail: N8nWorkflowDetailResponse | null): DecisionSource[] => {
  if (!detail?.workflow) return [];

  const seen = new Set<string>();
  const combinedExecutions = [
    ...(detail.latest_executions ?? []),
    ...(detail.related_g1_compliance_runs ?? []),
  ];

  return combinedExecutions
    .filter((execution) => {
      if (execution.workflowGroup !== G1_WORKFLOW_GROUP) {
        return false;
      }

      const uniqueKey = execution.executionId || execution.publicId;
      if (!uniqueKey || seen.has(uniqueKey)) {
        return false;
      }

      seen.add(uniqueKey);
      return true;
    })
    .sort((left, right) => new Date(right.executedAt).getTime() - new Date(left.executedAt).getTime())
    .map((execution) => buildDecisionSource(execution));
};

export const buildG1ComplianceGuardSnapshotFromDecisionSources = (input: {
  workflow: N8nWorkflowCard | null;
  decisionSources: DecisionSource[];
  rawRecords?: G1DeveloperRecords | null;
  developerEnabled?: boolean;
}): G1ComplianceGuardSnapshot => {
  if (!input.workflow) {
    return buildEmptyG1ComplianceGuardSnapshot();
  }

  const latest_decisions = input.decisionSources
    .map(buildDecisionRecord)
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 6);
  const blocked_reasons = buildBlockedReasonRecords(latest_decisions);
  const hasDecisions = latest_decisions.length > 0;
  const summary: G1Summary = {
    pass_today: latest_decisions.filter((decision) => decision.decision === "PASS" && isToday(decision.time)).length,
    block_today: latest_decisions.filter((decision) => decision.decision === "BLOCK" && isToday(decision.time)).length,
    manual_only_today: latest_decisions.filter((decision) => decision.decision === "MANUAL_ONLY" && isToday(decision.time)).length,
    pending_review:
      (input.workflow.pendingApprovalsCount ?? 0) +
      latest_decisions.filter((decision) => decision.decision === "PENDING_APPROVAL").length,
    main_issue: hasDecisions ? getMainIssue(blocked_reasons) : "No workflow actions checked yet",
  };

  return {
    workflow_group: G1_WORKFLOW_GROUP,
    workflow_name: input.workflow.name || G1_WORKFLOW_NAME,
    client_description: G1_CLIENT_DESCRIPTION,
    current_status: getCurrentStatus(summary, latest_decisions),
    last_checked_at: getLastCheckedAt(latest_decisions) ?? (hasDecisions ? input.workflow.lastRunAt ?? null : null),
    summary,
    latest_decisions,
    blocked_reasons,
    pending_actions: hasDecisions
      ? buildPendingActions(summary, blocked_reasons)
      : [
          {
            title: "No workflow actions have been checked yet",
            description: "G1 is active and waiting for the first real workflow decision.",
            action_needed: "No action needed right now.",
            related_reason: null,
          },
        ],
    developer_details: {
      enabled: input.developerEnabled ?? true,
      raw_records: input.rawRecords ?? {
        workflow: input.workflow,
        latest_executions: [],
        approvals: [],
        audit_logs: [],
        related_g1_compliance_runs: [],
      },
    },
  };
};

export const buildEmptyG1ComplianceGuardSnapshot = (): G1ComplianceGuardSnapshot => ({
  workflow_group: G1_WORKFLOW_GROUP,
  workflow_name: G1_WORKFLOW_NAME,
  client_description: G1_CLIENT_DESCRIPTION,
  current_status: "Active",
  last_checked_at: null,
  summary: {
    pass_today: 0,
    block_today: 0,
    manual_only_today: 0,
    pending_review: 0,
    main_issue: "No workflow actions checked yet",
  },
  latest_decisions: [],
  blocked_reasons: [],
  pending_actions: [
    {
      title: "No workflow actions have been checked yet",
      description: "G1 is active and waiting for the first real workflow decision.",
      action_needed: "No action needed right now.",
      related_reason: null,
    },
  ],
  developer_details: {
    enabled: false,
    raw_records: null,
  },
});

export const buildG1ComplianceGuardSnapshot = (
  detail: N8nWorkflowDetailResponse | null,
  options: { developerEnabled?: boolean } = {},
): G1ComplianceGuardSnapshot => {
  if (!detail?.workflow) {
    return buildEmptyG1ComplianceGuardSnapshot();
  }

  return buildG1ComplianceGuardSnapshotFromDecisionSources({
    workflow: detail.workflow,
    decisionSources: collectDecisionSources(detail),
    rawRecords: {
      workflow: detail.workflow,
      latest_executions: detail.latest_executions ?? [],
      approvals: detail.approvals ?? [],
      audit_logs: detail.audit_logs ?? [],
      related_g1_compliance_runs: detail.related_g1_compliance_runs ?? [],
    },
    developerEnabled: options.developerEnabled ?? true,
  });
};

export const formatG1DisplayDateTime = (value?: string | null) => {
  if (!value) return "Never";
  return formatDateTime(value);
};

export const formatG1DecisionLabel = (value: G1DecisionLabel) => value;
