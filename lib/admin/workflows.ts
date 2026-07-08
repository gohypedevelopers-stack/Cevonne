import type { HTMLAttributes } from "react";

export const ADMIN_WORKFLOW_IDS = [
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
  "G12",
  "WF1",
] as const;

export type AdminWorkflowId = (typeof ADMIN_WORKFLOW_IDS)[number];

export const WORKFLOW_UI_STATUSES = [
  "PASS",
  "BLOCK",
  "MANUAL_ONLY",
  "PENDING_APPROVAL",
  "DRY_RUN",
  "RECOMMENDATION_ONLY",
  "DO_NOT_SCALE",
  "FIX_FIRST",
  "NEEDS_EVIDENCE",
  "NOT_RUN_YET",
  "ERROR",
] as const;

export type WorkflowUiStatus = (typeof WORKFLOW_UI_STATUSES)[number];

export type WorkflowRunFieldType = "text" | "number" | "textarea" | "select" | "switch" | "datetime";
export type WorkflowPrimaryActionKind = "open_checks" | "refresh_status" | "generate_recommendation" | "run_dry_run" | "run" | "none";

export type WorkflowPrimaryActionConfig = {
  kind: WorkflowPrimaryActionKind;
  label: string | null;
  note: string | null;
  href: string | null;
  dialogTitle: string | null;
  dialogDescription: string | null;
  submitLabel: string | null;
  hiddenFieldKeys: string[];
};

export type WorkflowRunValue = string | boolean;
export type WorkflowRunValues = Record<string, WorkflowRunValue>;

export type WorkflowRunFieldOption = {
  label: string;
  value: string;
};

export type WorkflowRunField = {
  key: string;
  label: string;
  type: WorkflowRunFieldType;
  defaultValue?: WorkflowRunValue;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  options?: WorkflowRunFieldOption[];
  rows?: number;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  visibleWhen?: (values: WorkflowRunValues) => boolean;
};

export type WorkflowOutcomeDetails = {
  platform?: string | null;
  account?: string | null;
  evidenceSummary?: string | null;
  whatWasChecked?: string | null;
  sourceLabel?: string | null;
  recommendation?: string | null;
  recommendationLabel?: string | null;
  target?: string | null;
  targetWorkflow?: string | null;
  targetPlatform?: string | null;
  riskLevel?: string | null;
  riskNote?: string | null;
  nextStep?: string | null;
  why?: string[] | null;
  evidence?: string[] | null;
  missingData?: string[] | null;
  complianceStatus?: string | null;
  accountHealthStatus?: string | null;
  sourceDataStatus?: string | null;
  consentStatus?: string | null;
  rightsStatus?: string | null;
  offerStatus?: string | null;
  recommendationOnly?: boolean | null;
  notExecuted?: boolean | null;
  actionPacketDrafted?: boolean | null;
  executionStatus?: string | null;
  technicalNotes?: string[] | null;
};

export type WorkflowOutcomeSummary = {
  time: string | null;
  result: WorkflowUiStatus;
  whatWasChecked: string;
  whatHappened: string;
  actionNeeded: string;
  whyItBlocked: string | null;
  sourceLabel: string | null;
  summary?: string | null;
  handledAt?: string | null;
  details?: WorkflowOutcomeDetails | null;
};

export type WorkflowDetailView = {
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
  detailHref: string;
  status: WorkflowUiStatus;
  lastRunAt: string | null;
  latestAssetId?: string | null;
  latestOutcome: WorkflowOutcomeSummary | null;
  recentOutcomes: WorkflowOutcomeSummary[];
  runLabel: string;
  runEnabled: boolean;
  runDisabledReason: string | null;
  emptyStateCopy: string;
  mainActionNeeded: string;
};

export type WorkflowOverviewCard = {
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
  detailHref: string;
  status: WorkflowUiStatus;
  lastRunAt: string | null;
  latestAssetId?: string | null;
  mainActionNeeded: string;
  runEnabled: boolean;
  runDisabledReason: string | null;
  runLabel: string;
  emptyStateCopy: string;
};

export type WorkflowCatalogEntry = {
  id: AdminWorkflowId;
  title: string;
  purpose: string;
  detailHref: string;
  runLabel: string;
  runEnabled: boolean;
  runDisabledReason: string | null;
  emptyStateCopy: string;
  fallbackStatus: WorkflowUiStatus;
  runFields: WorkflowRunField[];
};

const textField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "text",
  ...field,
});

const numberField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "number",
  ...field,
});

const textareaField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "textarea",
  ...field,
});

const selectField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "select",
  ...field,
});

const switchField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "switch",
  ...field,
});

const datetimeField = (field: Omit<WorkflowRunField, "type">): WorkflowRunField => ({
  type: "datetime",
  ...field,
});

const commonRunFields: WorkflowRunField[] = [
  textField({
    key: "requested_by",
    label: "Requested by",
    defaultValue: "admin",
    helper: "Defaults to admin.",
    autoComplete: "name",
    required: true,
  }),
  switchField({
    key: "dry_run",
    label: "Dry run",
    defaultValue: true,
    helper: "Use a safe test run unless live execution is required.",
  }),
  textareaField({
    key: "notes",
    label: "Notes",
    placeholder: "Optional context for the run",
    helper: "Optional context for the run.",
    rows: 3,
  }),
];

const platformOptions: WorkflowRunFieldOption[] = [
  { label: "Meta", value: "META" },
  { label: "Instagram", value: "INSTAGRAM" },
  { label: "WhatsApp", value: "WHATSAPP" },
  { label: "Google Ads", value: "GOOGLE_ADS" },
  { label: "Google Search", value: "GOOGLE_SEARCH" },
  { label: "LinkedIn", value: "LINKEDIN" },
  { label: "Shopify", value: "SHOPIFY" },
  { label: "Website", value: "WEBSITE" },
  { label: "TikTok", value: "TIKTOK" },
  { label: "Other", value: "OTHER" },
];

