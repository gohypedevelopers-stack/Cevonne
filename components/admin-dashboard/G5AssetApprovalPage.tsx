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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  content_summary: string | null;
  ai_insight: string | null;
  original_post_data: string | null;
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

type BusyAction = "upload" | "register" | "approve" | "reject" | "readiness" | "publish" | null;

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
  manualPostUrl: string;
  onManualPostUrlChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRunReadinessCheck: () => void;
  onSavePostUrl: () => void;
  busyAction: BusyAction;
  runtimeResponse: G5WebhookResponse | null;
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
  PENDING_APPROVAL: "border-sky-200 bg-sky-50 text-sky-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  APPROVED_READY_TO_PUBLISH: "border-violet-200 bg-violet-50 text-violet-700",
  PUBLISHED_MANUALLY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  BLOCKED: "border-amber-200 bg-amber-50 text-amber-700",
  DEFAULT: "border-slate-200 bg-slate-100 text-slate-700",
};

const READINESS_TONES: Record<string, string> = {
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRY_RUN: "border-violet-200 bg-violet-50 text-violet-700",
  MANUAL_FALLBACK: "border-sky-200 bg-sky-50 text-sky-700",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

const normalizeStateKey = (value?: string | null) => upperText(value).replace(/[\s-]+/g, "_");

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
    return "Ready for G5";
  }

  if (normalized === "PASS" || normalized === "READY_FOR_APPROVAL" || normalized === "PENDING_HUMAN_APPROVAL" || normalized === "APPROVED") {
    return "Ready for G5";
  }

  if (normalized === "PENDING_APPROVAL") {
    return "Waiting for approval";
  }

  if (normalized === "APPROVED_READY_TO_PUBLISH" || normalized === "READY_TO_PUBLISH" || normalized === "READY") {
    return "Ready to publish manually";
  }

  if (normalized === "PUBLISHED_MANUALLY" || normalized === "PUBLISHED") {
    return "Published manually";
  }

  if (normalized === "BLOCKED" || normalized === "BLOCK" || normalized === "REJECTED" || normalized === "FAILED" || normalized === "ERROR") {
    return "Blocked / rejected";
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
    return "Not run yet";
  }

  if (normalized === "READY" || normalized === "PASS") {
    return "Ready to publish";
  }

  if (normalized === "DRY_RUN") {
    return "Preview complete";
  }

  if (normalized === "MANUAL_FALLBACK") {
    return "Manual check required";
  }

  if (normalized === "BLOCKED" || normalized === "BLOCK" || normalized === "FAILED" || normalized === "ERROR") {
    return "Needs attention";
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const isG4ReadyForG5 = (review: G5ApprovedContentRecord) => {
  const status = normalizeStateKey(review.status);
  const approvalState = normalizeStateKey(review.approval_state);

  return (
    status === "PASS" ||
    status === "MANUAL_ONLY" ||
    status === "APPROVED" ||
    status === "READY_FOR_APPROVAL" ||
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "APPROVED" ||
    approvalState === "PASS"
  );
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
    display_status: review.display_status?.trim() || "Ready for G5 Approval",
  };
};

const normalizeSelectionText = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const getMatchingOption = <T extends { id: string; text: string }>(options: T[], text?: string | null) => {
  const normalized = normalizeSelectionText(text);
  if (!normalized) {
    return null;
  }

  return options.find((option) => normalizeSelectionText(option.text) === normalized) ?? null;
};

const composeG5DraftText = (hookText?: string | null, captionText?: string | null) => {
  const hook = hookText?.trim() ?? "";
  const caption = captionText?.trim() ?? "";

  if (hook && caption) {
    return `${hook}\n\n${caption}`;
  }

  if (caption) {
    return caption;
  }

  return hook;
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

const isAssetPublishedManually = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  const status = upperText(asset.asset_status ?? asset.manual_publish_status);
  return Boolean(asset.post_url && asset.published_at) || status === "PUBLISHED_MANUALLY" || status === "PUBLISHED";
};

