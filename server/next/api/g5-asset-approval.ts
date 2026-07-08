import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { CEVONNE_MANUAL_REVIEW_MESSAGE, CEVONNE_SAFE_RESPONSE_MESSAGE, CEVONNE_TEMPORARY_FAILURE_MESSAGE } from "@/lib/cevonne/response";
import {
  extractG4ContentPreview,
  getG4ReviewSourceIds,
  normalizeG4StringArray,
  normalizeG4Text,
  summarizeG4Outcome,
  type G4ContentPreview,
} from "@/lib/admin/g4-content-review";
import { G12_SUPABASE_TABLES } from "@/server/next/api/g12-trend-fetcher-supabase";
import { buildN8nWebhookUrl } from "@/lib/n8n-client";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { env } from "@/server/config";
import { getCevonneAdminApprovals } from "@/server/next/api/cevonne-admin-store";
import { uploadFileToR2 } from "@/server/services/r2";

type JsonRecord = Record<string, unknown>;
type G4SourcePreview = Pick<G4ContentPreview, "captionPreview" | "views" | "likes" | "comments" | "shares" | "sourceUrl">;
type G4SourcePreviewDetails = G4SourcePreview & {
  profileUsername?: string | null;
  audioSound?: string | null;
  engagementRate?: string | null;
  trendStrength?: string | null;
  brandFitScore?: string | null;
  riskScore?: string | null;
};

type G5ClientStatus =
  | "Ready for G5"
  | "Pending approval"
  | "Approved"
  | "Ready to publish"
  | "Published manually"
  | "Rejected"
  | "Blocked";

type G5ClientTab = "approved_content" | "pending_approval" | "ready_to_publish" | "published_manually" | "blocked_rejected";

type G5OriginalPostDetails = {
  platform: string | null;
  handle: string | null;
  caption: string | null;
  post_url: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  audio: string | null;
  engagement_rate: string | null;
};

type G5AiDirectionDetails = {
  content_angle: string | null;
  safe_rewrite: string | null;
  hook_angle: string | null;
  risk_summary: string | null;
  compliance_note: string | null;
};

export type G5DashboardAssetRecord = {
  asset_id: string;
  asset_title: string | null;
  asset_type: string | null;
  intended_platform: string | null;
  platform: string | null;
  content_text: string | null;
  hook_angle: string | null;
  media_url: string | null;
  storage_url: string | null;
  metadata: JsonRecord | null;
  original_post: G5OriginalPostDetails | null;
  selected_caption: string | null;
  selected_caption_index: number | null;
  selected_hook: string | null;
  selected_hook_index: number | null;
  caption_options: G5G4CaptionOption[];
  hook_options: G5G4HookOption[];
  media_assets: JsonRecord[];
  source_content_id: string | null;
  source_g4_review_id: string | null;
  source_handoff_id: string | null;
  source_status: string | null;
  registration_status: string | null;
  g5_status: string | null;
  used_in_g5: boolean | null;
  registered_asset_id: string | null;
  registered_at: string | null;
  compliance_status: string | null;
  approval_status: string | null;
  approved_by: string | null;
  asset_created_at: string | null;
  asset_status: string | null;
  readiness_status: string | null;
  manual_publish_status: string | null;
  approval_id: string | null;
  last_manual_publish_result_id: string | null;
  post_url: string | null;
  published_by: string | null;
  published_at: string | null;
  state_updated_at: string | null;
  g4_review_id: string | null;
  g4_review_uuid: string | null;
  content_review_id: string | null;
  review_id: string | null;
  source_platform: string | null;
  source_event: string | null;
  rights_status: string | null;
  last_readiness_check_at: string | null;
  last_readiness_check_response: string | null;
  readiness_response: string | null;
  failure_reasons: string[];
  client_status: G5ClientStatus;
  client_tab: G5ClientTab;
};

export type G5DashboardSummary = {
  total: number;
  pending_approval: number;
  ready_to_publish: number;
  published_manually: number;
  blocked: number;
};

export type G5DashboardResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "VIEW" | "FALLBACK" | "UNAVAILABLE";
  message: string;
  summary: G5DashboardSummary;
  assets: G5DashboardAssetRecord[];
};

export type G5ApprovedContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: "Ready for G5";
  created_at: string | null;
  display_title: string;
  display_summary: string;
  hook_count: number;
  caption_count: number;
  platform_label: string;
  content_text: string | null;
  caption_preview: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  title: string | null;
  asset_id: string | null;
  platform: string | null;
};

export type G5ApprovedContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "TABLE" | "UNAVAILABLE";
  message: string;
  reviews: G5ApprovedContentRecord[];
};

export type G5G4CaptionOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

export type G5G4HookOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

export type G5SelectedG4ContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: "Ready for G5";
  created_at: string | null;
  display_title: string;
  display_summary: string;
  platform_label: string;
  caption_preview: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  profile_username: string | null;
  audio_sound: string | null;
  trend_strength: string | null;
  brand_fit_score: string | null;
  risk_score: string | null;
  source_url: string | null;
  ai_safe_rewrite: string | null;
  hook_angle: string | null;
  ai_risk_summary: string | null;
  ai_compliance_note: string | null;
  content_summary: string | null;
  ai_insight: string | null;
  original_post_data: string | null;
  engagement_rate: string | null;
  content: {
    title: string | null;
    summary: string | null;
    platform: string | null;
    created_at: string | null;
  };
  original_post: G5OriginalPostDetails;
  ai_direction: G5AiDirectionDetails;
  caption_options: G5G4CaptionOption[];
  hook_options: G5G4HookOption[];
  recommended_caption: string | null;
  recommended_hook: string | null;
};

export type G5SelectedG4ContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "TABLE" | "UNAVAILABLE";
  message: string;
  review: G5SelectedG4ContentRecord | null;
};

export type G5WebhookResponse = JsonRecord & {
  status: string;
  message: string;
  response_type: string | null;
  handled_at: string | null;
  request_id: string;
  sent_at: string;
  webhook_url: string;
  http_status: number | null;
  response_text: string | null;
  raw: JsonRecord | null;
};

export type G5AssetRegisterInput = {
  workflow_id: "G5";
  action_type: "IG_PUBLISH_POST";
  platform: "INSTAGRAM";
  asset_type: string;
  asset_title: string;
  content_text: string;
  hook_angle?: string | null;
  media_url: string;
  storage_url: string;
  g4_review_id: string;
  g4_review_uuid: string;
  content_review_id: string;
  review_id: string;
  source_content_id?: string | null;
  source_g4_review_id?: string | null;
  source_handoff_id?: string | null;
  selected_caption?: string | null;
  selected_caption_index?: number | null;
  selected_hook?: string | null;
  selected_hook_index?: number | null;
  caption_options?: G5G4CaptionOption[];
  hook_options?: G5G4HookOption[];
  media_assets?: JsonRecord[];
  original_post_data?: JsonRecord | string | null;
  original_post_url?: string | null;
  status?: string | null;
  source_status?: string | null;
  registration_status?: string | null;
  approval_status?: string | null;
  readiness_status?: string | null;
  metadata?: JsonRecord | null;
  used_in_g5?: boolean | null;
  source_platform: "WEBSITE";
  source_event: "CLIENT_UPLOAD";
  rights_status: "OWNED_OR_INTERNAL";
  actor: string;
};

export type G5AssetComposerUpdateInput = {
  asset_id: string;
  approval_id?: string | null;
  platform: "INSTAGRAM";
  asset_title: string;
  content_text: string;
  hook_angle?: string | null;
  selected_caption?: string | null;
  selected_caption_index?: number | null;
  selected_hook?: string | null;
  selected_hook_index?: number | null;
  caption_options?: G5G4CaptionOption[];
  hook_options?: G5G4HookOption[];
  media_url?: string | null;
  storage_url?: string | null;
  media_assets?: JsonRecord[];
  original_post_data?: JsonRecord | string | null;
  original_post_url?: string | null;
  source_content_id?: string | null;
  source_g4_review_id?: string | null;
  source_handoff_id?: string | null;
  source_platform?: string | null;
  source_event?: string | null;
  status?: string | null;
  source_status?: string | null;
  registration_status?: string | null;
  approval_status?: string | null;
  readiness_status?: string | null;
  g5_status?: string | null;
  used_in_g5?: boolean | null;
  metadata?: JsonRecord | null;
  actor: string;
};

export type G5ApprovalDecisionInput = {
  approval_id: string;
  asset_id: string;
  decision: "APPROVED" | "REJECTED";
  reviewer_id: string;
  reviewer_note?: string | null;
  rejection_reason?: string | null;
};

export type G5ReadinessCheckInput = {
  workflow_id: "G5";
  requested_by_workflow: "G5";
  action_type: "MANUAL_PUBLISH_READY_CHECK";
  execution_mode: "DRY_RUN";
  provider: "MANUAL_FALLBACK";
  platform: "INSTAGRAM";
  account_id: string;
  asset_id: string;
  content_review_id: string;
  g4_review_id: string;
  approval_id: string;
  asset_type: string;
  media_url: string;
  caption: string;
  hook_angle?: string | null;
  selected_caption?: string | null;
  selected_caption_index?: number | null;
  selected_hook?: string | null;
  selected_hook_index?: number | null;
  caption_options?: G5G4CaptionOption[];
  hook_options?: G5G4HookOption[];
  media_assets?: JsonRecord[];
  original_post_data?: JsonRecord | string | null;
  original_post_url?: string | null;
  source_content_id?: string | null;
  source_g4_review_id?: string | null;
  source_handoff_id?: string | null;
  source_status?: string | null;
  registration_status?: string | null;
  approval_status?: string | null;
  readiness_status?: string | null;
  g5_status?: string | null;
  metadata?: JsonRecord | null;
  actor: string;
};

export type G5ManualPublishResultInput = {
  asset_id: string;
  approval_id: string;
  platform: "INSTAGRAM";
  post_url: string;
  published_by: string;
  published_at?: string | null;
  notes?: string | null;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const toText = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
};

const toDate = (value: unknown) => {
  const text = toText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const pickText = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toText(row[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickDate = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toDate(row[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickArray = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return [];
  }

  for (const key of keys) {
    const value = row[key];
    if (!Array.isArray(value)) {
      continue;
    }

    return value
      .map((entry) => toText(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  return [];
};

const getJsonRecordCandidates = (record: JsonRecord | null | undefined) => {
  const direct = asRecord(record);
  const payload = asRecord(direct?.raw_payload);
  const nestedPayload = asRecord(payload?.raw_payload);
  const directMetadata = asRecord(direct?.metadata);
  const payloadMetadata = asRecord(payload?.metadata);
  const nestedMetadata = asRecord(nestedPayload?.metadata);
  const directSourceG4 = asRecord(direct?.source_g4 ?? direct?.sourceG4 ?? directMetadata?.source_g4 ?? directMetadata?.sourceG4);
  const payloadSourceG4 = asRecord(payload?.source_g4 ?? payload?.sourceG4 ?? payloadMetadata?.source_g4 ?? payloadMetadata?.sourceG4);
  const nestedSourceG4 = asRecord(nestedPayload?.source_g4 ?? nestedPayload?.sourceG4 ?? nestedMetadata?.source_g4 ?? nestedMetadata?.sourceG4);

  return [
    direct,
    payload,
    nestedPayload,
    directMetadata,
    payloadMetadata,
    nestedMetadata,
    directSourceG4,
    payloadSourceG4,
    nestedSourceG4,
  ].filter((value): value is JsonRecord => Boolean(value));
};

const readJsonRecordText = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = toText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readJsonRecordValue = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!(key in record)) {
      continue;
    }

    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      const text = value.trim();
      if (!text) {
        continue;
      }

      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }

    return value;
  }

  return null;
};

const readJsonRecordTextFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  for (const record of records) {
    for (const candidate of getJsonRecordCandidates(record)) {
      const value = readJsonRecordText(candidate, keys);
      if (value) {
        return value;
      }
    }
  }

  return null;
};

const getG4SourceLookupKey = (row: JsonRecord | null | undefined) =>
  readJsonRecordTextFromCandidates(
    [row],
    [
      "source_trend_id",
      "sourceTrendId",
      "trend_id",
      "trendId",
      "insight_id",
      "insightId",
      "source_insight_id",
      "sourceInsightId",
      "fetch_run_id",
      "fetchRunId",
      "asset_id",
      "assetId",
    ],
  );

type NormalizedG5MediaAsset = JsonRecord & {
  media_url: string | null;
  storage_url: string | null;
  storage_key: string | null;
  filename: string;
  content_type: string | null;
  kind: string;
  size: number | null;
};

const normalizeG5MediaAssets = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const mediaUrl = entry.trim();
        if (!mediaUrl) {
          return null;
        }

        return {
          media_url: mediaUrl,
          storage_url: mediaUrl,
          storage_key: mediaUrl,
          filename: `media-${index + 1}`,
          content_type: null,
          kind: "IMAGE",
          size: null,
        };
      }

      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const mediaUrl = pickTextFromCandidates(record, ["media_url", "mediaUrl", "url", "public_url", "publicUrl"]);
      const storageUrl = pickTextFromCandidates(record, ["storage_url", "storageUrl", "storage_key", "storageKey"]) ?? mediaUrl;
      const contentType = pickTextFromCandidates(record, ["content_type", "contentType", "mime_type", "mimeType"]);
      const kind = pickTextFromCandidates(record, ["kind", "asset_kind", "assetKind"]);
      const filename = pickTextFromCandidates(record, ["filename", "name", "file_name", "fileName"]);
      const size = readJsonRecordNumberFromCandidates([record], ["size", "file_size", "fileSize"]);

      return {
        ...record,
        media_url: mediaUrl,
        storage_url: storageUrl,
        storage_key: pickTextFromCandidates(record, ["storage_key", "storageKey"]) ?? storageUrl ?? mediaUrl,
        filename: filename ?? mediaUrl ?? `media-${index + 1}`,
        content_type: contentType,
        kind: kind ?? (contentType?.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE"),
        size,
      };
    })
    .filter((entry): entry is NormalizedG5MediaAsset => Boolean(entry));
};