const workflowSelectorOptions: WorkflowRunFieldOption[] = ADMIN_WORKFLOW_IDS.filter((id) => id !== "WF1").map((id) => ({
  label: `${id} - ${id === "G1" ? "Compliance Guard" : id === "G2" ? "Policy + Account Health Monitor" : id === "G3" ? "CRM + Consent + Attribution" : id === "G4" ? "Content / Landing / Claim Check" : id === "G5" ? "Asset Approval + Manual Publishing Queue" : id === "G6" ? "Messaging + Quiz + Recovery Router" : id === "G7" ? "Inventory + Offer Safety" : id === "G8" ? "UGC + Creator Proof" : id === "G9" ? "Ads + Retargeting Optimizer" : id === "G10" ? "SEO + CRO" : id === "G11" ? "Decision Engine" : "Public Trend Fetcher"}`,
  value: id,
}));

const g12BranchOptions: WorkflowRunFieldOption[] = [
  { label: "General manual fetch", value: "general_public_trend_fetch" },
  { label: "Viral audio trends", value: "viral_audio_trends" },
  { label: "Viral Reel hooks / formats", value: "viral_reel_hooks_formats" },
  { label: "Shade trends", value: "shade_trends" },
  { label: "Reviews / customer pain points", value: "reviews_customer_pain_points" },
  { label: "Creator discovery", value: "creator_discovery" },
  { label: "Competitor monitoring", value: "competitor_monitoring" },
  { label: "Pricing / packaging", value: "pricing_packaging" },
  { label: "Internal winning content", value: "internal_winning_content" },
  { label: "UGC patterns", value: "ugc_patterns" },
  { label: "Google / Search demand", value: "google_search_demand" },
];

const g3LaneOptions: WorkflowRunFieldOption[] = [
  { label: "Consent", value: "consent" },
  { label: "Opt-out", value: "opt_out" },
  { label: "Attribution", value: "attribution" },
  { label: "Purchase", value: "purchase" },
  { label: "Privacy", value: "privacy" },
];

const g3ConsentStatusOptions: WorkflowRunFieldOption[] = [
  { label: "Granted", value: "YES" },
  { label: "Declined", value: "NO" },
  { label: "Unknown", value: "UNKNOWN" },
  { label: "Needs review", value: "REVIEW" },
];

const g5ScheduleModeOptions: WorkflowRunFieldOption[] = [
  { label: "Queue now", value: "queue_now" },
  { label: "Schedule later", value: "schedule_later" },
  { label: "Dry run only", value: "dry_run" },
];

const g9RecommendationOptions: WorkflowRunFieldOption[] = [
  { label: "Budget change", value: "budget_change" },
  { label: "Pause ad", value: "pause_ad" },
  { label: "Update ad", value: "update_ad" },
  { label: "Duplicate ad", value: "duplicate_ad" },
  { label: "Upload audience", value: "upload_audience" },
  { label: "Recommendation only", value: "recommendation_only" },
  { label: "Other", value: "other" },
];

const g10ActionOptions: WorkflowRunFieldOption[] = [
  { label: "SEO update", value: "seo_update" },
  { label: "CRO experiment", value: "cro_experiment" },
  { label: "Copy update", value: "copy_update" },
  { label: "Technical audit", value: "technical_audit" },
  { label: "Other", value: "other" },
];

type G11ReviewAreaConfig = {
  label: string;
  value: string;
  targetWorkflowGroup: string;
  platform: string;
};

type G11RecommendationTypeConfig = {
  label: string;
  value: string;
  requestedDecision: "INVESTIGATE" | "SCALE" | "FIX_FIRST" | "TEST" | null;
  usesWeeklyDigest: boolean;
};

const g11ReviewAreaConfigs: G11ReviewAreaConfig[] = [
  { label: "Ads performance", value: "ads_performance", targetWorkflowGroup: "G9", platform: "META" },
  { label: "Content performance", value: "content_performance", targetWorkflowGroup: "G4", platform: "INSTAGRAM" },
  { label: "SEO / website performance", value: "seo_website_performance", targetWorkflowGroup: "G10", platform: "GOOGLE" },
  { label: "Offers and inventory", value: "offers_inventory", targetWorkflowGroup: "G7", platform: "SHOPIFY" },
  { label: "UGC / creators", value: "ugc_creators", targetWorkflowGroup: "G8", platform: "INSTAGRAM" },
  { label: "Overall business summary", value: "overall_business_summary", targetWorkflowGroup: "ALL", platform: "ALL" },
];

const g11RecommendationTypeConfigs: G11RecommendationTypeConfig[] = [
  { label: "What should we do next?", value: "next_step", requestedDecision: "INVESTIGATE", usesWeeklyDigest: false },
  { label: "Should we scale?", value: "scale", requestedDecision: "SCALE", usesWeeklyDigest: false },
  { label: "What needs fixing?", value: "fixing", requestedDecision: "FIX_FIRST", usesWeeklyDigest: false },
  { label: "What should we test?", value: "test", requestedDecision: "TEST", usesWeeklyDigest: false },
  { label: "Weekly summary", value: "weekly_summary", requestedDecision: null, usesWeeklyDigest: true },
];

export const G11_REVIEW_AREA_OPTIONS: WorkflowRunFieldOption[] = g11ReviewAreaConfigs.map(({ label, value }) => ({ label, value }));
export const G11_RECOMMENDATION_TYPE_OPTIONS: WorkflowRunFieldOption[] = g11RecommendationTypeConfigs.map(({ label, value }) => ({ label, value }));

export const getG11ReviewAreaConfig = (value?: string | null) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return g11ReviewAreaConfigs.find((entry) => entry.value === normalized) ?? null;
};

export const getG11RecommendationTypeConfig = (value?: string | null) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return g11RecommendationTypeConfigs.find((entry) => entry.value === normalized) ?? null;
};

const g6ActionOptions: WorkflowRunFieldOption[] = [
  { label: "Message", value: "message" },
  { label: "Quiz", value: "quiz" },
  { label: "Recovery", value: "recovery" },
];

const g4IntendedUseOptions: WorkflowRunFieldOption[] = [
  { label: "Caption", value: "caption" },
  { label: "Landing page", value: "landing_page" },
  { label: "Creative", value: "creative" },
  { label: "Ad copy", value: "ad_copy" },
  { label: "Other", value: "other" },
];

const g8IntendedUseOptions: WorkflowRunFieldOption[] = [
  { label: "Ad", value: "ad" },
  { label: "Landing page", value: "landing_page" },
  { label: "Social post", value: "social_post" },
  { label: "Email", value: "email" },
  { label: "Other", value: "other" },
];

