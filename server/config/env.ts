import { normalizeOriginUrl } from "./url.js";

const toNumber = (value: string | number | null | undefined, fallback: number | undefined = undefined) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | boolean | null | undefined, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const n8nBaseUrl = normalizeOriginUrl(process.env.N8N_BASE_URL || "https://n8n.cevonne.com/webhook");

const resolveWebhookUrl = (urlValue: string | undefined, pathValue: string | undefined) => {
  const directUrl = urlValue?.trim();
  if (directUrl) {
    return directUrl;
  }

  const path = pathValue?.trim();
  if (!path) {
    return "";
  }

  return `${n8nBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
};

const resolveG4ContentCheckPath = () => {
  const landingPath = process.env.N8N_G4_CONTENT_LANDING_CHECK_PATH?.trim();
  if (landingPath) {
    return landingPath;
  }

  const legacyPath = process.env.N8N_G4_CONTENT_CHECK_PATH?.trim();
  if (legacyPath && !["g4-content-check", "g4-content-review"].includes(legacyPath)) {
    return legacyPath;
  }

  return "g4-content-landing-check";
};

export const env = Object.freeze({
  port: toNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    "",
  jwtSecret: process.env.JWT_SECRET || "dev_secret",
  frontendUrl: normalizeOriginUrl(process.env.FRONTEND_URL || ""),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: toNumber(process.env.SMTP_PORT, undefined),
  smtpUser: process.env.SMTP_USER || "",
  emailFrom: process.env.EMAIL_FROM || "",
  googleAppKey: process.env.GOOGLE_APP_KEY || "",
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  r2PublicUrl: normalizeOriginUrl(process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || ""),
  cevonneN8nEnabled: toBoolean(process.env.CEVONNE_N8N_ENABLED, false),
  cevonneN8nDryRun: toBoolean(process.env.CEVONNE_N8N_DRY_RUN, false),
  cevonneSiteSource: process.env.CEVONNE_SITE_SOURCE || "website",
  cevonnePrivacyPolicyVersion: process.env.CEVONNE_PRIVACY_POLICY_VERSION || "2026-website-v1",
  cevonneN8nConsentIngestPath: process.env.N8N_G3_CONSENT_INGEST_PATH || "g3-consent-ingest",
  cevonneN8nConsentIngestUrl: resolveWebhookUrl(process.env.N8N_G3_CONSENT_INGEST_URL, process.env.N8N_G3_CONSENT_INGEST_PATH || "g3-consent-ingest"),
  cevonneN8nOptOutPath: process.env.N8N_G3_OPT_OUT_PATH || "g3-opt-out",
  cevonneN8nOptOutUrl: resolveWebhookUrl(process.env.N8N_G3_OPT_OUT_URL, process.env.N8N_G3_OPT_OUT_PATH || "g3-opt-out"),
  cevonneN8nAttributionEventPath: process.env.N8N_G3_ATTRIBUTION_EVENT_PATH || "g3-attribution-event",
  cevonneN8nAttributionEventUrl: resolveWebhookUrl(
    process.env.N8N_G3_ATTRIBUTION_EVENT_URL,
    process.env.N8N_G3_ATTRIBUTION_EVENT_PATH || "g3-attribution-event",
  ),
  cevonneN8nPurchaseEventPath: process.env.N8N_G3_PURCHASE_EVENT_PATH || "g3-purchase-event",
  cevonneN8nPurchaseEventUrl: resolveWebhookUrl(process.env.N8N_G3_PURCHASE_EVENT_URL, process.env.N8N_G3_PURCHASE_EVENT_PATH || "g3-purchase-event"),
  cevonneN8nPrivacyRequestPath: process.env.N8N_G3_PRIVACY_REQUEST_PATH || "g3-privacy-request",
  cevonneN8nPrivacyRequestUrl: resolveWebhookUrl(process.env.N8N_G3_PRIVACY_REQUEST_URL, process.env.N8N_G3_PRIVACY_REQUEST_PATH || "g3-privacy-request"),
  cevonneN8nPrivacyExecuteUrl: process.env.N8N_G3_PRIVACY_EXECUTE_URL || "",
  cevonneN8nWeeklyDigestUrl: process.env.N8N_G11_WEEKLY_DIGEST_URL || "",
  cevonneN8nDecisionRecommendationUrl: process.env.N8N_G11_DECISION_RECOMMENDATION_URL || "",
  cevonneN8nDraftActionPacketUrl: process.env.N8N_G11_DRAFT_ACTION_PACKET_URL || "",
  n8nBaseUrl,
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SHARED_SECRET || "",
  n8nG1ComplianceGuardPath: process.env.N8N_G1_COMPLIANCE_GUARD_PATH || "g1-compliance-guard",
  n8nG2StatusSummaryPath: process.env.N8N_G2_STATUS_SUMMARY_PATH || "g2-status-summary",
  n8nG2RegisterAccountPath: process.env.N8N_G2_REGISTER_ACCOUNT_PATH || "g2-register-account",
  n8nG2ListAccountsPath: process.env.N8N_G2_LIST_ACCOUNTS_PATH || "g2-list-accounts",
  n8nG2UpdateAccountPath: process.env.N8N_G2_UPDATE_ACCOUNT_PATH || "g2-update-account",
  n8nG2DisableAccountPath: process.env.N8N_G2_DISABLE_ACCOUNT_PATH || "g2-disable-account",
  n8nG2AccountHealthUpdatePath: process.env.N8N_G2_ACCOUNT_HEALTH_UPDATE_PATH || "g2-account-health-update",
  n8nG2OfficialEvidencePath: process.env.N8N_G2_OFFICIAL_EVIDENCE_PATH || "g2-official-evidence",
  n8nG4ContentCheckPath: resolveG4ContentCheckPath(),
  n8nG5PublishingSchedulerPath: process.env.N8N_G5_PUBLISHING_SCHEDULER_PATH || "g5-publishing-scheduler",
  n8nG6MessagingRouterPath: process.env.N8N_G6_MESSAGING_ROUTER_PATH || "g6-messaging-router",
  n8nG7InventoryOfferSafetyPath: process.env.N8N_G7_INVENTORY_OFFER_SAFETY_PATH || "g7-inventory-offer-safety",
  n8nG8UgcCreatorProofPath: process.env.N8N_G8_UGC_CREATOR_PROOF_PATH || "g8-ugc-creator-proof",
  n8nG9AdsRetargetingOptimizerPath: process.env.N8N_G9_ADS_RETARGETING_OPTIMIZER_PATH || "g9-ads-retargeting-optimizer",
  n8nG10SeoCroPath: process.env.N8N_G10_SEO_CRO_PATH || "g10-seo-cro",
  n8nG12PublicTrendFetchUrl: process.env.N8N_G12_PUBLIC_TREND_FETCH_URL || "",
  n8nWf1IntakePath: process.env.N8N_WF1_INTAKE_PATH || "wf1-caption-intake",
  n8nWf1DryRunPath: process.env.N8N_WF1_DRY_RUN_PATH || "wf1-schedule-dry-run",
  n8nWf1PublishResultPath: process.env.N8N_WF1_PUBLISH_RESULT_PATH || "wf1-publish-result",
  n8nWf1BufferHealthPath: process.env.N8N_WF1_BUFFER_HEALTH_PATH || "wf1-buffer-health",
  n8nG5ApprovalDecisionPath: process.env.N8N_G5_APPROVAL_DECISION_PATH || "g5-approval-decision",
  isProduction: process.env.NODE_ENV === "production",
  isVercel: toBoolean(process.env.VERCEL, false),
});

export const requireEnv = (name: string, value: string | undefined = process.env[name]) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};
