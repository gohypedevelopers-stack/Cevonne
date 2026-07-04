"use client";

import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  ExternalLink,
  Instagram,
  Loader2,
  MoreHorizontal,
  Music2,
  PencilLine,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, useCarousel } from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { type G4RecentOutcome, type G4WorkflowDetail } from "@/lib/admin/g4-content-review";
import { cn } from "@/lib/utils";

type G4ContentClaimCheckPageProps = {
  detail: G4WorkflowDetail;
};

type G4DisplayStatus = "PASS" | "PENDING_G5_APPROVAL" | "REQUESTED_CHANGES" | "REJECTED" | "NEEDS_EVIDENCE" | "BLOCK" | "ERROR";

type G4WebhookResponse = {
  status: string;
  message: string;
  review_id?: string | null;
  asset_id?: string | null;
  approval_state?: string | null;
  already_pending?: boolean | null;
  request_id?: string | null;
};

type G4UserActionType = "SEND_TO_G5_APPROVAL" | "REJECT_CONTENT" | "RECREATE_CONTENT";
type G4ActionTask = G4UserActionType | "MANUAL_EDIT_CHECK";

function ReadyRowsCarouselControls() {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8 rounded-full border-border/70 bg-white text-foreground shadow-sm hover:bg-muted/50"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        aria-label="Previous G5 content"
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8 rounded-full border-border/70 bg-white text-foreground shadow-sm hover:bg-muted/50"
        onClick={scrollNext}
        disabled={!canScrollNext}
        aria-label="Next G5 content"
      >
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

const REQUIRED_COPY_WARNING_TERMS = /(clearer skin|fix acne|guaranteed|permanent|overnight|heal|cure|transform)/i;

const normalizeRecentOutcomeKeyPart = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const getRecentOutcomeKey = (outcome: Pick<G4RecentOutcome, "reviewId" | "assetId" | "sourceId"> | null | undefined) => {
  if (!outcome) {
    return null;
  }

  return [
    normalizeRecentOutcomeKeyPart(outcome.reviewId),
    normalizeRecentOutcomeKeyPart(outcome.assetId),
    normalizeRecentOutcomeKeyPart(outcome.sourceId),
  ]
    .filter(Boolean)
    .join("::") || null;
};

const getReviewAssetKey = (reviewId: string | null | undefined, assetId: string | null | undefined) => {
  const reviewKey = normalizeRecentOutcomeKeyPart(reviewId);
  const assetKey = normalizeRecentOutcomeKeyPart(assetId);
  if (!reviewKey || !assetKey) {
    return null;
  }

  return `${reviewKey}::${assetKey}`;
};

const getRowDisplayStatus = (row: G4RecentOutcome, overrideStatus?: G4DisplayStatus | null): G4DisplayStatus => {
  if (overrideStatus) {
    return overrideStatus;
  }

  const approvalRequestStatus = row.approvalRequest?.status?.trim().toUpperCase() ?? "";
  if (approvalRequestStatus) {
    if (approvalRequestStatus === "CHANGES_REQUESTED") {
      return "REQUESTED_CHANGES";
    }

    if (approvalRequestStatus === "REJECTED" || approvalRequestStatus === "DECLINED" || approvalRequestStatus === "DENIED") {
      return "REJECTED";
    }

    return "PENDING_G5_APPROVAL";
  }

  const approvalState = row.approvalState?.trim().toUpperCase() ?? "";
  if (
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "APPROVED" ||
    approvalState === "PENDING_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "REVIEW_REQUESTED" ||
    approvalState === "IN_REVIEW"
  ) {
    return "PENDING_G5_APPROVAL";
  }

  if (approvalState === "CHANGES_REQUESTED") {
    return "REQUESTED_CHANGES";
  }

  if (approvalState === "REJECTED" || approvalState === "NOT_APPROVED" || approvalState === "DECLINED" || approvalState === "DENIED") {
    return "REJECTED";
  }

  switch (row.result) {
    case "PASS":
    case "PENDING_APPROVAL":
      return "PASS";
    case "BLOCK":
      return "BLOCK";
    case "NEEDS_EVIDENCE":
      return "NEEDS_EVIDENCE";
    case "MANUAL_ONLY":
      return "BLOCK";
    case "ERROR":
    default:
      return "ERROR";
  }
};

const getG4DisplayStatusLabel = (status: G4DisplayStatus) => {
  switch (status) {
    case "PASS":
      return "Ready for G5";
    case "PENDING_G5_APPROVAL":
      return "Sent to G5";
    case "REQUESTED_CHANGES":
      return "Changes requested";
    case "REJECTED":
      return "Rejected";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "BLOCK":
      return "Blocked";
    case "ERROR":
    default:
      return "Error";
  }
};

const getG4DisplayStatusToneClass = (status: G4DisplayStatus) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING_G5_APPROVAL":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "REQUESTED_CHANGES":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "ERROR":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const normalizeWebhookDisplayStatus = (status: string | null | undefined): G4DisplayStatus => {
  const normalized = status?.trim().toUpperCase() ?? "";

  switch (normalized) {
    case "PASS":
      return "PASS";
    case "APPROVED":
    case "PENDING_APPROVAL":
    case "PENDING_G5_APPROVAL":
    case "PENDING_HUMAN_APPROVAL":
    case "READY_FOR_APPROVAL":
    case "REVIEW_REQUESTED":
    case "IN_REVIEW":
      return "PENDING_G5_APPROVAL";
    case "CHANGES_REQUESTED":
    case "REQUEST_CHANGES":
    case "REQUESTED_CHANGES":
      return "REQUESTED_CHANGES";
    case "REJECTED":
    case "NOT_APPROVED":
    case "DECLINED":
    case "DENIED":
      return "REJECTED";
    case "NEEDS_EVIDENCE":
      return "NEEDS_EVIDENCE";
    case "BLOCK":
      return "BLOCK";
    case "MANUAL_ONLY":
      return "BLOCK";
    case "ERROR":
    default:
      return "ERROR";
  }
};

const getG4CardHelperCopy = (status: G4DisplayStatus) => {
  switch (status) {
    case "PASS":
      return "Content check passed. Send to G5 for human approval.";
    case "PENDING_G5_APPROVAL":
      return "Content has already been sent to G5 and is awaiting review. Use More actions to recreate or reject it.";
    case "REQUESTED_CHANGES":
      return "New version can be generated from this feedback.";
    case "REJECTED":
      return "This content was rejected and will not move to G5.";
    case "NEEDS_EVIDENCE":
      return "Add proof before this can continue.";
    case "BLOCK":
      return "Fix the issue before this can move forward.";
    case "ERROR":
    default:
      return "Unable to load content checks right now.";
  }
};