const g7ProofTypeOptions: WorkflowRunFieldOption[] = [
  { label: "Stock", value: "stock" },
  { label: "Discount", value: "discount" },
  { label: "Urgency", value: "urgency" },
  { label: "Offer", value: "offer" },
  { label: "Other", value: "other" },
];

const g2StatusOptions: WorkflowRunFieldOption[] = [
  { label: "Clean", value: "CLEAN" },
  { label: "Warning", value: "WARNING" },
  { label: "Restricted", value: "RESTRICTED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Unknown", value: "UNKNOWN" },
];

export const WORKFLOW_CATALOG: Record<AdminWorkflowId, WorkflowCatalogEntry> = {
  G1: {
    id: "G1",
    title: "G1 - Compliance Guard",
    purpose: "Checks whether risky workflow actions are safe before they run.",
    detailHref: "/admin/ai-automations/g1-compliance-guard",
    runLabel: "View Safety Checks",
    runEnabled: false,
    runDisabledReason: "This workflow is inspect-only and cannot be run manually.",
    emptyStateCopy: "This workflow is ready. View Safety Checks to inspect the first compliance gate decision.",
    fallbackStatus: "NOT_RUN_YET",
    runFields: [
      ...commonRunFields,
      textField({
        key: "workflow_requesting_check",
        label: "Workflow requesting check",
        placeholder: "G9 Ads, G5 Publishing, etc.",
        helper: "Which workflow is asking for this check?",
        required: true,
      }),
      selectField({
        key: "action_type",
        label: "Action type",
        defaultValue: "workflow_action",
        helper: "What kind of action is being checked?",
        options: [
          { label: "Workflow action", value: "workflow_action" },
          { label: "Ad change", value: "ad_change" },
          { label: "Publish content", value: "publish_content" },
          { label: "Message or DM", value: "message_or_dm" },
          { label: "Content claim", value: "content_claim" },
          { label: "Other", value: "other" },
        ],
        required: true,
      }),
      selectField({
        key: "platform",
        label: "Platform",
        defaultValue: "META",
        options: platformOptions,
        helper: "Where the action will run.",
        required: true,
      }),
    ],
  },
  G2: {
    id: "G2",
    title: "G2 - Policy + Account Health Monitor",
    purpose: "Tracks account health, policy status, API/tool changes, and manual review needs.",
    detailHref: "/dashboard/n8n-automations/g2",
    runLabel: "Refresh Status",
    runEnabled: false,
    runDisabledReason: "This workflow refreshes status from the source of truth.",
    emptyStateCopy: "This workflow is ready. Refresh Status to load the first account health snapshot.",
    fallbackStatus: "PENDING_APPROVAL",
    runFields: [
      ...commonRunFields,
      selectField({
        key: "platform",
        label: "Platform",
        defaultValue: "META",
        options: platformOptions,
        helper: "Where the account lives.",
        required: true,
      }),
      textField({
        key: "account_id",
        label: "Account ID",
        placeholder: "acct_1234 or similar",
        helper: "The account being checked.",
        required: true,
      }),
      selectField({
        key: "status",
        label: "Status",
        defaultValue: "CLEAN",
        options: g2StatusOptions,
        helper: "Current health state for the account.",
        required: true,
      }),
      textField({
        key: "evidence_url",
        label: "Evidence URL",
        placeholder: "Link to proof or review notes",
        helper: "Shown only when the status needs evidence.",
        inputMode: "url",
        visibleWhen: (values) =>
          ["CLEAN", "WARNING", "RESTRICTED", "SUSPENDED"].includes(String(values.status ?? "").toUpperCase()),
      }),
    ],
  },
  G3: {
    id: "G3",
    title: "G3 - CRM + Consent + Attribution",
    purpose: "Manages consent, opt-outs, attribution, purchases, and privacy requests.",
    detailHref: "/dashboard/n8n-automations/g3",
    runLabel: "Record Consent",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Record Consent to log the first consent event.",
    fallbackStatus: "PENDING_APPROVAL",
    runFields: [
      ...commonRunFields,
      textField({
        key: "contact_identifier",
        label: "Contact identifier",
        placeholder: "Contact ID, email, or phone hash",
        helper: "Use the contact ID or a masked identifier.",
        required: true,
      }),
      selectField({
        key: "channel",
        label: "Channel",
        defaultValue: "EMAIL",
        options: [
          { label: "Email", value: "EMAIL" },
          { label: "SMS", value: "SMS" },
          { label: "WhatsApp", value: "WHATSAPP" },
          { label: "Instagram", value: "INSTAGRAM" },
          { label: "Website", value: "WEBSITE" },
          { label: "Other", value: "OTHER" },
        ],
        helper: "Where the event belongs.",
        required: true,
      }),
      selectField({
        key: "lane",
        label: "Lane",
        defaultValue: "consent",
        options: g3LaneOptions,
        helper: "Choose the type of G3 event.",
        required: true,
      }),
      selectField({
        key: "consent_status",
        label: "Consent status",
        defaultValue: "YES",
        options: g3ConsentStatusOptions,
        helper: "Shown for consent events.",
        visibleWhen: (values) => values.lane === "consent",
      }),
      textField({
        key: "opt_out_reason",
        label: "Opt-out reason",
        placeholder: "unsubscribe, do not contact, etc.",
        helper: "Shown for opt-out events.",
        visibleWhen: (values) => values.lane === "opt_out",
      }),
      textField({
        key: "attribution_event",
        label: "Attribution event",
        placeholder: "Campaign, source, or touchpoint",
        helper: "Shown for attribution events.",
        visibleWhen: (values) => values.lane === "attribution",
      }),
      numberField({
        key: "purchase_value",
        label: "Purchase value",
        placeholder: "0",
        helper: "Shown for purchase events.",
        inputMode: "numeric",
        visibleWhen: (values) => values.lane === "purchase",
      }),
      selectField({
        key: "request_type",
        label: "Request type",
        defaultValue: "ACCESS",
        options: [
          { label: "Access", value: "ACCESS" },
          { label: "Delete", value: "DELETE" },
          { label: "Correction", value: "CORRECTION" },
          { label: "Export", value: "EXPORT" },
        ],
        helper: "Shown for privacy events.",
        visibleWhen: (values) => values.lane === "privacy",
      }),
    ],
  },
  G4: {
    id: "G4",
    title: "G4 - Content / Landing / Claim Check",
    purpose: "Checks captions, claims, landing-page wording, and risky language before content moves forward.",
    detailHref: "/dashboard/n8n-automations/g4",
    runLabel: "Start Content Check",
    runEnabled: false,
    runDisabledReason: "Content checks are available through the approved workflow trigger.",
    emptyStateCopy: "No content checks yet. Start a content check to review captions, claims, or landing-page wording before use.",
    fallbackStatus: "MANUAL_ONLY",
    runFields: [
      ...commonRunFields,
      textareaField({
        key: "content_text",
        label: "Content text",
        placeholder: "Paste the caption, claim, or page copy",
        helper: "What should be checked?",
        rows: 5,
        required: true,
      }),
      selectField({
        key: "intended_use",
        label: "Intended use",
        defaultValue: "caption",
        options: g4IntendedUseOptions,
        helper: "Where this will be used.",
        required: true,
      }),
      selectField({
        key: "platform",
        label: "Platform",
        defaultValue: "INSTAGRAM",
        options: platformOptions,
        helper: "Where the content will appear.",
        required: true,
      }),
    ],
  },
  G5: {
    id: "G5",
    title: "G5 - Asset Approval + Manual Publishing Queue",
    purpose: "Tracks approved assets, human approval, and manual publish proof before anything goes live.",
    detailHref: "/admin/ai-automations/g5-asset-approval",
    runLabel: "Review Pending Asset",
    runEnabled: false,
    runDisabledReason: "G5 is controlled through evidence, approval, dry-run, and manual publish proof.",
    emptyStateCopy: "No real G5 outcomes have been recorded yet. Assets stay queued until the required approval and publish proof are present.",
    fallbackStatus: "NOT_RUN_YET",
    runFields: [
      ...commonRunFields,
      textField({
        key: "asset_id",
        label: "Asset ID",
        placeholder: "asset_1234",
        helper: "The asset that will be reviewed.",
        required: true,
      }),
      selectField({
        key: "platform",
        label: "Platform",
        defaultValue: "INSTAGRAM",
        options: platformOptions,
        helper: "Where the asset will publish.",
        required: true,
      }),
      selectField({
        key: "schedule_mode",
        label: "Schedule mode",
        defaultValue: "queue_now",
        options: g5ScheduleModeOptions,
        helper: "How the asset should be handled.",
        required: true,
      }),
      datetimeField({
        key: "scheduled_for",
        label: "Schedule for",
        helper: "Shown when you choose schedule later.",
        visibleWhen: (values) => values.schedule_mode === "schedule_later",
      }),
    ],
  },
  G6: {
    id: "G6",
    title: "G6 - Messaging + Quiz + Recovery Router",
    purpose: "Routes quiz, WhatsApp, messaging, and recovery flows safely.",
    detailHref: "/dashboard/n8n-automations/g6",
    runLabel: "Run Quiz Dry Run",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Run Quiz Dry Run to test the messaging route.",
    fallbackStatus: "MANUAL_ONLY",
    runFields: [
      ...commonRunFields,
      textField({
        key: "contact_reference",
        label: "Contact ID or phone hash",
        placeholder: "contact_1234 or masked phone hash",
        helper: "Use a safe identifier only.",
        required: true,
      }),
      selectField({
        key: "channel",
        label: "Channel",
        defaultValue: "WHATSAPP",
        options: [
          { label: "WhatsApp", value: "WHATSAPP" },
          { label: "Instagram", value: "INSTAGRAM" },
          { label: "SMS", value: "SMS" },
          { label: "Email", value: "EMAIL" },
          { label: "Other", value: "OTHER" },
        ],
        helper: "Where the conversation happens.",
        required: true,
      }),
      selectField({
        key: "action",
        label: "Message / quiz / recovery",
        defaultValue: "message",
        options: g6ActionOptions,
        helper: "Pick the kind of flow to run.",
        required: true,
      }),
      textareaField({
        key: "message_or_action",
        label: "Message or action details",
        placeholder: "Short message, quiz step, or recovery details",
        helper: "Keep it plain and client-friendly.",
        rows: 4,
        required: true,
      }),
    ],
  },
  G7: {
    id: "G7",
    title: "G7 - Inventory + Offer Safety",
    purpose: "Verifies inventory, discount expiry, offer URLs, and urgency claims.",
    detailHref: "/dashboard/n8n-automations/g7",
    runLabel: "Check Proof",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "No proof checks have been run yet. Click Check Proof to verify a stock, discount, or urgency claim.",
    fallbackStatus: "NEEDS_EVIDENCE",
    runFields: [
      ...commonRunFields,
      textField({
        key: "product_or_sku",
        label: "Product or SKU",
        placeholder: "Product name or SKU",
        helper: "The item that needs checking.",
        required: true,
      }),
      textareaField({
        key: "offer_or_stock_claim",
        label: "Offer / discount / stock claim",
        placeholder: "What claim should be checked?",
        helper: "Share the offer or proof that needs review.",
        rows: 4,
        required: true,
      }),
      selectField({
        key: "proof_type",
        label: "Proof type",
        defaultValue: "stock",
        options: g7ProofTypeOptions,
        helper: "Which proof is being checked?",
      }),
    ],
  },
  G8: {
    id: "G8",
    title: "G8 - UGC + Creator Proof",
    purpose: "Tracks UGC, creator permission, rights, and disclosure proof.",
    detailHref: "/dashboard/n8n-automations/g8",
    runLabel: "Check UGC Rights",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Check UGC Rights to verify permissions.",
    fallbackStatus: "NEEDS_EVIDENCE",
    runFields: [
      ...commonRunFields,
      textField({
        key: "ugc_source_url",
        label: "UGC source URL",
        placeholder: "Link to the public source",
        helper: "Use a public source link only.",
        inputMode: "url",
        required: true,
      }),
      textField({
        key: "creator_handle",
        label: "Creator handle",
        placeholder: "@creatorname",
        helper: "The creator or account involved.",
        required: true,
      }),
      selectField({
        key: "intended_use",
        label: "Intended use",
        defaultValue: "ad",
        options: g8IntendedUseOptions,
        helper: "Where the content would be used.",
        required: true,
      }),
    ],
  },
  G9: {
    id: "G9",
    title: "G9 - Ads + Retargeting Optimizer",
    purpose: "Reviews ads and recommends safe optimization actions.",
    detailHref: "/dashboard/n8n-automations/g9",
    runLabel: "Generate Recommendation",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Generate a recommendation to create the first outcome.",
    fallbackStatus: "DRY_RUN",
    runFields: [
      ...commonRunFields,
      selectField({
        key: "platform",
        label: "Platform",
        defaultValue: "META",
        options: platformOptions,
        helper: "Where the recommendation applies.",
        required: true,
      }),
      textField({
        key: "account_id",
        label: "Account ID",
        placeholder: "ad account ID",
        helper: "The ad account being reviewed.",
        required: true,
      }),
      selectField({
        key: "recommendation_action_type",
        label: "Recommendation / action type",
        defaultValue: "budget_change",
        options: g9RecommendationOptions,
        helper: "What kind of recommendation is being made?",
        required: true,
      }),
      textField({
        key: "campaign_adset_ad_id",
        label: "Campaign / ad set / ad ID",
        placeholder: "Optional specific ID",
        helper: "Only if a specific object needs attention.",
      }),
      textareaField({
        key: "metrics",
        label: "Metrics",
        placeholder: "CTR, CPA, ROAS, spend, etc.",
        helper: "Keep this short and readable.",
        rows: 3,
      }),
      textareaField({
        key: "rollback_payload",
        label: "Rollback payload",
        placeholder: "Optional rollback notes for dry-run changes",
        helper: "Only needed for write-action dry runs.",
        rows: 3,
      }),
    ],
  },
  G10: {
    id: "G10",
    title: "G10 - SEO + CRO",
    purpose: "Creates SEO / CRO recommendations and dry-run website improvements.",
    detailHref: "/dashboard/n8n-automations/g10",
    runLabel: "Generate SEO/CRO Recommendation",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Generate SEO/CRO Recommendation to create the first recommendation.",
    fallbackStatus: "PENDING_APPROVAL",
    runFields: [
      ...commonRunFields,
      textField({
        key: "page_url",
        label: "Page URL",
        placeholder: "https://example.com/page",
        helper: "The page to review.",
        inputMode: "url",
        required: true,
      }),
      selectField({
        key: "seo_cro_action_type",
        label: "SEO / CRO action type",
        defaultValue: "seo_update",
        options: g10ActionOptions,
        helper: "What should be reviewed?",
        required: true,
      }),
      textareaField({
        key: "recommendation_notes",
        label: "Recommendation notes",
        placeholder: "Short notes on the suggested change",
        helper: "Keep the recommendation concise.",
        rows: 4,
        required: true,
      }),
    ],
  },
  G11: {
    id: "G11",
    title: "G11 — Decision Engine",
    purpose: "Creates safe business recommendations. No live action is executed.",
    detailHref: "/dashboard/n8n-automations/g11",
    runLabel: "Generate Recommendation",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "No recommendation has been created yet. Click \"Generate Recommendation\" to create one.",
    fallbackStatus: "RECOMMENDATION_ONLY",
    runFields: [
      selectField({
        key: "focus_area",
        label: "What should G11 review?",
        defaultValue: "ads_performance",
        options: G11_REVIEW_AREA_OPTIONS,
        required: true,
      }),
      selectField({
        key: "recommendation_type",
        label: "What kind of recommendation do you want?",
        defaultValue: "next_step",
        options: G11_RECOMMENDATION_TYPE_OPTIONS,
        required: true,
      }),
      textareaField({
        key: "note",
        label: "Add a note for G11",
        placeholder: "Example: Check if Meta ads should be scaled this week.",
        rows: 4,
      }),
    ],
  },
  G12: {
    id: "G12",
    title: "G12 - Public Trend Fetcher",
    purpose: "Fetches safe public trend signals and stores clean insights.",
    detailHref: "/admin/automations/g12-trend-fetcher",
    runLabel: "Run Dry Run",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: "This workflow is ready. Run a dry run to fetch the first public trend snapshot.",
    fallbackStatus: "DRY_RUN",
    runFields: [
      ...commonRunFields,
      selectField({
        key: "platforms",
        label: "Platforms",
        defaultValue: "both",
        options: [
          { label: "Instagram + TikTok", value: "both" },
          { label: "Instagram only", value: "instagram" },
          { label: "TikTok only", value: "tiktok" },
        ],
        helper: "Where to fetch public trend signals.",
        required: true,
      }),
      textField({
        key: "query",
        label: "Query",
        defaultValue: "trend signals",
        placeholder: "What should be fetched?",
        helper: "Short search topic or phrase.",
        required: true,
      }),
      numberField({
        key: "fetch_limit",
        label: "Fetch limit",
        defaultValue: "50",
        placeholder: "50",
        helper: "How many results should be requested?",
        inputMode: "numeric",
        required: true,
      }),
      selectField({
        key: "branch_key",
        label: "Branch / type",
        defaultValue: "general_public_trend_fetch",
        options: g12BranchOptions,
        helper: "Choose the branch that best fits the request.",
      }),
    ],
  },
  WF1: {
    id: "WF1",
    title: "WF1 - Instagram Scheduler",
    purpose: "Schedules approved Instagram content safely after review and approvals.",
    detailHref: "/dashboard/n8n-automations/wf1-instagram-scheduler",
    runLabel: "Approval only",
    runEnabled: false,
    runDisabledReason: "This workflow runs automatically or needs manual approval first.",
    emptyStateCopy: "This workflow runs automatically or needs manual approval first.",
    fallbackStatus: "PENDING_APPROVAL",
    runFields: commonRunFields,
  },
};

