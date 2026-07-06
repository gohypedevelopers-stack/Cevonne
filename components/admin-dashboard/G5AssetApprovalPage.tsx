"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileUp,
  Heart,
  Loader2,
  MessageCircle,
  Eye,
  PencilLine,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Share2,
  Upload,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { formatDateTime } from "@/components/admin-dashboard/n8n-automations-common";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type G5DashboardAssetRecord = {
  asset_id: string;
  asset_title: string | null;
  asset_type: string | null;
  intended_platform: string | null;
  platform: string | null;
  content_text: string | null;
  hook_angle: string | null;
  media_url: string | null;
  storage_url: string | null;
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
  client_status: string;
  client_tab: string;
};

type G5DashboardSummary = {
  total: number;
  pending_approval: number;
  ready_to_publish: number;
  published_manually: number;
  blocked: number;
};

type G5DashboardResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: string;
  message: string;
  summary: G5DashboardSummary;
  assets: G5DashboardAssetRecord[];
};

type G5ApprovedContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: string;
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

type G5SelectedContentRecord = Omit<G5ApprovedContentRecord, "content_review_id" | "review_id"> & {
  g4_review_id: string;
  g4_review_uuid: string;
  content_review_id: string;
  review_id: string;
  display_title: string;
  display_summary: string;
  display_status: string;
};

type G5G4CaptionOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

type G5G4HookOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

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

type G5SelectedG4ContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: string;
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

type G5ApprovedContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: string;
  message: string;
  reviews: G5ApprovedContentRecord[];
};

type G5SelectedG4ContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: string;
  message: string;
  review: G5SelectedG4ContentRecord | null;
};

type G5WebhookResponse = {
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

type G5UploadedMedia = {
  status: string;
  message: string;
  media_url: string;
  storage_url: string;
  storage_key: string;
  filename: string;
  content_type: string;
  kind: string;
  size: number;
};

type BusyAction = "upload" | "register" | "save" | "approve" | "reject" | "readiness" | "publish" | null;

type ComposerMode = "register" | "edit";

type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  toneClassName: string;
};

type AssetInspectorPanelProps = {
  asset: G5DashboardAssetRecord | null;
  mode: "card" | "sheet";
  captionText: string;
  hookText: string;
  onEdit: () => void;
  onApprove: () => void;
  onRunReadinessCheck: () => void;
  busyAction: BusyAction;
};

type AssetCardProps = {
  asset: G5DashboardAssetRecord;
  selected: boolean;
  onSelect: (assetId: string) => void;
};

type G4PickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviews: G5SelectedContentRecord[];
  message: string;
  busy: boolean;
  onSelect: (review: G5SelectedContentRecord) => void;
  onRefresh: () => void;
};

const PAGE_TITLE = "G5 Asset Approval + Manual Publishing Queue";
const PAGE_DESCRIPTION = "Choose approved content, upload media, publish manually, and save the live post URL.";
const SEARCH_PLACEHOLDER = "Search content, titles, or captions";
const DESKTOP_QUERY = "(min-width: 1280px)";

const ASSET_STATUS_TONES: Record<string, string> = {
  "Ready for G5": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Pending approval": "border-sky-200 bg-sky-50 text-sky-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Ready to publish": "border-violet-200 bg-violet-50 text-violet-700",
  "Published manually": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
  Blocked: "border-amber-200 bg-amber-50 text-amber-700",
  DEFAULT: "border-slate-200 bg-slate-100 text-slate-700",
};

const READINESS_TONES: Record<string, string> = {
  "Ready for G5": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Pending approval": "border-sky-200 bg-sky-50 text-sky-700",
  Approved: "border-blue-200 bg-blue-50 text-blue-700",
  "Ready to publish": "border-violet-200 bg-violet-50 text-violet-700",
  "Published manually": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Rejected / blocked": "border-rose-200 bg-rose-50 text-rose-700",
  "Blocked / rejected": "border-rose-200 bg-rose-50 text-rose-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
  Blocked: "border-amber-200 bg-amber-50 text-amber-700",
  NOT_RUN_YET: "border-slate-200 bg-slate-100 text-slate-700",
  DEFAULT: "border-slate-200 bg-slate-100 text-slate-700",
};

const STEP_DEFINITIONS = [
  { key: "g4", label: "Choose content", icon: Sparkles },
  { key: "media", label: "Upload media", icon: Upload },
  { key: "register", label: "Prepare details", icon: BadgeCheck },
  { key: "approval", label: "Approve manually", icon: ShieldCheck },
  { key: "readiness", label: "Check readiness", icon: Clock3 },
  { key: "publish", label: "Publish manually", icon: CheckCircle2 },
  { key: "proof", label: "Save live link", icon: ExternalLink },
] as const;

const EMPTY_G4_REVIEWS: G5ApprovedContentRecord[] = [];
const EMPTY_G5_ASSETS: G5DashboardAssetRecord[] = [];
const EMPTY_G5_CAPTION_OPTIONS: G5G4CaptionOption[] = [];
const EMPTY_G5_HOOK_OPTIONS: G5G4HookOption[] = [];

const createComposerDraftPlaceholder = (review: G5SelectedContentRecord): G5SelectedG4ContentRecord => ({
  id: review.id,
  g4_review_uuid: review.g4_review_uuid,
  g4_review_id: review.g4_review_id,
  content_review_id: review.content_review_id,
  review_id: review.review_id,
  status: review.status,
  approval_state: review.approval_state,
  display_status: review.display_status,
  created_at: review.created_at,
  display_title: review.display_title,
  display_summary: review.display_summary,
  platform_label: review.platform_label,
  caption_preview: review.caption_preview,
  views: review.views,
  likes: review.likes,
  comments: review.comments,
  shares: review.shares,
  profile_username: null,
  audio_sound: null,
  trend_strength: null,
  brand_fit_score: null,
  risk_score: null,
  source_url: null,
  ai_safe_rewrite: null,
  hook_angle: null,
  ai_risk_summary: null,
  ai_compliance_note: null,
  content_summary: review.display_summary,
  ai_insight: review.display_summary,
  original_post_data: null,
  engagement_rate: null,
  content: {
    title: review.display_title,
    summary: review.display_summary,
    platform: review.platform,
    created_at: review.created_at,
  },
  original_post: {
    platform: review.platform,
    handle: null,
    caption: review.caption_preview ?? review.content_text,
    post_url: null,
    views: review.views,
    likes: review.likes,
    comments: review.comments,
    shares: review.shares,
    audio: null,
    engagement_rate: null,
  },
  ai_direction: {
    content_angle: null,
    safe_rewrite: null,
    hook_angle: null,
    risk_summary: null,
    compliance_note: null,
  },
  caption_options: [],
  hook_options: [],
  recommended_caption: null,
  recommended_hook: null,
});

const buildOptimisticG5AssetRecord = (
  content: G5SelectedG4ContentRecord,
  media: G5UploadedMedia,
  assetId: string,
  approvalId: string,
  createdAt: string,
  caption: string,
  hook: string | null,
): G5DashboardAssetRecord => ({
  asset_id: assetId,
  asset_title: content.display_title?.trim() || content.display_summary?.trim() || "G5 asset",
  asset_type: media.kind || "IMAGE",
  intended_platform: "INSTAGRAM",
  platform: "INSTAGRAM",
  content_text: caption,
  hook_angle: hook,
  media_url: media.media_url,
  storage_url: media.storage_url,
  compliance_status: null,
  approval_status: "PENDING_APPROVAL",
  approved_by: null,
  asset_created_at: createdAt,
  asset_status: "PENDING_APPROVAL",
  readiness_status: null,
  manual_publish_status: null,
  approval_id: approvalId,
  last_manual_publish_result_id: null,
  post_url: null,
  published_by: null,
  published_at: null,
  state_updated_at: createdAt,
  g4_review_id: content.g4_review_id,
  g4_review_uuid: content.g4_review_uuid,
  content_review_id: content.content_review_id,
  review_id: content.review_id,
  source_platform: "WEBSITE",
  source_event: "CLIENT_UPLOAD",
  rights_status: "OWNED_OR_INTERNAL",
  last_readiness_check_at: null,
  last_readiness_check_response: null,
  readiness_response: null,
  failure_reasons: [],
  client_status: "Pending approval",
  client_tab: "pending_approval",
});

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const parseJson = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const upperText = (value?: string | null) => value?.trim().toUpperCase() ?? "";

const getG4ReviewTitle = (review: G5ApprovedContentRecord) =>
  review.display_title?.trim() || review.title?.trim() || review.caption_preview?.trim() || "Content check passed";

const getG4ReviewSummary = (review: G5ApprovedContentRecord) =>
  review.display_summary?.trim() ||
  review.content_text?.trim() ||
  review.caption_preview?.trim() ||
  "Approved content ready for G5.";

const getG4ReviewCaption = (review: G5ApprovedContentRecord) => review.caption_preview?.trim() || review.content_text?.trim() || null;

const G4_METRIC_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatG4MetricValue = (value: string | null | undefined) => {
  if (value == null) {
    return "—";
  }

  const text = value.trim();
  if (!text) {
    return "—";
  }

  const numeric = Number(text.replace(/,/g, ""));
  if (Number.isFinite(numeric)) {
    return G4_METRIC_FORMATTER.format(numeric);
  }

  return text;
};