const isAssetBlocked = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  const status = upperText(asset.asset_status ?? asset.approval_status ?? asset.readiness_status ?? asset.compliance_status);
  return status === "BLOCKED" || status === "BLOCK" || status === "REJECTED" || status === "FAILED" || status === "ERROR";
};

const isAssetApproved = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  const status = upperText(asset.asset_status ?? asset.approval_status ?? asset.readiness_status);
  return status === "APPROVED" || status === "APPROVED_READY_TO_PUBLISH" || status === "READY_TO_PUBLISH" || status === "PASS";
};

const isReadyToPublish = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return false;
  }

  const status = upperText(asset.asset_status ?? asset.readiness_status ?? asset.approval_status);
  return (
    status === "APPROVED_READY_TO_PUBLISH" ||
    status === "READY_TO_PUBLISH" ||
    status === "READY" ||
    status === "PASS" ||
    upperText(asset.readiness_status) === "READY"
  );
};

const getAssetStatusInfo = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return { label: "PENDING_APPROVAL", tone: ASSET_STATUS_TONES.DEFAULT };
  }

  const rawStatus = upperText(asset.asset_status ?? asset.manual_publish_status ?? asset.approval_status);

  if (isAssetPublishedManually(asset)) {
    return { label: "PUBLISHED_MANUALLY", tone: ASSET_STATUS_TONES.PUBLISHED_MANUALLY };
  }

  if (rawStatus === "PENDING_APPROVAL" || (!rawStatus && !isAssetApproved(asset) && !isAssetBlocked(asset))) {
    return { label: "PENDING_APPROVAL", tone: ASSET_STATUS_TONES.PENDING_APPROVAL };
  }

  if (rawStatus === "APPROVED_READY_TO_PUBLISH" || isReadyToPublish(asset)) {
    return { label: "APPROVED_READY_TO_PUBLISH", tone: ASSET_STATUS_TONES.APPROVED_READY_TO_PUBLISH };
  }

  if (rawStatus === "APPROVED") {
    return { label: "APPROVED", tone: ASSET_STATUS_TONES.APPROVED };
  }

  if (rawStatus === "REJECTED") {
    return { label: "REJECTED", tone: ASSET_STATUS_TONES.REJECTED };
  }

  if (rawStatus === "BLOCKED" || isAssetBlocked(asset)) {
    return { label: "BLOCKED", tone: ASSET_STATUS_TONES.BLOCKED };
  }

  return { label: rawStatus || "PENDING_APPROVAL", tone: ASSET_STATUS_TONES.DEFAULT };
};