export const WORKFLOW_ORDER: AdminWorkflowId[] = [...ADMIN_WORKFLOW_IDS];

export const normalizeWorkflowId = (value: string | null | undefined): AdminWorkflowId | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "WF1" || normalized === "WF1-INSTAGRAM-SCHEDULER") {
    return "WF1";
  }

  if (/^[QG]\d+$/.test(normalized)) {
    const asG = normalized.replace(/^Q/, "G") as AdminWorkflowId;
    if (WORKFLOW_CATALOG[asG]) {
      return asG;
    }
  }

  const byRoute = (Object.values(WORKFLOW_CATALOG) as WorkflowCatalogEntry[]).find((entry) => {
    const slug = entry.detailHref.split("/").filter(Boolean).pop()?.toUpperCase() ?? "";
    return slug === normalized;
  });

  return byRoute?.id ?? null;
};

export const getWorkflowCatalogEntry = (workflowId: AdminWorkflowId | string) => {
  const normalized = normalizeWorkflowId(workflowId);
  return normalized ? WORKFLOW_CATALOG[normalized] : null;
};

export const getWorkflowDetailHref = (workflowId: AdminWorkflowId | string) =>
  getWorkflowCatalogEntry(workflowId)?.detailHref ?? "/dashboard/n8n-automations";