const formatPlatformLabel = (value?: string | null) => {
  const text = value?.trim();
  if (!text) {
    return "Platform";
  }

  const normalized = text.toUpperCase();
  if (normalized === "INSTAGRAM") {
    return "Instagram";
  }
  if (normalized === "TIKTOK") {
    return "TikTok";
  }
  if (normalized === "WEBSITE") {
    return "Website";
  }

  return text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const getFriendlyStatusLabel = (status: string | null | undefined) => {
  const normalized = upperText(status);
  if (!normalized) {
    return "Pending approval";
  }

  if (normalized === "READY_FOR_G5" || normalized === "READY FOR G5") {
    return "Ready for G5";
  }

  if (normalized === "PENDING_APPROVAL" || normalized === "PENDING APPROVAL") {
    return "Pending approval";
  }

  if (normalized === "APPROVED") {
    return "Approved";
  }

  if (normalized === "READY_TO_PUBLISH" || normalized === "READY TO PUBLISH") {
    return "Ready to publish";
  }

  if (normalized === "PUBLISHED_MANUALLY" || normalized === "PUBLISHED MANUALLY" || normalized === "PUBLISHED") {
    return "Published manually";
  }

  if (normalized === "REJECTED") {
    return "Rejected";
  }

  if (normalized === "BLOCKED" || normalized === "BLOCK" || normalized === "FAILED" || normalized === "ERROR") {
    return "Blocked";
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const getFriendlyReadinessLabel = (status: string | null | undefined) => {
  const normalized = upperText(status);
  if (!normalized) {
    return "Pending approval";
  }

  if (normalized === "APPROVED_CONTENT" || normalized === "APPROVED CONTENT") {
    return "Ready for G5";
  }

  if (normalized === "PENDING_APPROVAL" || normalized === "PENDING APPROVAL") {
    return "Pending approval";
  }

  if (normalized === "READY_TO_PUBLISH" || normalized === "READY TO PUBLISH") {
    return "Ready to publish";
  }

  if (normalized === "PUBLISHED_MANUALLY" || normalized === "PUBLISHED MANUALLY") {
    return "Published manually";
  }

  if (normalized === "BLOCKED_REJECTED" || normalized === "BLOCKED / REJECTED") {
    return "Blocked / rejected";
  }

  if (normalized === "APPROVED") {
    return "Approved";
  }

  if (normalized === "READY FOR G5") {
    return "Ready for G5";
  }

  if (normalized === "REJECTED") {
    return "Rejected";
  }

  if (normalized === "BLOCKED") {
    return "Blocked";
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const toSelectableG4Review = (review: G5ApprovedContentRecord): G5SelectedContentRecord => {
  const contentReviewId = review.content_review_id?.trim() || review.review_id?.trim() || review.id;
  const reviewId = review.review_id?.trim() || review.content_review_id?.trim() || review.id;

  return {
    ...review,
    content_review_id: contentReviewId,
    review_id: reviewId,
    g4_review_id: review.g4_review_id?.trim() || review.id,
    g4_review_uuid: review.g4_review_uuid?.trim() || review.id,
    display_title: getG4ReviewTitle(review),
    display_summary: getG4ReviewSummary(review),
    display_status: review.display_status?.trim() || "Ready for G5",
  };
};

const normalizeSelectionText = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

type ApprovedContentIdentitySource = {
  id: string;
  g4_review_id?: string | null;
  g4_review_uuid?: string | null;
  content_review_id?: string | null;
  review_id?: string | null;
  display_title?: string | null;
  display_summary?: string | null;
  caption_preview?: string | null;
  content_text?: string | null;
  platform_label?: string | null;
  created_at?: string | null;
};

const buildApprovedContentFingerprint = (
  review: Pick<ApprovedContentIdentitySource, "display_title" | "display_summary" | "caption_preview" | "content_text" | "platform_label" | "created_at">,
) => {
  const title = normalizeSelectionText(review.display_title || review.display_summary || review.caption_preview || review.content_text);
  const summary = normalizeSelectionText(review.display_summary || review.content_text || review.caption_preview);
  const platform = normalizeSelectionText(review.platform_label);
  const createdAt = normalizeSelectionText(review.created_at);

  if (title && createdAt) {
    return `title_created:${title}|${createdAt}`;
  }

  if (summary && platform) {
    return `caption_platform:${summary}|${platform}`;
  }

  return null;
};

const buildApprovedContentCandidateKeys = (
  review: ApprovedContentIdentitySource,
) => {
  const keys = [
    review.content_review_id,
    review.review_id,
    review.g4_review_uuid,
    review.g4_review_id,
    review.id,
    buildApprovedContentFingerprint(review),
  ]
    .map(normalizeSelectionText)
    .filter(Boolean);

  return [...new Set(keys)];
};

const getMatchingOption = <T extends { id: string; text: string }>(options: T[], text?: string | null) => {
  const normalized = normalizeSelectionText(text);
  if (!normalized) {
    return null;
  }

  return options.find((option) => normalizeSelectionText(option.text) === normalized) ?? null;
};

const describeTimestamp = (value?: string | null, fallback = "Not available") => (value ? formatDateTime(value) : fallback);

const compactDateTime = (value?: string | null) => {
  return describeTimestamp(value, "Not yet run");
};

const getAssetTitle = (asset: G5DashboardAssetRecord | null) =>
  asset?.asset_title?.trim() || asset?.content_text?.trim() || "Untitled asset";

const getPlatformLabel = (asset: G5DashboardAssetRecord | null) =>
  asset?.platform?.trim() || asset?.intended_platform?.trim() || "INSTAGRAM";

const getPlatformDisplayLabel = (asset: G5DashboardAssetRecord | null) => formatPlatformLabel(getPlatformLabel(asset));

const createAssetComposerDraftPlaceholder = (
  asset: G5DashboardAssetRecord,
  caption: string,
  hook: string,
): G5SelectedG4ContentRecord => {
  const displayTitle = asset.asset_title?.trim() || asset.content_text?.trim() || "Untitled asset";
  const displaySummary = caption.trim() || asset.content_text?.trim() || displayTitle;
  const platform = asset.platform?.trim() || asset.intended_platform?.trim() || "INSTAGRAM";
  const reviewId = asset.review_id?.trim() || asset.content_review_id?.trim() || asset.g4_review_id?.trim() || asset.g4_review_uuid?.trim() || asset.asset_id;
  const contentReviewId = asset.content_review_id?.trim() || asset.review_id?.trim() || reviewId;
  const g4ReviewId = asset.g4_review_id?.trim() || asset.g4_review_uuid?.trim() || contentReviewId;
  const captionText = caption.trim() || asset.content_text?.trim() || displayTitle;
  const hookText = hook.trim();
  const captionOptionId = `${asset.asset_id}:caption:current`;
  const hookOptionId = `${asset.asset_id}:hook:current`;

  return {
    id: reviewId,
    g4_review_uuid: asset.g4_review_uuid?.trim() || g4ReviewId,
    g4_review_id: g4ReviewId,
    content_review_id: contentReviewId,
    review_id: reviewId,
    status: asset.approval_status,
    approval_state: asset.approval_status,
    display_status: asset.client_status || asset.approval_status || "Ready for G5",
    created_at: asset.asset_created_at || asset.state_updated_at,
    display_title: displayTitle,
    display_summary: displaySummary,
    platform_label: formatPlatformLabel(platform),
    caption_preview: captionText,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    profile_username: null,
    audio_sound: null,
    trend_strength: null,
    brand_fit_score: null,
    risk_score: null,
    source_url: asset.post_url?.trim() || null,
    ai_safe_rewrite: null,
    hook_angle: hookText || null,
    ai_risk_summary: null,
    ai_compliance_note: null,
    content_summary: displaySummary,
    ai_insight: displaySummary,
    original_post_data: null,
    engagement_rate: null,
    content: {
      title: displayTitle,
      summary: displaySummary,
      platform,
      created_at: asset.asset_created_at || asset.state_updated_at,
    },
    original_post: {
      platform,
      handle: null,
      caption: captionText,
      post_url: asset.post_url?.trim() || null,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      audio: asset.asset_type?.trim() || null,
      engagement_rate: null,
    },
    ai_direction: {
      content_angle: null,
      safe_rewrite: null,
      hook_angle: hookText || null,
      risk_summary: null,
      compliance_note: null,
    },
    caption_options: captionText
      ? [
          {
            id: captionOptionId,
            label: "Current caption",
            text: captionText,
            source: "G4" as const,
          },
        ]
      : [],
    hook_options: hookText
      ? [
          {
            id: hookOptionId,
            label: "Current hook",
            text: hookText,
            source: "G4" as const,
          },
        ]
      : [],
    recommended_caption: captionText || null,
    recommended_hook: hookText || null,
  };
};

const isAssetPublishedManually = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  return asset.client_tab === "published_manually";
};

const isAssetBlocked = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  return asset.client_tab === "blocked_rejected";
};

const isAssetApproved = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  return asset.client_status === "Approved" || asset.client_status === "Ready to publish";
};

const isReadyToPublish = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  return asset.client_tab === "ready_to_publish";
};

const getAssetStatusInfo = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return { label: "Pending approval", tone: ASSET_STATUS_TONES.DEFAULT };
  }

  const label = getFriendlyStatusLabel(asset.client_status);
  return { label, tone: ASSET_STATUS_TONES[label] ?? ASSET_STATUS_TONES.DEFAULT };
};

const getReadinessInfo = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return { label: "Pending approval", tone: READINESS_TONES.NOT_RUN_YET };
  }

  const label = getFriendlyReadinessLabel(asset.client_status);
  return { label, tone: READINESS_TONES[label] ?? READINESS_TONES.DEFAULT };
};

const getActionErrorMessage = (message: string) => (
  <Alert variant="destructive" className="border-rose-200 bg-rose-50/80 text-rose-700">
    <AlertTriangle className="size-4" />
    <AlertTitle className="text-sm font-medium text-rose-800">Action blocked</AlertTitle>
    <AlertDescription className="text-sm text-rose-700">{message}</AlertDescription>
  </Alert>
);

const MetricCard = ({ label, value, helper, icon, toneClassName }: MetricCardProps) => (
  <Card className="overflow-hidden border-border/70 bg-background/95 shadow-sm">
    <CardContent className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className={cn("flex size-11 items-center justify-center rounded-2xl border", toneClassName)}>{icon}</div>
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-1">
        <p className="font-serif text-3xl leading-none tracking-tight text-primary">{value}</p>
        <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
      </div>
    </CardContent>
  </Card>
);

const AssetStatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const tone = ASSET_STATUS_TONES[status] ?? ASSET_STATUS_TONES.DEFAULT;
  return (
    <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em]", tone, className)}>
      {getFriendlyStatusLabel(status)}
    </Badge>
  );
};

const AssetReadinessBadge = ({ status, className }: { status: string; className?: string }) => {
  const tone = READINESS_TONES[status] ?? READINESS_TONES.DEFAULT;
  return (
    <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em]", tone, className)}>
      {getFriendlyReadinessLabel(status)}
    </Badge>
  );
};