const normalizeG5OptionArray = (value: unknown, kind: "caption" | "hook") => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const text = normalizeG4Text(entry);
        if (!text) {
          return null;
        }

        return {
          id: `${kind}-${index + 1}`,
          label: `${kind === "caption" ? "Caption" : "Hook"} ${index + 1}`,
          text,
          source: "G4" as const,
        };
      }

      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const text =
        pickTextFromCandidates(record, ["text", "caption", "caption_text", "captionText", "hook", "hook_text", "hookText", "value"]) ??
        normalizeG4Text(record.text) ??
        null;
      if (!text) {
        return null;
      }

      const label =
        pickTextFromCandidates(record, ["label", "name", "title"]) ??
        `${kind === "caption" ? "Caption" : "Hook"} ${index + 1}`;

      return {
        id: pickTextFromCandidates(record, ["id", "option_id", "optionId", "key", "value"]) ?? `${kind}-${index + 1}`,
        label,
        text,
        source: "G4" as const,
      };
    })
    .filter((entry): entry is G5G4CaptionOption | G5G4HookOption => Boolean(entry));
};

const normalizeG5OriginalPost = (records: Array<JsonRecord | null | undefined>) => {
  const originalPostObject = readJsonRecordObjectFromCandidates(records, ["original_post", "originalPost"]);
  const originalPostDataObject = readJsonRecordObjectFromCandidates(records, ["original_post_data", "originalPostData"]);
  const sourceRecords = [...records, originalPostObject, originalPostDataObject];

  return {
    platform: readJsonRecordTextFromCandidates(sourceRecords, ["platform", "source_platform", "sourcePlatform"]),
    handle: readJsonRecordTextFromCandidates(sourceRecords, ["handle", "username", "profile_username", "profileUsername", "creator_handle", "creatorHandle"]),
    caption: readJsonRecordTextFromCandidates(sourceRecords, ["caption", "caption_text", "captionText", "content_text", "contentText"]),
    post_url: readJsonRecordTextFromCandidates(sourceRecords, ["post_url", "postUrl", "source_url", "sourceUrl", "landing_page_url", "landingPageUrl", "permalink"]),
    views: readJsonRecordTextFromCandidates(sourceRecords, ["views"]),
    likes: readJsonRecordTextFromCandidates(sourceRecords, ["likes"]),
    comments: readJsonRecordTextFromCandidates(sourceRecords, ["comments", "comments_count", "commentsCount"]),
    shares: readJsonRecordTextFromCandidates(sourceRecords, ["shares"]),
    audio: readJsonRecordTextFromCandidates(sourceRecords, ["audio", "audio_sound", "audioSound", "sound", "music"]),
    engagement_rate: readJsonRecordTextFromCandidates(sourceRecords, ["engagement_rate", "engagementRate"]),
  };
};

const loadG4SourcePreviewMap = async (rows: JsonRecord[]) => {
  const client = getN8nSupabaseAdmin();
  const previewByLookupKey = new Map<string, G4SourcePreviewDetails>();

  if (!client) {
    return previewByLookupKey;
  }

  const sourceLookupKeys = [...new Set(rows.map((row) => getG4SourceLookupKey(row)).filter((value): value is string => Boolean(value)))];
  if (!sourceLookupKeys.length) {
    return previewByLookupKey;
  }

  const [insightByTrendResult, insightByRunResult] = await Promise.all([
    client.schema("public").from(G12_SUPABASE_TABLES.insights).select("*").in("trend_id", sourceLookupKeys).order("created_at", { ascending: false, nullsFirst: false }).limit(250),
    client.schema("public").from(G12_SUPABASE_TABLES.insights).select("*").in("fetch_run_id", sourceLookupKeys).order("created_at", { ascending: false, nullsFirst: false }).limit(250),
  ]);

  if (insightByTrendResult.error || insightByRunResult.error) {
    console.warn("[g5-asset-approval] failed to load G12 source previews for G5 reviews", {
      trend_error: insightByTrendResult.error?.message ?? null,
      run_error: insightByRunResult.error?.message ?? null,
    });
    return previewByLookupKey;
  }

  const insightRecords = [
    ...(Array.isArray(insightByTrendResult.data) ? insightByTrendResult.data : []),
    ...(Array.isArray(insightByRunResult.data) ? insightByRunResult.data : []),
  ]
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  const insightByLookupKey = new Map<string, JsonRecord>();
  const metricIds = new Set<string>();
  const rawIds = new Set<string>();

  for (const record of insightRecords) {
    for (const key of [
      readJsonRecordTextFromCandidates([record], ["trend_id"]),
      readJsonRecordTextFromCandidates([record], ["fetch_run_id"]),
      readJsonRecordTextFromCandidates([record], ["asset_id"]),
      readJsonRecordTextFromCandidates([record], ["insight_id"]),
    ]) {
      if (key && !insightByLookupKey.has(key)) {
        insightByLookupKey.set(key, record);
      }
    }

    const metricId = readJsonRecordTextFromCandidates([record], ["metric_id"]);
    if (metricId) {
      metricIds.add(metricId);
    }

    const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
    if (rawId) {
      rawIds.add(rawId);
    }
  }

  const metricByMetricId = new Map<string, JsonRecord>();
  if (metricIds.size) {
    const { data: metricRows, error: metricError } = await client
      .schema("public")
      .from(G12_SUPABASE_TABLES.metrics)
      .select("*")
      .in("metric_id", [...metricIds]);

    if (metricError) {
      console.warn("[g5-asset-approval] failed to load G12 metric rows for G5 reviews", metricError);
    } else {
      for (const record of (Array.isArray(metricRows) ? metricRows : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const metricId = readJsonRecordTextFromCandidates([record], ["metric_id"]);
        if (metricId && !metricByMetricId.has(metricId)) {
          metricByMetricId.set(metricId, record);
        }

        const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
        if (rawId) {
          rawIds.add(rawId);
        }
      }
    }
  }

  const rawByRawId = new Map<string, JsonRecord>();
  if (rawIds.size) {
    const { data: rawRows, error: rawError } = await client
      .schema("public")
      .from(G12_SUPABASE_TABLES.rawScrapeQuarantine)
      .select("*")
      .in("raw_id", [...rawIds]);

    if (rawError) {
      console.warn("[g5-asset-approval] failed to load G12 raw scrape rows for G5 reviews", rawError);
    } else {
      for (const record of (Array.isArray(rawRows) ? rawRows : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
        if (rawId && !rawByRawId.has(rawId)) {
          rawByRawId.set(rawId, record);
        }
      }
    }
  }

  for (const sourceLookupKey of sourceLookupKeys) {
    const insight = insightByLookupKey.get(sourceLookupKey) ?? null;
    const metricId = readJsonRecordTextFromCandidates([insight], ["metric_id"]);
    const metric = metricId ? metricByMetricId.get(metricId) ?? null : null;
    const rawId = readJsonRecordTextFromCandidates([metric, insight], ["raw_id"]);
    const rawScrape = rawId ? rawByRawId.get(rawId) ?? null : null;

    previewByLookupKey.set(sourceLookupKey, {
      profileUsername: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["profile_username", "profileUsername", "username", "handle"]),
      audioSound: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["audio_sound", "audioSound", "sound", "music"]),
      engagementRate: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["engagement_rate", "engagementRate"]),
      trendStrength: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["trend_strength", "trendStrength"]),
      brandFitScore: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["brand_fit_score", "brandFitScore"]),
      riskScore: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["risk_score", "riskScore"]),
      captionPreview: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["caption_excerpt", "captionExcerpt", "caption_preview", "captionPreview", "caption", "text", "description"],
      ),
      views: readJsonRecordTextFromCandidates([rawScrape, metric], ["views"]),
      likes: readJsonRecordTextFromCandidates([rawScrape, metric], ["likes"]),
      comments: readJsonRecordTextFromCandidates([rawScrape, metric], ["comments_count", "commentsCount", "comments"]),
      shares: readJsonRecordTextFromCandidates([rawScrape, metric], ["shares"]),
      sourceUrl: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["source_url", "sourceUrl", "content_url", "contentUrl", "profile_public_link", "profilePublicLink", "url", "post_url", "postUrl", "web_video_url", "webVideoUrl", "permalink"],
      ),
    });
  }

  return previewByLookupKey;
};

const upperText = (value: unknown) => toText(value)?.toUpperCase() ?? null;

const normalizeStateKey = (value: unknown) => upperText(value)?.replace(/[\s-]+/g, "_") ?? null;

const pickTextFromCandidates = (row: JsonRecord | null | undefined, keys: string[]) => readJsonRecordTextFromCandidates([row], keys);

const pickDateFromCandidates = (row: JsonRecord | null | undefined, keys: string[]) => {
  const text = pickTextFromCandidates(row, keys);
  return text ? toDate(text) : null;
};

const collectTextValuesFromCandidates = (rows: JsonRecord[], keys: string[]) => {
  const values = new Set<string>();

  for (const row of rows) {
    for (const key of keys) {
      const value = pickTextFromCandidates(row, [key]);
      if (value) {
        values.add(value);
      }
    }
  }

  return [...values];
};

const collectG4SuggestionTexts = (row: JsonRecord, key: string) => {
  const rawPayload = asRecord(row.raw_payload);
  const nestedRawPayload = asRecord(rawPayload?.raw_payload);
  const rawAiFields = asRecord(rawPayload?.ai_fields);
  const nestedAiFields = asRecord(nestedRawPayload?.ai_fields);
  const values = new Set<string>();

  for (const source of [row[key], rawPayload?.[key], rawAiFields?.[key], nestedRawPayload?.[key], nestedAiFields?.[key]]) {
    for (const candidate of normalizeG4StringArray(source)) {
      const text = normalizeG4Text(candidate);
      if (text) {
        values.add(text);
      }
    }
  }

  return [...values];
};

const expandRecordWithRawPayload = (row: JsonRecord) => {
  const rawPayload = row.raw_payload;
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return row;
  }

  const rawPayloadRecord = asRecord(rawPayload);
  if (!rawPayloadRecord) {
    return row;
  }

  return mergeRecords(row, rawPayloadRecord);
};

const isSuccessfulG5AssetRegisterAudit = (row: JsonRecord) => {
  const operation = normalizeStateKey(row.operation);
  const status = normalizeStateKey(row.status);

  if (operation !== "ASSET_REGISTER" && operation !== "ASSET_EDIT") {
    return false;
  }

  if (!status) {
    return false;
  }

  return !["BLOCK", "ERROR", "FAIL", "FAILED", "REJECTED", "DENIED", "CANCELLED", "CANCELED"].includes(status);
};

const G5_G4_ASSET_LINKS_TABLE = "g5_g4_asset_links" as const;
const G5_ASSET_AUDIT_TABLE = "g5_asset_audit" as const;
const G5_APPROVALS_TABLE = "g5_approvals" as const;
const G5_ASSET_STATE_TABLE = "g5_asset_publish_state" as const;
const G5_WORKFLOW_GROUP = "G5" as const;
const G5_WORKFLOW_ID = "WF1" as const;

const normalizeG4ApprovedContentKeyText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const buildG5CaptionHash = (value: string | null | undefined) => {
  const normalized = normalizeG4ApprovedContentKeyText(value);
  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
};

const formatCompactUuid = (value: string) =>
  `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;

const normalizeG5ApprovalIdText = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  const stripped = normalized.replace(/^g5_approval_/, "");
  const compact = stripped.replace(/-/g, "");

  if (/^[0-9a-f]{32}$/.test(compact)) {
    return formatCompactUuid(compact);
  }

  const uuidMatch = stripped.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return null;
};

const getG4ApprovedContentCreatedAtValue = (row: JsonRecord) => {
  const createdAt = pickDateFromCandidates(row, ["created_at", "createdAt", "updated_at", "updatedAt"]);
  return createdAt ? Date.parse(createdAt) || 0 : 0;
};

const buildG4ApprovedContentIdentity = (row: JsonRecord) => {
  const preview = extractG4ContentPreview(row);

  const sourceHandoffId = pickTextFromCandidates(row, ["source_handoff_id", "sourceHandoffId", "handoff_id", "handoffId", "approval_id", "approvalId"]);
  const sourceG4ReviewId = pickTextFromCandidates(row, ["source_g4_review_id", "sourceG4ReviewId", "g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid"]);
  const sourceContentId = pickTextFromCandidates(row, ["source_content_id", "sourceContentId", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const contentReviewId = pickTextFromCandidates(row, ["content_review_id", "contentReviewId"]);
  const reviewId = pickTextFromCandidates(row, ["review_id", "reviewId"]);
  const sourceUrl =
    pickTextFromCandidates(row, ["source_url", "sourceUrl", "original_post_url", "originalPostUrl", "post_url", "postUrl", "permalink"]) ??
    preview.sourceUrl;
  const caption = normalizeG4Text(
    preview.captionPreview ??
      pickTextFromCandidates(row, ["caption_preview", "captionPreview", "content_text", "contentText", "caption", "caption_text", "captionText"]) ??
      preview.contentText,
  );
  const platform = normalizeG4Text(pickTextFromCandidates(row, ["platform", "source_platform", "sourcePlatform"]));
  const title = normalizeG4Text(preview.headline ?? pickTextFromCandidates(row, ["title", "headline", "name"]) ?? preview.productName);
  const createdAt = pickDateFromCandidates(row, ["created_at", "createdAt", "updated_at", "updatedAt"]);
  const createdDate = createdAt ? createdAt.slice(0, 10) : null;
  const rowId = pickTextFromCandidates(row, ["id"]);
  const captionHash = buildG5CaptionHash(caption);

  const candidateKeys = [
    sourceHandoffId ? `source_handoff_id:${normalizeG4ApprovedContentKeyText(sourceHandoffId)}` : null,
    sourceG4ReviewId ? `source_g4_review_id:${normalizeG4ApprovedContentKeyText(sourceG4ReviewId)}` : null,
    sourceContentId ? `source_content_id:${normalizeG4ApprovedContentKeyText(sourceContentId)}` : null,
    rowId ? `asset_id:${normalizeG4ApprovedContentKeyText(rowId)}` : null,
    sourceUrl && captionHash ? `original_post_url_caption_hash:${normalizeG4ApprovedContentKeyText(sourceUrl)}|${captionHash}` : null,
    contentReviewId ? `content_review_id:${normalizeG4ApprovedContentKeyText(contentReviewId)}` : null,
    reviewId ? `review_id:${normalizeG4ApprovedContentKeyText(reviewId)}` : null,
    sourceUrl ? `source_url:${normalizeG4ApprovedContentKeyText(sourceUrl)}` : null,
    caption ? `caption_platform:${normalizeG4ApprovedContentKeyText(caption)}|${normalizeG4ApprovedContentKeyText(platform)}` : null,
    title ? `title_created:${normalizeG4ApprovedContentKeyText(title)}|${normalizeG4ApprovedContentKeyText(createdDate)}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    candidateKeys,
    primaryKey: candidateKeys[0] ?? null,
  };
};