export const getWorkflowStatusTone = (status: WorkflowUiStatus) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "BLOCK":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "MANUAL_ONLY":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-100 text-sky-800";
    case "DRY_RUN":
      return "border-cyan-200 bg-cyan-100 text-cyan-800";
    case "RECOMMENDATION_ONLY":
      return "border-violet-200 bg-violet-100 text-violet-800";
    case "DO_NOT_SCALE":
      return "border-orange-200 bg-orange-100 text-orange-800";
    case "FIX_FIRST":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "NOT_RUN_YET":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "ERROR":
    default:
      return "border-rose-200 bg-rose-100 text-rose-800";
  }
};

export const getWorkflowStatusMessage = (status: WorkflowUiStatus) => {
  switch (status) {
    case "PASS":
      return "Workflow ran successfully.";
    case "BLOCK":
      return "Workflow safely stopped the action.";
    case "MANUAL_ONLY":
      return "Human review is needed before this can continue.";
    case "PENDING_APPROVAL":
      return "This is waiting for approval.";
    case "DRY_RUN":
      return "Workflow test completed. No live external action was performed.";
    case "RECOMMENDATION_ONLY":
      return "This workflow created a recommendation only. Nothing was executed.";
    case "DO_NOT_SCALE":
      return "This should not be scaled right now.";
    case "FIX_FIRST":
      return "Fix the issue before continuing.";
    case "NEEDS_EVIDENCE":
      return "More proof is needed before this can continue.";
    case "NOT_RUN_YET":
      return "No real workflow outcome has been recorded yet.";
    case "ERROR":
    default:
      return "Something failed while running the workflow. Admin/developer review is needed.";
  }
};

