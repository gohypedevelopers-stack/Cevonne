"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Clock3, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/components/admin-dashboard/n8n-automations-common";
import {
  getG5PrimaryAction,
  getG5StatusLabel,
  getG5StatusMessage,
  getG5StatusTone,
  type G5PrimaryAction,
  type G5PublishingSchedulerDetail,
  type G5PublishingSchedulerStatus,
  type G5PublishingSelectedAsset,
} from "@/lib/admin/g5-publishing-scheduler";
import { type G4ContentPreview } from "@/lib/admin/g4-content-review";
import { type WorkflowDetailView, type WorkflowOutcomeSummary, type WorkflowUiStatus } from "@/lib/admin/workflows";

type WorkflowDashboardDetailResponse = {
  status?: WorkflowUiStatus | "EMPTY";
  message?: string;
  workflowGroup?: string;
  workflow?: WorkflowDetailView;
  latestOutcome?: WorkflowOutcomeSummary | null;
  recentOutcomes?: WorkflowOutcomeSummary[];
  g5Detail?: G5PublishingSchedulerDetail | null;
};

type RequestOptions = RequestInit;

type G5PublishingDryRunResponse = {
  status: G5PublishingSchedulerStatus;
  result: G5PublishingSchedulerStatus;
  message: string;
  summary: string;
  action_needed: string;
  dry_run: true;
  not_executed: true;
  handled_at: string;
  workflowGroup: "G5";
  workflowId: "WF1";
  title: string;
  purpose: string;
  outcome: {
    time: string | null;
    stage: string;
    status: G5PublishingSchedulerStatus;
    whatHappened: string;
    actionNeeded: string;
    details: string | null;
    handledAt: string | null;
    result: G5PublishingSchedulerStatus;
    sourceLabel: string | null;
  };
  g1_compliance_run_id: string | null;
  workflow_execution_log_id: string | null;
  compliance_token_issued: boolean;
};

type ReadinessKey = keyof G5PublishingSchedulerDetail["readiness"];

type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  status: G5PublishingSchedulerStatus;
  helper: string;
};

const G5_DASHBOARD_ROUTE = "/api/admin/workflow-dashboard/G5";
const G5_DRY_RUN_ROUTE = "/api/admin/automations/g5/run-publishing-dry-run";

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const defaultRequest = (url: string, options?: RequestOptions) => fetch(url, options);

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

const sanitizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/\bhttps?:\/\/\S+/gi, "[hidden url]")
    .replace(/\bwww\.\S+/gi, "[hidden url]");
};