const dedupeG4ApprovedContentRows = (rows: JsonRecord[]) => {
  const uniqueRows: JsonRecord[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const identity = buildG4ApprovedContentIdentity(row);
    if (!identity.candidateKeys.length || identity.candidateKeys.some((key) => seenKeys.has(key))) {
      continue;
    }

    identity.candidateKeys.forEach((key) => seenKeys.add(key));
    uniqueRows.push(row);
  }

  return uniqueRows;
};

const buildRegisteredG5AssetIdentity = (row: JsonRecord) => {
  const sourceHandoffId = pickTextFromCandidates(row, ["source_handoff_id", "sourceHandoffId", "handoff_id", "handoffId", "approval_id", "approvalId"]);
  const sourceG4ReviewId = pickTextFromCandidates(row, ["source_g4_review_id", "sourceG4ReviewId", "g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const sourceContentId = pickTextFromCandidates(row, ["source_content_id", "sourceContentId", "content_review_id", "contentReviewId", "review_id", "reviewId", "id"]);
  const assetId = pickTextFromCandidates(row, ["registered_asset_id", "registeredAssetId", "asset_id", "assetId", "id", "approval_id", "approvalId"]);
  const originalPostUrl =
    pickTextFromCandidates(row, ["original_post_url", "originalPostUrl", "source_url", "sourceUrl", "post_url", "postUrl", "permalink"]) ??
    extractG4ContentPreview(row).sourceUrl;
  const selectedCaption =
    pickTextFromCandidates(row, ["selected_caption", "selectedCaption", "content_text", "caption", "caption_text", "captionText"]) ??
    extractG4ContentPreview(row).captionPreview ??
    null;
  const captionHash = buildG5CaptionHash(selectedCaption);

  const candidateKeys = [
    sourceHandoffId ? `source_handoff_id:${normalizeG4ApprovedContentKeyText(sourceHandoffId)}` : null,
    sourceG4ReviewId ? `source_g4_review_id:${normalizeG4ApprovedContentKeyText(sourceG4ReviewId)}` : null,
    sourceContentId ? `source_content_id:${normalizeG4ApprovedContentKeyText(sourceContentId)}` : null,
    assetId ? `asset_id:${normalizeG4ApprovedContentKeyText(assetId)}` : null,
    originalPostUrl && captionHash ? `original_post_url_caption_hash:${normalizeG4ApprovedContentKeyText(originalPostUrl)}|${captionHash}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    candidateKeys,
    primaryKey: candidateKeys[0] ?? null,
  };
};

const getG5ClientStatusInfo = (asset: Pick<
  G5DashboardAssetRecord,
  "approval_status" | "asset_status" | "manual_publish_status" | "post_url" | "published_at" | "last_manual_publish_result_id"
>) => {
  const contentApprovalStatus = normalizeStateKey(asset.approval_status);
  const publishStateStatus = normalizeStateKey(asset.asset_status);
  const manualPublishStatus = normalizeStateKey(asset.manual_publish_status);
  const hasManualPublishResult = Boolean(asset.last_manual_publish_result_id || (asset.post_url && asset.published_at));

  if (hasManualPublishResult || manualPublishStatus === "PUBLISHED_MANUALLY" || publishStateStatus === "PUBLISHED_MANUALLY" || publishStateStatus === "PUBLISHED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Published manually" as const,
      clientTab: "published_manually" as const,
    };
  }

  if (publishStateStatus === "APPROVED_READY_TO_PUBLISH" || publishStateStatus === "READY_TO_PUBLISH") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Ready to publish" as const,
      clientTab: "ready_to_publish" as const,
    };
  }

  if (publishStateStatus === "REJECTED" || contentApprovalStatus === "REJECTED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Rejected" as const,
      clientTab: "blocked_rejected" as const,
    };
  }

  if (publishStateStatus === "BLOCKED" || publishStateStatus === "FAILED" || publishStateStatus === "ERROR" || contentApprovalStatus === "BLOCKED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Blocked" as const,
      clientTab: "blocked_rejected" as const,
    };
  }

  if (publishStateStatus === "APPROVED" || contentApprovalStatus === "APPROVED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Approved" as const,
      clientTab: "ready_to_publish" as const,
    };
  }

  if (
    publishStateStatus === "PENDING_APPROVAL" ||
    contentApprovalStatus === "PENDING_APPROVAL" ||
    contentApprovalStatus === "PENDING"
  ) {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Pending approval" as const,
      clientTab: "pending_approval" as const,
    };
  }

  return {
    contentApprovalStatus,
    publishStateStatus,
    manualPublishStatus,
    clientStatus: "Pending approval" as const,
    clientTab: "pending_approval" as const,
  };
};

const isG4ReadyForG5 = (row: JsonRecord) => {
  const status = normalizeStateKey(row.status);
  const approvalState = normalizeStateKey(row.approval_state);

  return (
    status === "PASS" ||
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "APPROVED"
  );
};

const describeN8nSupabaseTarget = () => {
  const rawUrl = env.n8nSupabaseUrl.trim();
  if (!rawUrl) {
    return "missing";
  }

  try {
    const parsed = new URL(rawUrl);
    const project = parsed.hostname.split(".")[0] || parsed.hostname;
    return `${parsed.hostname} (project ${project})`;
  } catch {
    return "invalid-url";
  }
};

const mergeRecords = <T extends JsonRecord>(base: T, next: Partial<T>) => {
  const merged = { ...base };

  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    merged[key as keyof T] = value as T[keyof T];
  }

  return merged;
};

const normalizeAssetRecord = (row: JsonRecord): G5DashboardAssetRecord | null => {
  const assetId = pickTextFromCandidates(row, ["asset_id", "assetId", "id", "approval_id", "approvalId", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? null;

  if (!assetId) {
    return null;
  }

  const metadata = readJsonRecordObjectFromCandidates([row], ["metadata"]);
  const assetTitle = pickTextFromCandidates(row, ["asset_title", "assetTitle", "title", "name", "content_text", "contentText", "caption", "caption_text", "captionText", "summary"]);
  const assetType = pickTextFromCandidates(row, ["asset_type", "assetType", "content_type", "contentType", "media_type", "mediaType"]);
  const intendedPlatform = pickTextFromCandidates(row, ["intended_platform", "intendedPlatform"]);
  const platform = pickTextFromCandidates(row, ["platform", "source_platform", "sourcePlatform"]);
  const contentText = pickTextFromCandidates(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "body", "message"]);
  const selectedCaption = pickTextFromCandidates(row, ["selected_caption", "selectedCaption", "caption", "caption_text", "captionText", "content_text", "contentText"]) ?? contentText;
  const selectedCaptionIndex = readJsonRecordNumberFromCandidates([row], ["selected_caption_index", "selectedCaptionIndex"]);
  const selectedHook = pickTextFromCandidates(row, ["selected_hook", "selectedHook", "hook_angle", "hookAngle", "hook", "hook_text", "hookText", "ai_hook_angle"]);
  const selectedHookIndex = readJsonRecordNumberFromCandidates([row], ["selected_hook_index", "selectedHookIndex"]);
  const captionOptions = readBestJsonRecordArrayFromCandidates(
    [row],
    ["caption_options", "captionOptions", "generated_captions", "generatedCaptions", "captions"],
    (value) => normalizeG5OptionArray(value, "caption"),
  );
  const hookOptions = readBestJsonRecordArrayFromCandidates(
    [row],
    ["hook_options", "hookOptions", "generated_hooks", "generatedHooks", "hooks"],
    (value) => normalizeG5OptionArray(value, "hook"),
  );
  const mediaAssets = readBestJsonRecordArrayFromCandidates([row], ["media_assets", "mediaAssets"], (value) => normalizeG5MediaAssets(value));
  const sourceContentId = pickTextFromCandidates(row, ["source_content_id", "sourceContentId", "content_review_id", "contentReviewId", "review_id", "reviewId", "id"]);
  const sourceG4ReviewId = pickTextFromCandidates(row, ["source_g4_review_id", "sourceG4ReviewId", "g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const sourceHandoffId = pickTextFromCandidates(row, ["source_handoff_id", "sourceHandoffId", "handoff_id", "handoffId", "approval_id", "approvalId", "asset_id", "assetId"]);
  const sourceStatus = pickTextFromCandidates(row, ["source_status", "sourceStatus"]);
  const registrationStatus = pickTextFromCandidates(row, ["registration_status", "registrationStatus"]);
  const g5Status = pickTextFromCandidates(row, ["g5_status", "g5Status"]);
  const usedInG5 = readJsonRecordBooleanFromCandidates([row], ["used_in_g5", "usedInG5"]);
  const registeredAssetId = pickTextFromCandidates(row, ["registered_asset_id", "registeredAssetId"]) ?? assetId;
  const registeredAt = pickDateFromCandidates(row, ["registered_at", "registeredAt", "source_registered_at", "sourceRegisteredAt"]);
  const originalPost = normalizeG5OriginalPost([row]);
  const hookAngle = selectedHook ?? pickTextFromCandidates(row, ["hook_angle", "hookAngle", "ai_hook_angle"]);
  const mediaUrl = pickTextFromCandidates(row, ["media_url", "mediaUrl", "public_url", "publicUrl", "url", "image_url", "imageUrl", "video_url", "videoUrl"]);
  const storageUrl = pickTextFromCandidates(row, ["storage_url", "storageUrl", "storage_reference", "storageReference", "storage_key", "storageKey"]);
  const complianceStatus = pickTextFromCandidates(row, ["compliance_status", "complianceStatus", "g1_compliance_status", "g1ComplianceStatus"]);
  const approvalStatus = pickTextFromCandidates(row, ["approval_status", "approvalStatus", "decision", "approvalDecision"]);
  const approvedBy = pickTextFromCandidates(row, ["approved_by", "approvedBy", "reviewer", "reviewerId", "reviewer_id"]);
  const assetCreatedAt = pickDateFromCandidates(row, ["asset_created_at", "assetCreatedAt", "created_at", "createdAt"]);
  const assetStatus = pickTextFromCandidates(row, ["asset_status", "assetStatus", "status"]);
  const readinessStatus = pickTextFromCandidates(row, ["readiness_status", "readinessStatus"]);
  const manualPublishStatus = pickTextFromCandidates(row, ["manual_publish_status", "manualPublishStatus", "publish_status", "publishStatus"]);
  const approvalId = pickTextFromCandidates(row, ["approval_id", "approvalId"]);
  const lastManualPublishResultId = pickTextFromCandidates(row, ["last_manual_publish_result_id", "lastManualPublishResultId", "manual_publish_result_id", "manualPublishResultId"]);
  const postUrl = pickTextFromCandidates(row, ["post_url", "postUrl", "instagram_post_url", "instagramPostUrl", "published_url", "publishedUrl"]);
  const publishedBy = pickTextFromCandidates(row, ["published_by", "publishedBy"]);
  const publishedAt = pickDateFromCandidates(row, ["published_at", "publishedAt"]);
  const stateUpdatedAt = pickDateFromCandidates(row, ["state_updated_at", "stateUpdatedAt", "updated_at", "updatedAt", "modified_at", "modifiedAt"]);
  const g4ReviewId = pickTextFromCandidates(row, ["g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const g4ReviewUuid = pickTextFromCandidates(row, ["g4_review_uuid", "g4ReviewUuid"]);
  const contentReviewId = pickTextFromCandidates(row, ["content_review_id", "contentReviewId"]);
  const reviewId = pickTextFromCandidates(row, ["review_id", "reviewId"]);
  const sourcePlatform = pickTextFromCandidates(row, ["source_platform", "sourcePlatform"]);
  const sourceEvent = pickTextFromCandidates(row, ["source_event", "sourceEvent"]);
  const rightsStatus = pickTextFromCandidates(row, ["rights_status", "rightsStatus"]);
  const lastReadinessCheckAt = pickDateFromCandidates(row, ["last_readiness_check_at", "lastReadinessCheckAt", "readiness_checked_at", "readinessCheckedAt"]);
  const lastReadinessCheckResponse = pickTextFromCandidates(row, ["last_readiness_check_response", "lastReadinessCheckResponse"]);
  const readinessResponse = pickTextFromCandidates(row, ["readiness_response", "readinessResponse", "n8n_response", "n8nResponse", "response_text", "responseText"]);
  const failureReasons = pickArray(row, ["failure_reasons", "failureReasons", "blocked_reasons", "blockedReasons", "rejection_reasons", "rejectionReasons"]);
  const clientStatusInfo = getG5ClientStatusInfo({
    approval_status: approvalStatus,
    asset_status: assetStatus,
    manual_publish_status: manualPublishStatus,
    post_url: postUrl,
    published_at: publishedAt,
    last_manual_publish_result_id: lastManualPublishResultId,
  });

  return {
    asset_id: assetId,
    asset_title: assetTitle,
    asset_type: assetType,
    intended_platform: intendedPlatform,
    platform,
    content_text: contentText,
    hook_angle: hookAngle,
    media_url: mediaUrl,
    storage_url: storageUrl,
    metadata,
    original_post: originalPost,
    selected_caption: selectedCaption,
    selected_caption_index: selectedCaptionIndex,
    selected_hook: selectedHook,
    selected_hook_index: selectedHookIndex,
    caption_options: captionOptions,
    hook_options: hookOptions,
    media_assets: mediaAssets,
    source_content_id: sourceContentId,
    source_g4_review_id: sourceG4ReviewId,
    source_handoff_id: sourceHandoffId,
    source_status: sourceStatus,
    registration_status: registrationStatus,
    g5_status: g5Status,
    used_in_g5: usedInG5,
    registered_asset_id: registeredAssetId,
    registered_at: registeredAt,
    compliance_status: complianceStatus,
    approval_status: approvalStatus,
    approved_by: approvedBy,
    asset_created_at: assetCreatedAt,
    asset_status: assetStatus,
    readiness_status: readinessStatus,
    manual_publish_status: manualPublishStatus,
    approval_id: approvalId,
    last_manual_publish_result_id: lastManualPublishResultId,
    post_url: postUrl,
    published_by: publishedBy,
    published_at: publishedAt,
    state_updated_at: stateUpdatedAt,
    g4_review_id: g4ReviewId,
    g4_review_uuid: g4ReviewUuid,
    content_review_id: contentReviewId,
    review_id: reviewId,
    source_platform: sourcePlatform,
    source_event: sourceEvent,
    rights_status: rightsStatus,
    last_readiness_check_at: lastReadinessCheckAt,
    last_readiness_check_response: lastReadinessCheckResponse,
    readiness_response: readinessResponse,
    failure_reasons: failureReasons,
    client_status: clientStatusInfo.clientStatus,
    client_tab: clientStatusInfo.clientTab,
  };
};

const normalizeG4ReviewRecord = (row: JsonRecord, sourcePreview?: Partial<G4SourcePreview> | null): G5ApprovedContentRecord | null => {
  const id = pickText(row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  if (!id) {
    return null;
  }

  const preview = extractG4ContentPreview({ raw_payload: row });
  const safeRewriteText = normalizeG4Text(row.ai_safe_rewrite);
  const hookAngleText = normalizeG4Text(preview.hookAngle);
  const hookSuggestionTexts = collectG4SuggestionTexts(row, "ai_hook_suggestions");
  const captionSuggestionTexts = collectG4SuggestionTexts(row, "ai_caption_suggestions");
  const hookCount = collectSelectableOptionTexts(hookSuggestionTexts, [hookAngleText]).options.length;
  const captionCount = collectSelectableOptionTexts(captionSuggestionTexts, []).options.length;
  const displayTitle =
    preview.headline?.trim() ||
    preview.productName?.trim() ||
    sourcePreview?.captionPreview?.trim() ||
    preview.captionPreview?.trim() ||
    "Content check passed";
  const displaySummary =
    normalizeG4Text(row.safe_summary) ||
    normalizeG4Text(row.ai_safe_rewrite) ||
    normalizeG4Text(preview.cleanSummary) ||
    normalizeG4Text(preview.contentRecommendation) ||
    "Approved content ready for G5.";
  const platformLabel = pickText(row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown";

  return {
    id,
    g4_review_uuid: id,
    g4_review_id: id,
    content_review_id: pickText(row, ["content_review_id", "contentReviewId"]),
    review_id: pickText(row, ["review_id", "reviewId"]),
    status: pickText(row, ["status", "review_status", "reviewStatus"]),
    approval_state: pickText(row, ["approval_state", "approvalState"]),
    display_status: "Ready for G5",
    created_at: pickDate(row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    hook_count: hookCount,
    caption_count: captionCount,
    platform_label: platformLabel,
    content_text:
      pickText(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "content", "body", "message", "summary"]) ??
      preview.contentText ??
      sourcePreview?.captionPreview ??
      preview.captionPreview ??
      null,
    caption_preview:
      pickText(row, ["caption_preview", "captionPreview"]) ??
      sourcePreview?.captionPreview ??
      preview.captionPreview ??
      preview.contentText ??
      null,
    views: sourcePreview?.views ?? preview.views ?? null,
    likes: sourcePreview?.likes ?? preview.likes ?? null,
    comments: sourcePreview?.comments ?? preview.comments ?? null,
    shares: sourcePreview?.shares ?? preview.shares ?? null,
    title: pickText(row, ["title", "name", "headline"]) ?? preview.headline ?? null,
    asset_id: pickText(row, ["asset_id", "assetId"]),
    platform: pickText(row, ["platform", "source_platform", "sourcePlatform"]),
  };
};

const normalizeSelectionText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const collectNormalizedTexts = (...values: unknown[]) => {
  const normalized = new Set<string>();

  for (const value of values) {
    for (const candidate of normalizeG4StringArray(value)) {
      const text = normalizeG4Text(candidate);
      if (text) {
        normalized.add(text);
      }
    }
  }

  return [...normalized];
};

const looksLikeComplianceNote = (text: string) => {
  const normalized = normalizeSelectionText(text);
  if (!normalized) {
    return false;
  }

  return [
    "ensure all claims",
    "await further review",
    "include appropriate rights",
    "before publishing",
    "supported by evidence",
    "rights for any ugc",
    "creator content used",
    "review and approval",
    "claims about lipstick",
  ].some((phrase) => normalized.includes(phrase));
};

const collectSelectableOptionTexts = (texts: string[], excludedTexts: Array<string | null | undefined> = [], maxOptions = 3) => {
  const excluded = new Set(excludedTexts.map((text) => normalizeSelectionText(text)).filter(Boolean));
  const seen = new Set<string>();
  const options: string[] = [];
  const suppressed: string[] = [];

  for (const rawText of texts) {
    const text = normalizeG4Text(rawText);
    if (!text) {
      continue;
    }

    const normalized = normalizeSelectionText(text);
    if (!normalized || excluded.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);

    if (looksLikeComplianceNote(text)) {
      suppressed.push(text);
      continue;
    }

    options.push(text);
    if (options.length >= maxOptions) {
      break;
    }
  }

  return { options, suppressed };
};

const buildSelectableOptions = (texts: string[], kind: "caption" | "hook", excludedTexts: Array<string | null | undefined> = [], maxOptions = 3) =>
  collectSelectableOptionTexts(texts, excludedTexts, maxOptions).options.map((text, index) => ({
    id: `${kind}-${index + 2}`,
    label: `${kind === "caption" ? "Caption" : "Hook"} ${index + 2}`,
    text,
    source: "G4" as const,
  }));

const buildG5SelectedG4Content = (
  g4Row: JsonRecord,
  landingRow: JsonRecord | null,
  sourcePreview?: Partial<G4SourcePreviewDetails> | null
): G5SelectedG4ContentRecord => {
  const reviewPreview = extractG4ContentPreview(g4Row);
  const landingPreview = extractG4ContentPreview(landingRow ? { raw_payload: landingRow } : null);

  const contentReviewId = pickText(g4Row, ["content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const reviewId = pickText(g4Row, ["review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const id = pickText(g4Row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? "";
  const displayTitle =
    reviewPreview.headline?.trim() || reviewPreview.productName?.trim() || reviewPreview.captionPreview?.trim() || "Content check passed";

  const captionSuggestionTexts = collectG4SuggestionTexts(g4Row, "ai_caption_suggestions");
  const hookSuggestionTexts = collectG4SuggestionTexts(g4Row, "ai_hook_suggestions");
  const safeRewriteText =
    normalizeG4Text(g4Row.ai_safe_rewrite) ??
    normalizeG4Text(g4Row.rewritten_caption) ??
    normalizeG4Text(g4Row.safe_summary) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    captionSuggestionTexts[0] ??
    null;
  const hookAngleText = normalizeG4Text(g4Row.hook_angle) ?? normalizeG4Text(reviewPreview.hookAngle) ?? hookSuggestionTexts[0] ?? null;
  const contentAngleText =
    normalizeG4Text(g4Row.ai_insight) ??
    normalizeG4Text(g4Row.ai_summary) ??
    normalizeG4Text(g4Row.content_summary) ??
    normalizeG4Text(reviewPreview.contentRecommendation) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    null;

  const captionSelection = collectSelectableOptionTexts(captionSuggestionTexts, [], 3);
  const hookSelection = collectSelectableOptionTexts(hookSuggestionTexts, [hookAngleText], 3);
  const captionOptions = buildSelectableOptions(captionSelection.options, "caption");
  const hookOptions = buildSelectableOptions(hookSelection.options, "hook");

  const recommendedCaption = safeRewriteText ?? captionSelection.options[0] ?? normalizeG4Text(reviewPreview.cleanSummary) ?? null;
  const recommendedHook = hookAngleText ?? hookSelection.options[0] ?? null;

  const summaryCandidate =
    normalizeG4Text(g4Row.safe_summary) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);

  const claimNotes = collectNormalizedTexts(g4Row.ai_claim_notes);
  const insightCandidate =
    normalizeG4Text(g4Row.ai_risk_summary) ??
    normalizeG4Text(g4Row.risk_summary) ??
    normalizeG4Text(g4Row.ai_human_review_recommendation) ??
    normalizeG4Text(reviewPreview.contentRecommendation) ??
    (claimNotes.length ? claimNotes.join(" • ") : null) ??
    null;

  const complianceCandidates = [
    normalizeG4Text(g4Row.ai_human_review_recommendation),
    normalizeG4Text(g4Row.compliance_note),
    normalizeG4Text(g4Row.risk_summary),
    normalizeG4Text(g4Row.ai_risk_summary),
    ...captionSelection.suppressed,
    ...hookSelection.suppressed,
    ...(claimNotes.length ? claimNotes : []),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const contentSummary = summaryCandidate || null;
  const aiInsight = insightCandidate || null;
  const originalPostPlatform = pickText(landingRow, ["source_platform", "sourcePlatform", "platform"]) ?? pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) ?? null;
  const originalPostHandle =
    pickText(landingRow, ["profile_username", "profileUsername", "username", "handle", "creator_handle", "creatorHandle"]) ??
    sourcePreview?.profileUsername ??
    reviewPreview.profileUsername ??
    null;
  const originalPostCaption =
    normalizeG4Text(landingRow?.caption_text) ??
    normalizeG4Text(landingRow?.caption) ??
    normalizeG4Text(landingRow?.content_text) ??
    sourcePreview?.captionPreview ??
    reviewPreview.captionPreview ??
    normalizeG4Text(g4Row.caption_preview) ??
    normalizeG4Text(g4Row.caption) ??
    null;
  const originalPostUrl =
    pickText(landingRow, ["source_url", "sourceUrl", "post_url", "postUrl", "landing_page_url", "landingPageUrl"]) ??
    sourcePreview?.sourceUrl ??
    reviewPreview.sourceUrl ??
    null;
  const originalPostViews = sourcePreview?.views ?? reviewPreview.views ?? landingPreview.views ?? null;
  const originalPostLikes = sourcePreview?.likes ?? reviewPreview.likes ?? landingPreview.likes ?? null;
  const originalPostComments = sourcePreview?.comments ?? reviewPreview.comments ?? landingPreview.comments ?? null;
  const originalPostShares = sourcePreview?.shares ?? reviewPreview.shares ?? landingPreview.shares ?? null;
  const originalPostAudio = sourcePreview?.audioSound ?? reviewPreview.audioSound ?? landingPreview.audioSound ?? null;
  const originalPostEngagementRate = sourcePreview?.engagementRate ?? pickText(g4Row, ["engagement_rate", "engagementRate"]) ?? null;
  const originalPostData = [
    originalPostPlatform ? `Platform: ${originalPostPlatform}` : null,
    originalPostHandle ? `Handle: ${originalPostHandle}` : null,
    originalPostCaption ? `Caption: ${originalPostCaption}` : null,
    originalPostUrl ? `Post URL: ${originalPostUrl}` : null,
    originalPostViews ? `Views: ${originalPostViews}` : null,
    originalPostLikes ? `Likes: ${originalPostLikes}` : null,
    originalPostComments ? `Comments: ${originalPostComments}` : null,
    originalPostShares ? `Shares: ${originalPostShares}` : null,
    originalPostAudio ? `Audio: ${originalPostAudio}` : null,
    originalPostEngagementRate ? `Engagement rate: ${originalPostEngagementRate}` : null,
  ].filter((value): value is string => Boolean(value && value.trim())).join("\n") || null;
  const displaySummary = contentSummary || aiInsight || summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);
  const aiDirection = {
    content_angle: contentAngleText,
    safe_rewrite: recommendedCaption,
    hook_angle: recommendedHook,
    risk_summary: normalizeG4Text(g4Row.ai_risk_summary) ?? normalizeG4Text(g4Row.risk_summary) ?? null,
    compliance_note: complianceCandidates.length ? complianceCandidates[0] : null,
  };

  return {
    id,
    g4_review_uuid: id,
    g4_review_id: id,
    content_review_id: contentReviewId,
    review_id: reviewId,
    status: pickText(g4Row, ["status", "review_status", "reviewStatus"]),
    approval_state: pickText(g4Row, ["approval_state", "approvalState"]),
    display_status: "Ready for G5",
    created_at: pickDate(g4Row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    platform_label: pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown",
    ai_risk_summary: aiDirection.risk_summary,
    ai_compliance_note: aiDirection.compliance_note,
    caption_preview: reviewPreview.captionPreview ?? landingPreview.captionPreview ?? null,
    views: sourcePreview?.views ?? reviewPreview.views ?? landingPreview.views ?? null,
    likes: sourcePreview?.likes ?? reviewPreview.likes ?? landingPreview.likes ?? null,
    comments: sourcePreview?.comments ?? reviewPreview.comments ?? landingPreview.comments ?? null,
    shares: sourcePreview?.shares ?? reviewPreview.shares ?? landingPreview.shares ?? null,
    profile_username: sourcePreview?.profileUsername ?? reviewPreview.profileUsername ?? landingPreview.profileUsername ?? null,
    audio_sound: sourcePreview?.audioSound ?? reviewPreview.audioSound ?? landingPreview.audioSound ?? null,
    trend_strength: sourcePreview?.trendStrength ?? reviewPreview.trendStrength ?? landingPreview.trendStrength ?? null,
    brand_fit_score: sourcePreview?.brandFitScore ?? reviewPreview.brandFitScore ?? landingPreview.brandFitScore ?? null,
    risk_score: sourcePreview?.riskScore ?? reviewPreview.riskScore ?? landingPreview.riskScore ?? null,
    source_url: sourcePreview?.sourceUrl ?? reviewPreview.sourceUrl ?? landingPreview.sourceUrl ?? null,
    ai_safe_rewrite: recommendedCaption,
    hook_angle: hookAngleText,
    content_summary: contentSummary,
    ai_insight: aiInsight,
    engagement_rate: originalPostEngagementRate,
    original_post_data: originalPostData,
    content: {
      title: displayTitle,
      summary: displaySummary,
      platform: pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown",
      created_at: pickDate(g4Row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    },
    original_post: {
      platform: originalPostPlatform,
      handle: originalPostHandle,
      caption: originalPostCaption,
      post_url: originalPostUrl,
      views: originalPostViews,
      likes: originalPostLikes,
      comments: originalPostComments,
      shares: originalPostShares,
      audio: originalPostAudio,
      engagement_rate: originalPostEngagementRate,
    },
    ai_direction: aiDirection,
    caption_options: captionOptions,
    hook_options: hookOptions,
    recommended_caption: recommendedCaption,
    recommended_hook: recommendedHook,
  };
};

const isMissingRelationError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "42P01" || code === "42703" || code === "PGRST205" || /could not find the table|does not exist/i.test(message);
};

const isMissingColumnError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "42703" || /column .* does not exist/i.test(message);
};

const queryPublicRows = async (table: string, limit = 200) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return { rows: [] as JsonRecord[], error: null as string | null, available: false };
  }

  const { data, error } = await client.schema("public").from(table).select("*").limit(limit);
  if (error) {
    return {
      rows: [] as JsonRecord[],
      error: error.message || "Query failed.",
      available: !isMissingRelationError(error),
    };
  }

  return {
    rows: (Array.isArray(data) ? data : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row)),
    error: null as string | null,
    available: true,
  };
};

const getRowRecencyValue = (row: JsonRecord) => {
  const candidates = [
    "state_updated_at",
    "stateUpdatedAt",
    "handled_at",
    "handledAt",
    "approved_at",
    "approvedAt",
    "published_at",
    "publishedAt",
    "last_readiness_check_at",
    "lastReadinessCheckAt",
    "updated_at",
    "updatedAt",
    "modified_at",
    "modifiedAt",
    "created_at",
    "createdAt",
    "asset_created_at",
    "assetCreatedAt",
  ];

  for (const key of candidates) {
    const candidate = pickDateFromCandidates(row, [key]);
    if (!candidate) {
      continue;
    }

    const value = Date.parse(candidate);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const sortRowsByRecency = (rows: JsonRecord[]) => [...rows].sort((left, right) => getRowRecencyValue(left) - getRowRecencyValue(right));

const getAssetRecencyValue = (asset: G5DashboardAssetRecord) => {
  const candidates = [asset.state_updated_at, asset.published_at, asset.last_readiness_check_at, asset.asset_created_at];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const value = Date.parse(candidate);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const isPublishedManually = (asset: G5DashboardAssetRecord) => asset.client_tab === "published_manually";

const isReadyToPublish = (asset: G5DashboardAssetRecord) => asset.client_tab === "ready_to_publish";

const isBlocked = (asset: G5DashboardAssetRecord) => asset.client_tab === "blocked_rejected";

const logG5NormalizedAssetStatuses = (assets: G5DashboardAssetRecord[]) => {
  for (const asset of assets) {
    const statusInfo = getG5ClientStatusInfo(asset);
    console.log("G5 normalized asset status", {
      assetId: asset.asset_id,
      g4ReviewId: asset.g4_review_id ?? asset.g4_review_uuid ?? asset.content_review_id ?? asset.review_id ?? null,
      contentApprovalStatus: statusInfo.contentApprovalStatus,
      publishStateStatus: statusInfo.publishStateStatus,
      manualPublishStatus: statusInfo.manualPublishStatus,
      finalClientStatus: statusInfo.clientStatus,
      finalClientTab: statusInfo.clientTab,
    });
  }
};

const finalizeG5AssetRecord = (asset: G5DashboardAssetRecord): G5DashboardAssetRecord => {
  const statusInfo = getG5ClientStatusInfo(asset);

  return {
    ...asset,
    client_status: statusInfo.clientStatus,
    client_tab: statusInfo.clientTab,
  };
};

const buildDashboardSummary = (assets: G5DashboardAssetRecord[]): G5DashboardSummary => {
  const published = assets.filter(isPublishedManually).length;
  const ready = assets.filter((asset) => !isPublishedManually(asset) && isReadyToPublish(asset) && !isBlocked(asset)).length;
  const blocked = assets.filter(isBlocked).length;
  const pending = assets.filter((asset) => asset.client_tab === "pending_approval").length;

  return {
    total: assets.length,
    pending_approval: pending,
    ready_to_publish: ready,
    published_manually: published,
    blocked,
  };
};

const sortAssets = (assets: G5DashboardAssetRecord[]) =>
  [...assets].sort((left, right) => getAssetRecencyValue(right) - getAssetRecencyValue(left));

const createEmptyDashboardResponse = (source: G5DashboardResponse["source"], message: string): G5DashboardResponse => ({
  status: "EMPTY",
  source,
  message,
  summary: {
    total: 0,
    pending_approval: 0,
    ready_to_publish: 0,
    published_manually: 0,
    blocked: 0,
  },
  assets: [],
});

const defaultWebhookMessage = (status: string, fallbackToTemporaryFailure = false) => {
  switch (status) {
    case "PASS":
    case "APPROVED":
      return "Recorded.";
    case "PENDING_APPROVAL":
      return "Waiting for approval.";
    case "APPROVED_READY_TO_PUBLISH":
    case "READY_TO_PUBLISH":
      return "Ready to publish manually.";
    case "PUBLISHED_MANUALLY":
      return "Manual publish result recorded.";
    case "REJECTED":
    case "BLOCK":
    case "BLOCKED":
      return CEVONNE_SAFE_RESPONSE_MESSAGE;
    case "MANUAL_ONLY":
      return CEVONNE_MANUAL_REVIEW_MESSAGE;
    case "ERROR":
      return CEVONNE_TEMPORARY_FAILURE_MESSAGE;
    default:
      return fallbackToTemporaryFailure ? CEVONNE_TEMPORARY_FAILURE_MESSAGE : "Recorded.";
  }
};

const buildWebhookHeaders = (requestId: string, sentAt: string, dryRun: boolean) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cevonne-Source": "admin-panel",
    "X-Cevonne-Request-Id": requestId,
    "X-Cevonne-Timestamp": sentAt,
    "X-Cevonne-Dry-Run": dryRun ? "true" : "false",
  };

  if (env.n8nWebhookSecret.trim()) {
    headers.Authorization = `Bearer ${env.n8nWebhookSecret.trim()}`;
    headers["X-Cevonne-Webhook-Secret"] = env.n8nWebhookSecret.trim();
  }

  return headers;
};

const postG5Webhook = async (path: string, payload: JsonRecord, options: { dryRun?: boolean } = {}): Promise<G5WebhookResponse> => {
  const requestId = randomUUID();
  const sentAt = new Date().toISOString();
  const webhookUrl = buildN8nWebhookUrl(path);
  const dryRun = Boolean(options.dryRun ?? payload.dry_run ?? false);

  if (!webhookUrl) {
    return {
      status: "ERROR",
      message: "Missing n8n webhook configuration.",
      response_type: null,
      handled_at: null,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: null,
      response_text: null,
      raw: null,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: buildWebhookHeaders(requestId, sentAt, dryRun),
      body: JSON.stringify({
        ...payload,
        request_id: requestId,
        received_at: sentAt,
        dry_run: dryRun,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!responseText.trim()) {
      return {
        status: "ERROR",
        message: "n8n returned an empty response.",
        response_type: null,
        handled_at: null,
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: responseText,
        raw: null,
      };
    }

    let raw: JsonRecord | null = null;
    try {
      const parsed = JSON.parse(responseText);
      raw = asRecord(parsed);
    } catch {
      raw = null;
    }

    if (!raw) {
      return {
        status: "ERROR",
        message: "n8n returned invalid JSON.",
        response_type: null,
        handled_at: null,
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: responseText,
        raw: null,
      };
    }

    const status = upperText(raw.status) ?? (response.ok ? "PASS" : "ERROR");
    const handledAt = toText(raw.handled_at ?? raw.handledAt) ?? null;
    const message = toText(raw.message) ?? defaultWebhookMessage(status, !response.ok);
    const responseType = toText(raw.response_type ?? raw.responseType) ?? null;

    return {
      ...raw,
      status,
      message,
      response_type: responseType,
      handled_at: handledAt,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: response.status,
      response_text: responseText,
      raw,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "n8n request timed out." : "Failed to call n8n webhook.";
    return {
      status: "ERROR",
      message,
      response_type: null,
      handled_at: null,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: null,
      response_text: null,
      raw: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function loadG5DashboardAssets(): Promise<G5DashboardResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return createEmptyDashboardResponse("UNAVAILABLE", "G5 dashboard data source is not configured yet.");
  }

  const [viewResult, contentAssetsResult, stateResult, publishResultsResult, approvalResult, auditResult] = await Promise.all([
    queryPublicRows("g5_manual_publish_dashboard_view", 250),
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
    queryPublicRows(G5_APPROVALS_TABLE, 250),
    queryPublicRows(G5_ASSET_AUDIT_TABLE, 250),
  ]);
  const auditRows = auditResult.rows.filter(isSuccessfulG5AssetRegisterAudit).map(expandRecordWithRawPayload);
  const approvalRows = sortRowsByRecency(
    approvalResult.rows.filter((row) => {
      const workflowGroup = normalizeStateKey(row.workflow_group);
      const workflowId = normalizeStateKey(row.workflow_id);
      return workflowGroup === G5_WORKFLOW_GROUP || workflowId === G5_WORKFLOW_ID;
    }),
  );
  const baseRows = viewResult.error === null ? viewResult.rows : contentAssetsResult.rows;
  const merged = new Map<string, G5DashboardAssetRecord>();
  const mergeRows = (rows: JsonRecord[]) => {
    for (const row of rows) {
      const normalized = normalizeAssetRecord(row);
      if (!normalized) {
        continue;
      }

      const current = merged.get(normalized.asset_id);
      merged.set(normalized.asset_id, current ? mergeRecords(current, normalized) : normalized);
    }
  };

  const mergedRows = sortRowsByRecency([...baseRows, ...auditRows, ...approvalRows, ...stateResult.rows, ...publishResultsResult.rows]);
  mergeRows(mergedRows);

  const assets = sortAssets([...merged.values()].map(finalizeG5AssetRecord));
  logG5NormalizedAssetStatuses(assets);
  return {
    status: assets.length ? "PASS" : "EMPTY",
    source: viewResult.error === null ? "VIEW" : "FALLBACK",
    message: assets.length
      ? viewResult.error === null
        ? "G5 dashboard loaded from the consolidated view."
        : "G5 dashboard loaded from fallback tables."
      : "No G5 assets have been stored yet.",
    summary: buildDashboardSummary(assets),
    assets,
  };
}

export async function loadG5ApprovedContent(): Promise<G5ApprovedContentResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] n8n Supabase config missing", {
      supabase: describeN8nSupabaseTarget(),
      env_keys: ["N8N_SUPABASE_URL", "N8N_SUPABASE_SERVICE_ROLE_KEY"],
    });
    return {
      status: "EMPTY",
      source: "UNAVAILABLE",
      message: "G4 content source is not configured yet.",
      reviews: [],
    };
  }

  const supabaseTarget = describeN8nSupabaseTarget();
  console.info("[g5-asset-approval] loading G4 reviews from n8n Supabase", {
    supabase: supabaseTarget,
    table: "public.g4_content_reviews",
  });

  const [contentAssetsResult, stateResult, publishResultsResult, dashboardViewResult, g5G4LinkResult, auditResult, g4ReviewResult] = await Promise.all([
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
    queryPublicRows("g5_manual_publish_dashboard_view", 250),
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
    queryPublicRows(G5_ASSET_AUDIT_TABLE, 500),
    client
      .schema("public")
      .from("g4_content_reviews")
      .select("id, content_review_id, review_id, status, approval_state, created_at, platform, safe_summary, ai_safe_rewrite, ai_risk_summary, ai_caption_suggestions, ai_hook_suggestions, ai_human_review_recommendation, raw_payload")
      .or("status.eq.PASS,approval_state.in.(PENDING_HUMAN_APPROVAL,READY_FOR_APPROVAL,APPROVED)")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const { data, error } = g4ReviewResult;
  if (error) {
    console.error("[g5-asset-approval] failed to load G4 reviews", {
      supabase: supabaseTarget,
      table: "public.g4_content_reviews",
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      status: "ERROR",
      source: "UNAVAILABLE",
      message: `Unable to load G4 content reviews: ${error.message || "query failed."}`,
      reviews: [],
    };
  }

  const registeredG5AssetRows = [
    ...contentAssetsResult.rows,
    ...stateResult.rows,
    ...publishResultsResult.rows,
    ...dashboardViewResult.rows,
    ...g5G4LinkResult.rows,
    ...auditResult.rows.filter(isSuccessfulG5AssetRegisterAudit).map(expandRecordWithRawPayload),
  ].map(expandRecordWithRawPayload);
  const registeredG4ReviewKeys = new Set(
    registeredG5AssetRows
      .flatMap((row) => buildRegisteredG5AssetIdentity(row).candidateKeys)
      .map((value) => normalizeG4ApprovedContentKeyText(value))
      .filter(Boolean),
  );

  const g4Rows = (Array.isArray(data) ? data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));
  const orderedG4Rows = [...g4Rows].sort((left, right) => getG4ApprovedContentCreatedAtValue(right) - getG4ApprovedContentCreatedAtValue(left));
  const dedupedG4Rows = dedupeG4ApprovedContentRows(orderedG4Rows);
  const registeredG4ContentKeys = new Set<string>();

  for (const row of orderedG4Rows) {
    const identity = buildG4ApprovedContentIdentity(row);
    if (identity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key)) && identity.primaryKey) {
      registeredG4ContentKeys.add(identity.primaryKey);
    }
  }

  const sourcePreviewByLookupKey = await loadG4SourcePreviewMap(dedupedG4Rows);

  const reviews = dedupedG4Rows
    .map((row) => {
      const identity = buildG4ApprovedContentIdentity(row);
      const sourceLookupKey = getG4SourceLookupKey(row);
      const sourcePreview = sourceLookupKey ? sourcePreviewByLookupKey.get(sourceLookupKey) ?? null : null;
      const review = normalizeG4ReviewRecord(row, sourcePreview);

      return review ? { review, identity } : null;
    })
    .filter((entry): entry is { review: G5ApprovedContentRecord; identity: ReturnType<typeof buildG4ApprovedContentIdentity> } => Boolean(entry))
    .filter(({ review }) => isG4ReadyForG5(review))
    .filter(({ identity }) => !identity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key)) && !(identity.primaryKey && registeredG4ContentKeys.has(identity.primaryKey)))
    .map(({ review }) => review)
    .sort((left, right) => {
      const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
      const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
      return rightTime - leftTime;
    })
    .slice(0, 50);

  console.info("[g5-asset-approval] loaded G4 reviews for G5", {
    supabase: supabaseTarget,
    row_count: reviews.length,
    ids: reviews.slice(0, 5).map((row) => row.id),
  });

  return {
    status: reviews.length ? "PASS" : "EMPTY",
    source: "TABLE",
    message: reviews.length ? "G4 content ready for G5 loaded." : "No G4 content ready for G5 yet.",
    reviews,
  };
}

const resolveG4ReviewIdFromG5AssetIdentity = async (assetId?: string | null, approvalId?: string | null) => {
  const normalizedAssetId = assetId?.trim() ?? "";
  const normalizedApprovalId = normalizeG5ApprovalIdText(approvalId) ?? approvalId?.trim() ?? "";

  if (!normalizedAssetId && !normalizedApprovalId) {
    return null;
  }

  const [linkRowsResult, auditResult] = await Promise.all([
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
    queryPublicRows(G5_ASSET_AUDIT_TABLE, 500),
  ]);

  const auditRows = auditResult.rows.filter(isSuccessfulG5AssetRegisterAudit).map(expandRecordWithRawPayload);
  const candidateRows = [...linkRowsResult.rows, ...auditRows];
  const normalizedAssetKey = normalizeG4ApprovedContentKeyText(normalizedAssetId);
  const normalizedApprovalKey = normalizeG5ApprovalIdText(normalizedApprovalId) ?? normalizeG4ApprovedContentKeyText(normalizedApprovalId);

  for (const row of candidateRows) {
    const rowAssetKey = normalizeG4ApprovedContentKeyText(pickTextFromCandidates(row, ["asset_id", "assetId"]) ?? null);
    const rowApprovalKey = normalizeG5ApprovalIdText(pickTextFromCandidates(row, ["approval_id", "approvalId"]) ?? null) ?? "";
    const assetMatches = normalizedAssetKey && rowAssetKey === normalizedAssetKey;
    const approvalMatches = normalizedApprovalKey && rowApprovalKey === normalizedApprovalKey;

    if (!assetMatches && !approvalMatches) {
      continue;
    }

    const rawPayload = asRecord(row.raw_payload);
    const nestedRawPayload = asRecord(rawPayload?.raw_payload);
    const resolvedReviewId =
      pickTextFromCandidates(row, [
        "source_content_id",
        "sourceContentId",
        "source_g4_review_id",
        "sourceG4ReviewId",
        "source_handoff_id",
        "sourceHandoffId",
        "g4_review_id",
        "g4ReviewId",
        "g4_review_uuid",
        "g4ReviewUuid",
        "content_review_id",
        "contentReviewId",
        "review_id",
        "reviewId",
      ]) ??
      pickTextFromCandidates(rawPayload, [
        "source_content_id",
        "sourceContentId",
        "source_g4_review_id",
        "sourceG4ReviewId",
        "source_handoff_id",
        "sourceHandoffId",
        "g4_review_id",
        "g4ReviewId",
        "g4_review_uuid",
        "g4ReviewUuid",
        "content_review_id",
        "contentReviewId",
        "review_id",
        "reviewId",
      ]) ??
      pickTextFromCandidates(nestedRawPayload, [
        "source_content_id",
        "sourceContentId",
        "source_g4_review_id",
        "sourceG4ReviewId",
        "source_handoff_id",
        "sourceHandoffId",
        "g4_review_id",
        "g4ReviewId",
        "g4_review_uuid",
        "g4ReviewUuid",
        "content_review_id",
        "contentReviewId",
        "review_id",
        "reviewId",
      ]) ??
      null;

    if (resolvedReviewId) {
      return resolvedReviewId;
    }
  }

  return null;
};

const readJsonRecordValueFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  for (const record of records) {
    for (const candidate of getJsonRecordCandidates(record)) {
      const value = readJsonRecordValue(candidate, keys);
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value) && value.length === 0) {
        continue;
      }

      if (isRecord(value) && Object.keys(value).length === 0) {
        continue;
      }

      return value;
    }
  }

  return null;
};

const readBestJsonRecordArrayFromCandidates = <T extends unknown[]>(
  records: Array<JsonRecord | null | undefined>,
  keys: string[],
  normalize: (value: unknown) => T,
) => {
  let best = [] as unknown as T;

  for (const record of records) {
    for (const candidate of getJsonRecordCandidates(record)) {
      const value = readJsonRecordValue(candidate, keys);
      if (!Array.isArray(value) || value.length === 0) {
        continue;
      }

      const normalized = normalize(value);
      if (normalized.length > best.length) {
        best = normalized;
      }
    }
  }

  return best;
};

const readJsonRecordObjectFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  const value = readJsonRecordValueFromCandidates(records, keys);
  return asRecord(value);
};

const readJsonRecordArrayFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  const value = readJsonRecordValueFromCandidates(records, keys);
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
};

const readJsonRecordNumberFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  const value = readJsonRecordValueFromCandidates(records, keys);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const readJsonRecordBooleanFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  const value = readJsonRecordValueFromCandidates(records, keys);
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return null;
};

type G4ReviewSearchHints = {
  title?: string | null;
  caption?: string | null;
  hook?: string | null;
  platform?: string | null;
  sourceUrl?: string | null;
};

const isSimilarG4Text = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeSelectionText(normalizeG4Text(left) ?? undefined);
  const normalizedRight = normalizeSelectionText(normalizeG4Text(right) ?? undefined);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
};

const scoreG4ReviewContentMatch = (row: JsonRecord, hints: G4ReviewSearchHints) => {
  const preview = extractG4ContentPreview(row);
  let score = 0;

  if (hints.caption) {
    const captionMatches = [
      pickText(row, ["caption_preview", "captionPreview", "caption", "caption_text", "content_text"]),
      preview.captionPreview,
      preview.contentText,
      preview.cleanSummary,
      preview.contentRecommendation,
    ].some((candidate) => isSimilarG4Text(candidate, hints.caption));

    if (captionMatches) {
      score += 5;
    }
  }

  if (hints.title) {
    const titleMatches = [
      pickText(row, ["headline", "title", "name", "display_title"]),
      preview.headline,
      preview.productName,
      preview.captionPreview,
    ].some((candidate) => isSimilarG4Text(candidate, hints.title));

    if (titleMatches) {
      score += 4;
    }
  }

  if (hints.hook) {
    const hookMatches = [
      pickText(row, ["hook_angle", "hookAngle", "hook", "hook_text", "hookText"]),
      preview.hookAngle,
    ].some((candidate) => isSimilarG4Text(candidate, hints.hook));

    if (hookMatches) {
      score += 2;
    }
  }

  if (hints.platform) {
    const platformMatches = [
      pickText(row, ["platform", "source_platform", "sourcePlatform"]),
    ].some((candidate) => isSimilarG4Text(candidate, hints.platform));

    if (platformMatches) {
      score += 1;
    }
  }

  if (hints.sourceUrl) {
    const sourceUrlMatches = [
      pickText(row, ["source_url", "sourceUrl", "content_url", "contentUrl", "post_url", "postUrl", "permalink"]),
      preview.sourceUrl,
    ].some((candidate) => isSimilarG4Text(candidate, hints.sourceUrl));

    if (sourceUrlMatches) {
      score += 2;
    }
  }

  return score;
};

const resolveG4ReviewByContentHints = async (hints: G4ReviewSearchHints) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .schema("public")
    .from("g4_content_reviews")
    .select(G5_G4_DETAIL_COLUMNS)
    .or("status.eq.PASS,approval_state.in.(PENDING_HUMAN_APPROVAL,READY_FOR_APPROVAL,APPROVED)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("[g5-asset-approval] failed to search G4 review by content hints", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      hints,
    });
    return null;
  }

  const rows = (Array.isArray(data) ? data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  let bestMatch: { row: JsonRecord; score: number } | null = null;
  for (const row of rows) {
    const score = scoreG4ReviewContentMatch(row, hints);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { row, score };
    }
  }

  if (!bestMatch || bestMatch.score < 4) {
    return null;
  }

  return bestMatch.row;
};

const G5_G4_DETAIL_COLUMNS = "*" as const;

const G5_G4_LANDING_COLUMNS = "*" as const;

export async function loadG5SelectedG4Content(
  reviewId: string,
  assetId?: string | null,
  approvalId?: string | null,
  searchHints: G4ReviewSearchHints = {},
): Promise<G5SelectedG4ContentResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] n8n Supabase config missing", {
      supabase: describeN8nSupabaseTarget(),
      env_keys: ["N8N_SUPABASE_URL", "N8N_SUPABASE_SERVICE_ROLE_KEY"],
    });
    return {
      status: "EMPTY",
      source: "UNAVAILABLE",
      message: "G4 content source is not configured yet.",
      review: null,
    };
  }

  const normalizedReviewId = reviewId.trim();
  const normalizedAssetId = assetId?.trim() ?? "";
  const normalizedApprovalId = normalizeG5ApprovalIdText(approvalId) ?? approvalId?.trim() ?? "";
  const normalizedHints: G4ReviewSearchHints = {
    title: searchHints.title?.trim() || null,
    caption: searchHints.caption?.trim() || null,
    hook: searchHints.hook?.trim() || null,
    platform: searchHints.platform?.trim() || null,
    sourceUrl: searchHints.sourceUrl?.trim() || null,
  };
  const supabaseTarget = describeN8nSupabaseTarget();
  const queryG4RowsByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) {
      return { data: [], error: null };
    }

    return client
      .schema("public")
      .from("g4_content_reviews")
      .select(G5_G4_DETAIL_COLUMNS)
      .or(`id.eq.${identifier},content_review_id.eq.${identifier},review_id.eq.${identifier}`)
      .order("created_at", { ascending: false })
      .limit(10);
  };

  let selectedReviewIdentifier = normalizedReviewId;
  let { data: g4Data, error: g4Error } = await queryG4RowsByIdentifier(selectedReviewIdentifier);

  if (g4Error) {
    console.error("[g5-asset-approval] failed to load selected G4 review", {
      supabase: supabaseTarget,
      review_id: selectedReviewIdentifier,
      asset_id: normalizedAssetId || null,
      approval_id: normalizedApprovalId || null,
      table: "public.g4_content_reviews",
      code: g4Error.code,
      message: g4Error.message,
      details: g4Error.details,
      hint: g4Error.hint,
    });

    return {
      status: "ERROR",
      source: "UNAVAILABLE",
      message: `Unable to load selected G4 content: ${g4Error.message || "query failed."}`,
      review: null,
    };
  }

  let g4Rows = (Array.isArray(g4Data) ? g4Data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  if (!g4Rows.length && (normalizedAssetId || normalizedApprovalId)) {
    const resolvedReviewId = await resolveG4ReviewIdFromG5AssetIdentity(normalizedAssetId, normalizedApprovalId);
    if (resolvedReviewId && resolvedReviewId !== selectedReviewIdentifier) {
      console.info("[g5-asset-approval] resolved selected G4 review id from G5 asset audit trail", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId || null,
        asset_id: normalizedAssetId || null,
        approval_id: normalizedApprovalId || null,
        resolved_review_id: resolvedReviewId,
      });
      selectedReviewIdentifier = resolvedReviewId;
      ({ data: g4Data, error: g4Error } = await queryG4RowsByIdentifier(selectedReviewIdentifier));

      if (g4Error) {
        console.error("[g5-asset-approval] failed to load fallback G4 review", {
          supabase: supabaseTarget,
          review_id: selectedReviewIdentifier,
          asset_id: normalizedAssetId || null,
          approval_id: normalizedApprovalId || null,
          table: "public.g4_content_reviews",
          code: g4Error.code,
          message: g4Error.message,
          details: g4Error.details,
          hint: g4Error.hint,
        });

        return {
          status: "ERROR",
          source: "UNAVAILABLE",
          message: `Unable to load selected G4 content: ${g4Error.message || "query failed."}`,
          review: null,
        };
      }

      g4Rows = (Array.isArray(g4Data) ? g4Data : [])
        .map((row) => asRecord(row))
        .filter((row): row is JsonRecord => Boolean(row));
    }
  }

  if (!g4Rows.length && (normalizedHints.title || normalizedHints.caption || normalizedHints.hook || normalizedHints.platform || normalizedHints.sourceUrl)) {
    const matchedRow = await resolveG4ReviewByContentHints(normalizedHints);
    if (matchedRow) {
      selectedReviewIdentifier =
        pickText(matchedRow, ["content_review_id", "review_id", "id"]) ??
        selectedReviewIdentifier;
      g4Rows = [matchedRow];
      console.info("[g5-asset-approval] resolved selected G4 review id from content hints", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId || null,
        asset_id: normalizedAssetId || null,
        approval_id: normalizedApprovalId || null,
        selected_review_id: selectedReviewIdentifier,
        hints: normalizedHints,
      });
    }
  }

  if (!g4Rows.length) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "No G4 content ready for G5 yet.",
      review: null,
    };
  }

  const selectedG4Row = g4Rows[0];
  const sourcePreviewByLookupKey = await loadG4SourcePreviewMap([selectedG4Row]);

  console.info("[g5-asset-approval] selected G4 review query result", {
    supabase: supabaseTarget,
    review_id: selectedReviewIdentifier,
    asset_id: normalizedAssetId || null,
    approval_id: normalizedApprovalId || null,
    row_count: g4Rows.length,
  });

  const selectedSourceLookupKey = getG4SourceLookupKey(selectedG4Row);
  const selectedSourcePreview = selectedSourceLookupKey ? sourcePreviewByLookupKey.get(selectedSourceLookupKey) ?? null : null;
  console.info("[g5-asset-approval] selected G4 review row keys", {
    supabase: supabaseTarget,
    review_id: selectedReviewIdentifier,
    asset_id: normalizedAssetId || null,
    approval_id: normalizedApprovalId || null,
    keys: Object.keys(selectedG4Row),
  });
  console.info("[g5-asset-approval] selected G4 review row", {
    supabase: supabaseTarget,
    review_id: selectedReviewIdentifier,
    asset_id: normalizedAssetId || null,
    approval_id: normalizedApprovalId || null,
    row: selectedG4Row,
  });

  const selectedReviewKey = pickText(selectedG4Row, ["content_review_id", "review_id", "id"]) ?? selectedReviewIdentifier;
  const [contentAssetsResult, stateResult, publishResultsResult, dashboardViewResult, linkRowsResult, auditResult] = await Promise.all([
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
    queryPublicRows("g5_manual_publish_dashboard_view", 250),
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
    queryPublicRows(G5_ASSET_AUDIT_TABLE, 500),
  ]);
  const registeredG5AssetRows = [
    ...contentAssetsResult.rows,
    ...stateResult.rows,
    ...publishResultsResult.rows,
    ...dashboardViewResult.rows,
    ...linkRowsResult.rows,
    ...auditResult.rows.filter(isSuccessfulG5AssetRegisterAudit).map(expandRecordWithRawPayload),
  ].map(expandRecordWithRawPayload);
  const registeredG4ReviewKeys = new Set(
    registeredG5AssetRows
      .flatMap((row) => buildRegisteredG5AssetIdentity(row).candidateKeys)
      .map((value) => normalizeG4ApprovedContentKeyText(value))
      .filter(Boolean),
  );
  const selectedIdentity = buildG4ApprovedContentIdentity(selectedG4Row);

  if (!normalizedAssetId && !normalizedApprovalId && selectedIdentity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key))) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "This G4 content is already registered as a G5 asset.",
      review: null,
    };
  }

  let landingRow: JsonRecord | null = null;

  const { data: landingData, error: landingError } = await client
    .schema("public")
    .from("g4_content_landing_checks")
    .select(G5_G4_LANDING_COLUMNS)
    .or(`id.eq.${normalizedReviewId},content_review_id.eq.${normalizedReviewId},review_id.eq.${normalizedReviewId},id.eq.${selectedReviewKey},content_review_id.eq.${selectedReviewKey},review_id.eq.${selectedReviewKey}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (landingError) {
    console.error("[g5-asset-approval] failed to load G4 landing checks for selected review", {
      supabase: supabaseTarget,
      review_id: normalizedReviewId,
      content_review_id: selectedReviewKey,
      table: "public.g4_content_landing_checks",
      code: landingError.code,
      message: landingError.message,
      details: landingError.details,
      hint: landingError.hint,
    });
  } else {
    const landingRows = (Array.isArray(landingData) ? landingData : [])
      .map((row) => asRecord(row))
      .filter((row): row is JsonRecord => Boolean(row));

    console.info("[g5-asset-approval] selected G4 landing check query result", {
      supabase: supabaseTarget,
      review_id: normalizedReviewId,
      content_review_id: selectedReviewKey,
      row_count: landingRows.length,
    });

    if (landingRows.length) {
      landingRow = landingRows[0];
      console.info("[g5-asset-approval] selected G4 landing row keys", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId,
        content_review_id: selectedReviewKey,
        keys: Object.keys(landingRow),
      });
      console.info("[g5-asset-approval] selected G4 landing row", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId,
        content_review_id: selectedReviewKey,
        row: landingRow,
      });
    }
  }

  const review = buildG5SelectedG4Content(selectedG4Row, landingRow, selectedSourcePreview);

  return {
    status: "PASS",
    source: "TABLE",
    message: "G4 content ready for G5 loaded.",
    review,
  };
}

export async function uploadG5Media(file: File) {
  const asset = await uploadFileToR2(file);

  return {
    status: "PASS",
    message: "Media uploaded to R2.",
    media_url: asset.url,
    storage_url: asset.storageKey,
    storage_key: asset.storageKey,
    filename: asset.originalName,
    content_type: asset.mimeType,
    kind: asset.kind,
    size: asset.size,
  };
}

type G5AssetAuditOperation = "ASSET_REGISTER" | "ASSET_EDIT";

const buildG5AssetAuditSnapshot = (
  payload: JsonRecord,
  operation: G5AssetAuditOperation,
  response: G5WebhookResponse | null,
  assetId: string | null,
  approvalId: string | null,
  handledAt?: string | null,
) => {
  const effectiveHandledAt = handledAt ?? response?.handled_at ?? new Date().toISOString();
  const payloadMetadata = asRecord(payload.metadata);
  const normalizedApprovalId = normalizeG5ApprovalIdText(approvalId);
  const captionOptions = readBestJsonRecordArrayFromCandidates(
    [payload],
    ["caption_options", "captionOptions", "generated_captions", "generatedCaptions", "captions"],
    (value) => normalizeG5OptionArray(value, "caption"),
  );
  const hookOptions = readBestJsonRecordArrayFromCandidates(
    [payload],
    ["hook_options", "hookOptions", "generated_hooks", "generatedHooks", "hooks"],
    (value) => normalizeG5OptionArray(value, "hook"),
  );
  const mediaAssets = readBestJsonRecordArrayFromCandidates([payload], ["media_assets", "mediaAssets"], (value) => normalizeG5MediaAssets(value));
  const selectedCaption =
    pickTextFromCandidates(payload, ["selected_caption", "selectedCaption", "content_text", "caption", "caption_text", "captionText"]) ?? null;
  const selectedHook =
    pickTextFromCandidates(payload, ["selected_hook", "selectedHook", "hook_angle", "hookAngle", "hook", "hook_text", "hookText"]) ?? null;
  const selectedCaptionIndex = readJsonRecordNumberFromCandidates([payload], ["selected_caption_index", "selectedCaptionIndex"]);
  const selectedHookIndex = readJsonRecordNumberFromCandidates([payload], ["selected_hook_index", "selectedHookIndex"]);
  const originalPostData = readJsonRecordValueFromCandidates([payload], ["original_post_data", "originalPostData"]);
  const sourceContentId = pickTextFromCandidates(payload, ["source_content_id", "sourceContentId", "content_review_id", "contentReviewId", "review_id", "reviewId", "id"]);
  const sourceG4ReviewId = pickTextFromCandidates(payload, ["source_g4_review_id", "sourceG4ReviewId", "g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const sourceHandoffId = pickTextFromCandidates(payload, ["source_handoff_id", "sourceHandoffId", "handoff_id", "handoffId", "approval_id", "approvalId", "asset_id", "assetId"]);
  const originalPostUrl =
    pickTextFromCandidates(payload, ["original_post_url", "originalPostUrl", "source_url", "sourceUrl", "post_url", "postUrl", "permalink"]) ??
    (typeof originalPostData === "object" && originalPostData !== null && !Array.isArray(originalPostData)
      ? pickTextFromCandidates(asRecord(originalPostData), ["post_url", "postUrl", "source_url", "sourceUrl", "permalink"])
      : null);

  const sourceG4 = {
    source_content_id: sourceContentId,
    source_g4_review_id: sourceG4ReviewId,
    source_handoff_id: sourceHandoffId,
  };

  return {
    ...payload,
    asset_id: assetId ?? pickTextFromCandidates(payload, ["asset_id", "assetId"]) ?? null,
    approval_id: normalizedApprovalId ?? pickTextFromCandidates(payload, ["approval_id", "approvalId"]) ?? null,
    caption_options: captionOptions,
    hook_options: hookOptions,
    selected_caption: selectedCaption,
    selected_caption_index: selectedCaptionIndex ?? null,
    selected_hook: selectedHook,
    selected_hook_index: selectedHookIndex ?? null,
    media_assets: mediaAssets,
    original_post_data: originalPostData,
    original_post_url: originalPostUrl,
    source_content_id: sourceContentId,
    source_g4_review_id: sourceG4ReviewId,
    source_handoff_id: sourceHandoffId,
    source_g4: sourceG4,
    source_status:
      pickTextFromCandidates(payload, ["source_status", "sourceStatus"]) ??
      (operation === "ASSET_REGISTER" ? "REGISTERED" : null),
    registration_status:
      pickTextFromCandidates(payload, ["registration_status", "registrationStatus"]) ??
      (operation === "ASSET_REGISTER" ? "REGISTERED" : null),
    approval_status:
      pickTextFromCandidates(payload, ["approval_status", "approvalStatus"]) ??
      (operation === "ASSET_REGISTER" ? "PENDING" : null),
    readiness_status:
      pickTextFromCandidates(payload, ["readiness_status", "readinessStatus"]) ??
      (operation === "ASSET_REGISTER" ? "NOT_CHECKED" : null),
    status:
      pickTextFromCandidates(payload, ["status"]) ??
      (operation === "ASSET_REGISTER" ? "PENDING_APPROVAL" : null),
    g5_status:
      pickTextFromCandidates(payload, ["g5_status", "g5Status"]) ??
      (operation === "ASSET_REGISTER" ? "PENDING_APPROVAL" : null),
    used_in_g5: readJsonRecordBooleanFromCandidates([payload], ["used_in_g5", "usedInG5"]) ?? (operation === "ASSET_REGISTER" ? true : null),
    registered_asset_id:
      pickTextFromCandidates(payload, ["registered_asset_id", "registeredAssetId"]) ??
      assetId ??
      null,
    registered_at: pickTextFromCandidates(payload, ["registered_at", "registeredAt"]) ?? effectiveHandledAt,
    updated_at: effectiveHandledAt,
    state_updated_at: effectiveHandledAt,
    actor: pickTextFromCandidates(payload, ["actor"]) ?? null,
    response_status: response?.status ?? null,
    response_message: response?.message ?? null,
    response_type: response?.response_type ?? null,
    handled_at: effectiveHandledAt,
    request_id: response?.request_id ?? null,
    sent_at: response?.sent_at ?? null,
    webhook_url: response?.webhook_url ?? null,
    http_status: response?.http_status ?? null,
    response_text: response?.response_text ?? null,
    metadata: {
      ...(payloadMetadata ?? {}),
      caption_options: captionOptions,
      hook_options: hookOptions,
      selected_caption: selectedCaption,
      selected_caption_index: selectedCaptionIndex ?? null,
      selected_hook: selectedHook,
      selected_hook_index: selectedHookIndex ?? null,
      media_assets: mediaAssets,
      original_post_data: originalPostData,
      original_post_url: originalPostUrl,
      source_g4: sourceG4,
      source_content_id: sourceContentId,
      source_g4_review_id: sourceG4ReviewId,
      source_handoff_id: sourceHandoffId,
      source_status:
        pickTextFromCandidates(payload, ["source_status", "sourceStatus"]) ??
        (operation === "ASSET_REGISTER" ? "REGISTERED" : null),
      registration_status:
        pickTextFromCandidates(payload, ["registration_status", "registrationStatus"]) ??
        (operation === "ASSET_REGISTER" ? "REGISTERED" : null),
      approval_status:
        pickTextFromCandidates(payload, ["approval_status", "approvalStatus"]) ??
        (operation === "ASSET_REGISTER" ? "PENDING" : null),
      readiness_status:
        pickTextFromCandidates(payload, ["readiness_status", "readinessStatus"]) ??
        (operation === "ASSET_REGISTER" ? "NOT_CHECKED" : null),
      status:
        pickTextFromCandidates(payload, ["status"]) ??
        (operation === "ASSET_REGISTER" ? "PENDING_APPROVAL" : null),
      g5_status:
        pickTextFromCandidates(payload, ["g5_status", "g5Status"]) ??
        (operation === "ASSET_REGISTER" ? "PENDING_APPROVAL" : null),
      used_in_g5: readJsonRecordBooleanFromCandidates([payload], ["used_in_g5", "usedInG5"]) ?? (operation === "ASSET_REGISTER" ? true : null),
      registered_asset_id:
        pickTextFromCandidates(payload, ["registered_asset_id", "registeredAssetId"]) ??
        assetId ??
        null,
      registered_at: pickTextFromCandidates(payload, ["registered_at", "registeredAt"]) ?? effectiveHandledAt,
      updated_at: effectiveHandledAt,
      state_updated_at: effectiveHandledAt,
      actor: pickTextFromCandidates(payload, ["actor"]) ?? null,
      response_status: response?.status ?? null,
      response_message: response?.message ?? null,
      response_type: response?.response_type ?? null,
      handled_at: effectiveHandledAt,
      request_id: response?.request_id ?? null,
      sent_at: response?.sent_at ?? null,
      webhook_url: response?.webhook_url ?? null,
      http_status: response?.http_status ?? null,
      response_text: response?.response_text ?? null,
    },
  };
};

const persistG5AssetLink = async (payload: G5AssetRegisterInput, response: G5WebhookResponse) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return;
  }

  const assetId =
    pickTextFromCandidates(response, ["asset_id", "assetId"]) ?? pickTextFromCandidates(response.raw, ["asset_id", "assetId"]);
  const approvalId =
    normalizeG5ApprovalIdText(pickTextFromCandidates(response, ["approval_id", "approvalId"]) ?? pickTextFromCandidates(response.raw, ["approval_id", "approvalId"])) ??
    null;

  if (!assetId || !approvalId) {
    console.warn("[g5-asset-approval] skipping G4/G5 asset link insert because the webhook response was missing identifiers", {
      asset_id: assetId,
      approval_id: approvalId,
      g4_review_uuid: payload.g4_review_uuid,
    });
    return;
  }

  const { error } = await client.schema("public").from(G5_G4_ASSET_LINKS_TABLE).insert({
    g4_review_uuid: payload.g4_review_uuid,
    content_review_id: payload.content_review_id,
    review_id: payload.review_id,
    asset_id: assetId,
    approval_id: approvalId,
  });

  if (error) {
    const logPayload = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      g4_review_uuid: payload.g4_review_uuid,
      content_review_id: payload.content_review_id,
      review_id: payload.review_id,
      asset_id: assetId,
      approval_id: approvalId,
    };

    if (isMissingRelationError(error)) {
      console.info("[g5-asset-approval] G4/G5 asset link table is not available yet", logPayload);
      return;
    }

    console.warn("[g5-asset-approval] failed to insert G4/G5 asset link", logPayload);
  }
};