export const getWorkflowStatusLabel = (status: WorkflowUiStatus) => {
  switch (status) {
    case "PASS":
      return "Pass";
    case "BLOCK":
      return "Blocked";
    case "MANUAL_ONLY":
      return "Manual review";
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "DRY_RUN":
      return "Dry run";
    case "RECOMMENDATION_ONLY":
      return "Recommendation only";
    case "DO_NOT_SCALE":
      return "Do not scale";
    case "FIX_FIRST":
      return "Fix first";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "NOT_RUN_YET":
      return "Not run yet";
    case "ERROR":
    default:
      return "Error";
  }
};

const genericActionNeededByStatus: Record<WorkflowUiStatus, string> = {
  PASS: "No action needed.",
  BLOCK: "Fix the issue before continuing.",
  MANUAL_ONLY: "Review manually before continuing.",
  PENDING_APPROVAL: "Approve or reject this request.",
  DRY_RUN: "Review the test result. No live action was performed.",
  RECOMMENDATION_ONLY: "Review the recommendation. Nothing was executed.",
  DO_NOT_SCALE: "Do not scale this right now.",
  FIX_FIRST: "Fix the issue before continuing.",
  NEEDS_EVIDENCE: "Add proof or evidence first.",
  NOT_RUN_YET: "Run the workflow to create the first outcome.",
  ERROR: "Ask developer/admin to check the workflow run.",
};

const reasonTranslations: Array<[RegExp, string]> = [
  [/HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED/i, "Human approval is needed before this can continue."],
  [/ACCOUNT_HEALTH_NOT_CLEAN/i, "Check account health first."],
  [/ACCOUNT_HEALTH_UNKNOWN/i, "Account health is unknown. Check the account first."],
  [/CONSENT_MISSING/i, "Add valid customer consent first."],
  [/UGC_RIGHTS_MISSING/i, "Add creator / UGC permission proof."],
  [/CLAIM_EVIDENCE_MISSING/i, "Add approved claim evidence first."],
  [/OFFER_PROOF/i, "Verify offer / stock proof."],
  [/STOCK_PROOF/i, "Verify offer / stock proof."],
  [/DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER/i, "Use the approved DM partner route."],
  [/GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES/i, "Use approved Google sources only."],
  [/G11_DIRECT_WRITE_ATTEMPT_BLOCKED/i, "G11 cannot execute actions. It can only recommend."],
  [/PENDING_APPROVAL/i, "Approve or reject this request."],
  [/NEEDS_EVIDENCE/i, "Add proof or evidence first."],
  [/FIX_FIRST/i, "Fix the issue before continuing."],
];

const humanizeTechnicalText = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());

const looksTechnical = (value: string) =>
  /^[A-Z0-9_:\-/]+$/.test(value) || value.includes("{") || value.includes("}") || value.includes("[") || value.includes("]") || /\b[A-Z0-9_]+=/.test(value);

export const sanitizeDisplayText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.includes('"')) {
    return null;
  }

  const withoutUrls = trimmed.replace(/https?:\/\/\S+/gi, "");
  const collapsed = withoutUrls.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return null;
  }

  if (looksTechnical(collapsed)) {
    return null;
  }

  return collapsed;
};

export const humanizeReasonText = (value: string | null | undefined) => {
  const sanitized = sanitizeDisplayText(value);
  if (sanitized) {
    return sanitized;
  }

  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }

  for (const [pattern, translated] of reasonTranslations) {
    if (pattern.test(text)) {
      return translated;
    }
  }

  return humanizeTechnicalText(text);
};

