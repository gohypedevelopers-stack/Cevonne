"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CircleHelp, Copy, ExternalLink, Instagram, Music2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  formatG4ResultLabel,
  formatG4StatusTone,
  type G4RecentOutcome,
  type G4WorkflowDetail,
} from "@/lib/admin/g4-content-review";
import { cn } from "@/lib/utils";

type G4ContentClaimCheckPageProps = {
  detail: G4WorkflowDetail;
};

type G4Status = G4WorkflowDetail["status"];

type G4RecheckResponse = {
  status: G4Status | "ERROR";
  message: string;
};

type G4ApprovalRequestResponse = {
  status: "PASS" | "BLOCK" | "ERROR";
  message: string;
  approvalId: string | null;
  alreadyQueued: boolean;
  approvalRequest: G4WorkflowDetail["approvalRequest"];
};

type ActionConfig = {
  label: string;
  disabled: boolean;
  helper: string | null;
  action: "fix" | "view" | "approval" | "evidence" | "manual";
};

const REQUIRED_COPY_WARNING_TERMS = /(clearer skin|fix acne|guaranteed|permanent|overnight|heal|cure|transform)/i;

const getStatusAccentClass = (status: G4Status) => {
  switch (status) {
    case "PASS":
      return "bg-emerald-400";
    case "BLOCK":
      return "bg-rose-400";
    case "PENDING_APPROVAL":
      return "bg-sky-400";
    case "MANUAL_ONLY":
      return "bg-violet-400";
    case "NEEDS_EVIDENCE":
      return "bg-amber-400";
    case "ERROR":
    default:
      return "bg-slate-400";
  }
};

const getActionToneClass = (status: G4Status) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "MANUAL_ONLY":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "ERROR":
    default:
      return "border-slate-200 bg-slate-100 text-slate-950";
  }
};

const buildInitialDraft = (detail: G4WorkflowDetail) =>
  detail.cleanAiOutput?.safeRewrite ??
  detail.contentPreview.contentText ??
  detail.contentPreview.pageText ??
  detail.latestOutcome?.summary ??
  "";

const getApprovalSourceId = (outcome: Pick<G4RecentOutcome, "reviewId" | "assetId"> | null) => outcome?.reviewId ?? outcome?.assetId ?? null;

const normalizeRecentOutcomeKeyPart = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

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

const getActionPanelCopy = (status: G4Status) => {
  switch (status) {
    case "BLOCK":
      return {
        title: "Fix this content before it can move forward",
        body: "This content cannot move to approval or publishing until the risky claim is removed or rewritten.",
        buttonLabel: "Fix content",
        buttonAction: "fix" as const,
        disabled: false,
        helper: null,
      };
    case "PENDING_APPROVAL":
      return {
        title: "Review and approve before use",
        body: "The content check passed, but a human approval is still required before publishing or ad use.",
        buttonLabel: "Send to approval",
        buttonAction: "approval" as const,
        disabled: false,
        helper: null,
      };
    case "PASS":
      return {
        title: "Review approval status before use",
        body: "Content check passed. Confirm the approval status before next workflow use.",
        buttonLabel: "View approval status",
        buttonAction: "view" as const,
        disabled: false,
        helper: null,
      };
    case "NEEDS_EVIDENCE":
      return {
        title: "Add missing proof before this can continue",
        body: "This content needs proof before it can move forward.",
        buttonLabel: "Add evidence",
        buttonAction: "evidence" as const,
        disabled: true,
        helper: "Evidence action is not connected yet.",
      };
    case "MANUAL_ONLY":
      return {
        title: "Manual review required",
        body: "This content needs manual review before it can continue.",
        buttonLabel: "Manual review",
        buttonAction: "manual" as const,
        disabled: true,
        helper: "Manual review action is not connected yet.",
      };
    case "ERROR":
    default:
      return {
        title: "Check the data source",
        body: "Unable to load content checks right now.",
        buttonLabel: "View details",
        buttonAction: "view" as const,
        disabled: false,
        helper: null,
      };
  }
};