const persistG5AssetAuditEntry = async (payload: G5AssetRegisterInput, response: G5WebhookResponse) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] skipping G5 asset audit persistence because Supabase config is missing", {
      asset_title: payload.asset_title,
      g4_review_uuid: payload.g4_review_uuid,
    });
    return {
      auditRow: null as JsonRecord | null,
      skipped: true,
    };
  }

  const assetId =
    pickTextFromCandidates(response, ["asset_id", "assetId"]) ?? pickTextFromCandidates(response.raw, ["asset_id", "assetId"]) ?? null;
  const approvalId =
    normalizeG5ApprovalIdText(pickTextFromCandidates(response, ["approval_id", "approvalId"]) ?? pickTextFromCandidates(response.raw, ["approval_id", "approvalId"])) ??
    null;

  if (!assetId || !approvalId) {
    console.warn("[g5-asset-approval] skipping G5 asset audit insert because the webhook response was missing identifiers", {
      asset_id: assetId,
      approval_id: approvalId,
      g4_review_uuid: payload.g4_review_uuid,
    });
    return {
      auditRow: null as JsonRecord | null,
      skipped: true,
    };
  }

  const handledAt = response.handled_at ?? new Date().toISOString();
  const auditPayload = buildG5AssetAuditSnapshot(payload, "ASSET_REGISTER", response, assetId, approvalId, handledAt);

  console.info("[g5-asset-approval] persisting G5 asset audit row", {
    asset_id: assetId,
    approval_id: approvalId,
    hook_angle: payload.hook_angle ?? null,
  });

  const { data, error } = await client
    .schema("public")
    .from(G5_ASSET_AUDIT_TABLE)
    .insert({
      asset_id: assetId,
      approval_id: approvalId,
      operation: "ASSET_REGISTER",
      status: response.status,
      reason: null,
      actor: payload.actor,
      source_platform: payload.source_platform,
      source_event: payload.source_event,
      raw_payload: auditPayload,
      created_at: handledAt,
    })
    .select("audit_id, asset_id, approval_id, operation, status, reason, actor, source_platform, source_event, created_at")
    .maybeSingle();

  if (error) {
    const logPayload = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      asset_id: assetId,
      approval_id: approvalId,
      g4_review_uuid: payload.g4_review_uuid,
    };

    if (isMissingRelationError(error)) {
      console.info("[g5-asset-approval] G5 asset audit table is not available yet", logPayload);
      return {
        auditRow: null as JsonRecord | null,
        skipped: true,
      };
    }

    console.warn("[g5-asset-approval] failed to insert G5 asset audit row", logPayload);
    return {
      auditRow: null as JsonRecord | null,
      skipped: false,
      error_message: error.message || error.code,
    };
  }

  console.log("G5_REGISTERED_ASSET_ROW", data ? asRecord(data) : null);

  return {
    auditRow: data ? asRecord(data) : null,
    skipped: false,
  };
};

