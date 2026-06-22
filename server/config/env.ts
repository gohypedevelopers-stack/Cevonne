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
  cevonneN8nConsentIngestUrl: process.env.N8N_G3_CONSENT_INGEST_URL || "",
  cevonneN8nOptOutUrl: process.env.N8N_G3_OPT_OUT_URL || "",
  cevonneN8nAttributionEventUrl: process.env.N8N_G3_ATTRIBUTION_EVENT_URL || "",
  cevonneN8nPurchaseEventUrl: process.env.N8N_G3_PURCHASE_EVENT_URL || "",
  cevonneN8nPrivacyRequestUrl: process.env.N8N_G3_PRIVACY_REQUEST_URL || "",
  cevonneN8nPrivacyExecuteUrl: process.env.N8N_G3_PRIVACY_EXECUTE_URL || "",
  cevonneN8nWeeklyDigestUrl: process.env.N8N_G11_WEEKLY_DIGEST_URL || "",
  cevonneN8nDecisionRecommendationUrl: process.env.N8N_G11_DECISION_RECOMMENDATION_URL || "",
  cevonneN8nDraftActionPacketUrl: process.env.N8N_G11_DRAFT_ACTION_PACKET_URL || "",
  n8nBaseUrl: normalizeOriginUrl(process.env.N8N_BASE_URL || "https://n8n.cevonne.com/webhook"),
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SHARED_SECRET || "",
  n8nG2StatusSummaryPath: process.env.N8N_G2_STATUS_SUMMARY_PATH || "g2-status-summary",
  n8nG2RegisterAccountPath: process.env.N8N_G2_REGISTER_ACCOUNT_PATH || "g2-register-account",
  n8nG2ListAccountsPath: process.env.N8N_G2_LIST_ACCOUNTS_PATH || "g2-list-accounts",
  n8nG2UpdateAccountPath: process.env.N8N_G2_UPDATE_ACCOUNT_PATH || "g2-update-account",
  n8nG2DisableAccountPath: process.env.N8N_G2_DISABLE_ACCOUNT_PATH || "g2-disable-account",
  n8nG2AccountHealthUpdatePath: process.env.N8N_G2_ACCOUNT_HEALTH_UPDATE_PATH || "g2-account-health-update",
  n8nG2OfficialEvidencePath: process.env.N8N_G2_OFFICIAL_EVIDENCE_PATH || "g2-official-evidence",
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