const getRecentRowAction = (status: G4Status): ActionConfig => {
  switch (status) {
    case "BLOCK":
      return {
        label: "Fix",
        disabled: false,
        helper: null,
        action: "fix",
      };
    case "PENDING_APPROVAL":
      return {
        label: "Queue",
        disabled: false,
        helper: null,
        action: "approval",
      };
    case "PASS":
      return {
        label: "View",
        disabled: false,
        helper: null,
        action: "view",
      };
    case "NEEDS_EVIDENCE":
      return {
        label: "Add evidence",
        disabled: true,
        helper: "Evidence action is not connected yet.",
        action: "evidence",
      };
    case "MANUAL_ONLY":
      return {
        label: "Manual review",
        disabled: true,
        helper: "Manual review action is not connected yet.",
        action: "manual",
      };
    case "ERROR":
    default:
      return {
        label: "View",
        disabled: false,
        helper: null,
        action: "view",
      };
  }
};

const buildRecheckPayload = (detail: G4WorkflowDetail, draft: string) => ({
  content_text: draft,
  intended_use: "other",
  platform: detail.latestOutcome?.platform ?? "WEBSITE",
  requested_by: "admin",
  dry_run: true,
  notes: "G4 re-check from the content fix panel",
});

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
      order,
      value: value.trim(),
    }))
    .filter(({ value }) => Boolean(value))
    .filter(({ value }) => {
      const normalized = normalizeRecentOutcomeKeyPart(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .sort((left, right) => left.order - right.order)
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

  return null;
};

function PendingApprovalCard({
  row,
  onSendApproval,
  onViewDetails,
  submittingSourceId,
}: {
  row: G4RecentOutcome;
  onSendApproval: (sourceId: string | null) => void;
  onViewDetails: () => void;
  submittingSourceId: string | null;
}) {
  const sourceId = getApprovalSourceId(row);
  const approvalRequest = row.approvalRequest;
  const isSubmitting = submittingSourceId === sourceId;
  const approvalButtonDisabled = submittingSourceId !== null || Boolean(approvalRequest) || !sourceId;
  const approvalButtonLabel = isSubmitting
    ? "Queueing..."
    : approvalRequest
      ? approvalRequest.status === "PENDING"
        ? "Queued"
        : "Approval recorded"
      : "Send to approval";

  return (
    <div className="flex h-full flex-col rounded-[22px] border border-border/60 bg-white shadow-sm">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left side: status, summary, and actions */}
        <div className="flex flex-col p-4 md:max-w-[220px] md:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", formatG4StatusTone(row.result))}>
              {formatG4ResultLabel(row.result)}
            </Badge>
            <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/20">
              <PlatformIcon platform={row.platform} className="text-foreground" />
            </div>
          </div>

          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{row.whatHappened}</p>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button
              type="button"
              size="sm"
              className="h-8 w-full rounded-full text-[11px] font-medium"
              variant={approvalRequest ? "outline" : "default"}
              disabled={approvalButtonDisabled}
              onClick={() => void onSendApproval(sourceId)}
            >
              {approvalButtonLabel}
            </Button>

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
          </div>
        </div>

        {/* Right side: caption & hook suggestions */}
        {(row.cleanAiOutput?.captionSuggestions?.length || row.cleanAiOutput?.hookSuggestions?.length) ? (
          <div className="flex flex-1 flex-col gap-2.5 border-t border-border/50 p-4 md:border-t-0 md:border-l">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Suggestions</p>
            {row.cleanAiOutput.captionSuggestions.length ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Captions</p>
                  <CopyButton label="Copy" text={row.cleanAiOutput.captionSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                </div>
                <ul className="space-y-1">
                  {row.cleanAiOutput.captionSuggestions.map((item, index) => (
                    <li key={`cap-${index}`} className="rounded-xl border border-border/50 bg-muted/10 px-2.5 py-1.5 text-xs leading-5 text-foreground">
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
                    <li key={`hook-${index}`} className="rounded-xl border border-border/50 bg-muted/10 px-2.5 py-1.5 text-xs leading-5 text-foreground">
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

function OriginalPostDetailsDialog({
  row,
  open,
  onOpenChange,
}: {
  row: Pick<G4RecentOutcome, "contentPreview" | "cleanAiOutput"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;
  const sourceContentSections = getUniqueSourceContentSections(row.contentPreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-[24px]">
        <div className="flex flex-col">
          <DialogHeader className="border-b border-border/60 bg-muted/10 px-6 py-5">
            <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Original Post Details</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Review the original post data and AI suggestions.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            <div className="space-y-8">
              {/* Original Post Data */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Original Content</h4>
                  {row.contentPreview.sourceUrl ? (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" asChild>
                      <a href={row.contentPreview.sourceUrl} target="_blank" rel="noopener noreferrer">
                        View source <ArrowRight className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm leading-6">
                  {sourceContentSections.length ? (
                    sourceContentSections.map((section) => (
                      <div key={`${section.label}-${section.value}`}>
                        <span className="font-semibold text-foreground">{section.label}:</span>{" "}
                        <span className="text-muted-foreground">{section.value}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground italic">No original content data available.</div>
                  )}
                </div>
              </div>

              {/* AI Suggestions Section */}
              {(row.cleanAiOutput?.captionSuggestions?.length || row.cleanAiOutput?.hookSuggestions?.length) ? (
                <div className="space-y-4">
                  <Separator className="bg-border/60" />
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">AI Suggestions</h4>
                  
                  {row.cleanAiOutput.captionSuggestions && row.cleanAiOutput.captionSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Captions</span>
                        <CopyButton label="Copy" text={row.cleanAiOutput.captionSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                      </div>
                      <ul className="space-y-2">
                        {row.cleanAiOutput.captionSuggestions.map((s, i) => (
                          <li key={i} className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-xs leading-5 text-foreground">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {row.cleanAiOutput.hookSuggestions && row.cleanAiOutput.hookSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Hooks</span>
                        <CopyButton label="Copy" text={row.cleanAiOutput.hookSuggestions[0] ?? null} className="h-6 px-2 text-[10px]" />
                      </div>
                      <ul className="space-y-2">
                        {row.cleanAiOutput.hookSuggestions.map((s, i) => (
                          <li key={i} className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-xs leading-5 text-foreground">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendingApprovalDetailsDialog({
  row,
  open,
  onOpenChange,
}: {
  row: G4RecentOutcome | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) {
    return null;
  }

  const sourceUrl = row.contentPreview.sourceUrl ?? row.contentPreview.landingPageUrl;
  const sourceCaption = getSourceCaptionText(row.contentPreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,108rem)] max-w-none sm:max-w-none overflow-hidden rounded-[32px] border-border/60 bg-white p-0 shadow-2xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-5 text-left">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle className="font-serif text-2xl tracking-tight text-primary">View Details</DialogTitle>
                <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Source post data sits on the left and AI notes stay on the right. Caption and hook suggestions are shown on each card.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", formatG4StatusTone(row.result))}>
                  {formatG4ResultLabel(row.result)}
                </Badge>
                <PlatformPill platform={row.platform} />
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
                  <CopyButton label="Copy safe rewrite" text={row.cleanAiOutput?.safeRewrite ?? null} />
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

function SuggestionsList({
  title,
  items,
  emptyText,
  copyLabel,
  showCopyButton,
}: {
  title: string;
  items: string[];
  emptyText: string;
  copyLabel: string;
  showCopyButton: boolean;
}) {
  return (
    <div className="space-y-3 rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        {showCopyButton ? <CopyButton label={copyLabel} text={items[0] ?? null} /> : null}
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-2 text-sm leading-6 text-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export default function G4ContentClaimCheckPage({ detail }: G4ContentClaimCheckPageProps) {
  const router = useRouter();
  const { authFetch } = useAuth();
  const latestOutcome = detail.latestOutcome;
  const status = latestOutcome?.result ?? detail.status;
  const statusTone = formatG4StatusTone(status);
  const statusAccentClass = getStatusAccentClass(status);
  const actionPanelCopy = getActionPanelCopy(status);
  const recentRowAction = getRecentRowAction(status);
  const request = authFetch ?? fetch;
  const riskyRewriteWarning = isRiskyRewriteLanguage(detail.cleanAiOutput?.safeRewrite ?? null);
  const initialDraft = buildInitialDraft(detail);
  const latestApprovalSourceId = getApprovalSourceId(latestOutcome);

  const [fixPanelOpen, setFixPanelOpen] = useState(false);
  const [recheckDraft, setRecheckDraft] = useState(initialDraft);
  const [rechecking, setRechecking] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(detail.approvalRequest);
  const [approvalSubmittingSourceId, setApprovalSubmittingSourceId] = useState<string | null>(null);
  const [selectedPendingRow, setSelectedPendingRow] = useState<G4RecentOutcome | null>(null);
  const [selectedRecentRow, setSelectedRecentRow] = useState<G4RecentOutcome | null>(null);

  useEffect(() => {
    setRecheckDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    setApprovalRequest(detail.approvalRequest);
  }, [detail.approvalRequest]);

  const approvalRecorded = Boolean(approvalRequest);
  const approvalQueued = approvalRequest?.status === "PENDING";
  const approvalActionDisabled = approvalSubmittingSourceId !== null || approvalRecorded;
  const approvalButtonLabel =
    latestApprovalSourceId && approvalSubmittingSourceId === latestApprovalSourceId
      ? "Queueing approval..."
      : approvalQueued
        ? "Approval queued"
        : approvalRecorded
          ? "Approval recorded"
          : "Send to approval";
  const approvalHelperText = approvalRequest
    ? approvalRequest.status === "PENDING"
      ? `Approval queued as ${approvalRequest.approvalId}.`
      : `Approval record ${approvalRequest.status.toLowerCase().replace(/_/g, " ")} as ${approvalRequest.approvalId}.`
    : "Queue this content for human approval.";
  const recentOutcomes = dedupeRecentOutcomes(detail.recentOutcomes);
  const visiblePendingApprovalRows = recentOutcomes
    .filter((row) => {
      const isLatestOutcomeRow = getApprovalSourceId(row) === latestApprovalSourceId;
      return row.result === "PENDING_APPROVAL" && !isLatestOutcomeRow;
    })
    .filter((row, index, arr) => {
      const sourceId = getApprovalSourceId(row);
      if (!sourceId) return index === arr.findIndex((r) => !getApprovalSourceId(r));
      return index === arr.findIndex((r) => getApprovalSourceId(r) === sourceId);
    })
    .slice(0, 3);

  const handleApprovalRequest = async (sourceId: string | null = latestApprovalSourceId) => {
    if (!sourceId || approvalSubmittingSourceId !== null) {
      return;
    }

    setApprovalSubmittingSourceId(sourceId);
    try {
      const response = await request("/api/admin/workflow-dashboard/g4/send-approval", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceId }),
      });

      const body = await parseJsonResponse<G4ApprovalRequestResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to queue approval (${response.status}).`);
      }

      if (body.approvalRequest && sourceId === latestApprovalSourceId) {
        setApprovalRequest(body.approvalRequest);
      }

      toast.success(body.message || "Approval request queued.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to queue approval.";
      toast.error(message);
    } finally {
      setApprovalSubmittingSourceId((current) => (current === sourceId ? null : current));
    }
  };

  const handlePanelAction = () => {
    if (actionPanelCopy.disabled) {
      return;
    }

    if (actionPanelCopy.buttonAction === "fix") {
      setFixPanelOpen(true);
      return;
    }

    if (actionPanelCopy.buttonAction === "approval") {
      void handleApprovalRequest();
      return;
    }

    if (actionPanelCopy.buttonAction === "view") {
      document.getElementById("recent-checks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRowAction = (action: ActionConfig["action"]) => {
    if (action === "fix") {
      setFixPanelOpen(true);
      return;
    }

    if (action === "approval") {
      void handleApprovalRequest();
      return;
    }

    if (action === "view") {
      document.getElementById("content-being-reviewed")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRecheck = async () => {
    const draft = recheckDraft.trim();
    if (!draft) {
      toast.error("Add content before re-checking.");
      return;
    }

    setRechecking(true);
    try {
      const response = await request("/api/admin/workflow-dashboard/g4/recheck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRecheckPayload(detail, draft)),
        cache: "no-store",
      });

      const body = await parseJsonResponse<G4RecheckResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to re-check content (${response.status}).`);
      }

      toast.success(body.message || "Content sent for re-check.");
      setFixPanelOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to re-check content.";
      toast.error(message);
    } finally {
      setRechecking(false);
    }
  };

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

        {visiblePendingApprovalRows.length ? (
          <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Pending For Approval</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                {visiblePendingApprovalRows.length} check{visiblePendingApprovalRows.length === 1 ? "" : "s"} are waiting for human approval. Use each card to queue approval or review AI notes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {visiblePendingApprovalRows.map((row) => (
                  <PendingApprovalCard
                    key={`${row.time}-${row.reviewId ?? row.assetId ?? row.platform ?? "pending"}`}
                    row={row}
                    onSendApproval={(sourceId) => void handleApprovalRequest(sourceId)}
                    onViewDetails={() => setSelectedPendingRow(row)}
                    submittingSourceId={approvalSubmittingSourceId}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}


        <Card id="recent-checks" className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Checks</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Compact history of the latest G4 checks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentOutcomes.length ? (
              <div className="overflow-hidden rounded-[24px] border border-border/60 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px] table-fixed">
                    <colgroup>
                      <col className="w-[140px]" />
                      <col className="w-[64px]" />
                      <col />
                      <col className="w-[160px]" />
                      <col className="w-[180px]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Date</TableHead>
                        <TableHead className="px-4">Platform</TableHead>
                        <TableHead className="px-4 text-left">Content summary</TableHead>
                        <TableHead className="px-4">Status</TableHead>
                        <TableHead className="px-4">Action Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOutcomes.map((row) => {
                        const isLatestRow = row.reviewId === latestOutcome?.reviewId || (!row.reviewId && row.assetId === latestOutcome?.assetId);
                        const rowSourceId = getApprovalSourceId(row);
                        const rowAction =
                          row.result === "PENDING_APPROVAL" && !isLatestRow
                            ? { label: "View", disabled: false, helper: null, action: "view" as const }
                            : getRecentRowAction(row.result);
                        const rowApprovalQueued = Boolean(row.approvalRequest);
                        const formattedDate = row.time
                          ? new Date(row.time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—";
                        const formattedTime = row.time
                          ? new Date(row.time).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
                          : "";

                        return (
                          <TableRow key={`${row.time}-${row.reviewId ?? row.assetId ?? row.platform ?? "g4"}`}>
                            <TableCell className="px-4 py-3 align-middle">
                              <div className="text-sm text-foreground">{formattedDate}</div>
                              {formattedTime ? <div className="text-xs text-muted-foreground">{formattedTime}</div> : null}
                            </TableCell>
                            <TableCell className="px-4 py-3 align-middle">
                              <PlatformIcon platform={row.platform} className="text-foreground" />
                            </TableCell>
                            <TableCell className="px-4 py-3 align-middle">
                              <p className="line-clamp-2 text-sm leading-5 text-foreground">{row.whatHappened}</p>
                              <Button
                                variant="link"
                                className="mt-1 h-auto p-0 text-[11px] font-semibold text-primary hover:underline"
                                onClick={() => setSelectedRecentRow(row)}
                              >
                                Original post
                              </Button>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-middle">
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", formatG4StatusTone(row.result))}>
                                {formatG4ResultLabel(row.result)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-middle">
                              {rowAction.action === "approval" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 w-full rounded-full text-[11px] font-medium"
                                  variant={rowApprovalQueued ? "outline" : "default"}
                                  disabled={rowApprovalQueued || approvalSubmittingSourceId !== null || !rowSourceId}
                                  onClick={() => void handleApprovalRequest(rowSourceId)}
                                >
                                  {approvalSubmittingSourceId === rowSourceId ? "Queueing..." : rowApprovalQueued ? "Queued" : "Send to approval"}
                                </Button>
                              ) : rowAction.action === "fix" ? (
                                <Button type="button" size="sm" className="h-8 w-full rounded-full text-[11px] font-medium" onClick={() => setFixPanelOpen(true)}>
                                  {rowAction.label}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-full rounded-full border-border/70 text-[11px] font-medium"
                                  disabled={rowAction.disabled}
                                  onClick={() => handleRowAction(rowAction.action)}
                                >
                                  {rowAction.label}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
                No recent checks yet.
              </div>
            )}
          </CardContent>
        </Card>
      </WorkflowDashboardShell>

      <PendingApprovalDetailsDialog
        row={selectedPendingRow}
        open={Boolean(selectedPendingRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPendingRow(null);
          }
        }}
      />

      <OriginalPostDetailsDialog
        row={selectedRecentRow}
        open={Boolean(selectedRecentRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecentRow(null);
          }
        }}
      />

      <Sheet open={fixPanelOpen} onOpenChange={setFixPanelOpen}>
        <SheetContent side="right" className="w-full max-w-none p-0 sm:max-w-[min(96vw,80rem)]">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/60 bg-muted/20 px-5 py-5">
              <SheetTitle className="font-serif text-2xl tracking-tight text-primary">Fix content</SheetTitle>
              <SheetDescription className="text-sm leading-6 text-muted-foreground">
                Review the original content on the left, then edit the safer version and re-check it through G4 only.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <CardTitle className="font-serif text-xl tracking-tight text-primary">Original content</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      This is the content that was checked by G4.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <FieldBlock label="Headline" value={detail.contentPreview.headline ?? "Not available"} />
                    <FieldBlock label="Caption / Content" value={detail.contentPreview.contentText ?? "Not available"} />
                    <FieldBlock label="CTA" value={detail.contentPreview.ctaText ?? "Not available"} />
                    <FieldBlock label="Landing page text" value={detail.contentPreview.pageText ?? "Not available"} />
                    <FieldBlock label="Product" value={detail.contentPreview.productName ?? "Not available"} />
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="font-serif text-xl tracking-tight text-primary">Suggested safer version</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">
                          Use this as the starting point for a safer rewrite.
                        </CardDescription>
                      </div>
                      <CopyButton label="Copy rewrite" text={detail.cleanAiOutput?.safeRewrite ?? null} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-[24px] border border-border/60 bg-muted/15 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safe rewrite</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                        {detail.cleanAiOutput?.safeRewrite ?? "No safe rewrite provided."}
                      </p>
                    </div>

                    {riskyRewriteWarning ? (
                      <div className="flex gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                        <p className="text-sm leading-6 text-amber-950">
                          This rewrite may still contain result-style language. Review carefully before using.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-2 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Edit before re-check</p>
                      <Textarea
                        value={recheckDraft}
                        onChange={(event) => setRecheckDraft(event.target.value)}
                        rows={8}
                        className="mt-2 min-h-[220px] rounded-[20px] border-border/70 bg-muted/10 text-sm leading-6"
                        placeholder="Edit the safer content here"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SuggestionsList
                        title="Caption suggestions"
                        items={detail.cleanAiOutput?.captionSuggestions ?? []}
                        emptyText="No caption suggestions provided."
                        copyLabel="Copy caption suggestion"
                        showCopyButton={Boolean(detail.cleanAiOutput?.captionSuggestions.length)}
                      />
                      <SuggestionsList
                        title="Hook suggestions"
                        items={detail.cleanAiOutput?.hookSuggestions ?? []}
                        emptyText="No hook suggestions provided."
                        copyLabel="Copy hook"
                        showCopyButton={Boolean(detail.cleanAiOutput?.hookSuggestions.length)}
                      />
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claim notes</p>
                        <CopyButton
                          label="Copy claim note"
                          text={detail.cleanAiOutput?.claimNotes.length ? detail.cleanAiOutput.claimNotes.join("\n") : null}
                        />
                      </div>
                      {detail.cleanAiOutput?.claimNotes.length ? (
                        <ul className="space-y-2">
                          {detail.cleanAiOutput.claimNotes.map((note, index) => (
                            <li key={`${note}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-2 text-sm leading-6 text-foreground">
                              {note}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">No claim notes provided.</p>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human review recommendation</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {detail.cleanAiOutput?.humanReviewRecommendation ?? "No human review recommendation provided."}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        AI suggestions are advisory only. Re-checked content still needs rules and human approval.
                      </p>
                      <Button
                        type="button"
                        className="h-10 rounded-full px-5"
                        onClick={() => void handleRecheck()}
                        disabled={rechecking || !recheckDraft.trim()}
                      >
                        <RefreshCcw className={cn("size-4", rechecking && "animate-spin")} />
                        Re-check content
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}