export const normalizeWorkflowUiStatus = (value: unknown, fallback: WorkflowUiStatus = "ERROR"): WorkflowUiStatus => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";

  switch (normalized) {
    case "PASS":
    case "ACTIVE":
    case "COMPLETE":
    case "COMPLETED":
    case "READY":
    case "APPROVED":
    case "CLEAN":
    case "VERIFIED":
    case "OK":
    case "LIVE":
    case "SUCCESS":
    case "YES":
    case "ALLOWED":
    case "ALLOW":
    case "ENABLED":
      return "PASS";
    case "BLOCK":
    case "BLOCKED":
    case "FAIL":
    case "FAILED":
    case "REJECTED":
    case "NO":
    case "DENIED":
    case "DECLINED":
    case "RESTRICTED":
    case "SUSPENDED":
    case "STOPPED":
    case "DISABLED":
      return "BLOCK";
    case "MANUAL_ONLY":
    case "REVIEW":
    case "NEEDS_REVIEW":
    case "MANUAL":
      return "MANUAL_ONLY";
    case "PENDING_APPROVAL":
    case "PENDING":
    case "QUEUED":
    case "ACCEPTED":
    case "SCHEDULED":
    case "WAITING":
    case "AWAITING_APPROVAL":
    case "APPROVAL_REQUIRED":
    case "UNKNOWN":
      return "PENDING_APPROVAL";
    case "DRY_RUN":
    case "TEST":
    case "TESTING":
    case "SAFE_TEST":
      return "DRY_RUN";
    case "RECOMMENDATION_ONLY":
    case "RECOMMENDATION":
    case "SUGGESTION":
      return "RECOMMENDATION_ONLY";
    case "DO_NOT_SCALE":
    case "DO_NOT_SCALE_YET":
    case "DONT_SCALE":
      return "DO_NOT_SCALE";
    case "FIX_FIRST":
    case "NEEDS_FIX":
    case "FIX_REQUIRED":
      return "FIX_FIRST";
    case "NEEDS_EVIDENCE":
    case "EVIDENCE_REQUIRED":
    case "PROOF_REQUIRED":
    case "MISSING_EVIDENCE":
      return "NEEDS_EVIDENCE";
    case "NOT_RUN_YET":
    case "NOT_RUN":
    case "NO_RUN":
      return "NOT_RUN_YET";
    case "ERROR":
    case "FAILED_SYSTEM":
    case "SYSTEM_ERROR":
      return "ERROR";
    default:
      return fallback;
  }
};

const keywordMessages: Array<[RegExp, string]> = [
  [/approval/i, "Approve or reject this request."],
  [/account/i, "Check account health first."],
  [/consent/i, "Add valid customer consent first."],
  [/rights|ugc|creator/i, "Add creator / UGC permission proof."],
  [/offer|stock|discount/i, "Verify offer / stock proof."],
  [/claim|evidence|proof/i, "Add approved claim evidence first."],
  [/scale/i, "Do not scale this right now."],
  [/fix/i, "Fix the issue before continuing."],
];

export const getWorkflowActionNeeded = (input: {
  workflowId: AdminWorkflowId;
  status: WorkflowUiStatus;
  reason?: string | null;
  rowHints?: string[];
}) => {
  const explicitReason = humanizeReasonText(input.reason);
  if (explicitReason && input.status !== "PASS") {
    return explicitReason;
  }

  if (input.status !== "BLOCK") {
    return genericActionNeededByStatus[input.status];
  }

  const hintSource = `${input.reason ?? ""} ${(input.rowHints ?? []).join(" ")}`.trim();
  for (const [pattern, message] of keywordMessages) {
    if (pattern.test(hintSource)) {
      return message;
    }
  }

  switch (input.workflowId) {
    case "G2":
      return "Check account health first.";
    case "G3":
      return "Add valid customer consent first.";
    case "G6":
      return "Use the approved partner route first.";
    case "G7":
      return "Verify offer / stock proof.";
    case "G8":
      return "Add creator / UGC permission proof.";
    case "G9":
      return "Review the recommendation before running again.";
    case "G10":
      return "Add approved claim evidence first.";
    case "G11":
      return "Review the recommendation before continuing.";
    default:
      return "Fix the issue before continuing.";
  }
};

export const getWorkflowDetailMessage = (status: WorkflowUiStatus, reason?: string | null) => {
  if (status === "BLOCK" && reason) {
    const translated = humanizeReasonText(reason);
    return translated ?? genericActionNeededByStatus.BLOCK;
  }

  return getWorkflowStatusMessage(status);
};

export const getWorkflowRouteLabel = (workflowId: AdminWorkflowId) => {
  switch (workflowId) {
    case "G1":
      return "G1";
    case "G2":
      return "G2";
    case "G3":
      return "G3";
    case "G4":
      return "G4";
    case "G5":
      return "G5";
    case "G6":
      return "G6";
    case "G7":
      return "G7";
    case "G8":
      return "G8";
    case "G9":
      return "G9";
    case "G10":
      return "G10";
    case "G11":
      return "G11";
    case "G12":
      return "G12";
    case "WF1":
      return "WF1";
    default:
      return workflowId;
  }
};

export const formatWorkflowDateTime = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatWorkflowRelativeTime = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ];

  let unit: Intl.RelativeTimeFormatUnit = "day";
  let valueInUnits = diff;

  for (const [threshold, nextUnit] of units) {
    if (abs < threshold) {
      unit = nextUnit;
      break;
    }

    valueInUnits = Math.round(valueInUnits / threshold);
    unit = nextUnit;
  }

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(valueInUnits, unit);
};

export const maskIdentifier = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    if (!domain) {
      return `${trimmed.slice(0, 1)}***`;
    }

    return `${name.slice(0, 1)}***@${domain}`;
  }

  if (/^\+?\d[\d\s()-]{5,}$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
  }

  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
};

export const cleanWorkflowText = (value: string | null | undefined) => sanitizeDisplayText(value) ?? null;

export const getWorkflowEmptyStateActionNeeded = (workflowId: AdminWorkflowId) => {
  switch (workflowId) {
    case "G1":
      return "View Safety Checks to inspect the latest compliance gate decision.";
    case "G2":
      return "Refresh Status to load the latest account health snapshot.";
    case "G3":
      return "Record the first consent event or privacy update.";
    case "G4":
      return "Check content to see the latest result.";
    case "G5":
      return "Review publishing readiness before trying to schedule or publish.";
    case "G6":
      return "Run Quiz Dry Run to check the safe messaging route.";
    case "G7":
      return "Click Check Proof to verify a stock, discount, or urgency claim.";
    case "G8":
      return "Check UGC Rights before reusing creator content.";
    case "G9":
    case "G11":
      return "Generate a recommendation to create the first outcome.";
    case "G10":
      return "Generate the first SEO/CRO recommendation.";
    case "G12":
      return "Run a dry run to fetch the first public trend snapshot.";
    case "WF1":
      return "Wait for approval or automatic processing.";
    default:
      return "Run the workflow to create the first outcome.";
  }
};