export const persistG5AssetComposerEditEntry = async (payload: G5AssetComposerUpdateInput) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] skipping G5 asset edit persistence because Supabase config is missing", {
      asset_id: payload.asset_id,
      approval_id: payload.approval_id ?? null,
    });
    return {
      auditRow: null as JsonRecord | null,
      skipped: true,
    };
  }

  const assetId = payload.asset_id.trim();
  const approvalId = normalizeG5ApprovalIdText(payload.approval_id?.trim()) ?? assetId;
  const handledAt = new Date().toISOString();
  const syntheticResponse: G5WebhookResponse = {
    status: "PASS",
    message: "Asset details updated.",
    response_type: "ASSET_EDIT",
    handled_at: handledAt,
    request_id: randomUUID(),
    sent_at: handledAt,
    webhook_url: "local://g5/asset-edit",
    http_status: 200,
    response_text: null,
    raw: null,
  };
  const snapshot = buildG5AssetAuditSnapshot(
    {
      ...payload,
      asset_id: assetId,
      approval_id: approvalId,
      source_status: payload.source_status ?? "REGISTERED",
      registration_status: payload.registration_status ?? "REGISTERED",
      approval_status: payload.approval_status ?? "PENDING",
      readiness_status: payload.readiness_status ?? "NOT_CHECKED",
      status: payload.status ?? "PENDING_APPROVAL",
      g5_status: payload.g5_status ?? "PENDING_APPROVAL",
      used_in_g5: payload.used_in_g5 ?? true,
      selected_caption: payload.selected_caption ?? payload.content_text,
      selected_hook: payload.selected_hook ?? payload.hook_angle ?? null,
      selected_caption_index: payload.selected_caption_index ?? null,
      selected_hook_index: payload.selected_hook_index ?? null,
      media_assets: payload.media_assets ?? [],
      original_post_data: payload.original_post_data ?? null,
      original_post_url: payload.original_post_url ?? null,
      caption_options: payload.caption_options ?? [],
      hook_options: payload.hook_options ?? [],
      metadata: payload.metadata ?? null,
    },
    "ASSET_EDIT",
    syntheticResponse,
    assetId,
    approvalId,
    handledAt,
  );

  const { data, error } = await client
    .schema("public")
    .from(G5_ASSET_AUDIT_TABLE)
    .insert({
      asset_id: assetId,
      approval_id: approvalId,
      operation: "ASSET_EDIT",
      status: "PASS",
      reason: null,
      actor: payload.actor,
      source_platform: payload.source_platform ?? "WEBSITE",
      source_event: payload.source_event ?? "CLIENT_UPLOAD",
      raw_payload: snapshot,
      created_at: handledAt,
    })
    .select("audit_id, asset_id, approval_id, operation, status, reason, actor, source_platform, source_event, created_at")
    .maybeSingle();

  if (error) {
    const logPayload = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      asset_id: assetId,
      approval_id: approvalId,
    };

    if (isMissingRelationError(error)) {
      console.info("[g5-asset-approval] G5 asset audit table is not available yet for edits", logPayload);
      return {
        auditRow: null as JsonRecord | null,
        skipped: true,
      };
    }

    console.warn("[g5-asset-approval] failed to insert G5 asset edit audit row", logPayload);
    return {
      auditRow: null as JsonRecord | null,
      skipped: false,
      error_message: error.message || error.code,
    };
  }

  console.log("G5_REGISTERED_ASSET_ROW", data ? asRecord(data) : null);

  return {
    auditRow: data ? asRecord(data) : null,
    skipped: false,
  };
};