const formatPreviewText = (preview?: G4ContentPreview | null) =>
  [
    sanitizeText(preview?.headline),
    sanitizeText(preview?.contentText),
    sanitizeText(preview?.ctaText),
    sanitizeText(preview?.productName),
    sanitizeText(preview?.pageText),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ") || null;

const formatHandledAt = (value?: string | null) => {
  if (!value) {
    return "Not yet run";
  }

  return `${formatDateTime(value)} · ${formatRelativeTime(value)}`;
};

const getSecondaryActionHref = (action: G5PrimaryAction) => {
  switch (action.kind) {
    case "open_g4":
      return "/dashboard/n8n-automations/g4";
    case "view_account_health":
      return "/dashboard/n8n-automations/g2";
    case "view_safety_checks":
      return "/dashboard/n8n-automations/g1";
    case "open_approval":
    case "attach_media":
      return "#selected-asset";
    default:
      return null;
  }
};

const getSecondaryActionLabel = (action: G5PrimaryAction) => {
  switch (action.kind) {
    case "open_approval":
      return "Review Selected Asset";
    case "attach_media":
      return "Inspect Evidence";
    default:
      return action.label;
  }
};

const getReadinessCopy = (key: ReadinessKey, status: G5PublishingSchedulerStatus) => {
  switch (key) {
    case "g4Review":
      switch (status) {
        case "PASS":
          return "G4 review is clean and ready.";
        case "PENDING_APPROVAL":
          return "G4 review passed, but human approval is still pending.";
        case "NEEDS_EVIDENCE":
          return "No G4 review record was found.";
        case "BLOCK":
          return "G4 review is blocking publishing.";
        case "MANUAL_ONLY":
          return "G4 review is available, but live publishing stays manual-only.";
        case "FIX_FIRST":
          return "G4 review needs another pass.";
        case "ERROR":
          return "G4 review could not be loaded safely.";
        case "NOT_RUN_YET":
        case "DRY_RUN":
        default:
          return "Waiting on G4 review evidence.";
      }
    case "g5Approval":
      switch (status) {
        case "PASS":
          return "G5 approval is recorded.";
        case "PENDING_APPROVAL":
          return "Approval is still pending.";
        case "BLOCK":
          return "Approval was blocked or rejected.";
        case "NEEDS_EVIDENCE":
          return "No approval evidence is attached yet.";
        case "MANUAL_ONLY":
          return "Approval exists, but live execution is still manual-only.";
        case "FIX_FIRST":
          return "Approval exists, but publishing still needs another safety pass.";
        case "ERROR":
          return "Approval data could not be loaded safely.";
        case "NOT_RUN_YET":
        case "DRY_RUN":
        default:
          return "Waiting on approval evidence.";
      }
    case "g1Compliance":
      switch (status) {
        case "PASS":
          return "Compliance check passed and the token is usable.";
        case "NOT_RUN_YET":
          return "Compliance has not been run yet.";
        case "NEEDS_EVIDENCE":
          return "Compliance token is missing, expired, or not usable.";
        case "BLOCK":
          return "Compliance blocked the publishing path.";
        case "FIX_FIRST":
          return "Compliance needs a fix before the dry-run can continue.";
        case "MANUAL_ONLY":
          return "Compliance is present, but live execution stays manual-only.";
        case "ERROR":
          return "Compliance data could not be loaded safely.";
        case "PENDING_APPROVAL":
        case "DRY_RUN":
        default:
          return "Compliance evidence is still being gathered.";
      }
    case "g2AccountHealth":
      switch (status) {
        case "PASS":
          return "Account health is clean.";
        case "BLOCK":
          return "Account health is blocking publishing.";
        case "MANUAL_ONLY":
          return "Account health needs manual review.";
        case "NEEDS_EVIDENCE":
          return "No current health snapshot was found.";
        case "FIX_FIRST":
          return "Account health needs another clean pass.";
        case "ERROR":
          return "Account health could not be loaded safely.";
        case "NOT_RUN_YET":
        case "PENDING_APPROVAL":
        case "DRY_RUN":
        default:
          return "Waiting on account health evidence.";
      }
    case "mediaReference":
      return status === "PASS" ? "Approved media reference is present." : "Approved media reference is missing.";
    case "storageReference":
      return status === "PASS" ? "Storage reference is recorded." : "Storage reference is missing.";
    case "publishingDryRun":
      switch (status) {
        case "DRY_RUN":
          return "Publishing dry-run completed safely.";
        case "PASS":
          return "A live publish or schedule completed successfully.";
        case "MANUAL_ONLY":
          return "Dry-run completed, but live publishing stays manual-only.";
        case "NOT_RUN_YET":
          return "The dry-run route has not been used yet.";
        case "BLOCK":
          return "The dry-run was blocked safely.";
        case "NEEDS_EVIDENCE":
          return "Dry-run evidence is missing.";
        case "FIX_FIRST":
          return "Dry-run is still waiting on a fix.";
        case "ERROR":
          return "Dry-run data could not be loaded safely.";
        case "PENDING_APPROVAL":
        default:
          return "Dry-run evidence is still being gathered.";
      }
    case "rollbackPayload":
      return status === "PASS" ? "Rollback payload is recorded." : "Rollback payload is missing.";
    case "finalHumanApproval":
      return status === "PASS" ? "Final human approval is recorded." : "Final human approval is still missing.";
    default:
      return getG5StatusMessage(status);
  }
};

const renderPresenceBadge = (present: boolean, label: string) => (
  <Badge
    variant="outline"
    className={cn(
      "rounded-full border px-3 py-1 text-[11px] font-semibold",
      present ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-rose-200 bg-rose-100 text-rose-800",
    )}
  >
    {label}
  </Badge>
);

function DetailField({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[22px] border border-border/60 bg-muted/15 p-4", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{label}</p>
      <div className="mt-2 text-sm leading-6 text-white/90 text-pretty">{value}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-white/55">{helper}</p> : null}
    </div>
  );
}

function ReadinessCard({ item }: { item: ReadinessItem }) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="text-sm leading-6 text-muted-foreground">{item.helper}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG5StatusTone(item.status))}>
          {getG5StatusLabel(item.status)}
        </Badge>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <Card className="overflow-hidden rounded-[32px] border border-slate-800/80 bg-[#0b1020] shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <CardContent className="relative grid gap-6 p-6 md:p-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <Skeleton className="h-5 w-44 rounded-full bg-white/10" />
            <Skeleton className="h-12 w-4/5 rounded-[20px] bg-white/10" />
            <Skeleton className="h-16 w-full rounded-[24px] bg-white/10" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-52 rounded-full bg-white/10" />
              <Skeleton className="h-11 w-44 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`g5-hero-skeleton-${index}`} className="h-28 rounded-[24px] bg-white/10" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-44 rounded-full" />
            <Skeleton className="h-4 w-72 rounded-full" />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={`g5-side-skeleton-${index}`} className="h-24 rounded-[22px]" />
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-4 w-80 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 rounded-[22px]" />
            <Skeleton className="h-28 rounded-[22px]" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const dedupeOutcomes = (outcomes: WorkflowOutcomeSummary[]) => {
  const seen = new Set<string>();

  return outcomes.filter((outcome) => {
    const key = `${outcome.time ?? ""}|${outcome.result}|${outcome.whatWasChecked}|${outcome.whatHappened}|${outcome.actionNeeded}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const buildReadinessItems = (detail: G5PublishingSchedulerDetail): ReadinessItem[] => [
  { key: "g4Review", label: "G4 review", status: detail.readiness.g4Review, helper: getReadinessCopy("g4Review", detail.readiness.g4Review) },
  { key: "g5Approval", label: "G5 approval", status: detail.readiness.g5Approval, helper: getReadinessCopy("g5Approval", detail.readiness.g5Approval) },
  { key: "g1Compliance", label: "G1 compliance", status: detail.readiness.g1Compliance, helper: getReadinessCopy("g1Compliance", detail.readiness.g1Compliance) },
  { key: "g2AccountHealth", label: "G2 account health", status: detail.readiness.g2AccountHealth, helper: getReadinessCopy("g2AccountHealth", detail.readiness.g2AccountHealth) },
  { key: "mediaReference", label: "Media reference", status: detail.readiness.mediaReference, helper: getReadinessCopy("mediaReference", detail.readiness.mediaReference) },
  { key: "storageReference", label: "Storage reference", status: detail.readiness.storageReference, helper: getReadinessCopy("storageReference", detail.readiness.storageReference) },
  { key: "publishingDryRun", label: "Publishing dry-run", status: detail.readiness.publishingDryRun, helper: getReadinessCopy("publishingDryRun", detail.readiness.publishingDryRun) },
  { key: "rollbackPayload", label: "Rollback payload", status: detail.readiness.rollbackPayload, helper: getReadinessCopy("rollbackPayload", detail.readiness.rollbackPayload) },
  { key: "finalHumanApproval", label: "Final human approval", status: detail.readiness.finalHumanApproval, helper: getReadinessCopy("finalHumanApproval", detail.readiness.finalHumanApproval) },
];

export default function G5PublishingSchedulerPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [snapshot, setSnapshot] = useState<WorkflowDashboardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadSnapshot = useCallback(async () => {
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await request(buildRouteUrl(G5_DASHBOARD_ROUTE), { cache: "no-store" });
      const body = await parseJsonResponse<WorkflowDashboardDetailResponse>(response);

      if (!response.ok || !body?.workflow) {
        throw new Error(body?.message ?? `Unable to load G5 detail (${response.status}).`);
      }

      setSnapshot(body);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load the publishing scheduler.";
      setError(message);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const detail = snapshot?.g5Detail ?? null;
  const workflow = snapshot?.workflow ?? null;
  const selectedAsset = detail?.selectedAsset ?? null;
  const currentStatus = (detail?.status ?? workflow?.status ?? "NOT_RUN_YET") as G5PublishingSchedulerStatus;
  const recentOutcomes = useMemo(() => dedupeOutcomes(workflow?.recentOutcomes ?? []), [workflow?.recentOutcomes]);
  const latestRecordedOutcome = recentOutcomes[0] ?? null;
  const primaryAction = useMemo(() => getG5PrimaryAction(detail), [detail]);
  const readinessItems = useMemo(() => (detail ? buildReadinessItems(detail) : []), [detail]);
  const secondaryActionHref = getSecondaryActionHref(primaryAction);
  const secondaryActionLabel = getSecondaryActionLabel(primaryAction);
  const currentSummaryText =
    sanitizeText(snapshot?.message) ??
    sanitizeText(workflow?.latestOutcome?.whatHappened) ??
    getG5StatusMessage(currentStatus);
  const currentActionNeeded = sanitizeText(workflow?.mainActionNeeded) ?? primaryAction.description;
  const latestEventSummary = sanitizeText(latestRecordedOutcome?.whatHappened) ?? "No recorded event yet.";
  const latestEventAction = sanitizeText(latestRecordedOutcome?.actionNeeded) ?? "No recorded action yet.";
  const lastChecked = formatHandledAt(workflow?.lastRunAt ?? null);
  const assetTitle = sanitizeText(selectedAsset?.title) ?? sanitizeText(selectedAsset?.assetId) ?? "No selected asset";
  const assetPreview =
    sanitizeText(selectedAsset?.contentPreview) ??
    formatPreviewText(detail?.g4Detail?.contentPreview) ??
    "No content preview recorded.";
  const riskSummary =
    sanitizeText(selectedAsset?.riskSummary) ??
    sanitizeText(detail?.g4Detail?.cleanAiOutput?.riskSummary) ??
    "No risk summary recorded.";
  const aiReviewSummary = sanitizeText(selectedAsset?.aiReviewSummary) ?? "No AI review summary recorded.";
  const claimContentResult = sanitizeText(selectedAsset?.claimContentResult) ?? "Not recorded.";
  const evidenceNote = sanitizeText(selectedAsset?.evidenceNote) ?? "No evidence note recorded.";
  const liveExecutionEnabled = selectedAsset?.liveExecutionEnabled;
  const canRunDryRun = Boolean(detail && selectedAsset?.assetId && selectedAsset?.approvalId && primaryAction.kind === "run_dry_run");
  const runDisabledReason = canRunDryRun ? null : primaryAction.description;
  const selectedAssetPlatform = sanitizeText(selectedAsset?.platform) ?? "Not recorded";
  const selectedAssetAccount = sanitizeText(selectedAsset?.accountId) ?? "Not recorded";
  const selectedAssetAction = sanitizeText(selectedAsset?.actionType) ?? "Not recorded";
  const approvalId = sanitizeText(selectedAsset?.approvalId) ?? "Not recorded";
  const g4ReviewId = sanitizeText(selectedAsset?.g4ReviewId) ?? "Not recorded";
  const mediaRecorded = Boolean(selectedAsset?.mediaReference);
  const storageRecorded = Boolean(selectedAsset?.storageReference);
  const rollbackRecorded = Boolean(selectedAsset?.rollbackPayload);
  const finalApprovalText = sanitizeText(selectedAsset?.finalHumanApprovalState) ?? "Not recorded";
  const g4Detail = detail?.g4Detail ?? null;
  const g4Status = (g4Detail?.status ?? "NOT_RUN_YET") as G5PublishingSchedulerStatus;
  const g4Summary = sanitizeText(g4Detail?.latestOutcome?.summary) ?? "No G4 review summary recorded.";
  const g4ActionNeeded = sanitizeText(g4Detail?.actionNeeded) ?? "No G4 action recorded.";
  const g4LandingPageStatus = sanitizeText(g4Detail?.latestOutcome?.landingPageStatus) ?? "Not recorded";
  const g4ApprovalState = sanitizeText(g4Detail?.latestOutcome?.approvalState) ?? "Not recorded";
  const g4ContentPreview = formatPreviewText(g4Detail?.contentPreview) ?? "No G4 content preview recorded.";
  const currentStatusTone = getG5StatusTone(currentStatus);
  const latestEventTone = getG5StatusTone((latestRecordedOutcome?.result ?? currentStatus) as G5PublishingSchedulerStatus);

  const handleRunDryRun = useCallback(async () => {
    if (!detail || !selectedAsset?.assetId || !selectedAsset.approvalId || primaryAction.kind !== "run_dry_run") {
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const response = await request(buildRouteUrl(G5_DRY_RUN_ROUTE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: selectedAsset.approvalId,
          asset_id: selectedAsset.assetId,
        }),
        cache: "no-store",
      });

      const body = await parseJsonResponse<G5PublishingDryRunResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to run the G5 dry-run (${response.status}).`);
      }

      if (body.status === "ERROR" || body.result === "ERROR") {
        toast.error(body.message);
      } else if (body.status === "PASS" || body.status === "DRY_RUN" || body.result === "PASS" || body.result === "DRY_RUN") {
        toast.success(body.message);
      } else {
        toast.info(body.message);
      }

      await loadSnapshot();
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unable to run the G5 dry-run.";
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }, [detail, loadSnapshot, primaryAction.kind, request, selectedAsset?.approvalId, selectedAsset?.assetId]);

  const headerBadges = (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", currentStatusTone)}>
        {getG5StatusLabel(currentStatus)}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
        {lastChecked}
      </Badge>
    </>
  );

  const headerActions = (
    <>
      <Button asChild variant="outline" className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm">
        <Link href="/dashboard/n8n-automations">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm"
        onClick={() => void loadSnapshot()}
        disabled={loading || refreshing}
      >
        <RefreshCcw className={cn("mr-2 h-4 w-4", loading || refreshing ? "animate-spin" : undefined)} />
        {refreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </>
  );

  if (error && !workflow && !detail) {
    return (
      <WorkflowDashboardShell
        eyebrow="Automations / G5"
        title="Publishing Scheduler"
        description="Real Supabase-backed publishing state only. No synthetic readiness or raw payloads are shown."
        badges={headerBadges}
        actions={headerActions}
      >
        <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{error}</CardContent>
        </Card>
      </WorkflowDashboardShell>
    );
  }

  return (
    <WorkflowDashboardShell
      eyebrow="Automations / G5"
      title={detail?.title ?? workflow?.title ?? "Publishing Scheduler"}
      description={
        snapshot?.message ??
        "Real Supabase-backed publishing readiness, approvals, evidence, and dry-run history. URLs, tokens, and raw payloads stay hidden."
      }
      badges={headerBadges}
      actions={headerActions}
    >
      {error ? (
        <Card role="alert" className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-amber-950">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !workflow ? (
        <LoadingState />
      ) : workflow ? (
        <>
          <Card className="overflow-hidden rounded-[32px] border border-slate-800/80 bg-[#0b1020] shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.22),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_28%)]" />
            <CardContent className="relative grid gap-6 p-6 md:p-8 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", currentStatusTone)}>
                    Current: {getG5StatusLabel(currentStatus)}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", latestEventTone)}>
                    Latest event: {latestRecordedOutcome ? getG5StatusLabel((latestRecordedOutcome.result ?? currentStatus) as G5PublishingSchedulerStatus) : "Not run yet"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold",
                      selectedAsset?.liveExecutionEnabled === true
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-violet-200 bg-violet-100 text-violet-800",
                    )}
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    {selectedAsset?.liveExecutionEnabled === true ? "Live execution enabled" : "Manual only"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">Supabase-backed only</p>
                  <h2 className="font-serif text-3xl leading-none tracking-tight text-white md:text-5xl">Publishing Scheduler</h2>
                  <p className="max-w-2xl text-sm leading-6 text-white/70 md:text-base">
                    The current asset, evidence trail, approval state, and dry-run history are loaded directly from n8n Supabase.
                    No fake readiness, raw URLs, or service tokens are rendered in this view.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Current state</p>
                  <p className="mt-2 text-base leading-7 text-white/90">{currentSummaryText}</p>
                  <p className="mt-3 text-sm leading-6 text-white/60">{currentActionNeeded}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={cn(
                      "h-11 rounded-full px-5 font-medium",
                      canRunDryRun
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/5",
                    )}
                    disabled={!canRunDryRun || running}
                    onClick={() => void handleRunDryRun()}
                    title={runDisabledReason ?? undefined}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {running ? "Running Dry Run" : "Run Publishing Dry Run"}
                  </Button>

                  {secondaryActionHref ? (
                    secondaryActionHref.startsWith("#") ? (
                      <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10">
                        <a href={secondaryActionHref}>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          {secondaryActionLabel}
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10">
                        <Link href={secondaryActionHref}>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          {secondaryActionLabel}
                        </Link>
                      </Button>
                    )
                  ) : null}
                </div>

                <p className="text-xs leading-5 text-white/50">
                  {canRunDryRun
                    ? "This runs only the dry-run path and records the outcome. It does not publish live changes."
                    : runDisabledReason}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Current status"
                  value={<span className="font-medium text-white">{getG5StatusLabel(currentStatus)}</span>}
                  helper={snapshot?.status === "EMPTY" ? "No workflow events have been stored yet." : "Derived from the live workflow state."}
                />
                <MetricCard
                  label="Latest event"
                  value={latestEventSummary}
                  helper={latestEventAction}
                />
                <MetricCard
                  label="Last checked"
                  value={lastChecked}
                  helper="The freshest checked timestamp from Supabase."
                />
                <MetricCard
                  label="Selected asset"
                  value={assetTitle}
                  helper={selectedAsset ? `${selectedAssetPlatform} · ${selectedAssetAccount}` : "No asset has been selected yet."}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card id="selected-asset" className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Selected Asset</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  Asset identity, evidence, and the safe state copied from Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAsset ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField label="Asset ID" value={<span className="font-mono text-sm">{sanitizeText(selectedAsset.assetId) ?? "Not recorded"}</span>} />
                      <DetailField label="Platform" value={selectedAssetPlatform} />
                      <DetailField label="Account ID" value={selectedAssetAccount} />
                      <DetailField label="Action type" value={selectedAssetAction} />
                      <DetailField label="Approval ID" value={<span className="font-mono text-sm">{approvalId}</span>} />
                      <DetailField label="G4 review ID" value={<span className="font-mono text-sm">{g4ReviewId}</span>} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField
                        label="Media reference"
                        value={renderPresenceBadge(mediaRecorded, mediaRecorded ? "Recorded" : "Missing")}
                        helper="Only the presence of the evidence is shown."
                      />
                      <DetailField
                        label="Storage reference"
                        value={renderPresenceBadge(storageRecorded, storageRecorded ? "Recorded" : "Missing")}
                        helper="Only the presence of the evidence is shown."
                      />
                      <DetailField
                        label="Rollback payload"
                        value={renderPresenceBadge(rollbackRecorded, rollbackRecorded ? "Recorded" : "Missing")}
                        helper="Rollback details are hidden; only the safety state is shown."
                      />
                      <DetailField
                        label="Live execution"
                        value={renderPresenceBadge(liveExecutionEnabled === true, liveExecutionEnabled === true ? "Enabled" : "Manual only")}
                        helper="Live publishing remains hidden until the full evidence chain is ready."
                      />
                      <DetailField
                        label="Final approval"
                        value={<Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", selectedAsset?.finalHumanApprovalState?.toUpperCase() === "APPROVED" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700")}>{finalApprovalText}</Badge>}
                        helper="The final human approval state is stored in Supabase."
                      />
                      <DetailField label="Account health" value={selectedAsset?.accountHealthStatus ?? "Not recorded"} helper="Copied from the account health record." />
                    </div>

                    <DetailField
                      label="Content preview"
                      value={<p className="whitespace-pre-wrap">{assetPreview}</p>}
                      helper="Rendered text is sanitized to avoid leaking raw URLs or tokens."
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField label="Risk summary" value={<p className="whitespace-pre-wrap">{riskSummary}</p>} />
                      <DetailField label="AI review summary" value={<p className="whitespace-pre-wrap">{aiReviewSummary}</p>} />
                    </div>
                    <DetailField label="Claim check result" value={<p className="whitespace-pre-wrap">{claimContentResult}</p>} />
                    <DetailField label="Evidence note" value={<p className="whitespace-pre-wrap">{evidenceNote}</p>} />
                  </>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    No asset evidence has been recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card id="g4-evidence" className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">G4 Evidence</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The review record that feeds the publishing scheduler.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {g4Detail ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG5StatusTone(g4Status))}>
                        {getG5StatusLabel(g4Status)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        Approval state: {g4ApprovalState}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        Landing page: {g4LandingPageStatus}
                      </Badge>
                    </div>

                    <DetailField label="Review summary" value={<p className="whitespace-pre-wrap">{g4Summary}</p>} />
                    <DetailField label="Action needed" value={<p className="whitespace-pre-wrap">{g4ActionNeeded}</p>} />
                    <DetailField label="Content preview" value={<p className="whitespace-pre-wrap">{g4ContentPreview}</p>} />

                    {g4Detail.cleanAiOutput?.riskSummary ? (
                      <DetailField
                        label="AI risk summary"
                        value={<p className="whitespace-pre-wrap">{sanitizeText(g4Detail.cleanAiOutput.riskSummary) ?? "Not recorded."}</p>}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    No G4 review record is available.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm" id="readiness-matrix">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Readiness Matrix</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                Every gate that must be real before the scheduler can move safely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {readinessItems.map((item) => (
                  <ReadinessCard key={item.key} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm" id="recent-events">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Events</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The newest recorded approvals, health checks, and dry-run outcomes from Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead>Action needed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOutcomes.length ? (
                      recentOutcomes.map((outcome, index) => {
                        const outcomeStatus = (outcome.result ?? currentStatus) as G5PublishingSchedulerStatus;
                        const checkedLabel = sanitizeText(outcome.whatWasChecked) ?? "Event";
                        const isDryRunEvent = checkedLabel.toLowerCase().includes("dry run") || outcomeStatus === "DRY_RUN";
                        return (
                          <TableRow key={`${outcome.time ?? "outcome"}-${index}`}>
                            <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatHandledAt(outcome.time)}</TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                {checkedLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG5StatusTone(outcomeStatus))}>
                                {getG5StatusLabel(outcomeStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                              <div className="space-y-2">
                                <p className="whitespace-pre-wrap">{sanitizeText(outcome.whatHappened) ?? "No summary recorded."}</p>
                                {isDryRunEvent ? (
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dry-run outcome</p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                              {sanitizeText(outcome.actionNeeded) ?? "No action recorded."}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No real G5 outcomes have been recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </WorkflowDashboardShell>
  );
}