export const getWorkflowPrimaryActionConfig = (
  workflowId: AdminWorkflowId,
  runLabel: string,
  runEnabled: boolean,
): WorkflowPrimaryActionConfig => {
  switch (workflowId) {
    case "G1":
      return {
        kind: "open_checks",
        label: "View Safety Checks",
        note: "Jump to the latest compliance checks.",
        href: "#latest-outcome",
        dialogTitle: null,
        dialogDescription: null,
        submitLabel: null,
        hiddenFieldKeys: [],
      };
    case "G2":
      return {
        kind: "refresh_status",
        label: "Refresh Status",
        note: "Reload the latest account health snapshot.",
        href: null,
        dialogTitle: null,
        dialogDescription: null,
        submitLabel: null,
        hiddenFieldKeys: [],
      };
    case "G4":
      return {
        kind: "none",
        label: null,
        note: "Content checks are available through the approved workflow trigger.",
        href: null,
        dialogTitle: null,
        dialogDescription: null,
        submitLabel: null,
        hiddenFieldKeys: [],
      };
    case "G5":
      return {
        kind: "none",
        label: "Review Pending Asset",
        note: "Open the publishing scheduler to review the asset, checks, and readiness state.",
        href: null,
        dialogTitle: null,
        dialogDescription: null,
        submitLabel: null,
        hiddenFieldKeys: [],
      };
    case "G9":
      return {
        kind: "generate_recommendation",
        label: "Generate Recommendation",
        note: "Create a recommendation only. No live action will be executed.",
        href: null,
        dialogTitle: "Generate Recommendation",
        dialogDescription: "Create a recommendation only. No live action will be executed.",
        submitLabel: "Generate Recommendation",
        hiddenFieldKeys: ["dry_run"],
      };
    case "G11":
      return {
        kind: "generate_recommendation",
        label: "Generate Recommendation",
        note: "Create a recommendation only. No live action will be executed.",
        href: null,
        dialogTitle: "Generate Recommendation",
        dialogDescription: "G11 will review available workflow data and suggest what to do next. Nothing will be executed.",
        submitLabel: "Generate Recommendation",
        hiddenFieldKeys: [],
      };
    case "G12":
      return {
        kind: "run_dry_run",
        label: "Run Dry Run",
        note: "Safe test fetch only.",
        href: null,
        dialogTitle: "Run Dry Run",
        dialogDescription: "Fetch public trend signals in safe test mode only.",
        submitLabel: "Run Dry Run",
        hiddenFieldKeys: ["dry_run"],
      };
    case "WF1":
      return {
        kind: "none",
        label: null,
        note: "This workflow runs automatically or needs manual approval first.",
        href: null,
        dialogTitle: null,
        dialogDescription: null,
        submitLabel: null,
        hiddenFieldKeys: [],
      };
    default:
      return runEnabled
        ? {
            kind: "run",
            label: runLabel || "Run Workflow",
            note: null,
            href: null,
            dialogTitle: runLabel || "Run Workflow",
            dialogDescription: "Use the smallest safe set of fields. The workflow keeps dry run on unless a live run is intentionally selected.",
            submitLabel: runLabel || "Run Workflow",
            hiddenFieldKeys: [],
          }
        : {
            kind: "none",
            label: null,
            note: null,
            href: null,
            dialogTitle: null,
            dialogDescription: null,
            submitLabel: null,
            hiddenFieldKeys: [],
          };
  }
};

export const getWorkflowOutcomeSectionTitles = (workflowId: AdminWorkflowId) => {
  switch (workflowId) {
    case "G1":
      return {
        latest: "Latest Compliance Check",
        recent: "Recent Safety Checks",
      };
    case "G2":
      return {
        latest: "Latest Account Health",
        recent: "Recent Health Checks",
      };
    case "G3":
      return {
        latest: "Latest Consent Event",
        recent: "Recent Consent Events",
      };
    case "G6":
      return {
        latest: "Latest Messaging Result",
        recent: "Recent Messaging Results",
      };
    case "G7":
      return {
        latest: "Latest Proof",
        recent: "Recent Proof Checks",
      };
    case "G8":
      return {
        latest: "Latest Rights Check",
        recent: "Recent Rights Checks",
      };
    case "G9":
    case "G11":
      return {
        latest: "Latest Recommendation",
        recent: "Recent Recommendations",
      };
    case "G10":
      return {
        latest: "Latest SEO/CRO Recommendation",
        recent: "Recent SEO/CRO Outcomes",
      };
    case "G5":
      return {
        latest: "Latest Publishing Outcome",
        recent: "Recent Publishing Outcomes",
      };
    case "G12":
      return {
        latest: "Latest Fetch Result",
        recent: "Recent Fetch Results",
      };
    default:
      return {
        latest: "Latest Outcome",
        recent: "Recent Outcomes",
      };
  }
};

export const getWorkflowStatusDetailCopy = (workflowId: AdminWorkflowId, status: WorkflowUiStatus) => {
  if (workflowId === "G11" || workflowId === "G9") {
    return "Creates safe business recommendations. No live action is executed.";
  }

  if (workflowId === "G3") {
    return "This page records consent, opt-outs, attribution, purchases, and privacy requests.";
  }

  if (workflowId === "G6") {
    return "This page keeps messaging, quiz, and recovery routes on the approved partner path.";
  }

  if (workflowId === "G7") {
    return "This page verifies stock proof, discount expiry, offer URLs, and urgency claims before anything is used.";
  }

  if (workflowId === "G8") {
    return "This page checks rights, disclosure, and creator proof before content is reused.";
  }

  if (workflowId === "G10") {
    return "This page creates SEO and CRO recommendations without unsafe live changes.";
  }

  if (workflowId === "G5") {
    return "Publishing is controlled here. Review the asset, confirm the dry-run, and only schedule when every gate is green.";
  }

  if (workflowId === "G1" && status === "BLOCK") {
    return "Safety checks blocked this action.";
  }

  if (workflowId === "G2") {
    return "This page reflects the latest account health, policy status, and manual review snapshot.";
  }

  return getWorkflowStatusMessage(status);
};