const persistG5ApprovalDecision = async (payload: G5ApprovalDecisionInput, response: G5WebhookResponse) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] skipping G5 approval persistence because Supabase config is missing", {
      approval_id: payload.approval_id,
      asset_id: payload.asset_id,
    });
    return {
      approvalRow: null as JsonRecord | null,
      assetStateRow: null as JsonRecord | null,
    };
  }

  const approvalId = normalizeG5ApprovalIdText(payload.approval_id.trim()) ?? payload.approval_id.trim();
  const assetId = payload.asset_id.trim();
  const decision = payload.decision;
  const reviewer = payload.reviewer_id.trim();
  const handledAt = response.handled_at ?? new Date().toISOString();
  const reason = decision === "APPROVED" ? payload.reviewer_note?.trim() ?? null : payload.rejection_reason?.trim() ?? payload.reviewer_note?.trim() ?? null;

  console.info("[g5-asset-approval] persisting approval decision to Supabase", {
    approval_id: approvalId,
    asset_id: assetId,
    decision,
    reviewer,
    handled_at: handledAt,
  });

  const approvalPatch = {
    approval_id: approvalId,
    asset_id: assetId || null,
    workflow_group: G5_WORKFLOW_GROUP,
    workflow_id: G5_WORKFLOW_ID,
    decision,
    reviewer,
    reason,
    evidence_url: null,
    approved_at: decision === "APPROVED" ? handledAt : null,
    expires_at: null,
    locked: false,
    created_at: handledAt,
  };

  const { data: existingApproval, error: approvalLookupError } = await client
    .schema("public")
    .from(G5_APPROVALS_TABLE)
    .select("id, approval_id, asset_id, workflow_group, workflow_id, decision, reviewer, reason, evidence_url, approved_at, expires_at, locked, created_at")
    .eq("approval_id", approvalId)
    .maybeSingle();

  if (approvalLookupError && !isMissingRelationError(approvalLookupError) && !isMissingColumnError(approvalLookupError)) {
    console.warn("[g5-asset-approval] failed to read existing G5 approval row", {
      approval_id: approvalId,
      code: approvalLookupError.code,
      message: approvalLookupError.message,
      details: approvalLookupError.details,
      hint: approvalLookupError.hint,
    });
  }

  let approvalRow: JsonRecord | null = null;
  if (existingApproval) {
    const { data, error } = await client
      .schema("public")
      .from(G5_APPROVALS_TABLE)
      .update(approvalPatch)
      .eq("approval_id", approvalId)
      .select("id, approval_id, asset_id, workflow_group, workflow_id, decision, reviewer, reason, evidence_url, approved_at, expires_at, locked, created_at")
      .maybeSingle();

    if (error) {
      console.warn("[g5-asset-approval] failed to update G5 approval row", {
        approval_id: approvalId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    } else {
      approvalRow = data ? asRecord(data) : null;
    }
  } else {
    const { data, error } = await client
      .schema("public")
      .from(G5_APPROVALS_TABLE)
      .insert(approvalPatch)
      .select("id, approval_id, asset_id, workflow_group, workflow_id, decision, reviewer, reason, evidence_url, approved_at, expires_at, locked, created_at")
      .maybeSingle();

    if (error) {
      console.warn("[g5-asset-approval] failed to insert G5 approval row", {
        approval_id: approvalId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    } else {
      approvalRow = data ? asRecord(data) : null;
    }
  }

  const assetStatePatch = {
    approval_id: approvalId,
    asset_id: assetId || null,
    approval_status: decision,
    approved_by: reviewer,
    asset_status: decision === "APPROVED" ? "APPROVED_READY_TO_PUBLISH" : "REJECTED",
    state_updated_at: handledAt,
  };

  const stateLookupCandidates = [approvalId, assetId].filter((value): value is string => Boolean(value && value.trim()));
  let assetStateRow: JsonRecord | null = null;

  for (const candidate of stateLookupCandidates) {
    const { data, error } = await client
      .schema("public")
      .from(G5_ASSET_STATE_TABLE)
      .update(assetStatePatch)
      .eq(candidate === approvalId ? "approval_id" : "asset_id", candidate)
      .select("asset_id, approval_id, approval_status, approved_by, asset_status, state_updated_at")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        console.warn("[g5-asset-approval] failed to update G5 asset publish state", {
          approval_id: approvalId,
          asset_id: assetId,
          filter: candidate === approvalId ? "approval_id" : "asset_id",
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }
      continue;
    }

    if (data) {
      assetStateRow = asRecord(data);
      break;
    }
  }

  if (!assetStateRow) {
    const { data, error } = await client
      .schema("public")
      .from(G5_ASSET_STATE_TABLE)
      .insert(assetStatePatch)
      .select("asset_id, approval_id, approval_status, approved_by, asset_status, state_updated_at")
      .maybeSingle();

    if (error) {
      console.warn("[g5-asset-approval] failed to insert G5 asset publish state", {
        approval_id: approvalId,
        asset_id: assetId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    } else {
      assetStateRow = data ? asRecord(data) : null;
    }
  }

  console.info("[g5-asset-approval] approval persistence finished", {
    approval_id: approvalId,
    asset_id: assetId,
    approval_row_persisted: Boolean(approvalRow),
    asset_state_persisted: Boolean(assetStateRow),
  });

  return {
    approvalRow,
    assetStateRow,
  };
};

const findExistingG5AssetRegistration = async (payload: G5AssetRegisterInput) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return null;
  }

  const candidateIdentity = buildRegisteredG5AssetIdentity(payload as JsonRecord);
  if (!candidateIdentity.candidateKeys.length) {
    return null;
  }

  const [contentAssetsResult, stateResult, publishResultsResult, dashboardViewResult, linkRowsResult, auditResult] = await Promise.all([
    queryPublicRows("content_assets", 500),
    queryPublicRows("g5_asset_publish_state", 500),
    queryPublicRows("g5_manual_publish_results", 500),
    queryPublicRows("g5_manual_publish_dashboard_view", 500),
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
    queryPublicRows(G5_ASSET_AUDIT_TABLE, 500),
  ]);

  const registeredRows = [
    ...contentAssetsResult.rows,
    ...stateResult.rows,
    ...publishResultsResult.rows,
    ...dashboardViewResult.rows,
    ...linkRowsResult.rows,
    ...auditResult.rows.filter(isSuccessfulG5AssetRegisterAudit).map(expandRecordWithRawPayload),
  ].map(expandRecordWithRawPayload);

  const candidateKeySet = new Set(candidateIdentity.candidateKeys.map((value) => normalizeG4ApprovedContentKeyText(value)));

  for (const row of registeredRows) {
    const rowIdentity = buildRegisteredG5AssetIdentity(row);
    if (rowIdentity.candidateKeys.some((key) => candidateKeySet.has(normalizeG4ApprovedContentKeyText(key)))) {
      return {
        row,
        rowIdentity,
      };
    }
  }

  return null;
};

export async function registerG5Asset(payload: G5AssetRegisterInput): Promise<G5WebhookResponse> {
  const duplicateRegistration = await findExistingG5AssetRegistration(payload);
  if (duplicateRegistration) {
    const handledAt = new Date().toISOString();
    const existingAssetId =
      pickTextFromCandidates(duplicateRegistration.row, ["asset_id", "assetId", "registered_asset_id", "registeredAssetId"]) ??
      null;
    const existingApprovalId = pickTextFromCandidates(duplicateRegistration.row, ["approval_id", "approvalId"]) ?? null;

    return {
      status: "PASS",
      message: "This content is already registered.",
      response_type: "DUPLICATE",
      handled_at: handledAt,
      request_id: randomUUID(),
      sent_at: handledAt,
      webhook_url: "local://g5/register-asset/duplicate",
      http_status: 200,
      response_text: null,
      raw: {
        duplicate: true,
        existing_asset_id: existingAssetId,
        existing_approval_id: existingApprovalId,
        matched_keys: duplicateRegistration.rowIdentity.candidateKeys,
      },
      asset_id: existingAssetId,
      approval_id: existingApprovalId,
    };
  }

  const response = await postG5Webhook(env.n8nG5AssetRegisterPath, payload);

  if (response.status !== "ERROR") {
    const persistedAudit = await persistG5AssetAuditEntry(payload, response);
    await persistG5AssetLink(payload, response);

    if (!persistedAudit.auditRow && !persistedAudit.skipped) {
      console.error("[g5-asset-approval] asset registration webhook succeeded but audit persistence failed", {
        asset_title: payload.asset_title,
        g4_review_uuid: payload.g4_review_uuid,
        hook_angle: payload.hook_angle ?? null,
        error_message: persistedAudit.error_message,
      });
      // We don't fail the request here because the asset was successfully registered in n8n.
    }
  }

  return response;
}

export async function submitG5ApprovalDecision(payload: G5ApprovalDecisionInput): Promise<G5WebhookResponse> {
  console.info("[g5-asset-approval] sending approval decision webhook", {
    approval_id: payload.approval_id,
    asset_id: payload.asset_id,
    decision: payload.decision,
    reviewer_id: payload.reviewer_id,
  });

  const response = await postG5Webhook(env.n8nG5ApprovalDecisionPath, payload);

  console.info("[g5-asset-approval] approval decision webhook response", {
    approval_id: payload.approval_id,
    asset_id: payload.asset_id,
    decision: payload.decision,
    status: response.status,
    message: response.message,
    http_status: response.http_status,
    response_type: response.response_type,
    handled_at: response.handled_at,
  });

  if (response.status !== "ERROR") {
    const persisted = await persistG5ApprovalDecision(payload, response);
    if (!persisted.approvalRow || !persisted.assetStateRow) {
      console.error("[g5-asset-approval] approval decision webhook succeeded but database persistence failed", {
        approval_id: payload.approval_id,
        asset_id: payload.asset_id,
        decision: payload.decision,
        webhook_status: response.status,
        approval_row_persisted: Boolean(persisted.approvalRow),
        asset_state_persisted: Boolean(persisted.assetStateRow),
      });
      // We don't fail the request here because the approval was successfully recorded in n8n.
    }
  }

  return response;
}

export async function runG5ReadinessCheck(payload: G5ReadinessCheckInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5PublishingActionPath, payload, { dryRun: true });
}

export async function recordG5ManualPublishResult(payload: G5ManualPublishResultInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5ManualPublishResultPath, payload);
}

export const buildG5WebhookChecksum = (payload: JsonRecord) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");