const AssetCard = ({ asset, selected, onSelect }: AssetCardProps) => {
  const statusInfo = getAssetStatusInfo(asset);
  const readinessInfo = getReadinessInfo(asset);

  return (
    <button
      type="button"
      onClick={() => onSelect(asset.asset_id)}
      className={cn(
        "w-full rounded-[24px] border p-4 text-left transition-all hover:border-primary/30 hover:bg-accent/30",
        selected ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border/60 bg-background"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="truncate font-serif text-lg leading-tight text-primary">{getAssetTitle(asset)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium">
              {getPlatformDisplayLabel(asset)}
            </Badge>
            <AssetStatusBadge status={statusInfo.label} />
            <AssetReadinessBadge status={readinessInfo.label} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Created</p>
          <p className="truncate text-sm text-foreground/80">{describeTimestamp(asset.asset_created_at, "Created time unavailable")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Latest link</p>
          <p className="truncate text-sm text-foreground/80">{asset.post_url?.trim() || "Not yet published"}</p>
        </div>
      </div>
    </button>
  );
};

const G4PickerDialog = ({ open, onOpenChange, reviews, message, busy, onSelect, onRefresh }: G4PickerDialogProps) => {
  const safeMessage = message?.trim() && !/not configured|source/i.test(message) ? message.trim() : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1120px)] max-w-none overflow-hidden rounded-[28px] border-border/70 bg-background p-0 shadow-xl">
        <div className="border-b border-border/60 px-5 py-5 sm:px-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-serif text-2xl leading-tight text-primary">Select content from G4</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Choose approved content that is ready for G5 publishing. The media upload and caption editor will open after selection.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-h-0 border-b border-border/60 xl:border-b-0 xl:border-r xl:border-border/60">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Approved content</p>
                <p className="text-sm text-muted-foreground">{reviews.length} item{reviews.length === 1 ? "" : "s"} ready for G5.</p>
              </div>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy} className="h-10 rounded-full px-4">
                <RefreshCcw className={cn("size-4", busy ? "animate-spin" : "")} />
                Refresh list
              </Button>
            </div>

            <ScrollArea className="h-[60vh] px-5 py-5 sm:px-6">
              {reviews.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-muted-foreground">
                      <Sparkles className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-serif text-2xl leading-tight tracking-tight text-primary">No G4 content ready for G5 yet.</p>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Approved content will appear here once the content check passes.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <button
                      key={review.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onSelect(review)}
                      className="w-full rounded-[24px] border border-border/60 bg-background p-4 text-left transition hover:border-primary/30 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {review.display_status}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              {review.platform_label}
                            </Badge>
                          </div>
                          <p className="truncate font-serif text-lg leading-tight text-primary">{getG4ReviewTitle(review)}</p>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{getG4ReviewSummary(review)}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{review.hook_count} hook{review.hook_count === 1 ? "" : "s"}</span>
                            <span>{review.caption_count} caption{review.caption_count === 1 ? "" : "s"}</span>
                            <span>{describeTimestamp(review.created_at, "Created time unavailable")}</span>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex min-h-0 flex-col bg-[#fbf8f6]">
            <div className="border-b border-border/60 px-5 py-4 sm:px-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Select a review to load its caption and hook suggestions, then upload media and save it into the publishing queue.
              </p>
            </div>
            <div className="flex-1 px-5 py-5 sm:px-6">
    <div className="space-y-3 rounded-[24px] border border-dashed border-border/70 bg-white p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Selection guide</p>
      <ul className="space-y-2 text-sm leading-6 text-foreground/80">
        <li>• Content already passed the G4 check</li>
        <li>• Caption and hook suggestions load after you choose one</li>
                  <li>• Media upload and final review happen in the next step</li>
                </ul>
              </div>
              {safeMessage ? (
                <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900">
                  {safeMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AssetInspectorPanel = ({
  asset,
  mode,
  captionText,
  hookText,
  onEdit,
  onApprove,
  onRunReadinessCheck,
  busyAction,
}: AssetInspectorPanelProps) => {
  const approvalComplete = Boolean(asset && isAssetApproved(asset));
  const approvalButtonLabel =
    asset && asset.client_status === "Ready to publish"
      ? "Ready to publish"
      : asset && asset.client_status === "Approved"
        ? "Approved"
        : "Approve for publishing";

  const body = asset ? (
    <>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium">
              {getPlatformDisplayLabel(asset)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px]"
              onClick={onEdit}
            >
              <PencilLine className="size-4" />
              Edit post
            </Button>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Last update</p>
              <p className="mt-1 text-sm font-medium text-foreground">{compactDateTime(asset.state_updated_at || asset.asset_created_at)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-[#fbf8f6] p-5">
          {asset.media_url ? (
            <a
              href={asset.media_url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[20px] border border-border/70 bg-background transition hover:border-primary/30 hover:shadow-sm"
              aria-label="Open uploaded media"
            >
              {(() => {
                const isVideo = upperText(asset.asset_type).includes("VIDEO") || /\.(mp4|webm|mov|m4v)$/i.test(asset.media_url ?? "");
                if (isVideo) {
                  return <video controls className="h-64 w-full bg-black object-cover" src={asset.media_url} />;
                }
                return <img src={asset.media_url} alt={getAssetTitle(asset)} className="h-64 w-full object-cover" loading="lazy" />;
              })()}
            </a>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-[20px] border border-dashed border-border/80 bg-white">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-[#faf5f1] text-muted-foreground">
                  <FileUp className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No media preview yet</p>
                  <p className="text-sm text-muted-foreground">Upload media before moving this item to manual publishing.</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Caption preview</p>
            <p className="text-sm leading-6 text-foreground/80 whitespace-pre-wrap">
              {captionText || "No caption preview available."}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Selected hook</p>
            <p className="text-sm leading-6 text-foreground/80 whitespace-pre-wrap">
              {hookText || "No hook selected"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={onApprove}
              disabled={busyAction !== null || approvalComplete}
              className="h-10 rounded-full bg-primary px-4 text-sm"
            >
              {busyAction === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {approvalButtonLabel}
            </Button>
            <Button
              type="button"
              onClick={onRunReadinessCheck}
              disabled={busyAction !== null}
              variant="outline"
              className="h-10 rounded-full px-4 text-sm"
            >
              {busyAction === "readiness" ? <Loader2 className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
              Check readiness
            </Button>
          </div>
        </div>
      </div>
    </>
  ) : (
    <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-background/95 p-6 text-center shadow-sm">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-[#fbf8f6] text-muted-foreground">
          <Sparkles className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-serif text-2xl leading-tight tracking-tight text-primary">No asset selected</p>
          <p className="text-sm leading-6 text-muted-foreground">Choose an item from the queue to review the preview, live link, and next action.</p>
        </div>
      </div>
    </div>
  );

  if (mode === "sheet") {
    return (
      <div className="flex h-full flex-col bg-background pt-12">
        <ScrollArea className="flex-1">
          <div className="px-5 pb-6">{body}</div>
        </ScrollArea>
      </div>
    );
  }

  return <div className="rounded-[28px] border border-border/70 bg-background/95 shadow-sm">{body}</div>;
};

const LoadingShell = () => (
  <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`metric-skeleton-${index}`} className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-4 w-44 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="border-border/70 bg-background/95 shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`step-skeleton-${index}`} className="h-16 rounded-2xl" />
        ))}
      </CardContent>
    </Card>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
      <Card className="border-border/70 bg-background/95 shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-56 rounded-full" />
          <Skeleton className="h-4 w-80 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`asset-skeleton-${index}`} className="h-20 rounded-2xl" />
          ))}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-background/95 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-8 w-48 rounded-full" />
          <Skeleton className="h-64 rounded-[24px]" />
          <Skeleton className="h-40 rounded-[24px]" />
        </CardContent>
      </Card>
    </div>
  </div>
);

export default function G5AssetApprovalPage() {
  const { authFetch, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerOpenStartedAtRef = useRef<number | null>(null);

  const [dashboard, setDashboard] = useState<G5DashboardResponse | null>(null);
  const [g4ReadyContent, setG4ReadyContent] = useState<G5ApprovedContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetEdits, setAssetEdits] = useState<Record<string, { caption: string; hook: string }>>({});
  const [registeredG4ReviewKeys, setRegisteredG4ReviewKeys] = useState<string[]>([]);
  const [draftContent, setDraftContent] = useState<G5SelectedG4ContentRecord | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [draftHookOverride, setDraftHookOverride] = useState("");
  const [captionDraftManuallyEdited, setCaptionDraftManuallyEdited] = useState(false);
  const [g4SelectionBusy, setG4SelectionBusy] = useState(false);
  const [draftMediaItems, setDraftMediaItems] = useState<G5UploadedMedia[]>([]);
  const [selectedDraftMediaKey, setSelectedDraftMediaKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [composerLoading, setComposerLoading] = useState(false);
  const [originalPostModalOpen, setOriginalPostModalOpen] = useState(false);
  const [g4DialogOpen, setG4DialogOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("approved-content");
  const deferredSearch = useDeferredValue(search);

  const g4ReadyReviews = g4ReadyContent?.reviews ?? EMPTY_G4_REVIEWS;
  const registeredG4ReviewKeySet = useMemo(
    () => new Set(registeredG4ReviewKeys.map((value) => normalizeSelectionText(value)).filter(Boolean)),
    [registeredG4ReviewKeys],
  );
  const selectableG4Reviews = useMemo(
    () => {
      const seenKeys = new Set<string>();

      return g4ReadyReviews
        .map(toSelectableG4Review)
        .filter((review) => {
          const candidateKeys = buildApprovedContentCandidateKeys(review);
          if (candidateKeys.some((key) => seenKeys.has(key))) {
            return false;
          }

          candidateKeys.forEach((key) => seenKeys.add(key));
          return !candidateKeys.some((key) => registeredG4ReviewKeySet.has(key));
        });
    },
    [g4ReadyReviews, registeredG4ReviewKeySet],
  );
  const allAssets = dashboard?.assets ?? EMPTY_G5_ASSETS;
  const searchQuery = deferredSearch.trim().toLowerCase();
  const filteredApprovedContent = useMemo(() => {
    if (!searchQuery) {
      return selectableG4Reviews;
    }

    return selectableG4Reviews.filter((review) =>
      [review.display_title, review.display_summary, review.caption_preview, review.content_text, review.platform_label, review.display_status, review.created_at]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(searchQuery))
    );
  }, [searchQuery, selectableG4Reviews]);
  const filteredPendingApprovalAssets = useMemo(() => {
    if (!searchQuery) {
      return allAssets.filter((asset) => asset.client_tab === "pending_approval");
    }

    return allAssets.filter((asset) => {
      if (asset.client_tab !== "pending_approval") {
        return false;
      }

      return [
        getAssetTitle(asset),
        asset.content_text,
        asset.platform,
        asset.intended_platform,
        getFriendlyStatusLabel(getAssetStatusInfo(asset).label),
        getFriendlyReadinessLabel(getReadinessInfo(asset).label),
        asset.post_url,
        asset.asset_created_at,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(searchQuery));
    });
  }, [allAssets, searchQuery]);
  const filteredReadyToPublishAssets = useMemo(() => {
    if (!searchQuery) {
      return allAssets.filter((asset) => asset.client_tab === "ready_to_publish");
    }

    return allAssets.filter((asset) => {
      if (asset.client_tab !== "ready_to_publish") {
        return false;
      }

      return [
        getAssetTitle(asset),
        asset.content_text,
        asset.platform,
        asset.intended_platform,
        getFriendlyStatusLabel(getAssetStatusInfo(asset).label),
        getFriendlyReadinessLabel(getReadinessInfo(asset).label),
        asset.post_url,
        asset.asset_created_at,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(searchQuery));
    });
  }, [allAssets, searchQuery]);
  const filteredPublishedAssets = useMemo(() => {
    if (!searchQuery) {
      return allAssets.filter((asset) => asset.client_tab === "published_manually");
    }

    return allAssets.filter((asset) => {
      if (asset.client_tab !== "published_manually") {
        return false;
      }

      return [
        getAssetTitle(asset),
        asset.content_text,
        asset.platform,
        asset.intended_platform,
        getFriendlyStatusLabel(getAssetStatusInfo(asset).label),
        getFriendlyReadinessLabel(getReadinessInfo(asset).label),
        asset.post_url,
        asset.asset_created_at,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(searchQuery));
    });
  }, [allAssets, searchQuery]);
  const filteredBlockedAssets = useMemo(() => {
    if (!searchQuery) {
      return allAssets.filter((asset) => asset.client_tab === "blocked_rejected");
    }

    return allAssets.filter((asset) => {
      if (asset.client_tab !== "blocked_rejected") {
        return false;
      }

      return [
        getAssetTitle(asset),
        asset.content_text,
        asset.platform,
        asset.intended_platform,
        getFriendlyStatusLabel(getAssetStatusInfo(asset).label),
        getFriendlyReadinessLabel(getReadinessInfo(asset).label),
        asset.post_url,
        asset.asset_created_at,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(searchQuery));
    });
  }, [allAssets, searchQuery]);
  const captionOptions = draftContent?.caption_options ?? EMPTY_G5_CAPTION_OPTIONS;
  const hookOptions = draftContent?.hook_options ?? EMPTY_G5_HOOK_OPTIONS;
  const selectedCaptionOption = useMemo(() => {
    if (!draftContent) {
      return null;
    }

    return captionOptions.find((option) => option.id === selectedCaptionId) ?? null;
  }, [captionOptions, draftContent, selectedCaptionId]);
  const selectedHookOption = useMemo(() => {
    if (!draftContent) {
      return null;
    }

    return hookOptions.find((option) => option.id === selectedHookId) ?? null;
  }, [draftContent, hookOptions, selectedHookId]);
  const draftHookText = composerMode === "edit"
    ? draftHookOverride.trim() || selectedHookOption?.text?.trim() || null
    : selectedHookOption?.text?.trim() || null;
  const draftMedia = useMemo(() => {
    if (!draftMediaItems.length) {
      return null;
    }

    if (selectedDraftMediaKey) {
      return draftMediaItems.find((item) => item.storage_key === selectedDraftMediaKey || item.media_url === selectedDraftMediaKey) ?? draftMediaItems[draftMediaItems.length - 1] ?? null;
    }

    return draftMediaItems[draftMediaItems.length - 1] ?? null;
  }, [draftMediaItems, selectedDraftMediaKey]);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!isDevelopment || !composerOpen) {
      return;
    }

    const startedAt = composerOpenStartedAtRef.current;
    if (startedAt == null) {
      return;
    }

    console.debug("[G5 composer] modal shell opened", {
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    composerOpenStartedAtRef.current = null;
  }, [composerOpen, isDevelopment]);

  useEffect(() => {
    if (!isDevelopment || !composerOpen || !draftContent) {
      return;
    }

    console.debug("[G5 composer] caption options loaded", {
      reviewId: draftContent.id,
      captionCount: captionOptions.length,
      hookCount: hookOptions.length,
      loading: composerLoading,
    });
  }, [captionOptions.length, composerLoading, composerOpen, draftContent, hookOptions.length, isDevelopment]);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setPageError(null);

    const nextErrors: string[] = [];

    try {
      const [assetsResponse, reviewsResponse] = await Promise.all([
        authFetch(buildRouteUrl("/api/admin/g5/assets"), { cache: "no-store", silent: true }).catch(() => null),
        authFetch(buildRouteUrl("/api/admin/g5/g4-approved-content"), { cache: "no-store", silent: true }).catch(() => null),
      ]);

      if (assetsResponse) {
        const body = await parseJson<G5DashboardResponse>(assetsResponse);
        if (body) {
          setDashboard(body);
          if (!assetsResponse.ok || body.status === "ERROR") {
            nextErrors.push(body.message || "Unable to load G5 assets.");
          }
        } else {
          nextErrors.push("Unable to load G5 assets.");
        }
      } else {
        nextErrors.push("Unable to load G5 assets.");
      }

      if (reviewsResponse) {
        const body = await parseJson<G5ApprovedContentResponse>(reviewsResponse);
        if (body) {
          setG4ReadyContent(body);
          if (!reviewsResponse.ok || body.status === "ERROR") {
            nextErrors.push(body.message || "Unable to load G4 content ready for G5.");
          }
        } else {
          nextErrors.push("Unable to load G4 content ready for G5.");
        }
      } else {
        nextErrors.push("Unable to load G4 content ready for G5.");
      }
    } catch (error) {
      nextErrors.push(error instanceof Error ? error.message : "Unable to load G5 data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setPageError(nextErrors.length > 0 ? nextErrors.join(" ") : null);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadData("initial");
  }, [loadData]);

  const selectedAsset = useMemo(() => {
    if (!allAssets.length) {
      return null;
    }

    if (selectedAssetId) {
      const found = allAssets.find((asset) => asset.asset_id === selectedAssetId);
      if (found) {
        return found;
      }
    }

    return allAssets[0] ?? null;
  }, [allAssets, selectedAssetId]);

  useEffect(() => {
    if (!allAssets.length) {
      setSelectedAssetId(null);
      return;
    }

    const selectedExists = Boolean(selectedAssetId && allAssets.some((asset) => asset.asset_id === selectedAssetId));
    if (!selectedAssetId || !selectedExists) {
      setSelectedAssetId(allAssets[0].asset_id);
    }
  }, [allAssets, selectedAssetId]);

  useEffect(() => {
    if (isDesktop) {
      setDetailSheetOpen(false);
      return;
    }

    setDetailSheetOpen(Boolean(selectedAsset));
  }, [isDesktop, selectedAsset]);

  const selectedAssetEdit = selectedAsset ? assetEdits[selectedAsset.asset_id] ?? null : null;
  const selectedAssetCaptionValue =
    selectedAssetEdit?.caption?.trim() ||
    selectedAsset?.content_text?.trim() ||
    selectedAsset?.asset_title?.trim() ||
    "";
  const selectedAssetHookValue = selectedAssetEdit?.hook?.trim() || selectedAsset?.hook_angle?.trim() || "";
  const selectedAssetMatchedG4Review = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }

    const caption = selectedAssetCaptionValue.trim();
    const syntheticReview = {
      id: selectedAsset.g4_review_id?.trim() || selectedAsset.g4_review_uuid?.trim() || selectedAsset.content_review_id?.trim() || selectedAsset.review_id?.trim() || selectedAsset.asset_id,
      g4_review_id: selectedAsset.g4_review_id?.trim() || null,
      g4_review_uuid: selectedAsset.g4_review_uuid?.trim() || null,
      content_review_id: selectedAsset.content_review_id?.trim() || null,
      review_id: selectedAsset.review_id?.trim() || null,
      display_title: selectedAsset.asset_title?.trim() || caption || selectedAsset.content_text?.trim() || null,
      display_summary: caption || selectedAsset.content_text?.trim() || selectedAsset.asset_title?.trim() || null,
      caption_preview: caption || selectedAsset.content_text?.trim() || null,
      content_text: caption || selectedAsset.content_text?.trim() || null,
      platform_label: getPlatformDisplayLabel(selectedAsset),
      created_at: selectedAsset.asset_created_at || selectedAsset.state_updated_at || null,
    };

    const candidateKeys = new Set(buildApprovedContentCandidateKeys(syntheticReview));
    return g4ReadyReviews.find((review) => buildApprovedContentCandidateKeys(review).some((key) => candidateKeys.has(key))) ?? null;
  }, [g4ReadyReviews, selectedAsset, selectedAssetCaptionValue]);

  const clearDraftSelection = useCallback(() => {
    setDraftContent(null);
    setDraftCaption("");
    setSelectedCaptionId(null);
    setSelectedHookId(null);
    setDraftHookOverride("");
    setCaptionDraftManuallyEdited(false);
    setG4SelectionBusy(false);
    setComposerLoading(false);
    setDraftMediaItems([]);
    setSelectedDraftMediaKey(null);
    setOriginalPostModalOpen(false);
    setComposerMode(null);
    setComposerOpen(false);
    composerOpenStartedAtRef.current = null;
  }, []);

  const summary = dashboard?.summary ?? {
    total: 0,
    pending_approval: 0,
    ready_to_publish: 0,
    published_manually: 0,
    blocked: 0,
  };

  const draftSummary = useMemo(() => {
    const contentLabel = draftContent ? draftContent.display_title : null;
    const mediaLabel = draftMedia ? draftMedia.filename : null;
    const captionLabel = draftContent ? (draftCaption.trim() ? "Composer ready" : "Caption needed") : null;
    const hookLabel = draftContent ? (selectedHookOption ? "Hook selected" : "Hook optional") : null;

    if (!contentLabel && !mediaLabel) {
      return "Select approved content and upload media before saving the queue item.";
    }

    return `Draft: ${contentLabel || "No G4 selected"}${mediaLabel ? ` · Media: ${mediaLabel}` : " · Media not uploaded yet"}${captionLabel ? ` · ${captionLabel}` : ""}${hookLabel ? ` · ${hookLabel}` : ""}`;
  }, [draftCaption, draftContent, draftMedia, selectedHookOption]);

  const selectAsset = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      if (!isDesktop) {
        setDetailSheetOpen(true);
      }
    },
    [isDesktop]
  );

  const handleOpenPostEditor = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }

    const caption = selectedAssetCaptionValue.trim();
    const hook = selectedAssetHookValue.trim();
    const syntheticMediaUrl = selectedAsset.media_url?.trim() || selectedAsset.storage_url?.trim() || null;
    const reviewId =
      selectedAsset.g4_review_id?.trim() ||
      selectedAsset.g4_review_uuid?.trim() ||
      selectedAsset.content_review_id?.trim() ||
      selectedAsset.review_id?.trim() ||
      selectedAssetMatchedG4Review?.content_review_id?.trim() ||
      selectedAssetMatchedG4Review?.review_id?.trim() ||
      selectedAssetMatchedG4Review?.id?.trim() ||
      null;

    setComposerMode("edit");
    setComposerLoading(Boolean(reviewId || selectedAsset.asset_id || selectedAsset.approval_id));
    setG4SelectionBusy(false);
    setInlineError(null);
    setDraftCaption(caption);
    setDraftHookOverride(hook);
    setCaptionDraftManuallyEdited(Boolean(caption));
    setDraftMediaItems(
      syntheticMediaUrl
        ? [
            {
              status: "PASS",
              message: "Existing media loaded.",
              media_url: syntheticMediaUrl,
              storage_url: selectedAsset.storage_url?.trim() || syntheticMediaUrl,
              storage_key: selectedAsset.storage_url?.trim() || syntheticMediaUrl,
              filename: selectedAsset.asset_title?.trim() || `asset-${selectedAsset.asset_id}`,
              content_type:
                upperText(selectedAsset.asset_type).includes("VIDEO") ||
                /\.(mp4|webm|mov|m4v)$/i.test(syntheticMediaUrl)
                  ? "video/mp4"
                  : "image/*",
              kind: upperText(selectedAsset.asset_type).includes("VIDEO") ? "VIDEO" : "IMAGE",
              size: 0,
            },
          ]
        : []
    );
    setSelectedDraftMediaKey(syntheticMediaUrl);
    setOriginalPostModalOpen(false);
    setG4DialogOpen(false);
    setComposerOpen(true);

    try {
      const query = new URLSearchParams({
        reviewId: reviewId || "",
        assetId: selectedAsset.asset_id,
        approvalId: selectedAsset.approval_id?.trim() || selectedAsset.asset_id,
        title: selectedAsset.asset_title?.trim() || selectedAsset.content_text?.trim() || "",
        caption: caption,
        hook: hook,
        platform: selectedAsset.platform?.trim() || selectedAsset.intended_platform?.trim() || "",
        sourceUrl: selectedAsset.post_url?.trim() || "",
      });

      const response = await authFetch(buildRouteUrl(`/api/admin/g5/g4-content-options?${query.toString()}`), {
        cache: "no-store",
        silent: true,
      });

      const body = await parseJson<G5SelectedG4ContentResponse>(response);
      if (!response.ok || !body?.review) {
        const message = body?.message || "Unable to load selected G4 content.";
        throw new Error(message);
      }

      const selected = body.review;
      setDraftContent(selected);
      setSelectedCaptionId(getMatchingOption(selected.caption_options, caption)?.id ?? null);
      setSelectedHookId(getMatchingOption(selected.hook_options, hook)?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load selected G4 content.";
      setInlineError(message);
      toast.error(message);
      const placeholder = createAssetComposerDraftPlaceholder(selectedAsset, caption, hook);
      setDraftContent(placeholder);
      setSelectedCaptionId(placeholder.caption_options[0]?.id ?? null);
      setSelectedHookId(placeholder.hook_options[0]?.id ?? null);
    } finally {
      setComposerLoading(false);
    }
  }, [authFetch, selectedAsset, selectedAssetCaptionValue, selectedAssetHookValue, selectedAssetMatchedG4Review]);

  const refreshData = useCallback(async () => {
    await loadData("refresh");
  }, [loadData]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadMedia = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (!files.length) {
        return;
      }

      setBusyAction("upload");
      setInlineError(null);

      try {
        const uploaded = await Promise.allSettled(
          files.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            const response = await authFetch(buildRouteUrl("/api/admin/g5/upload-media"), {
              method: "POST",
              body: formData,
              silent: true,
            });

            const body = await parseJson<G5UploadedMedia>(response);
            if (!response.ok || !body) {
              const message = body && "message" in body ? String(body.message) : `Unable to upload ${file.name}.`;
              throw new Error(message);
            }

            return body;
          })
        );

        const successfulUploads = uploaded
          .filter((result): result is PromiseFulfilledResult<G5UploadedMedia> => result.status === "fulfilled")
          .map((result) => result.value);
        const failedUploads = uploaded
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => result.reason);

        if (successfulUploads.length > 0) {
          setDraftMediaItems((current) => [...current, ...successfulUploads]);
          const latestUpload = successfulUploads[successfulUploads.length - 1];
          setSelectedDraftMediaKey(latestUpload.storage_key || latestUpload.media_url);
          toast.success(
            successfulUploads.length === 1
              ? successfulUploads[0].message || "Media uploaded."
              : `${successfulUploads.length} media files uploaded.`
          );
        }

        if (failedUploads.length > 0) {
          const failureMessage = failedUploads
            .map((error) => (error instanceof Error ? error.message : typeof error === "string" ? error : null))
            .filter((value): value is string => Boolean(value))
            .join(" ");
          const message = failureMessage || "Unable to upload one or more media files.";
          setInlineError(message);
          toast.error(message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload media.";
        setInlineError(message);
        toast.error(message);
      } finally {
        setBusyAction(null);
      }
    },
    [authFetch]
  );

  const handleSelectG4Review = useCallback(
    async (review: G5SelectedContentRecord) => {
      composerOpenStartedAtRef.current = typeof performance !== "undefined" ? performance.now() : null;
      setG4SelectionBusy(true);
      setInlineError(null);
      setComposerLoading(true);
      setComposerMode("register");
      setCaptionDraftManuallyEdited(false);
      setSelectedCaptionId(null);
      setSelectedHookId(null);
      setDraftHookOverride("");
      setDraftCaption("");
      setDraftMediaItems([]);
      setSelectedDraftMediaKey(null);
      setDraftContent(createComposerDraftPlaceholder(review));
      setOriginalPostModalOpen(false);
      setG4DialogOpen(false);
      setComposerOpen(true);

      try {
        const response = await authFetch(buildRouteUrl(`/api/admin/g5/g4-content-options?reviewId=${encodeURIComponent(review.id)}`), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJson<G5SelectedG4ContentResponse>(response);
        if (!response.ok || !body?.review) {
          const message = body?.message || "Unable to load selected G4 content.";
          throw new Error(message);
        }

        const selected = body.review;
        if (isDevelopment) {
          console.debug("[G5 composer] caption options received", {
            reviewId: selected.id,
            captionCount: selected.caption_options?.length ?? 0,
            hookCount: selected.hook_options?.length ?? 0,
          });
        }
        setDraftContent(selected);
        setSelectedCaptionId(null);
        setSelectedHookId(null);
        setDraftCaption("");
        setDraftMediaItems([]);
        setSelectedDraftMediaKey(null);
        setCaptionDraftManuallyEdited(false);
        toast.success(body.message || "G4 content selected.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load selected G4 content.";
        setInlineError(message);
        toast.error(message);
        clearDraftSelection();
      } finally {
        setG4SelectionBusy(false);
        setComposerLoading(false);
      }
    },
    [authFetch, clearDraftSelection, isDevelopment]
  );

  const handleSelectCaptionOption = useCallback(
    (option: G5G4CaptionOption) => {
      setSelectedCaptionId(option.id);
      const shouldKeepManualCaption = captionDraftManuallyEdited && draftCaption.trim().length > 0;
      if (!shouldKeepManualCaption) {
        setDraftCaption(option.text);
        setCaptionDraftManuallyEdited(false);
      }
    },
    [captionDraftManuallyEdited, draftCaption]
  );

  const handleSelectHookOption = useCallback(
    (option: G5G4HookOption) => {
      setSelectedHookId(option.id);
      setDraftHookOverride(option.text);
    },
    []
  );

  const handleRegisterAsset = useCallback(async () => {
    if (!draftContent) {
      const message = g4ReadyReviews.length > 0 ? "Select approved content first." : "No G4 content ready for G5 yet.";
      setInlineError(message);
      toast.error(message);
      setG4DialogOpen(true);
      return;
    }

    if (composerLoading) {
      const message = "Wait for the caption options to finish loading.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    if (!draftMedia) {
      const message = "Upload media before registering this asset.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    const caption = draftCaption.trim();
    if (!caption) {
      const message = captionOptions.length > 0 ? "Select a caption and edit it before registering this asset." : "Enter a caption before registering this asset.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    const actor = user?.name?.trim() || user?.email?.trim() || user?.id?.trim() || "admin";
    const contentReviewId = draftContent.content_review_id?.trim() || draftContent.review_id?.trim() || draftContent.id;
    const reviewId = draftContent.review_id?.trim() || draftContent.content_review_id?.trim() || draftContent.id;
    const title = draftContent.display_title?.trim() || draftContent.content_summary?.trim() || "G5 asset";

    setBusyAction("register");
    setInlineError(null);

    try {
      const response = await authFetch(buildRouteUrl("/api/admin/g5/register-asset"), {
        method: "POST",
        body: JSON.stringify({
          workflow_id: "G5",
          action_type: "IG_PUBLISH_POST",
          platform: "INSTAGRAM",
          asset_type: draftMedia.kind || "IMAGE",
          asset_title: title,
          content_text: caption,
          hook_angle: draftHookText,
          media_url: draftMedia.media_url,
          storage_url: draftMedia.storage_url,
          g4_review_id: draftContent.g4_review_id,
          g4_review_uuid: draftContent.g4_review_uuid,
          content_review_id: contentReviewId,
          review_id: reviewId,
          source_platform: "WEBSITE",
          source_event: "CLIENT_UPLOAD",
          rights_status: "OWNED_OR_INTERNAL",
          actor,
        }),
        silent: true,
      });

      const body = await parseJson<G5WebhookResponse>(response);
      if (!response.ok || !body) {
        const message = body?.message || "Unable to register asset.";
        throw new Error(message);
      }

      const responseRecord = body as unknown as Record<string, unknown>;
      const responseRawRecord = (body.raw as Record<string, unknown> | null) ?? null;
      const registeredAssetId =
        [responseRecord.asset_id, responseRecord.assetId, responseRawRecord?.asset_id, responseRawRecord?.assetId]
          .find((value): value is string => typeof value === "string" && value.trim().length > 0)
          ?.trim() ?? "";
      const registeredApprovalId =
        [responseRecord.approval_id, responseRecord.approvalId, responseRawRecord?.approval_id, responseRawRecord?.approvalId]
          .find((value): value is string => typeof value === "string" && value.trim().length > 0)
          ?.trim() ?? "";
      const registeredAt = new Date().toISOString();
      const registeredContentKeys = buildApprovedContentCandidateKeys(draftContent);
      const optimisticAssetId = registeredAssetId || registeredApprovalId || draftContent.id;
      const optimisticApprovalId = registeredApprovalId || registeredAssetId || draftContent.id;
      const optimisticAsset = buildOptimisticG5AssetRecord(
        draftContent,
        draftMedia,
        optimisticAssetId,
        optimisticApprovalId,
        registeredAt,
        caption,
        draftHookText,
      );

      toast.success("Asset registered and moved to Pending Approval.");
      setRegisteredG4ReviewKeys((current) => [...new Set([...current, ...registeredContentKeys])]);
      setDashboard((current) => {
        if (!current) {
          return {
            status: "PASS",
            source: "FALLBACK",
            message: "G5 dashboard updated optimistically.",
            summary: {
              total: 1,
              pending_approval: 1,
              ready_to_publish: 0,
              published_manually: 0,
              blocked: 0,
            },
            assets: [optimisticAsset],
          };
        }

        const existingIndex = current.assets.findIndex((asset) => asset.asset_id === optimisticAsset.asset_id);
        const nextAssets =
          existingIndex >= 0
            ? current.assets.map((asset) => (asset.asset_id === optimisticAsset.asset_id ? { ...asset, ...optimisticAsset } : asset))
            : [optimisticAsset, ...current.assets];

        return {
          ...current,
          summary:
            existingIndex >= 0
              ? current.summary
              : {
                  ...current.summary,
                  total: current.summary.total + 1,
                  pending_approval: current.summary.pending_approval + 1,
                },
          assets: nextAssets,
        };
      });
      setDraftContent(null);
      setDraftCaption("");
      setSelectedCaptionId(null);
      setSelectedHookId(null);
      setDraftHookOverride("");
      setCaptionDraftManuallyEdited(false);
      setDraftMediaItems([]);
      setSelectedDraftMediaKey(null);
      setComposerMode(null);
      setComposerOpen(false);
      composerOpenStartedAtRef.current = null;
      setActiveTab("pending-approval");
      setSelectedAssetId(optimisticAsset.asset_id);

      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to register asset.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }, [authFetch, captionOptions.length, composerLoading, draftCaption, draftContent, draftHookText, draftMedia, g4ReadyReviews.length, refreshData, user?.email, user?.id, user?.name]);

  const handleSaveComposerEdit = useCallback(() => {
    if (!selectedAsset) {
      return;
    }

    const caption = draftCaption.trim();
    if (!caption) {
      toast.error("Enter a caption before saving changes.");
      return;
    }

    const hook = draftHookText?.trim() || "";
    setAssetEdits((current) => ({
      ...current,
      [selectedAsset.asset_id]: {
        caption,
        hook,
      },
    }));
    toast.success("Post updated.");
    clearDraftSelection();
  }, [clearDraftSelection, draftCaption, draftHookText, selectedAsset]);

  const handleApprovalDecision = useCallback(
    async (decision: "APPROVED" | "REJECTED") => {
      if (!selectedAsset) {
        return;
      }

      const approvalId = selectedAsset.approval_id?.trim() || selectedAsset.asset_id;
      const actor = user?.name?.trim() || user?.email?.trim() || user?.id?.trim() || "admin";
      const responseAction = decision === "APPROVED" ? "approve" : "reject";

      setBusyAction(responseAction);
      setInlineError(null);

      try {
        const response = await authFetch(buildRouteUrl("/api/admin/g5/approval-decision"), {
          method: "POST",
          body: JSON.stringify({
            approval_id: approvalId,
            asset_id: selectedAsset.asset_id,
            decision,
            reviewer_id: actor,
            reviewer_note: decision === "APPROVED" ? "Approved from the G5 dashboard." : "Rejected from the G5 dashboard.",
            rejection_reason: decision === "REJECTED" ? "Rejected from the G5 dashboard." : null,
          }),
          silent: true,
        });

        const body = await parseJson<G5WebhookResponse>(response);
        if (!response.ok || !body) {
          const message = body?.message || "Unable to save G5 decision.";
          throw new Error(message);
        }

        toast.success(body.message || (decision === "APPROVED" ? "Asset approved." : "Asset rejected."));
        setActiveTab(decision === "APPROVED" ? "ready-to-publish" : "blocked");
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save G5 decision.";
        setInlineError(message);
        toast.error(message);
      } finally {
        setBusyAction(null);
      }
    },
    [authFetch, refreshData, selectedAsset, user?.email, user?.id, user?.name]
  );

  const handleRunReadinessCheck = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }

    if (!isAssetApproved(selectedAsset)) {
      const message = "Approve this asset before readiness check.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    const actor = user?.name?.trim() || user?.email?.trim() || user?.id?.trim() || "admin";
    const contentReviewId = selectedAsset.content_review_id?.trim() || selectedAsset.g4_review_id?.trim() || selectedAsset.review_id?.trim() || selectedAsset.asset_id;
    const approvalId = selectedAsset.approval_id?.trim() || selectedAsset.asset_id;

    setBusyAction("readiness");
    setInlineError(null);

    try {
      const response = await authFetch(buildRouteUrl("/api/admin/g5/readiness-check"), {
        method: "POST",
        body: JSON.stringify({
          workflow_id: "G5",
          requested_by_workflow: "G5",
          action_type: "MANUAL_PUBLISH_READY_CHECK",
          execution_mode: "DRY_RUN",
          provider: "MANUAL_FALLBACK",
          platform: "INSTAGRAM",
          account_id: `${getPlatformLabel(selectedAsset)}:${selectedAsset.asset_id}`,
          asset_id: selectedAsset.asset_id,
          content_review_id: contentReviewId,
          g4_review_id: selectedAsset.g4_review_id?.trim() || selectedAsset.review_id?.trim() || selectedAsset.asset_id,
          approval_id: approvalId,
          asset_type: selectedAsset.asset_type?.trim() || "IMAGE",
          media_url: selectedAsset.media_url?.trim() || "",
          caption: selectedAssetCaptionValue,
          actor,
        }),
        silent: true,
      });

      const body = await parseJson<G5WebhookResponse>(response);
      if (!response.ok || !body) {
        const message = body?.message || "Unable to run readiness check.";
        throw new Error(message);
      }

        toast.success(body.message || "Readiness check completed.");
        await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run readiness check.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }, [authFetch, refreshData, selectedAsset, selectedAssetCaptionValue, user?.email, user?.id, user?.name]);

  const headerBadges = (
    <>
      <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3.5 py-1 text-[11px] font-semibold text-emerald-800">
        Client-ready queue
      </Badge>
      <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 px-3.5 py-1 text-[11px] font-semibold text-violet-800">
        Manual publishing flow
      </Badge>
    </>
  );

  const stepState = useMemo(() => {
    const completed = [
      Boolean(draftContent || selectedAsset?.g4_review_id || selectedAsset?.content_review_id),
      Boolean(draftMedia?.media_url || selectedAsset?.media_url),
      Boolean(selectedAsset?.asset_created_at || selectedAsset?.state_updated_at || selectedAsset),
      isAssetApproved(selectedAsset),
      Boolean(selectedAsset?.last_readiness_check_at || isReadyToPublish(selectedAsset)),
      Boolean(selectedAsset?.published_at || selectedAsset?.post_url || isAssetPublishedManually(selectedAsset)),
      Boolean(selectedAsset?.post_url),
    ];

    const firstIncomplete = completed.findIndex((item) => !item);
    return STEP_DEFINITIONS.map((step, index) => ({
      ...step,
      completed: completed[index],
      current: firstIncomplete === -1 ? false : index === firstIncomplete,
      pending: firstIncomplete === -1 ? false : index > firstIncomplete,
    }));
  }, [draftContent, draftMedia, selectedAsset]);

  const originalPost = draftContent?.original_post ?? {
    platform: draftContent?.original_post?.platform?.trim() || draftContent?.content?.platform?.trim() || draftContent?.platform_label?.trim() || null,
    handle: draftContent?.profile_username?.trim() || null,
    caption:
      draftContent?.original_post?.caption?.trim() ||
      draftContent?.caption_preview?.trim() ||
      draftContent?.content_summary?.trim() ||
      draftContent?.display_summary?.trim() ||
      null,
    post_url: draftContent?.source_url?.trim() || null,
    views: draftContent?.views?.trim() || null,
    likes: draftContent?.likes?.trim() || null,
    comments: draftContent?.comments?.trim() || null,
    shares: draftContent?.shares?.trim() || null,
    audio: draftContent?.audio_sound?.trim() || null,
    engagement_rate: draftContent?.engagement_rate?.trim() || null,
  };
  const originalPostUrl = originalPost.post_url?.trim() || null;
  const mediaCarouselItems = useMemo(() => [...draftMediaItems].slice().reverse(), [draftMediaItems]);
  const renderInfoTile = (label: string, value: string, className = "") => (
    <div className={cn("rounded-[14px] border border-border/60 bg-[#fbf8f6] p-3", className)}>
      <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-[13px] font-semibold leading-5 text-foreground/80 text-pretty whitespace-pre-wrap">{value}</p>
    </div>
  );
  const selectedContentPanel = draftContent ? (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-background/95 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="font-serif text-[22px] leading-tight text-primary sm:text-[26px]">{draftContent.display_title}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mr-8 h-8 rounded-full px-3.5 text-[11px] sm:mr-10"
          onClick={() => setOriginalPostModalOpen(true)}
          disabled={composerLoading}
        >
          <ExternalLink className="size-4" />
          Original post data
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="space-y-2.5 border-b border-border/60 px-4 py-4 xl:border-b-0 xl:border-r xl:border-border/60 sm:px-5 sm:py-4">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Choose Caption</Label>

            {composerLoading && !captionOptions.length ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`caption-skeleton-${index}`} className="rounded-[14px] border border-border/70 bg-[#fbf8f6] px-3 py-2.5 shadow-none">
                    <Skeleton className="h-4 w-4/5 rounded-full" />
                    <Skeleton className="mt-2 h-3 w-11/12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : captionOptions.length > 0 ? (
              <>
                {captionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selectedCaptionOption?.id === option.id}
                    className={cn(
                      "w-full rounded-[14px] border border-border/70 bg-[#fbf8f6] px-3 py-2.5 text-left shadow-none transition-colors hover:border-primary/40 hover:bg-primary/5",
                      selectedCaptionOption?.id === option.id && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => handleSelectCaptionOption(option)}
                  >
                    <p className="mt-1.5 text-[11px] leading-5 text-foreground/80">{option.text}</p>
                  </button>
                ))}
              </>
            ) : (
              <Alert variant="default" className="border-amber-200 bg-amber-50/80 text-amber-800">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-medium text-amber-900">No generated captions found</AlertTitle>
                <AlertDescription className="text-sm leading-6 text-amber-800">You can write or paste one manually.</AlertDescription>
              </Alert>
            )}
          </div>

          <Separator className="my-1" />

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Choose Hook</Label>

            {composerLoading && !hookOptions.length ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`hook-skeleton-${index}`} className="rounded-[14px] border border-border/70 bg-[#fbf8f6] px-3 py-2.5 shadow-none">
                    <Skeleton className="h-4 w-3/5 rounded-full" />
                  </div>
                ))}
              </div>
            ) : hookOptions.length > 0 ? (
              <>
                {hookOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selectedHookOption?.id === option.id}
                    className={cn(
                      "w-full rounded-[14px] border border-border/70 bg-[#fbf8f6] px-3 py-2.5 text-left shadow-none transition-colors hover:border-primary/40 hover:bg-primary/5",
                      selectedHookOption?.id === option.id && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => handleSelectHookOption(option)}
                  >
                    <p className="mt-1.5 text-[11px] leading-5 text-foreground/80">{option.text}</p>
                  </button>
                ))}
              </>
            ) : (
              <Alert variant="default" className="border-amber-200 bg-amber-50/80 text-amber-800">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-medium text-amber-900">No generated hooks found</AlertTitle>
                <AlertDescription className="text-sm leading-6 text-amber-800">You can continue with caption only.</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-2.5 px-4 py-4 sm:px-5 sm:py-4">
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="g5-caption" className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Final caption
              </Label>
              <Textarea
                id="g5-caption"
                value={draftCaption}
                onChange={(event) => {
                  setDraftCaption(event.target.value);
                  setCaptionDraftManuallyEdited(true);
                }}
                placeholder={
                  composerMode === "edit"
                    ? "Edit the final caption before saving changes."
                    : captionOptions.length
                      ? "Edit the final caption before saving the queue item."
                      : "Enter the final caption for this post."
                }
                className="min-h-14 rounded-[20px] border-border/70 bg-white px-3.5 py-2.5 text-[13px] leading-5 shadow-sm"
              />
            </div>

            {composerMode === "edit" ? (
              <div className="space-y-1.5 rounded-[20px] border border-violet-200/70 bg-violet-50/60 p-3">
                <Label htmlFor="g5-edit-hook" className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Hook
                </Label>
                <Input
                  id="g5-edit-hook"
                  value={draftHookOverride}
                  onChange={(event) => {
                    setDraftHookOverride(event.target.value);
                    setSelectedHookId(null);
                  }}
                  placeholder="Edit the hook before saving changes."
                  className="h-10 rounded-[16px] border-border/70 bg-white px-3.5 text-[13px] shadow-sm"
                />
              </div>
            ) : (
              <div className="rounded-[20px] border border-violet-200/70 bg-violet-50/60 p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Selected hook</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5 text-foreground/85">{draftHookText || "No hook selected"}</p>
              </div>
            )}

            {draftMediaItems.length > 0 ? (
              <Carousel
                opts={{ align: "start", loop: mediaCarouselItems.length > 1 }}
                className="relative flex h-[300px] flex-none flex-col overflow-hidden rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-2 sm:h-[320px]"
              >
                <div className="flex items-center justify-between gap-3 pb-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-700">Uploaded media</p>
                    <p className="truncate text-[13px] font-medium text-emerald-950">
                      {draftMediaItems.length} file{draftMediaItems.length === 1 ? "" : "s"} uploaded
                    </p>
                  </div>
                </div>

                <CarouselContent className="h-full min-h-0 flex-1" style={{ marginLeft: 0 }}>
                  {mediaCarouselItems.map((media) => {
                    const selected = draftMedia?.storage_key === media.storage_key || draftMedia?.media_url === media.media_url;
                    const isVideo = media.kind?.toUpperCase() === "VIDEO" || media.content_type.toLowerCase().startsWith("video/");

                    return (
                      <CarouselItem key={media.storage_key || media.media_url} className="h-full" style={{ paddingLeft: 0 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDraftMediaKey(media.storage_key || media.media_url)}
                          className={cn(
                            "group flex h-full w-full flex-col overflow-hidden rounded-[16px] border bg-white p-2 text-left transition-colors",
                            selected ? "border-emerald-400 ring-1 ring-emerald-400/30" : "border-emerald-200/70 hover:border-emerald-300"
                          )}
                        >
                          <div className="relative flex-1 overflow-hidden rounded-[14px] bg-black/5">
                            {isVideo ? (
                              <video
                                src={media.media_url}
                                controls
                                playsInline
                                preload="metadata"
                                className="h-full w-full bg-black object-contain"
                              />
                            ) : (
                              <img
                                src={media.media_url}
                                alt={media.filename}
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>
                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">{media.kind}</p>
                          </div>
                        </button>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>

                {mediaCarouselItems.length > 1 ? (
                  <>
                    <CarouselPrevious
                      style={{ left: "0.5rem" }}
                      className="border-emerald-200 bg-white text-emerald-900 shadow-sm hover:bg-emerald-50"
                    />
                    <CarouselNext
                      style={{ right: "0.5rem" }}
                      className="border-emerald-200 bg-white text-emerald-900 shadow-sm hover:bg-emerald-50"
                    />
                  </>
                ) : null}
              </Carousel>
            ) : (
              <div className="flex h-[300px] flex-none items-center justify-center rounded-[20px] border border-dashed border-border/70 bg-[#fbf8f6] p-4 text-sm text-muted-foreground sm:h-[320px]">
                {composerMode === "edit" ? "No media preview available for this post." : "Upload media after choosing the final caption."}
              </div>
            )}

            {composerMode === "edit" ? (
              <div className="grid gap-2 pt-1 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={clearDraftSelection} className="h-9 rounded-full px-4 text-sm">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveComposerEdit}
                  disabled={!draftCaption.trim()}
                  className="h-9 rounded-full bg-primary px-4 text-sm"
                >
                  Save changes
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 pt-1 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={openFilePicker} disabled={busyAction === "upload"} className="h-9 rounded-full px-4 text-sm">
                  {busyAction === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Add media
                </Button>
                <Button type="button" onClick={handleRegisterAsset} disabled={busyAction === "register" || composerLoading} className="h-9 rounded-full bg-primary px-4 text-sm">
                  {busyAction === "register" ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                  Register asset
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-[28px] border border-border/70 bg-background/95 shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="space-y-4 border-b border-border/60 px-5 py-5 xl:border-b-0 xl:border-r xl:border-border/60 sm:px-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Start here</p>
          <div className="space-y-2">
            <h2 className="font-serif text-2xl leading-tight text-primary">Choose approved content for publishing</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Pick a review from G4, upload the media, and turn it into a queue item ready for manual publishing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-11 rounded-full px-4" onClick={() => setG4DialogOpen(true)}>
              <Sparkles className="size-4" />
              Select content from G4
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-full px-4" onClick={openFilePicker} disabled={busyAction === "upload"}>
              {busyAction === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload media
            </Button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">What you’ll do next</p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-border/60 bg-white p-3 text-sm leading-6 text-foreground/80">Choose a review that is ready for G5</div>
              <div className="rounded-2xl border border-border/60 bg-white p-3 text-sm leading-6 text-foreground/80">Upload the media file for the post</div>
              <div className="rounded-2xl border border-border/60 bg-white p-3 text-sm leading-6 text-foreground/80">Register the item and finish the G5 step</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const originalPostModal = draftContent ? (
    <Dialog open={originalPostModalOpen} onOpenChange={setOriginalPostModalOpen}>
      <DialogContent className="h-[100dvh] !w-[100vw] !max-w-none overflow-y-auto rounded-none border-0 bg-background p-0 shadow-none sm:h-auto sm:max-h-[90vh] sm:!w-[min(92vw,980px)] sm:!max-w-[min(92vw,980px)] sm:rounded-[28px] sm:border sm:border-border/70 sm:bg-background sm:shadow-xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
          <DialogTitle className="font-serif text-2xl leading-tight text-primary">Original post data</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            Source details for {draftContent.display_title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-5 sm:px-6">
          <div className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Original caption</p>
            <p className="mt-1 text-[13px] font-semibold leading-6 text-foreground/80 text-pretty whitespace-pre-wrap">
              {originalPost.caption || "Not available"}
            </p>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {renderInfoTile("Platform", originalPost.platform || "Unknown")}
            {renderInfoTile("Handle", originalPost.handle || "Unknown")}
            {renderInfoTile("Audio", originalPost.audio || "original sound")}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {renderInfoTile("Views", formatG4MetricValue(originalPost.views))}
            {renderInfoTile("Likes", formatG4MetricValue(originalPost.likes))}
            {renderInfoTile("Comments", formatG4MetricValue(originalPost.comments))}
            {renderInfoTile("Shares", formatG4MetricValue(originalPost.shares))}
            {renderInfoTile("Engagement rate", formatG4MetricValue(originalPost.engagement_rate))}
          </div>

          {originalPostUrl ? (
            <Button asChild variant="outline" className="h-10 w-full rounded-[12px] border-border/70 bg-white px-3.5 text-xs font-semibold shadow-none">
              <a href={originalPostUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-3.5" />
                Open Original Post
              </a>
            </Button>
          ) : (
            <p className="text-[11px] leading-5 text-muted-foreground">Open link not available from this review bundle.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  const composerModal = draftContent ? (
    <Dialog
      open={composerOpen}
      onOpenChange={(open) => {
        if (open) {
          setComposerOpen(true);
          return;
        }

        clearDraftSelection();
      }}
    >
      <DialogContent className="h-[100dvh] !w-[100vw] !max-w-none overflow-hidden rounded-none border-0 bg-background p-0 shadow-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto sm:!w-[min(94vw,1400px)] sm:!max-w-[min(94vw,1400px)] sm:rounded-[28px] sm:border sm:border-border/70 sm:bg-background sm:shadow-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Prepare content for publishing</DialogTitle>
          <DialogDescription>Choose a hook, caption, media file, and register the asset.</DialogDescription>
        </DialogHeader>
        {selectedContentPanel}
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <>
      <WorkflowDashboardShell
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        badges={headerBadges}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleUploadMedia} />

        {pageError ? getActionErrorMessage(pageError) : null}

        {isLoading ? (
          <LoadingShell />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Pending Approval"
                value={String(summary.pending_approval)}
                helper="Assets waiting for human review."
                icon={<AlertTriangle className="size-5" />}
                toneClassName="border-sky-200 bg-sky-50 text-sky-700"
              />
              <MetricCard
                label="Ready to Publish"
                value={String(summary.ready_to_publish)}
                helper="Approved assets cleared for manual publishing."
                icon={<CheckCircle2 className="size-5" />}
                toneClassName="border-violet-200 bg-violet-50 text-violet-700"
              />
              <MetricCard
                label="Published Manually"
                value={String(summary.published_manually)}
                helper="Assets with proof URLs saved."
                icon={<ExternalLink className="size-5" />}
                toneClassName="border-emerald-200 bg-emerald-50 text-emerald-700"
              />
              <MetricCard
                label="Blocked"
                value={String(summary.blocked)}
                helper="Rejected or blocked assets."
                icon={<XCircle className="size-5" />}
                toneClassName="border-rose-200 bg-rose-50 text-rose-700"
              />
            </div>

            <Card className="overflow-hidden border-border/70 bg-background/95 shadow-sm">
              <CardHeader className="space-y-3 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-2xl leading-tight text-primary">Publishing journey</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      Choose approved content, upload media, approve it, publish manually, and save the live post URL.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {summary.total} queue item{summary.total === 1 ? "" : "s"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-7">
                  {stepState.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.key}
                        className={cn(
                          "flex items-start gap-3 rounded-[24px] border p-4 transition-colors",
                          step.completed
                            ? "border-emerald-200 bg-emerald-50/60"
                            : step.current
                              ? "border-violet-200 bg-violet-50/60"
                              : "border-border/60 bg-background"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                            step.completed
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : step.current
                                ? "border-violet-200 bg-white text-violet-700"
                                : "border-border/70 bg-[#fbf8f6] text-muted-foreground"
                          )}
                        >
                          {step.completed ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-foreground">{step.label}</p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {step.completed ? "Complete" : step.current ? "Current step" : "Pending"}
                          </p>
                        </div>
                        {index < stepState.length - 1 ? <ArrowRight className="ml-auto mt-1 hidden size-4 text-border xl:block" /> : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {inlineError ? (
              <Alert variant="destructive" className="border-rose-200 bg-rose-50/80 text-rose-700">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-medium text-rose-800">Inline error</AlertTitle>
                <AlertDescription className="text-sm text-rose-700">{inlineError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
              <Card className="overflow-hidden border-border/70 bg-background/95 shadow-sm">
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="font-serif text-2xl leading-tight text-primary">Content queue</CardTitle>
                      <CardDescription className="text-sm leading-6 text-muted-foreground">
                      Choose approved content, then review the items moving through G5, publishing, and proof.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      Queue items: {summary.total}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative w-full max-w-xl">
                    <Label htmlFor="g5-search" className="sr-only">
                      Search content, titles, or captions
                    </Label>
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="g5-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={SEARCH_PLACEHOLDER}
                      className="h-10 rounded-full border-border/70 bg-white pl-10 shadow-sm"
                    />
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[28px] bg-transparent p-0 md:grid-cols-3 xl:grid-cols-5">
                      <TabsTrigger
                        value="approved-content"
                        className="flex h-auto flex-col items-start justify-start gap-1 rounded-[20px] border border-border/60 bg-white px-4 py-3 text-left text-sm data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                      >
                        <span className="font-medium text-foreground">Approved Content</span>
                        <span className="text-[11px] text-muted-foreground">{filteredApprovedContent.length} ready for G5</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="pending-approval"
                        className="flex h-auto flex-col items-start justify-start gap-1 rounded-[20px] border border-border/60 bg-white px-4 py-3 text-left text-sm data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                      >
                        <span className="font-medium text-foreground">Pending Approval</span>
                        <span className="text-[11px] text-muted-foreground">{filteredPendingApprovalAssets.length} waiting</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="ready-to-publish"
                        className="flex h-auto flex-col items-start justify-start gap-1 rounded-[20px] border border-border/60 bg-white px-4 py-3 text-left text-sm data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                      >
                        <span className="font-medium text-foreground">Ready to Publish</span>
                        <span className="text-[11px] text-muted-foreground">{filteredReadyToPublishAssets.length} ready</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="published-manually"
                        className="flex h-auto flex-col items-start justify-start gap-1 rounded-[20px] border border-border/60 bg-white px-4 py-3 text-left text-sm data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                      >
                        <span className="font-medium text-foreground">Published Manually</span>
                        <span className="text-[11px] text-muted-foreground">{filteredPublishedAssets.length} saved</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="blocked"
                        className="flex h-auto flex-col items-start justify-start gap-1 rounded-[20px] border border-border/60 bg-white px-4 py-3 text-left text-sm data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                      >
                        <span className="font-medium text-foreground">Blocked / Rejected</span>
                        <span className="text-[11px] text-muted-foreground">{filteredBlockedAssets.length} need review</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="approved-content" className="space-y-4">
                      {filteredApprovedContent.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {filteredApprovedContent.map((review) => {
                            const selected = draftContent?.id === review.id;
                            const isAlreadyRegistered = buildApprovedContentCandidateKeys(review).some((key) => registeredG4ReviewKeySet.has(key));
                            const reviewMetrics = [
                              {
                                label: "Views",
                                value: formatG4MetricValue(review.views),
                                icon: <Eye className="size-5" aria-hidden="true" />,
                                accentClassName: "border-violet-100 bg-violet-50 text-violet-700",
                              },
                              {
                                label: "Comments",
                                value: formatG4MetricValue(review.comments),
                                icon: <MessageCircle className="size-5" aria-hidden="true" />,
                                accentClassName: "border-indigo-100 bg-indigo-50 text-indigo-700",
                              },
                              {
                                label: "Likes",
                                value: formatG4MetricValue(review.likes),
                                icon: <Heart className="size-5" aria-hidden="true" />,
                                accentClassName: "border-rose-100 bg-rose-50 text-rose-700",
                              },
                              {
                                label: "Shares",
                                value: formatG4MetricValue(review.shares),
                                icon: <Share2 className="size-5" aria-hidden="true" />,
                                accentClassName: "border-emerald-100 bg-emerald-50 text-emerald-700",
                              },
                            ];

                            return (
                              <article
                                key={review.id}
                                className={cn(
                                  "group w-full overflow-hidden rounded-[20px] border bg-white shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-200",
                                  selected
                                    ? "border-violet-300"
                                    : "border-border/60 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                                )}
                              >
                                <div className="relative overflow-hidden border-b border-border/60 bg-white">
                                  <div className="relative space-y-3 px-4 py-3 sm:px-5 sm:py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <Badge
                                        variant="outline"
                                        className="rounded-full border-violet-200/70 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700 shadow-none"
                                      >
                                        <TrendingUp className="mr-1.5 size-3.5" aria-hidden="true" />
                                        Trending content
                                      </Badge>
                                      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-2.5 py-1 text-[10px] leading-none text-muted-foreground shadow-none">
                                        <CalendarDays className="size-3 text-violet-600" aria-hidden="true" />
                                        <span>{describeTimestamp(review.created_at, "Created time unavailable")}</span>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <p className="max-w-5xl font-serif text-[clamp(0.95rem,1.15vw,1.45rem)] leading-[1.05] tracking-tight text-primary text-pretty">
                                        {review.display_title}
                                      </p>
                                      <div className="flex min-w-0 items-center gap-2 text-[10px] leading-5">
                                        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                          <MessageCircle className="size-3 shrink-0 text-violet-600" aria-hidden="true" />
                                          <span>Caption:</span>
                                        </span>
                                        <p className="min-w-0 flex-1 truncate text-xs leading-5 text-slate-600">
                                        {getG4ReviewCaption(review) || "No original caption available."}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                      {reviewMetrics.map((metric) => (
                                        <div
                                          key={metric.label}
                                          className="flex items-center gap-3 rounded-[16px] border border-border/60 bg-white px-3 py-2 shadow-none"
                                        >
                                          <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", metric.accentClassName)}>
                                            {metric.icon}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                              {metric.label}
                                            </p>
                                            <p className="mt-0.5 text-[1.15rem] font-semibold leading-none tracking-tight text-primary tabular-nums">
                                              {metric.value}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      {isAlreadyRegistered ? (
                                        <div className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold leading-none text-slate-600 shadow-none">
                                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                                          Already registered
                                        </div>
                                      ) : (
                                        <Button
                                          type="button"
                                          className="inline-flex h-9 items-center rounded-full px-4 text-sm leading-none shadow-none"
                                          onClick={() => void handleSelectG4Review(review)}
                                        >
                                          <Sparkles className="size-3.5" aria-hidden="true" />
                                          Use this content
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                          <div className="space-y-2">
                            <p className="font-serif text-2xl leading-tight tracking-tight text-primary">No G4 content ready for G5 yet.</p>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Approved content will appear here once the content check passes.</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="pending-approval" className="space-y-4">
                      {filteredPendingApprovalAssets.length > 0 ? (
                        <div className="grid gap-3">
                          {filteredPendingApprovalAssets.map((asset) => (
                            <AssetCard key={asset.asset_id} asset={asset} selected={asset.asset_id === selectedAsset?.asset_id} onSelect={selectAsset} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                          <div className="space-y-2">
                            <p className="font-serif text-2xl leading-tight tracking-tight text-primary">Nothing waiting right now</p>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Items that still need review will appear here.</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="ready-to-publish" className="space-y-4">
                      {filteredReadyToPublishAssets.length > 0 ? (
                        <div className="grid gap-3">
                          {filteredReadyToPublishAssets.map((asset) => (
                            <AssetCard key={asset.asset_id} asset={asset} selected={asset.asset_id === selectedAsset?.asset_id} onSelect={selectAsset} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                          <div className="space-y-2">
                            <p className="font-serif text-2xl leading-tight tracking-tight text-primary">Nothing ready to publish yet</p>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Approved items will land here once they are cleared for manual publishing.</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="published-manually" className="space-y-4">
                      {filteredPublishedAssets.length > 0 ? (
                        <div className="grid gap-3">
                          {filteredPublishedAssets.map((asset) => (
                            <AssetCard key={asset.asset_id} asset={asset} selected={asset.asset_id === selectedAsset?.asset_id} onSelect={selectAsset} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                          <div className="space-y-2">
                            <p className="font-serif text-2xl leading-tight tracking-tight text-primary">No published posts yet</p>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Saved live links will appear here after manual publishing is complete.</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="blocked" className="space-y-4">
                      {filteredBlockedAssets.length > 0 ? (
                        <div className="grid gap-3">
                          {filteredBlockedAssets.map((asset) => (
                            <AssetCard key={asset.asset_id} asset={asset} selected={asset.asset_id === selectedAsset?.asset_id} onSelect={selectAsset} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-6">
                          <div className="space-y-2">
                            <p className="font-serif text-2xl leading-tight tracking-tight text-primary">Nothing blocked right now</p>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Rejected or blocked items will appear here if they need attention.</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <div className="hidden self-start xl:block xl:sticky xl:top-6">
                <AssetInspectorPanel
                  asset={selectedAsset}
                  mode="card"
                  captionText={selectedAssetCaptionValue}
                  hookText={selectedAssetHookValue}
                  onEdit={handleOpenPostEditor}
                  onApprove={() => void handleApprovalDecision("APPROVED")}
                  onRunReadinessCheck={() => void handleRunReadinessCheck()}
                  busyAction={busyAction}
                />
              </div>
            </div>
          </div>
        )}
      </WorkflowDashboardShell>

      <Sheet open={!isDesktop && detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="right" className="w-full border-border/70 p-0 sm:max-w-[760px]">
          <AssetInspectorPanel
            asset={selectedAsset}
            mode="sheet"
            captionText={selectedAssetCaptionValue}
            hookText={selectedAssetHookValue}
            onEdit={handleOpenPostEditor}
            onApprove={() => void handleApprovalDecision("APPROVED")}
            onRunReadinessCheck={() => void handleRunReadinessCheck()}
            busyAction={busyAction}
          />
        </SheetContent>
      </Sheet>

      {composerModal}
      {originalPostModal}

      <G4PickerDialog
        open={g4DialogOpen}
        onOpenChange={setG4DialogOpen}
        reviews={selectableG4Reviews}
        message={g4ReadyContent?.message || "No G4 content ready for G5 yet."}
        busy={busyAction !== null || g4SelectionBusy}
        onRefresh={() => void loadData("refresh")}
        onSelect={(review) => void handleSelectG4Review(review)}
      />
    </>
  );
}