const getReadinessInfo = (asset: G5DashboardAssetRecord | null) => {
  if (!asset) {
    return { label: "NOT_RUN_YET", tone: READINESS_TONES.NOT_RUN_YET };
  }

  const rawStatus = upperText(asset.readiness_status);

  if (isAssetPublishedManually(asset)) {
    return { label: "READY", tone: READINESS_TONES.READY };
  }

  if (rawStatus === "READY" || rawStatus === "PASS") {
    return { label: rawStatus, tone: READINESS_TONES.READY };
  }

  if (rawStatus === "DRY_RUN") {
    return { label: "DRY_RUN", tone: READINESS_TONES.DRY_RUN };
  }

  if (rawStatus === "MANUAL_FALLBACK") {
    return { label: "MANUAL_FALLBACK", tone: READINESS_TONES.MANUAL_FALLBACK };
  }

  if (rawStatus === "BLOCKED" || rawStatus === "BLOCK" || rawStatus === "FAILED" || rawStatus === "ERROR") {
    return { label: rawStatus || "BLOCKED", tone: READINESS_TONES.BLOCKED };
  }

  if (rawStatus) {
    return { label: rawStatus, tone: READINESS_TONES.DEFAULT };
  }

  return { label: "NOT_RUN_YET", tone: READINESS_TONES.NOT_RUN_YET };
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
  manualPostUrl,
  onManualPostUrlChange,
  onApprove,
  onReject,
  onRunReadinessCheck,
  onSavePostUrl,
  busyAction,
  runtimeResponse,
}: AssetInspectorPanelProps) => {
  const body = asset ? (
    <>
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium">
              {getPlatformDisplayLabel(asset)}
            </Badge>
            <AssetStatusBadge status={getAssetStatusInfo(asset).label} />
            <AssetReadinessBadge status={getReadinessInfo(asset).label} />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-3xl leading-tight tracking-tight text-primary">{getAssetTitle(asset)}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {asset.asset_type?.trim() ? `${formatPlatformLabel(asset.asset_type)} asset` : "Ready for review in the publishing queue"}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-[#fbf8f6] p-4">
          {asset.media_url ? (
            <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background">
              {(() => {
                const isVideo = upperText(asset.asset_type).includes("VIDEO") || /\.(mp4|webm|mov|m4v)$/i.test(asset.media_url ?? "");
                if (isVideo) {
                  return <video controls className="h-64 w-full bg-black object-cover" src={asset.media_url} />;
                }
                return <img src={asset.media_url} alt={getAssetTitle(asset)} className="h-64 w-full object-cover" loading="lazy" />;
              })()}
            </div>
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
              {asset.content_text?.trim() || asset.asset_title?.trim() || "No caption preview available."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Publishing status</p>
            <p className="mt-2 text-sm font-medium text-foreground">{getFriendlyStatusLabel(getAssetStatusInfo(asset).label)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Readiness</p>
            <p className="mt-2 text-sm font-medium text-foreground">{getFriendlyReadinessLabel(getReadinessInfo(asset).label)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Media link</p>
            {asset.media_url ? (
              <a href={asset.media_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View uploaded media
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not uploaded yet</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Last update</p>
            <p className="mt-2 text-sm font-medium text-foreground">{compactDateTime(asset.state_updated_at || asset.asset_created_at)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`g5-post-url-${asset.asset_id}`} className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Live post URL
            </Label>
            <Input
              id={`g5-post-url-${asset.asset_id}`}
              value={manualPostUrl}
              onChange={(event) => onManualPostUrlChange(event.target.value)}
              placeholder="https://www.instagram.com/p/..."
              className="h-11 rounded-full border-border/70 bg-white px-4"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={onApprove}
              disabled={busyAction !== null}
              className="h-10 rounded-full bg-primary px-4 text-sm"
            >
              {busyAction === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Approve for publishing
            </Button>
            <Button
              type="button"
              onClick={onReject}
              disabled={busyAction !== null}
              variant="outline"
              className="h-10 rounded-full px-4 text-sm"
            >
              {busyAction === "reject" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Send back
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
            <Button
              type="button"
              onClick={onSavePostUrl}
              disabled={busyAction !== null}
              className="h-10 rounded-full bg-primary px-4 text-sm"
            >
              {busyAction === "publish" ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Save live link
            </Button>
          </div>
        </div>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="group h-10 w-full justify-between rounded-full border border-border/70 bg-background px-4 text-sm">
              <span>Developer details</span>
              <ArrowRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-3 rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">asset_id</p>
                  <p className="mt-1 break-all text-sm text-foreground/80">{asset.asset_id}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">approval_id</p>
                  <p className="mt-1 break-all text-sm text-foreground/80">{asset.approval_id || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">g4_review_id</p>
                  <p className="mt-1 break-all text-sm text-foreground/80">{asset.g4_review_id || asset.review_id || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">last_manual_publish_result_id</p>
                  <p className="mt-1 break-all text-sm text-foreground/80">{asset.last_manual_publish_result_id || "—"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">readiness response</p>
                <pre className="max-h-40 overflow-auto rounded-2xl border border-border/70 bg-white p-3 text-xs leading-6 text-foreground/80 whitespace-pre-wrap break-words">
                  {asset.readiness_response || asset.last_readiness_check_response || "—"}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">runtime response</p>
                <pre className="max-h-40 overflow-auto rounded-2xl border border-border/70 bg-white p-3 text-xs leading-6 text-foreground/80 whitespace-pre-wrap break-words">
                  {runtimeResponse ? JSON.stringify(runtimeResponse, null, 2) : "—"}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">failure_reasons</p>
                <div className="rounded-2xl border border-border/70 bg-white p-3 text-sm text-foreground/80">
                  {asset.failure_reasons.length > 0 ? asset.failure_reasons.join(" • ") : "None"}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
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

  const [dashboard, setDashboard] = useState<G5DashboardResponse | null>(null);
  const [g4ReadyContent, setG4ReadyContent] = useState<G5ApprovedContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [manualPostUrl, setManualPostUrl] = useState("");
  const [draftContent, setDraftContent] = useState<G5SelectedG4ContentRecord | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [g4SelectionBusy, setG4SelectionBusy] = useState(false);
  const [draftMedia, setDraftMedia] = useState<G5UploadedMedia | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [g4DialogOpen, setG4DialogOpen] = useState(false);
  const [runtimeResponses, setRuntimeResponses] = useState<Record<string, G5WebhookResponse | null>>({});
  const [isDesktop, setIsDesktop] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("approved-content");
  const deferredSearch = useDeferredValue(search);

  const g4ReadyReviews = g4ReadyContent?.reviews ?? [];
  const selectableG4Reviews = useMemo(() => g4ReadyReviews.filter(isG4ReadyForG5).map(toSelectableG4Review), [g4ReadyReviews]);
  const allAssets = dashboard?.assets ?? [];
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
      return allAssets.filter((asset) => getAssetStatusInfo(asset).label === "PENDING_APPROVAL");
    }

    return allAssets.filter((asset) => {
      if (getAssetStatusInfo(asset).label !== "PENDING_APPROVAL") {
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
      return allAssets.filter((asset) => isReadyToPublish(asset) && !isAssetPublishedManually(asset) && !isAssetBlocked(asset));
    }

    return allAssets.filter((asset) => {
      if (!isReadyToPublish(asset) || isAssetPublishedManually(asset) || isAssetBlocked(asset)) {
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
      return allAssets.filter((asset) => isAssetPublishedManually(asset));
    }

    return allAssets.filter((asset) => {
      if (!isAssetPublishedManually(asset)) {
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
      return allAssets.filter((asset) => isAssetBlocked(asset));
    }

    return allAssets.filter((asset) => {
      if (!isAssetBlocked(asset)) {
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
  const selectedCaptionOption = useMemo(() => {
    if (!draftContent) {
      return null;
    }

    return draftContent.caption_options.find((option) => option.id === selectedCaptionId) ?? null;
  }, [draftContent, selectedCaptionId]);
  const selectedHookOption = useMemo(() => {
    if (!draftContent) {
      return null;
    }

    return draftContent.hook_options.find((option) => option.id === selectedHookId) ?? null;
  }, [draftContent, selectedHookId]);

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
    setManualPostUrl(selectedAsset?.post_url?.trim() ?? "");
  }, [selectedAsset?.asset_id]);

  useEffect(() => {
    if (isDesktop) {
      setDetailSheetOpen(false);
      return;
    }

    setDetailSheetOpen(Boolean(selectedAsset));
  }, [isDesktop, selectedAsset?.asset_id]);

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

  const refreshData = useCallback(async () => {
    await loadData("refresh");
  }, [loadData]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadMedia = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      setBusyAction("upload");
      setInlineError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await authFetch(buildRouteUrl("/api/admin/g5/upload-media"), {
          method: "POST",
          body: formData,
          silent: true,
        });

        const body = await parseJson<G5UploadedMedia>(response);
        if (!response.ok || !body) {
          const message = body && "message" in body ? String(body.message) : "Unable to upload media.";
          throw new Error(message);
        }

        setDraftMedia(body);
        toast.success(body.message || "Media uploaded.");
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
      setG4SelectionBusy(true);
      setInlineError(null);

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
        setDraftContent(selected);
        setSelectedCaptionId(null);
        setSelectedHookId(null);
        setDraftCaption(composeG5DraftText(selected.recommended_hook, selected.recommended_caption));
        setDraftMedia(null);
        setG4DialogOpen(false);
        setComposerOpen(true);
        toast.success(body.message || "G4 content selected.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load selected G4 content.";
        setInlineError(message);
        toast.error(message);
      } finally {
        setG4SelectionBusy(false);
      }
    },
    [authFetch]
  );

  const handleSelectCaptionOption = useCallback(
    (option: G5G4CaptionOption) => {
      setSelectedCaptionId(option.id);
      setDraftCaption(composeG5DraftText(selectedHookOption?.text || draftContent?.recommended_hook, option.text));
    },
    [draftContent?.recommended_hook, selectedHookOption?.text]
  );

  const handleSelectHookOption = useCallback(
    (option: G5G4HookOption) => {
      setSelectedHookId(option.id);
      setDraftCaption(composeG5DraftText(option.text, selectedCaptionOption?.text || draftContent?.recommended_caption));
    },
    [draftContent?.recommended_caption, selectedCaptionOption?.text]
  );

  const handleRegisterAsset = useCallback(async () => {
    if (!draftContent) {
      const message = g4ReadyReviews.length > 0 ? "Select approved content first." : "No G4 content ready for G5 yet.";
      setInlineError(message);
      toast.error(message);
      setG4DialogOpen(true);
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
      const message = draftContent.caption_options.length > 0 ? "Select a caption and edit it before registering this asset." : "Enter a caption before registering this asset.";
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

      toast.success(body.message || "Asset registered.");
      setDraftContent(null);
      setDraftCaption("");
      setSelectedCaptionId(null);
      setSelectedHookId(null);
      setDraftMedia(null);
      setComposerOpen(false);

      const rawAssetId = body.raw?.asset_id;
      if (typeof rawAssetId === "string" && rawAssetId.trim()) {
        setSelectedAssetId(rawAssetId.trim());
      }

      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to register asset.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }, [authFetch, draftCaption, draftContent, draftMedia, g4ReadyReviews.length, refreshData, user?.email, user?.id, user?.name]);

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
            decision,
            reviewer_id: actor,
            reviewer_note: decision === "APPROVED" ? "Approved from the G5 dashboard." : "Rejected from the G5 dashboard.",
            rejection_reason: decision === "REJECTED" ? "Rejected from the G5 dashboard." : null,
          }),
          silent: true,
        });

        const body = await parseJson<G5WebhookResponse>(response);
        if (!response.ok || !body) {
          const message = body?.message || "Unable to save approval decision.";
          throw new Error(message);
        }

        setRuntimeResponses((current) => ({
          ...current,
          [selectedAsset.asset_id]: body,
        }));
        toast.success(body.message || (decision === "APPROVED" ? "Asset approved." : "Asset rejected."));
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save approval decision.";
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
          caption: selectedAsset.content_text?.trim() || selectedAsset.asset_title?.trim() || "",
          actor,
        }),
        silent: true,
      });

      const body = await parseJson<G5WebhookResponse>(response);
      if (!response.ok || !body) {
        const message = body?.message || "Unable to run readiness check.";
        throw new Error(message);
      }

      setRuntimeResponses((current) => ({
        ...current,
        [selectedAsset.asset_id]: body,
      }));
      toast.success(body.message || "Readiness check completed.");
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run readiness check.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }, [authFetch, refreshData, selectedAsset, user?.email, user?.id, user?.name]);

  const handleSavePostUrl = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }

    if (!isReadyToPublish(selectedAsset)) {
      const message = "Run readiness check before marking as published.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    const normalizedUrl = manualPostUrl.trim();
    if (!normalizedUrl) {
      const message = "Paste the live Instagram URL after manual publishing.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    const actor = user?.name?.trim() || user?.email?.trim() || user?.id?.trim() || "admin";

    setBusyAction("publish");
    setInlineError(null);

    try {
      const response = await authFetch(buildRouteUrl("/api/admin/g5/manual-publish-result"), {
        method: "POST",
        body: JSON.stringify({
          asset_id: selectedAsset.asset_id,
          approval_id: selectedAsset.approval_id?.trim() || selectedAsset.asset_id,
          platform: "INSTAGRAM",
          post_url: normalizedUrl,
          published_by: actor,
          published_at: new Date().toISOString(),
          notes: "Manual publish proof saved from the G5 dashboard.",
        }),
        silent: true,
      });

      const body = await parseJson<G5WebhookResponse>(response);
      if (!response.ok || !body) {
        const message = body?.message || "Unable to save post URL.";
        throw new Error(message);
      }

      setRuntimeResponses((current) => ({
        ...current,
        [selectedAsset.asset_id]: body,
      }));
      toast.success(body.message || "Post URL saved.");
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save post URL.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }, [authFetch, manualPostUrl, refreshData, selectedAsset, user?.email, user?.id, user?.name]);

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

  const clearDraftSelection = useCallback(() => {
    setDraftContent(null);
    setDraftCaption("");
    setSelectedCaptionId(null);
    setSelectedHookId(null);
    setDraftMedia(null);
    setComposerOpen(false);
  }, []);

  const captionPreviewText =
    selectedCaptionOption?.text ||
    draftContent?.recommended_caption ||
    draftContent?.content_summary ||
    draftContent?.display_summary ||
    "Caption will be finalized during registration.";
  const originalPostDataText = draftContent?.original_post_data?.trim() || null;
  const originalPostDataLines =
    originalPostDataText
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const originalPostHandle = draftContent?.profile_username?.trim() || null;
  const originalPostAudio = draftContent?.audio_sound?.trim() || null;
  const originalPostUrl =
    draftContent?.source_url?.trim() ||
    originalPostDataLines.find((line) => /^https?:\/\//i.test(line)) ||
    null;
  const aiSafeRewriteText = draftContent?.ai_safe_rewrite?.trim() || draftContent?.recommended_caption?.trim() || null;
  const hookAngleText = draftContent?.hook_angle?.trim() || draftContent?.recommended_hook?.trim() || null;
  const metricTiles: Array<{ label: string; value: string }> = [
    { label: "Views", value: formatG4MetricValue(draftContent?.views) },
    { label: "Likes", value: formatG4MetricValue(draftContent?.likes) },
    { label: "Comments", value: formatG4MetricValue(draftContent?.comments) },
    { label: "Shares", value: formatG4MetricValue(draftContent?.shares) },
    { label: "Trend Strength", value: formatG4MetricValue(draftContent?.trend_strength) },
    { label: "Brand Fit", value: formatG4MetricValue(draftContent?.brand_fit_score) },
    { label: "Risk", value: formatG4MetricValue(draftContent?.risk_score) },
  ];
  const selectedContentPanel = draftContent ? (
    <div className="rounded-[28px] border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Selected content</p>
            <div className="space-y-1">
              <h2 className="font-serif text-2xl leading-tight text-primary">{draftContent.display_title}</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{draftContent.display_summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-[#fbf8f6] px-2.5 py-1 text-[11px] font-medium">
                {draftContent.platform_label}
              </Badge>
              <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {draftContent.display_status}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {describeTimestamp(draftContent.created_at, "Created time unavailable")}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-full px-4"
              onClick={() => {
                setComposerOpen(false);
                setG4DialogOpen(true);
              }}
            >
              <Sparkles className="size-4" />
              Change content
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 rounded-full px-4 text-muted-foreground"
              onClick={clearDraftSelection}
            >
              Clear selection
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <div className="space-y-3 border-b border-border/60 px-4 py-4 xl:border-b-0 xl:border-r xl:border-border/60 sm:px-5">
          <div className="rounded-[22px] border border-border/60 bg-white p-3.5 shadow-none">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Caption</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">
                {captionPreviewText}
              </p>
            </div>
          </div>

          <Card className="rounded-[22px] border-border/60 bg-white p-3.5 shadow-none">
            <div className="space-y-3">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Metrics</CardTitle>
              <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                {metricTiles.map((tile) => (
                  <div key={tile.label} className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-2.5">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{tile.label}</p>
                    <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="rounded-[22px] border-border/60 bg-white p-3.5 shadow-none">
            <div className="space-y-3">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Original Post Data</CardTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-2.5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Handle</p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">{originalPostHandle || "Unknown"}</p>
                </div>
                <div className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-2.5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Audio</p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">{originalPostAudio || "original sound"}</p>
                </div>
              </div>

              {originalPostUrl ? (
                <Button asChild variant="outline" className="h-9 w-full rounded-[12px] border-border/70 bg-white px-3.5 text-xs font-semibold shadow-none">
                  <a href={originalPostUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 size-3.5" />
                    Open Original Post
                  </a>
                </Button>
              ) : (
                <p className="text-[11px] leading-5 text-muted-foreground">Open link not available from this review bundle.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[22px] border-border/60 bg-white p-3.5 shadow-none">
            <div className="space-y-3">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">AI direction</CardTitle>
              <div className="space-y-2">
                <div className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-2.5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Safe rewrite</p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">
                    {aiSafeRewriteText || "Not available"}
                  </p>
                </div>
                <div className="rounded-[14px] border border-border/60 bg-[#fbf8f6] p-2.5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hook angle</p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-foreground/80 text-pretty">
                    {hookAngleText || "Not available"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Caption options</Label>
              <Badge variant="outline" className="rounded-full border-border/70 bg-[#fbf8f6] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {draftContent.caption_options.length} caption{draftContent.caption_options.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {draftContent.caption_options.length > 0 ? (
              <ToggleGroup
                type="single"
                variant="outline"
                value={selectedCaptionOption?.id}
                onValueChange={(value) => {
                  const option = draftContent.caption_options.find((item) => item.id === value);
                  if (option) {
                    handleSelectCaptionOption(option);
                  }
                }}
                className="flex w-full flex-col gap-2"
              >
                {draftContent.caption_options.map((option) => (
                  <ToggleGroupItem
                    key={option.id}
                    value={option.id}
                    variant="outline"
                    size="lg"
                    className="h-auto w-full flex-col items-start justify-start gap-1.5 rounded-[16px] border-border/70 bg-[#fbf8f6] px-3 py-3 text-left whitespace-normal data-[state=on]:border-primary/40 data-[state=on]:bg-primary/5"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{option.label}</span>
                      <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                        G4
                      </Badge>
                    </div>
                    <p className="text-xs leading-5 text-foreground/80">{option.text}</p>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <Alert variant="default" className="border-amber-200 bg-amber-50/80 text-amber-800">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-medium text-amber-900">No caption suggestions found</AlertTitle>
                <AlertDescription className="text-sm leading-6 text-amber-800">Enter the final caption manually during registration.</AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Hook options</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-[#fbf8f6] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {draftContent.hook_options.length} hook{draftContent.hook_options.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>

            {draftContent.hook_options.length > 0 ? (
              <ToggleGroup
                type="single"
                variant="outline"
                value={selectedHookOption?.id}
                onValueChange={(value) => {
                  const option = draftContent.hook_options.find((item) => item.id === value);
                  if (option) {
                    handleSelectHookOption(option);
                  }
                }}
                className="flex w-full flex-col gap-2"
              >
                {draftContent.hook_options.map((option) => (
                  <ToggleGroupItem
                    key={option.id}
                    value={option.id}
                    variant="outline"
                    size="lg"
                    className="h-auto w-full flex-col items-start justify-start gap-1.5 rounded-[16px] border-border/70 bg-[#fbf8f6] px-3 py-3 text-left whitespace-normal data-[state=on]:border-primary/40 data-[state=on]:bg-primary/5"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{option.label}</span>
                      <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                        G4
                      </Badge>
                    </div>
                    <p className="text-xs leading-5 text-foreground/80">{option.text}</p>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <Alert variant="default" className="border-amber-200 bg-amber-50/80 text-amber-800">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm font-medium text-amber-900">No hook suggestions found</AlertTitle>
                <AlertDescription className="text-sm leading-6 text-amber-800">Write the opening line manually while keeping the final caption aligned to this review.</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="g5-caption" className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Final caption
              </Label>
              <Textarea
                id="g5-caption"
                value={draftCaption}
                onChange={(event) => setDraftCaption(event.target.value)}
                placeholder={draftContent.caption_options.length ? "Edit the caption before saving the queue item." : "Enter the final caption for this post."}
                className="min-h-28 rounded-[24px] border-border/70 bg-white px-4 py-3 text-sm shadow-sm"
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                <span>This becomes the final text saved with the queue item.</span>
                {selectedCaptionOption ? (
                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    {selectedCaptionOption.label}
                  </Badge>
                ) : null}
                {selectedHookOption ? (
                  <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                    {selectedHookOption.label}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={openFilePicker} disabled={busyAction === "upload"} className="h-11 rounded-full px-4">
                {busyAction === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Upload media
              </Button>
              <Button type="button" onClick={handleRegisterAsset} disabled={busyAction === "register"} className="h-11 rounded-full bg-primary px-4">
                {busyAction === "register" ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                Register asset
              </Button>
            </div>

            {draftMedia ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                Media uploaded: {draftMedia.filename}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-[#fbf8f6] p-4 text-sm text-muted-foreground">
                Upload media after choosing the final caption.
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
              <div className="rounded-2xl border border-border/60 bg-white p-3 text-sm leading-6 text-foreground/80">Register the item and finish approval</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const composerModal = draftContent ? (
    <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
      <DialogContent className="h-[100dvh] !w-[100vw] !max-w-none overflow-y-auto rounded-none border-0 bg-background p-0 shadow-none sm:h-auto sm:max-h-[92vh] sm:!w-[min(94vw,1400px)] sm:!max-w-[min(94vw,1400px)] sm:rounded-[28px] sm:border sm:border-border/70 sm:bg-background sm:shadow-xl">
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
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleUploadMedia} />

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
                        Choose approved content, then review the items moving through approval, publishing, and proof.
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
                                      <p className="max-w-5xl font-serif text-[clamp(1.1rem,1.4vw,1.75rem)] leading-[1] tracking-tight text-primary text-pretty">
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
                                      <Button
                                        type="button"
                                        className="inline-flex h-9 items-center rounded-full px-4 text-sm leading-none shadow-none"
                                        onClick={() => void handleSelectG4Review(review)}
                                      >
                                        <Sparkles className="size-3.5" aria-hidden="true" />
                                        Use this content
                                      </Button>
                                      <div className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 text-sm font-semibold leading-none text-emerald-700 shadow-none">
                                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                                        Ready for G5 Approval
                                      </div>
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
                  manualPostUrl={manualPostUrl}
                  onManualPostUrlChange={setManualPostUrl}
                  onApprove={() => void handleApprovalDecision("APPROVED")}
                  onReject={() => void handleApprovalDecision("REJECTED")}
                  onRunReadinessCheck={() => void handleRunReadinessCheck()}
                  onSavePostUrl={() => void handleSavePostUrl()}
                  busyAction={busyAction}
                  runtimeResponse={selectedAsset ? runtimeResponses[selectedAsset.asset_id] ?? null : null}
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
            manualPostUrl={manualPostUrl}
            onManualPostUrlChange={setManualPostUrl}
            onApprove={() => void handleApprovalDecision("APPROVED")}
            onReject={() => void handleApprovalDecision("REJECTED")}
            onRunReadinessCheck={() => void handleRunReadinessCheck()}
            onSavePostUrl={() => void handleSavePostUrl()}
            busyAction={busyAction}
            runtimeResponse={selectedAsset ? runtimeResponses[selectedAsset.asset_id] ?? null : null}
          />
        </SheetContent>
      </Sheet>

      {composerModal}

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