const getG4CardMainButtonLabel = (status: G4DisplayStatus) => {
  switch (status) {
    case "PASS":
      return "Send to G5 Approval";
    case "PENDING_G5_APPROVAL":
      return "Sent to G5";
    default:
      return "View Details";
  }
};

const getG4RecentRowActionLabel = (status: G4DisplayStatus) => {
  switch (status) {
    case "PASS":
      return "Send to G5 Approval";
    case "PENDING_G5_APPROVAL":
      return "Sent to G5";
    case "REQUESTED_CHANGES":
    case "REJECTED":
      return "View";
    case "NEEDS_EVIDENCE":
      return "Fix required";
    case "BLOCK":
    case "ERROR":
    default:
      return "View issue";
  }
};

const buildManualEditDraft = (row: G4RecentOutcome | null) =>
  row?.cleanAiOutput?.safeRewrite ??
  row?.contentPreview.captionPreview ??
  row?.contentPreview.contentText ??
  row?.contentPreview.pageText ??
  row?.whatHappened ??
  "";

type SourceContentSection = {
  label: string;
  value: string;
};

const buildRecentOutcomeStableKey = (row: G4RecentOutcome) => {
  const sourceId = normalizeRecentOutcomeKeyPart(row.assetId);
  const contentFingerprint = [
    row.contentPreview.headline,
    row.contentPreview.contentText,
    row.contentPreview.captionPreview,
    row.contentPreview.ctaText,
    row.contentPreview.landingPageUrl,
    row.contentPreview.pageText,
    row.contentPreview.productName,
    row.contentPreview.cleanSummary,
    row.contentPreview.contentRecommendation,
    row.contentPreview.hookAngle,
    row.platform,
  ]
    .map((value) => normalizeRecentOutcomeKeyPart(value))
    .filter(Boolean)
    .join("||");

  if (contentFingerprint) {
    return contentFingerprint;
  }

  if (sourceId) {
    return sourceId;
  }

  return contentFingerprint || normalizeRecentOutcomeKeyPart(row.reviewId) || normalizeRecentOutcomeKeyPart(row.time);
};

const dedupeRecentOutcomes = (rows: G4RecentOutcome[]) => {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = buildRecentOutcomeStableKey(row);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getPlatformLabel = (platform: string | null) => {
  const normalized = platform?.trim().toUpperCase() ?? "";
  if (normalized === "TIKTOK") {
    return "TikTok";
  }

  if (normalized === "INSTAGRAM") {
    return "Instagram";
  }

  return platform?.trim() || "Not available";
};

function TikTokIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0", className)} aria-hidden="true">
      <Music2 className="absolute inset-0 translate-x-[1px] translate-y-[-1px] size-4 text-cyan-400/90" />
      <Music2 className="absolute inset-0 -translate-x-[1px] translate-y-[1px] size-4 text-rose-500/90" />
      <Music2 className="relative size-4 text-foreground" />
    </span>
  );
}

function PlatformIcon({ platform, className }: { platform: string | null; className?: string }) {
  const normalized = platform?.trim().toUpperCase() ?? "";

  if (normalized === "INSTAGRAM") {
    return <Instagram className={cn("size-4 shrink-0", className)} aria-hidden="true" />;
  }

  if (normalized === "TIKTOK") {
    return <TikTokIcon className={className} />;
  }

  return <CircleHelp className={cn("size-4 shrink-0", className)} aria-hidden="true" />;
}

function TrendMetricChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

const parseMetrics = (preview: Pick<G4RecentOutcome["contentPreview"], "views" | "likes" | "shares" | "trendStrength" | "brandFitScore" | "contentText" | "profileUsername" | "audioSound" | "comments">) => {
  const t = [preview.contentText, preview.comments, preview.profileUsername, preview.audioSound].filter(Boolean).join(" ");
  const extract = (regex: RegExp) => {
    const match = t.match(regex);
    return match ? match[1] : null;
  };
  
  const views = preview.views || extract(/(\d+[\d.,]*\w*)\s+views/i);
  const likes = preview.likes || extract(/(\d+[\d.,]*\w*)\s+likes/i);
  const shares = preview.shares || extract(/(\d+[\d.,]*\w*)\s+shares/i);
  const comments = preview.comments || extract(/(\d+[\d.,]*\w*)\s+comments/i);
  const trendStrength = preview.trendStrength || extract(/trend strength\s+(\d+[\d.,]*\w*)/i);
  const brandFit = preview.brandFitScore || extract(/brand fit\s+(\d+[\d.,]*\w*)/i);
  const handle = preview.profileUsername || extract(/handle\s+(\w+)/i) || "—";
  const audio = preview.audioSound || extract(/audio\s+(.+?)(?:;|,|$)/i) || "—";
  
  return { views, likes, shares, comments, trendStrength, brandFit, handle, audio };
};

function PlatformPill({ platform, className }: { platform: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary shadow-sm",
        className,
      )}
    >
      <PlatformIcon platform={platform} className="text-primary" />
      <span>{getPlatformLabel(platform)}</span>
    </div>
  );
}

const isRiskyRewriteLanguage = (value: string | null) => Boolean(value && REQUIRED_COPY_WARNING_TERMS.test(value));

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
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

function FieldBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[22px] border border-border/60 bg-white p-4 shadow-sm", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

function SourceDataTile({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-[16px] border border-border/60 bg-[#faf7f0] p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-2 break-words text-[1.02rem] font-semibold leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

const formatCompactMetricValue = (value: string | null) => {
  if (!value) {
    return "Not available";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Not available";
  }

  if (/^[0-9,]+(?:\.[0-9]+)?$/.test(trimmed)) {
    const numeric = Number(trimmed.replace(/,/g, ""));
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(numeric);
    }
  }

  return trimmed;
};

const formatSourceAudioName = (value: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^original sound\b/i.test(trimmed)) {
    return "original sound";
  }

  return trimmed;
};

const getUniqueSourceContentSections = (
  preview: Pick<
    G4RecentOutcome["contentPreview"],
    "headline" | "captionPreview" | "contentText" | "contentRecommendation" | "cleanSummary" | "hookAngle" | "pageText" | "ctaText"
  >,
) => {
  const candidates: Array<SourceContentSection & { order: number }> = [
    { label: "Headline", value: preview.headline ?? "", order: 0 },
    { label: "Caption", value: preview.captionPreview ?? "", order: 1 },
    { label: "Content text", value: preview.contentText ?? "", order: 2 },
    { label: "Content recommendation", value: preview.contentRecommendation ?? "", order: 3 },
    { label: "Clean summary", value: preview.cleanSummary ?? "", order: 4 },
    { label: "Hook angle", value: preview.hookAngle ?? "", order: 5 },
    { label: "Page text", value: preview.pageText ?? "", order: 6 },
    { label: "Call to action", value: preview.ctaText ?? "", order: 7 },
  ];

  const seen = new Set<string>();

  return candidates
    .map(({ label, value, order }) => ({
      label,
      value: value.trim(),
      order,
    }))
    .filter((c) => {
      if (!c.value) return false;
      const key = `${c.label}:${c.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map(({ label, value }) => ({ label, value }));
};

const getSourceCaptionText = (
  preview: Pick<
    G4RecentOutcome["contentPreview"],
    "headline" | "captionPreview" | "contentText" | "contentRecommendation" | "cleanSummary" | "hookAngle" | "pageText" | "ctaText"
  >,
) => {
  const captionPreview = preview.captionPreview?.trim();
  if (captionPreview) {
    return captionPreview;
  }

  const contentText = preview.contentText?.trim();
  if (contentText) {
    return contentText;
  }

  const pageText = preview.pageText?.trim();
  if (pageText) {
    return pageText;
  }

  const cleanSummary = preview.cleanSummary?.trim();
  if (cleanSummary) {
    return cleanSummary;
  }

  return null;
};

function PendingApprovalCard({
  row,
  displayStatus,
  onSendToG5Approval,
  onViewDetails,
  onRecreateContent,
  onRejectContent,
  isBusy,
}: {
  row: G4RecentOutcome;
  displayStatus: G4DisplayStatus;
  onSendToG5Approval: (row: G4RecentOutcome) => void;
  onViewDetails: () => void;
  onRecreateContent: (row: G4RecentOutcome) => void;
  onRejectContent: (row: G4RecentOutcome) => void;
  isBusy: boolean;
}) {
  const selectedCaption = row.cleanAiOutput?.captionSuggestions?.[0] ?? row.contentPreview.captionPreview ?? row.contentPreview.contentText ?? null;
  const selectedHook = row.cleanAiOutput?.hookSuggestions?.[0] ?? row.contentPreview.hookAngle ?? row.contentPreview.contentRecommendation ?? null;
  const reviewAssetKey = getReviewAssetKey(row.reviewId, row.assetId);
  const canSendToG5 = displayStatus === "PASS" && Boolean(reviewAssetKey && selectedCaption && selectedHook);
  const isSentToG5 = displayStatus === "PENDING_G5_APPROVAL";
  const areContentActionsLocked = isBusy || isSentToG5;
  const mainButtonLabel = getG4CardMainButtonLabel(displayStatus);
  const helperCopy = getG4CardHelperCopy(displayStatus);

  return (
    <div className="flex h-full flex-col rounded-[22px] border border-border/60 bg-white shadow-sm">
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="flex flex-col p-4 md:max-w-[220px] md:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/20">
              <PlatformIcon platform={row.platform} className="text-foreground" />
            </div>
            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG4DisplayStatusToneClass(displayStatus))}>
              {getG4DisplayStatusLabel(displayStatus)}
            </Badge>
          </div>

          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{helperCopy}</p>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            {displayStatus === "PASS" || displayStatus === "PENDING_G5_APPROVAL" ? (
              <Button
                type="button"
                size="sm"
                className={cn("h-8 w-full rounded-full text-[11px] font-medium", displayStatus !== "PASS" && "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100")}
                variant={displayStatus === "PASS" ? "default" : "outline"}
                disabled={!canSendToG5 || isBusy || displayStatus !== "PASS"}
                onClick={() => onSendToG5Approval(row)}
              >
                {isBusy ? "Sending to G5..." : mainButtonLabel}
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="group h-8 w-full rounded-full border-border/70 bg-white text-[11px] font-medium"
              onClick={onViewDetails}
            >
              View Details
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-full rounded-full border-border/70 bg-white text-[11px] font-medium"
                  disabled={areContentActionsLocked}
                >
                  More actions
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[14rem] rounded-[18px] border-border/60 bg-white p-1 shadow-lg">
                <DropdownMenuItem
                  className="rounded-[14px] px-3 py-2 text-sm"
                  disabled={areContentActionsLocked}
                  onSelect={(event) => {
                    event.preventDefault();
                    onRecreateContent(row);
                  }}
                >
                  Recreate content
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  variant="destructive"
                  className="rounded-[14px] px-3 py-2 text-sm"
                  disabled={areContentActionsLocked}
                  onSelect={(event) => {
                    event.preventDefault();
                    onRejectContent(row);
                  }}
                >
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {(row.cleanAiOutput?.captionSuggestions?.length || row.cleanAiOutput?.hookSuggestions?.length) ? (
          <div className="flex flex-1 flex-col gap-2.5 border-t border-border/50 p-4 md:border-t-0 md:border-l">
            <div className="flex items-center justify-between gap-2">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Caption Suggestions</p>
              {row.cleanAiOutput.captionSuggestions.length ? (
                <CopyButton label="Copy" text={row.cleanAiOutput.captionSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
              ) : null}
            </div>
            {row.cleanAiOutput.captionSuggestions.length ? (
              <div className="space-y-1.5">
                <ul className="space-y-1">
                  {row.cleanAiOutput.captionSuggestions.map((item, index) => (
                    <li
                      key={`cap-${index}`}
                      className={cn(
                        "rounded-xl border px-2.5 py-1.5 text-xs leading-5 text-foreground",
                        index === 0 ? "border-primary/25 bg-primary/5" : "border-border/50 bg-muted/10",
                      )}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {row.cleanAiOutput.hookSuggestions.length ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Hooks</p>
                  <CopyButton label="Copy" text={row.cleanAiOutput.hookSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                </div>
                <ul className="space-y-1">
                  {row.cleanAiOutput.hookSuggestions.map((item, index) => (
                    <li
                      key={`hook-${index}`}
                      className={cn(
                        "rounded-xl border px-2.5 py-1.5 text-xs leading-5 text-foreground",
                        index === 0 ? "border-primary/25 bg-primary/5" : "border-border/50 bg-muted/10",
                      )}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}



function PendingApprovalDetailsDialog({
  row,
  open,
  onOpenChange,
  displayStatus,
  isBusy,
  onSendToG5Approval,
  onRejectContent,
  onManualEditCheck,
}: {
  row: G4RecentOutcome | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayStatus: G4DisplayStatus;
  isBusy: boolean;
  onSendToG5Approval: (row: G4RecentOutcome) => Promise<G4WebhookResponse | null>;
  onRejectContent: (row: G4RecentOutcome) => void;
  onManualEditCheck: (row: G4RecentOutcome, contentText: string) => Promise<G4WebhookResponse | null>;
}) {
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualEditDraft, setManualEditDraft] = useState(buildManualEditDraft(row));
  const [manualEditSubmitting, setManualEditSubmitting] = useState(false);
  const [manualEditValidated, setManualEditValidated] = useState(false);
  const sourceUrl = row?.contentPreview.sourceUrl ?? row?.contentPreview.landingPageUrl;
  const sourceCaption = row ? getSourceCaptionText(row.contentPreview) : null;

  useEffect(() => {
    if (!row) {
      setManualEditOpen(false);
      setManualEditDraft("");
      setManualEditSubmitting(false);
      setManualEditValidated(false);
      return;
    }

    setManualEditOpen(false);
    setManualEditDraft(buildManualEditDraft(row));
    setManualEditSubmitting(false);
    setManualEditValidated(displayStatus === "PASS");
  }, [displayStatus, row]);

  const handleManualEditToggle = () => {
    setManualEditOpen((current) => {
      const next = !current;
      if (next) {
        setManualEditValidated(false);
      }
      return next;
    });
  };

  if (!row) {
    return null;
  }

  const hasManualRiskWarning = isRiskyRewriteLanguage(manualEditDraft);
  const selectedCaption = row.cleanAiOutput?.captionSuggestions?.[0] ?? row.contentPreview.captionPreview ?? row.contentPreview.contentText ?? null;
  const selectedHook = row.cleanAiOutput?.hookSuggestions?.[0] ?? row.contentPreview.hookAngle ?? row.contentPreview.contentRecommendation ?? null;
  const reviewAssetKey = getReviewAssetKey(row.reviewId, row.assetId);
  const canSendToG5 = displayStatus === "PASS" && Boolean(reviewAssetKey && selectedCaption && selectedHook);
  const sendToG5Disabled = isBusy || !canSendToG5 || displayStatus !== "PASS";

  const handleManualEditCheck = async () => {
    const draft = manualEditDraft.trim();
    if (!draft) {
      toast.error("Add content before checking.");
      return;
    }

    setManualEditSubmitting(true);
    try {
      const response = await onManualEditCheck(row, draft);
      if (!response || response.status === "ERROR") {
        setManualEditValidated(false);
        throw new Error(response?.message || "Unable to check edited content.");
      }

      setManualEditValidated(response.status === "PASS");
      toast.success("Edited content checked");
    } catch (error) {
      setManualEditValidated(false);
      const message = error instanceof Error ? error.message : "Action failed. Please try again.";
      toast.error(message);
    } finally {
      setManualEditSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,108rem)] max-w-none sm:max-w-none overflow-hidden rounded-[32px] border-border/60 bg-white p-0 shadow-2xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-5 text-left">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle className="font-serif text-2xl tracking-tight text-primary">View Details</DialogTitle>
                <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Review original content on the left alongside AI-generated safety notes and rewrite suggestions on the right. Use this view to ensure captions and claims meet compliance guidelines before moving forward.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid flex-1 min-h-0 gap-4 overflow-y-auto px-6 py-6 xl:grid-cols-[minmax(18rem,1fr)_minmax(22rem,1.25fr)]">
            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-xl tracking-tight text-primary">Original Post Data</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The original post fields captured when this row was reviewed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[22px] border border-border/60 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Caption</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground text-pretty">
                    {sourceCaption ?? "Not available"}
                  </p>
                </div>

                <div className="rounded-[22px] border border-border/60 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Metrics</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <SourceDataTile label="Views" value={formatCompactMetricValue(row.contentPreview.views)} />
                    <SourceDataTile label="Likes" value={formatCompactMetricValue(row.contentPreview.likes)} />
                    <SourceDataTile label="Comments" value={formatCompactMetricValue(row.contentPreview.comments)} />
                    <SourceDataTile label="Shares" value={formatCompactMetricValue(row.contentPreview.shares)} />
                    <SourceDataTile label="Trend strength" value={formatCompactMetricValue(row.contentPreview.trendStrength)} />
                    <SourceDataTile label="Brand fit" value={formatCompactMetricValue(row.contentPreview.brandFitScore)} />
                    <SourceDataTile label="Risk" value={formatCompactMetricValue(row.contentPreview.riskScore)} />
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/60 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Original post data</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <SourceDataTile
                      label="Handle"
                      value={row.contentPreview.profileUsername ?? "Not available"}
                    />
                    <SourceDataTile label="Audio" value={formatSourceAudioName(row.contentPreview.audioSound) ?? "original sound"} />
                  </div>
                  <div className="mt-3">
                    {sourceUrl ? (
                      <Button asChild variant="outline" className="h-10 w-full rounded-[14px] border-border/70 bg-white px-4 text-sm font-semibold shadow-none">
                        <a href={sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 size-4" />
                          Open Original Post
                        </a>
                      </Button>
                    ) : (
                      <p className="text-xs leading-5 text-muted-foreground">Source link not available from this review record.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="font-serif text-xl tracking-tight text-primary">AI notes</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      Review the generated guidance before sending this item forward.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton label="Copy safe rewrite" text={row.cleanAiOutput?.safeRewrite ?? null} />
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none" onClick={handleManualEditToggle}>
                      <PencilLine />
                      Edit manually
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {row.cleanAiOutput ? (
                  <>
                    <FieldBlock
                      label="Risk summary"
                      value={row.cleanAiOutput.riskSummary ?? "No risk summary provided."}
                      className="bg-muted/10 shadow-none"
                    />
                    <FieldBlock
                      label="Safe rewrite"
                      value={row.cleanAiOutput.safeRewrite ?? "No safe rewrite provided."}
                      className="bg-muted/10 shadow-none"
                    />
                    {manualEditOpen ? (
                      <div className="space-y-3 rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Edit manually</p>
                          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", manualEditValidated ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700")}>
                            {manualEditValidated ? "Edited PASS" : "Needs check"}
                          </Badge>
                        </div>
                        <Textarea
                          value={manualEditDraft}
                          onChange={(event) => {
                            setManualEditDraft(event.target.value);
                            setManualEditValidated(false);
                          }}
                          rows={8}
                          className="min-h-[220px] rounded-[20px] border-border/70 bg-muted/10 text-sm leading-6"
                          placeholder="Edit the caption here"
                        />
                        {hasManualRiskWarning ? (
                          <div className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                            <p className="text-sm leading-6 text-amber-950">
                              This edited caption still looks risky. Review it carefully before checking again.
                            </p>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm leading-6 text-muted-foreground">
                            Re-run G4 on this edited caption. Send to G5 only after the edited version returns PASS.
                          </p>
                          <Button
                            type="button"
                            className="h-10 rounded-full px-5"
                            onClick={() => void handleManualEditCheck()}
                            disabled={manualEditSubmitting || !manualEditDraft.trim()}
                          >
                            <RefreshCcw className={cn(manualEditSubmitting && "animate-spin")} />
                            {manualEditSubmitting ? "Checking content..." : "Check edited content"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <FieldBlock
                      label="Human review recommendation"
                      value={row.cleanAiOutput.humanReviewRecommendation ?? "No human review recommendation provided."}
                      className="bg-muted/10 shadow-none"
                    />
                    <div className="space-y-2 rounded-[22px] border border-border/60 bg-muted/10 p-4 shadow-none">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claim notes</p>
                      {row.cleanAiOutput.claimNotes.length ? (
                        <ul className="space-y-2">
                          {row.cleanAiOutput.claimNotes.map((note, index) => (
                            <li key={`${note}-${index}`} className="rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm leading-6 text-foreground">
                              {note}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">No claim notes provided.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">No AI notes are available for this check.</p>
                )}
              </CardContent>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
                <Button
                  type="button"
                  className="h-9 rounded-full px-4"
                  disabled={sendToG5Disabled}
                  onClick={() => void onSendToG5Approval(row)}
                >
                  {displayStatus === "PENDING_G5_APPROVAL" ? "Sent to G5" : "Send to G5 Approval"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-border/70 bg-white px-4 text-sm font-medium shadow-none"
                  onClick={handleManualEditToggle}
                >
                  Edit Manually
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-rose-200 bg-white px-4 text-sm font-medium text-rose-700 shadow-none hover:bg-rose-50 hover:text-rose-800"
                  disabled={isBusy}
                  onClick={() => void onRejectContent(row)}
                >
                  Reject
                </Button>
              </div>
            </Card>


          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({
  label,
  text,
  className,
}: {
  label: string;
  text: string | null;
  className?: string;
}) {
  const handleCopy = async () => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none", className)}
      onClick={() => void handleCopy()}
      disabled={!text}
    >
      <Copy className="size-3.5" />
      {label}
    </Button>
  );
}

export default function G4ContentClaimCheckPage({ detail }: G4ContentClaimCheckPageProps) {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const request = authFetch ?? fetch;
  const latestOutcome = detail.latestOutcome;
  const recentOutcomes = dedupeRecentOutcomes(detail.recentOutcomes);

  const [selectedDetailRow, setSelectedDetailRow] = useState<G4RecentOutcome | null>(null);
  const [selectedRecentRow, setSelectedRecentRow] = useState<G4RecentOutcome | null>(null);
  const [selectedCaptionHookRow, setSelectedCaptionHookRow] = useState<G4RecentOutcome | null>(null);
  const [rowStatusOverrides, setRowStatusOverrides] = useState<Record<string, G4DisplayStatus>>({});
  const [rowFeedbackNotes, setRowFeedbackNotes] = useState<Record<string, string>>({});
  const [actioningRowKey, setActioningRowKey] = useState<string | null>(null);
  const [actioningTask, setActioningTask] = useState<G4ActionTask | null>(null);
  const [rejectingRow, setRejectingRow] = useState<G4RecentOutcome | null>(null);

  const getActorLabel = useCallback(() => user?.email?.trim() || user?.id?.trim() || "admin", [user?.email, user?.id]);

  const getRowKey = useCallback((row: G4RecentOutcome) => getReviewAssetKey(row.reviewId, row.assetId) ?? getRecentOutcomeKey(row) ?? row.time, []);

  const resolveRowDisplayStatus = useCallback(
    (row: G4RecentOutcome) => {
      const rowKey = getRowKey(row);
      return getRowDisplayStatus(row, rowKey ? rowStatusOverrides[rowKey] ?? null : null);
    },
    [getRowKey, rowStatusOverrides],
  );

  const getSelectedCaption = useCallback(
    (row: G4RecentOutcome) =>
      row.cleanAiOutput?.safeRewrite ??
      row.cleanAiOutput?.captionSuggestions?.[0] ??
      row.contentPreview.captionPreview ??
      row.contentPreview.contentText ??
      row.contentPreview.pageText ??
      row.contentPreview.cleanSummary ??
      null,
    [],
  );

  const getSelectedHook = useCallback(
    (row: G4RecentOutcome) =>
      row.cleanAiOutput?.hookSuggestions?.[0] ??
      row.contentPreview.hookAngle ??
      row.contentPreview.contentRecommendation ??
      row.contentPreview.headline ??
      row.contentPreview.cleanSummary ??
      null,
    [],
  );

  const getOriginalCaption = useCallback(
    (row: G4RecentOutcome) => row.contentPreview.captionPreview ?? row.contentPreview.contentText ?? row.contentPreview.cleanSummary ?? null,
    [],
  );

  const getCurrentContentText = useCallback(
    (row: G4RecentOutcome) => row.cleanAiOutput?.safeRewrite ?? row.contentPreview.contentText ?? row.contentPreview.captionPreview ?? row.contentPreview.pageText ?? row.whatHappened ?? null,
    [],
  );

  const getSourcePlatform = useCallback((row: G4RecentOutcome) => row.sourcePlatform ?? row.platform ?? "WEBSITE", []);

  const getSourceEvent = useCallback((row: G4RecentOutcome) => row.sourceEvent ?? "G4_CONTENT_RECHECK", []);

  const markRowStatus = useCallback(
    (row: G4RecentOutcome, status: G4DisplayStatus, feedbackNote?: string | null) => {
      const rowKey = getRowKey(row);
      setRowStatusOverrides((current) => ({ ...current, [rowKey]: status }));
      if (feedbackNote !== undefined) {
        setRowFeedbackNotes((current) => ({ ...current, [rowKey]: feedbackNote ?? "" }));
      }
    },
    [getRowKey],
  );

  const callG4Webhook = useCallback(
    async (path: string, payload: Record<string, unknown>) => {
      const response = await request(path, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await parseJsonResponse<G4WebhookResponse>(response);
      if (!response.ok || !body || body.status === "ERROR") {
        throw new Error(body?.message || `Request failed (${response.status}).`);
      }

      return body;
    },
    [request],
  );

  const handleSendToG5Approval = useCallback(
    async (row: G4RecentOutcome) => {
      const rowKey = getRowKey(row);
      const selectedCaption = getSelectedCaption(row);
      const selectedHook = getSelectedHook(row);
      if (!row.reviewId || !row.assetId || !selectedCaption || !selectedHook) {
        toast.error("Action failed. Please try again.");
        return null;
      }

      if (actioningRowKey === rowKey) {
        return null;
      }

      setActioningRowKey(rowKey);
      setActioningTask("SEND_TO_G5_APPROVAL");
      try {
        const body = await callG4Webhook("/api/admin/workflow-dashboard/g4/user-action", {
          action_type: "SEND_TO_G5_APPROVAL",
          review_id: row.reviewId,
          asset_id: row.assetId,
          actor: getActorLabel(),
          selected_caption: selectedCaption,
          selected_hook: selectedHook,
          platform: row.platform,
        });

        markRowStatus(row, "PENDING_G5_APPROVAL");
        toast.success(body.message || "Sent to G5 Approval");
        router.refresh();
        return body;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed. Please try again.";
        toast.error(message);
        return null;
      } finally {
        setActioningRowKey((current) => (current === rowKey ? null : current));
        setActioningTask((current) => (current === "SEND_TO_G5_APPROVAL" ? null : current));
      }
    },
    [actioningRowKey, callG4Webhook, getActorLabel, getRowKey, getSelectedCaption, getSelectedHook, markRowStatus, router],
  );

  const openRejectConfirm = useCallback(
    (row: G4RecentOutcome) => {
      if (resolveRowDisplayStatus(row) === "PENDING_G5_APPROVAL") {
        return;
      }
      setSelectedDetailRow(null);
      setSelectedRecentRow(null);
      setSelectedCaptionHookRow(null);
      setRejectingRow(row);
    },
    [resolveRowDisplayStatus],
  );

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingRow) {
      return null;
    }

    const row = rejectingRow;
    if (resolveRowDisplayStatus(row) === "PENDING_G5_APPROVAL") {
      return null;
    }

    const rowKey = getRowKey(row);
    if (actioningRowKey === rowKey) {
      return null;
    }

    setActioningRowKey(rowKey);
    setActioningTask("REJECT_CONTENT");
    try {
      const body = await callG4Webhook("/api/admin/workflow-dashboard/g4/user-action", {
        action_type: "REJECT_CONTENT",
        review_id: row.reviewId,
        asset_id: row.assetId,
        actor: getActorLabel(),
        rejection_reason: null,
        platform: row.platform,
      });

      markRowStatus(row, "REJECTED");
      toast.success("Content rejected");
      setRejectingRow(null);
      router.refresh();
      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed. Please try again.";
      toast.error(message);
      return null;
    } finally {
      setActioningRowKey((current) => (current === rowKey ? null : current));
      setActioningTask((current) => (current === "REJECT_CONTENT" ? null : current));
    }
  }, [actioningRowKey, callG4Webhook, getActorLabel, getRowKey, markRowStatus, rejectingRow, resolveRowDisplayStatus, router]);

  const handleRecreateContent = useCallback(
    async (row: G4RecentOutcome) => {
      const rowKey = getRowKey(row);
      if (!row.assetId) {
        toast.error("Action failed. Please try again.");
        return null;
      }

      if (resolveRowDisplayStatus(row) === "PENDING_G5_APPROVAL") {
        return null;
      }

      if (actioningRowKey === rowKey) {
        return null;
      }

      setActioningRowKey(rowKey);
      setActioningTask("RECREATE_CONTENT");
      try {
        const feedbackNote = rowFeedbackNotes[rowKey] ?? undefined;
        const body = await callG4Webhook("/api/admin/workflow-dashboard/g4/user-action", {
          action_type: "RECREATE_CONTENT",
          review_id: row.reviewId,
          asset_id: row.assetId,
          source_platform: getSourcePlatform(row),
          source_event: getSourceEvent(row),
          platform: row.platform,
          original_post_caption: getOriginalCaption(row) ?? "",
          content_text: getCurrentContentText(row) ?? "",
          feedback_note: feedbackNote,
          actor: getActorLabel(),
        });

        const nextStatus = normalizeWebhookDisplayStatus(body.status);
        if (nextStatus !== "ERROR") {
          markRowStatus(row, nextStatus);
        }
        toast.success(body.message || "Content recreated and ready for G5.");
        router.refresh();
        return body;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed. Please try again.";
        toast.error(message);
        return null;
      } finally {
        setActioningRowKey((current) => (current === rowKey ? null : current));
        setActioningTask((current) => (current === "RECREATE_CONTENT" ? null : current));
      }
    },
    [
      actioningRowKey,
      callG4Webhook,
      getActorLabel,
      getCurrentContentText,
      getOriginalCaption,
      getRowKey,
      getSourceEvent,
      getSourcePlatform,
      markRowStatus,
      rowFeedbackNotes,
      resolveRowDisplayStatus,
      router,
    ],
  );

  const readyRows = recentOutcomes
    .map((row) => {
      const displayStatus = resolveRowDisplayStatus(row);
      const canSendToG5 = Boolean(displayStatus === "PASS" && getReviewAssetKey(row.reviewId, row.assetId) && getSelectedCaption(row) && getSelectedHook(row));

      return { row, displayStatus, canSendToG5 };
    })
    .filter(({ displayStatus }) => displayStatus === "PENDING_G5_APPROVAL" || displayStatus === "PASS")
    .slice(0, 3);

  const selectedDetailDisplayStatus = selectedDetailRow ? resolveRowDisplayStatus(selectedDetailRow) : "ERROR";
  const selectedDetailBusy = selectedDetailRow ? actioningRowKey === getRowKey(selectedDetailRow) : false;
  const rejectingBusy = rejectingRow ? actioningRowKey === getRowKey(rejectingRow) : false;

  return (
    <>
      <WorkflowDashboardShell
        eyebrow="Workflow"
        title={detail.title}
        description={detail.purpose}
        titleContainerClassName="lg:max-w-none"
        titleClassName="lg:whitespace-nowrap"
        descriptionClassName="lg:max-w-none lg:whitespace-nowrap"
      >
        {detail.status === "ERROR" ? (
          <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
            <CardContent className="p-5 text-sm leading-6 text-rose-900">{detail.actionNeeded}</CardContent>
          </Card>
        ) : null}

        {readyRows.length ? (
          <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm">
            <Carousel
              opts={{ align: "start", loop: readyRows.length > 1 }}
              className="relative w-full"
              aria-label="Content Ready For G5 carousel"
            >
              <CardHeader className="gap-2 pb-4">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Content Ready For G5</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {readyRows.length} check{readyRows.length === 1 ? "" : "s"} are ready or already sent to G5. Swipe the carousel or use the arrows to review the handoff or AI notes.
                </CardDescription>
                {readyRows.length > 1 ? (
                  <CardAction className="self-start pt-1 sm:self-auto">
                    <ReadyRowsCarouselControls />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0">
                <CarouselContent className="h-full min-h-0">
                  {readyRows.map(({ row, displayStatus }) => (
                    <CarouselItem key={`${row.time}-${row.reviewId ?? row.assetId ?? row.platform ?? "pending"}`} className="basis-full lg:basis-1/2">
                      <PendingApprovalCard
                        row={row}
                        displayStatus={displayStatus}
                        onSendToG5Approval={(targetRow) => void handleSendToG5Approval(targetRow)}
                        onViewDetails={() => setSelectedDetailRow(row)}
                        onRecreateContent={(targetRow) => void handleRecreateContent(targetRow)}
                        onRejectContent={(targetRow) => openRejectConfirm(targetRow)}
                        isBusy={actioningRowKey === getRowKey(row)}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </CardContent>
            </Carousel>
          </Card>
        ) : null}

        <Card id="recent-checks" className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Checks</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">Compact history of the latest G4 checks.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOutcomes.length ? (
              <div className="overflow-hidden rounded-[24px] border border-border/60 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px] table-fixed">
                    <colgroup>
                      <col className="w-[140px]" />
                      <col className="w-[80px]" />
                      <col />
                      <col className="w-[200px]" />
                      <col className="w-[160px]" />
                      <col className="w-[160px]" />
                      <col className="w-[180px]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Date</TableHead>
                        <TableHead className="px-4 text-center">Platform</TableHead>
                        <TableHead className="px-4 text-left">Content summary</TableHead>
                        <TableHead className="px-4 text-center">Original Post Data</TableHead>
                        <TableHead className="px-4 text-center">AI Insight</TableHead>
                        <TableHead className="px-4">Status</TableHead>
                        <TableHead className="px-4">Action Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOutcomes.map((row) => {
                        const rowDisplayStatus = resolveRowDisplayStatus(row);
                        const rowKey = getRowKey(row);
                        const rowBusy = actioningRowKey === rowKey;
                        const rowCanSendToG5 = Boolean(
                          rowDisplayStatus === "PASS" &&
                            getReviewAssetKey(row.reviewId, row.assetId) &&
                            getSelectedCaption(row) &&
                            getSelectedHook(row),
                        );
                        const formattedDate = row.time
                          ? new Date(row.time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—";
                        const formattedTime = row.time
                          ? new Date(row.time).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
                          : "";
                        const hasSuggestions = Boolean(row.cleanAiOutput?.captionSuggestions?.length || row.cleanAiOutput?.hookSuggestions?.length);

                        const isSourcePostOpen = selectedRecentRow === row;
                        const isAiInsightOpen = selectedCaptionHookRow === row;

                        return (
                          <Fragment key={`${row.time}-${row.reviewId ?? row.assetId ?? row.platform ?? "g4"}`}>
                            <TableRow className={cn((isSourcePostOpen || isAiInsightOpen) && "border-b-0 hover:bg-transparent")}>
                              <TableCell className="px-4 py-3 align-middle">
                                <div className="text-sm text-foreground">{formattedDate}</div>
                                {formattedTime ? <div className="text-xs text-muted-foreground">{formattedTime}</div> : null}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <div className="mx-auto flex size-8 items-center justify-center rounded-md border border-border/60 bg-muted/20">
                                  <PlatformIcon platform={row.platform} className="text-foreground" />
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <p className="line-clamp-2 text-sm leading-5 text-foreground">{row.whatHappened}</p>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "mx-auto h-9 w-max justify-center whitespace-nowrap rounded-full border-border/70 bg-white px-3 text-left text-xs font-semibold text-foreground shadow-none hover:bg-muted/50",
                                    isSourcePostOpen && "bg-muted/50",
                                  )}
                                  onClick={() => {
                                    setSelectedRecentRow(isSourcePostOpen ? null : row);
                                    if (!isSourcePostOpen) {
                                      setSelectedCaptionHookRow(null);
                                    }
                                  }}
                                >
                                  <Database className="mr-2 size-3.5 text-muted-foreground" />
                                  {isSourcePostOpen ? "Hide Original Post Data" : "Original Post Data"}
                                </Button>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!hasSuggestions}
                                  className={cn(
                                    "mx-auto h-9 w-max justify-center whitespace-nowrap rounded-full border-sky-200 bg-sky-50 px-3 text-left text-xs font-semibold text-sky-700 shadow-none hover:bg-sky-100",
                                    isAiInsightOpen && "bg-sky-100",
                                  )}
                                  onClick={() => {
                                    setSelectedCaptionHookRow(isAiInsightOpen ? null : row);
                                    if (!isAiInsightOpen) {
                                      setSelectedRecentRow(null);
                                    }
                                  }}
                                >
                                  <Sparkles className="mr-2 size-3.5 text-sky-500" />
                                  {isAiInsightOpen ? "Hide AI Insight" : "AI Insight"}
                                </Button>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG4DisplayStatusToneClass(rowDisplayStatus))}>
                                  {getG4DisplayStatusLabel(rowDisplayStatus)}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                {rowDisplayStatus === "PASS" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 w-full rounded-full text-[11px] font-medium"
                                    disabled={rowBusy || !rowCanSendToG5}
                                    onClick={() => void handleSendToG5Approval(row)}
                                  >
                                    {rowBusy && actioningTask === "SEND_TO_G5_APPROVAL" ? "Sending to G5..." : "Send to G5 Approval"}
                                  </Button>
                                ) : rowDisplayStatus === "PENDING_G5_APPROVAL" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full rounded-full border-sky-200 bg-sky-50 text-[11px] font-medium text-sky-700 shadow-none"
                                    disabled
                                  >
                                    Sent to G5
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full rounded-full border-border/70 text-[11px] font-medium"
                                    disabled={rowBusy}
                                    onClick={() => setSelectedDetailRow(row)}
                                  >
                                    {getG4RecentRowActionLabel(rowDisplayStatus)}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {isSourcePostOpen ? (
                              <TableRow className="border-b-0 hover:bg-transparent">
                                <TableCell colSpan={7} className="p-4 pt-0">
                                  <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                      <Database className="size-4 text-muted-foreground" />
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Original Post Data</p>
                                    </div>
                                    <div className="space-y-4">
                                      <div className="flex flex-col gap-3">
                                        {getUniqueSourceContentSections(row.contentPreview).map((section) => (
                                          <div key={`${section.label}-${section.value}`} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{section.label}</p>
                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{section.value}</p>
                                          </div>
                                        ))}
                                      </div>
                                      {(() => {
                                        const metrics = parseMetrics(row.contentPreview);
                                        const hasAnyMetric = metrics.views || metrics.likes || metrics.shares || metrics.trendStrength || metrics.brandFit || row.contentPreview.sourceUrl;

                                        return (
                                          <>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <TrendMetricChip label="Handle" value={metrics.handle} />
                                              <TrendMetricChip label="Audio" value={metrics.audio} />
                                            </div>
                                            {hasAnyMetric ? (
                                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                                                <TrendMetricChip label="Views" value={metrics.views || "—"} />
                                                <TrendMetricChip label="Likes" value={metrics.likes || "—"} />
                                                <TrendMetricChip label="Shares" value={metrics.shares || "—"} />
                                                <TrendMetricChip label="Trend Strength" value={metrics.trendStrength || "—"} />
                                                <TrendMetricChip label="Brand Fit" value={metrics.brandFit || "—"} />
                                                <div className="flex min-w-0 items-stretch">
                                                  {row.contentPreview.sourceUrl ? (
                                                    <Button asChild variant="outline" className="h-full w-full rounded-xl border-border/70 bg-white px-4 text-xs font-semibold shadow-none">
                                                      <a href={row.contentPreview.sourceUrl} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="mr-2 size-3.5" />
                                                        Open Original Post
                                                      </a>
                                                    </Button>
                                                  ) : (
                                                    <div className="flex h-full min-h-[56px] w-full items-center rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
                                                      <p className="text-xs leading-5 text-muted-foreground">URL not available</p>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ) : null}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                            {isAiInsightOpen ? (
                              <TableRow className="border-b-0 hover:bg-transparent">
                                <TableCell colSpan={7} className="p-4 pt-0">
                                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 shadow-sm">
                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                      <Sparkles className="size-4 text-sky-600" />
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-800">AI Insight</p>
                                    </div>
                                    <div className="space-y-4">
                                      {row.cleanAiOutput?.captionSuggestions?.length ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Captions</span>
                                            <CopyButton label="Copy" text={row.cleanAiOutput.captionSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                                          </div>
                                          <ul className="space-y-2">
                                            {row.cleanAiOutput.captionSuggestions.map((suggestion, index) => (
                                              <li
                                                key={`${row.time}-caption-${index}`}
                                                className={cn(
                                                  "rounded-xl border px-3 py-2 text-xs leading-5 text-foreground shadow-sm",
                                                  index === 0 ? "border-primary/25 bg-primary/5" : "border-border/50 bg-white",
                                                )}
                                              >
                                                {suggestion}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {row.cleanAiOutput?.hookSuggestions?.length ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Hooks</span>
                                            <CopyButton label="Copy" text={row.cleanAiOutput.hookSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                                          </div>
                                          <ul className="space-y-2">
                                            {row.cleanAiOutput.hookSuggestions.map((suggestion, index) => (
                                              <li
                                                key={`${row.time}-hook-${index}`}
                                                className={cn(
                                                  "rounded-xl border px-3 py-2 text-xs leading-5 text-foreground shadow-sm",
                                                  index === 0 ? "border-primary/25 bg-primary/5" : "border-border/50 bg-white",
                                                )}
                                              >
                                                {suggestion}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {!row.cleanAiOutput?.captionSuggestions?.length && !row.cleanAiOutput?.hookSuggestions?.length ? (
                                        <div className="text-sm text-muted-foreground">No suggestions available for this check.</div>
                                      ) : null}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">No recent checks yet.</div>
            )}
          </CardContent>
        </Card>
      </WorkflowDashboardShell>

      <PendingApprovalDetailsDialog
        row={selectedDetailRow}
        open={Boolean(selectedDetailRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDetailRow(null);
          }
        }}
        displayStatus={selectedDetailDisplayStatus}
        isBusy={selectedDetailBusy}
        onSendToG5Approval={handleSendToG5Approval}
        onRejectContent={openRejectConfirm}
        onManualEditCheck={async (row, contentText) => {
          const rowKey = getRowKey(row);
          if (actioningRowKey === rowKey) {
            return null;
          }

          setActioningRowKey(rowKey);
          setActioningTask("MANUAL_EDIT_CHECK");
          try {
            const body = await callG4Webhook("/api/admin/workflow-dashboard/g4/recheck", {
              asset_id: row.assetId,
              source_platform: getSourcePlatform(row),
              source_event: "MANUAL_EDIT_CHECK",
              platform: row.platform,
              original_post_caption: getOriginalCaption(row) ?? "",
              content_text: contentText,
              manual_content_text: contentText,
              feedback_note: rowFeedbackNotes[rowKey] ?? undefined,
              actor: getActorLabel(),
            });

            const nextStatus = normalizeWebhookDisplayStatus(body.status);
            if (nextStatus !== "ERROR") {
              markRowStatus(row, nextStatus);
            }
            return body;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Action failed. Please try again.";
            toast.error(message);
            return null;
          } finally {
            setActioningRowKey((current) => (current === rowKey ? null : current));
            setActioningTask((current) => (current === "MANUAL_EDIT_CHECK" ? null : current));
          }
        }}
      />

      <AlertDialog
        open={Boolean(rejectingRow)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingRow(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-[28px] border-border/60 bg-white p-6 shadow-2xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="font-serif text-2xl tracking-tight text-primary">Reject this content?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">Reject this content? It will not move to G5.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-wrap items-center justify-end gap-2 sm:flex-row">
            <AlertDialogCancel className="h-9 rounded-full border-border/70 bg-white px-4 text-sm font-medium shadow-none" onClick={() => setRejectingRow(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 rounded-full bg-rose-600 px-4 text-sm font-medium text-white shadow-none hover:bg-rose-700"
              onClick={() => void handleRejectConfirm()}
            >
              {rejectingBusy && actioningTask === "REJECT_CONTENT" ? "Saving rejection..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}





