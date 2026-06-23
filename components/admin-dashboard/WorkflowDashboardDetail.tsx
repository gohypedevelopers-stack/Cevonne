"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Clock3, Play, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import WorkflowRunDialog from "@/components/admin-dashboard/WorkflowRunDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  formatWorkflowDateTime,
  formatWorkflowRelativeTime,
  getWorkflowOutcomeSectionTitles,
  getWorkflowPrimaryActionConfig,
  getWorkflowStatusDetailCopy,
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
  type AdminWorkflowId,
  type WorkflowDetailView,
  type WorkflowOutcomeSummary,
  type WorkflowRunValues,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";

type WorkflowDashboardDetailResponse = {
  status: WorkflowUiStatus | "EMPTY";
  message: string;
  workflowGroup?: AdminWorkflowId;
  workflow: WorkflowDetailView;
  latestOutcome?: WorkflowOutcomeSummary | null;
  recentOutcomes?: WorkflowOutcomeSummary[];
};

type WorkflowDashboardRunResponse = {
  status: WorkflowUiStatus;
  message: string;
  response_type: string | null;
  handled_at: string;
  outcome: WorkflowOutcomeSummary;
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

type G2AccountHealthUpdateResponse = {
  status: string;
  message: string;
  response_type?: string | null;
  handled_at?: string | null;
};

type G2StatusSummaryResponse = {
  status?: string;
  message?: string;
  response_type?: string | null;
  handled_at?: string | null;
};

type RequestOptions = RequestInit & { silent?: boolean };

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

const formatTimeLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

const formatRowTimeLabel = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

const isG2StatusUnsafe = (status: WorkflowUiStatus) => status !== "PASS";

const deriveG2HealthStatus = (workflow: WorkflowDetailView) => {
  const source = workflow.latestOutcome?.result ?? workflow.status;

  switch (source) {
    case "PASS":
      return "CLEAN";
    case "BLOCK":
      return "RESTRICTED";
    case "MANUAL_ONLY":
      return "WARNING";
    default:
      return "UNKNOWN";
  }
};

const getLatestOutcomeSummary = (workflowId: AdminWorkflowId, outcome: WorkflowOutcomeSummary | null) => {
  if (!outcome) {
    return "No workflow outcome has been recorded yet.";
  }

  switch (outcome.result) {
    case "PASS":
      return outcome.whatHappened || "Good. The latest check completed safely.";
    case "BLOCK":
      return `Blocked safely because ${outcome.whyItBlocked ?? outcome.actionNeeded}.`;
    case "MANUAL_ONLY":
      return outcome.whatHappened || "Human review is needed before the next safe step.";
    case "PENDING_APPROVAL":
      return outcome.whatHappened || "Waiting for approval before it can continue.";
    case "DRY_RUN":
      return outcome.whatHappened || "Test only. Nothing live happened.";
    case "RECOMMENDATION_ONLY":
      return outcome.whatHappened || "Recommendation created. Nothing was executed.";
    case "DO_NOT_SCALE":
      return outcome.whatHappened || "Do not scale this yet.";
    case "FIX_FIRST":
      return outcome.whatHappened || "Fix the issue before continuing.";
    case "NEEDS_EVIDENCE":
      return outcome.whatHappened || "More proof is needed before this can continue.";
    case "ERROR":
    default:
      return workflowId === "G2" ? "Account health needs review." : "System review is needed.";
  }
};

const getSavedOutputBlock = (workflowId: AdminWorkflowId, outcome: WorkflowOutcomeSummary | null) => {
  if (!outcome) {
    return null;
  }

  switch (workflowId) {
    case "G3":
      return {
        label: "Consent / privacy summary",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G6":
      return {
        label: "Messaging result",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G7":
      return {
        label: "Offer proof",
        value: outcome.whatHappened,
        helper: outcome.actionNeeded,
      };
    case "G8":
      return {
        label: "Rights scope",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G9":
    case "G10":
    case "G11":
      return {
        label: "Recommendation",
        value: outcome.whatHappened,
        helper: outcome.actionNeeded,
      };
    default:
      return null;
  }
};

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
    <div className={cn("rounded-2xl border border-border/60 bg-muted/15 p-4", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6 md:p-8">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-9 w-3/4 rounded-2xl" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`detail-skeleton-${index}`} className="h-24 rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-32 rounded-2xl" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4 md:p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`table-skeleton-${index}`} className="h-14 rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export default function WorkflowDashboardDetail({ workflowId }: { workflowId: AdminWorkflowId }) {
  const { authFetch } = useAuth();
  const request = useCallback(
    (url: string, options?: RequestOptions) => (authFetch ? authFetch(url, options) : defaultRequest(url, options)),
    [authFetch],
  );

  const [snapshot, setSnapshot] = useState<WorkflowDashboardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [outcomeDetailsOpen, setOutcomeDetailsOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<WorkflowOutcomeSummary | null>(null);
  const [g2UpdateOpen, setG2UpdateOpen] = useState(false);
  const [g2HealthStatus, setG2HealthStatus] = useState("UNKNOWN");
  const [g2Notes, setG2Notes] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = Boolean(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await request(buildRouteUrl(`/api/admin/workflow-dashboard/${workflowId}`), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<WorkflowDashboardDetailResponse>(response);
        if (!active) {
          return;
        }

        if (response.ok && body?.workflow) {
          const workflowRecentOutcomes = Array.isArray(body.workflow.recentOutcomes) ? body.workflow.recentOutcomes : [];
          const topLevelRecentOutcomes = Array.isArray(body.recentOutcomes) ? body.recentOutcomes : [];
          setSnapshot({
            status: body.status ?? "EMPTY",
            message: body.message ?? "Workflow detail loaded.",
            workflowGroup: body.workflowGroup ?? workflowId,
            workflow: body.workflow,
            latestOutcome: body.workflow.latestOutcome ?? body.latestOutcome ?? null,
            recentOutcomes: workflowRecentOutcomes.length > 0 ? workflowRecentOutcomes : topLevelRecentOutcomes,
          });
          return;
        }

        setError(body?.message ?? `Unable to load workflow detail (${response.status}).`);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load workflow detail.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [authFetch, refreshNonce, request, workflowId]);

  const workflow = snapshot?.workflow ?? null;
  const latestOutcome = snapshot?.latestOutcome ?? workflow?.latestOutcome ?? null;
  const recentOutcomes = snapshot?.recentOutcomes ?? workflow?.recentOutcomes ?? [];
  const displayedRecentOutcomes = recentOutcomes.length > 0 ? recentOutcomes : latestOutcome ? [latestOutcome] : [];
  const safeOutcomeTime = latestOutcome?.time ?? workflow?.lastRunAt ?? null;
  const workflowStatus = workflow?.status ?? snapshot?.status ?? "ERROR";
  const outcomeTitles = workflow ? getWorkflowOutcomeSectionTitles(workflow.workflowId) : { latest: "Latest Outcome", recent: "Recent Outcomes" };
  const primaryAction = workflow ? getWorkflowPrimaryActionConfig(workflow.workflowId, workflow.runLabel, workflow.runEnabled) : null;
  const g2NeedsUpdate = Boolean(workflow && workflow.workflowId === "G2" && isG2StatusUnsafe(workflow.status));
  const g2PrimaryCopy = g2NeedsUpdate ? "Update Account Status" : "View Account Health";
  const savedOutput = workflow ? getSavedOutputBlock(workflow.workflowId, latestOutcome) : null;

  const refreshDetail = useCallback(async () => {
    if (workflow?.workflowId === "G2") {
      setRefreshing(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/g2-status-summary"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          silent: true,
        });

        const body = (await parseJsonResponse<G2StatusSummaryResponse>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message ?? `Unable to refresh G2 status (${response.status}).`);
        }

        if (body?.message) {
          toast.success(body.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to refresh G2 status.";
        setRefreshing(false);
        setError(message);
        toast.error(message);
        return;
      }

      setRefreshNonce((value) => value + 1);
      return;
    }

    setRefreshing(true);
    setRefreshNonce((value) => value + 1);
  }, [request, workflow?.workflowId]);

  const openG2UpdateDialog = () => {
    if (!workflow) {
      return;
    }

    setG2HealthStatus(deriveG2HealthStatus(workflow));
    setG2Notes(latestOutcome?.whyItBlocked ?? latestOutcome?.actionNeeded ?? workflow.mainActionNeeded ?? "");
    setG2UpdateOpen(true);
  };

  const handleRunSubmit = async (values: WorkflowRunValues) => {
    const response = await request(buildRouteUrl(`/api/admin/workflow-dashboard/${workflowId}/run`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      cache: "no-store",
      silent: true,
    });

    const body = await parseJsonResponse<WorkflowDashboardRunResponse>(response);
    if (!response.ok || !body) {
      throw new Error(body?.message ?? `Unable to submit workflow action (${response.status}).`);
    }

    return body;
  };

  const handleRunSuccess = (response: WorkflowDashboardRunResponse) => {
    setRunOpen(false);

    if (response.status === "ERROR") {
      toast.error(response.message);
    } else if (response.status === "PASS") {
      toast.success(response.message);
    } else {
      toast.info(response.message);
    }

    setRefreshNonce((value) => value + 1);
  };

  const handleG2UpdateSubmit = async (): Promise<G2AccountHealthUpdateResponse> => {
    if (!workflow) {
      throw new Error("Workflow detail is not available.");
    }

    const response = await request(buildRouteUrl("/api/admin/g2-account-health-update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_status: g2HealthStatus,
        notes: g2Notes.trim() || undefined,
      }),
      cache: "no-store",
      silent: true,
    });

    const body = await parseJsonResponse<G2AccountHealthUpdateResponse>(response);
    if (!response.ok || !body) {
      throw new Error(body?.message ?? `Unable to update account status (${response.status}).`);
    }

    return body;
  };

  const handleG2UpdateSuccess = async () => {
    try {
      const result = await handleG2UpdateSubmit();
      toast.success(result.message || "Account status updated.");
      setG2UpdateOpen(false);
      setRefreshNonce((value) => value + 1);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to update account status.";
      toast.error(message);
    }
  };

  const headerBadges = (
    <>
      <Badge
        variant="outline"
        className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(workflowStatus as WorkflowUiStatus))}
      >
        {workflow ? getWorkflowStatusLabel(workflowStatus as WorkflowUiStatus) : "Loading"}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 data-icon="inline-start" className="size-3.5" />
        {workflow ? formatTimeLabel(safeOutcomeTime) : "Loading workflow"}
      </Badge>
    </>
  );

  const headerActions = (
    <>
      <Button asChild variant="outline" className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm">
        <Link href="/dashboard/n8n-automations">
          <ArrowLeft data-icon="inline-start" />
          Back
        </Link>
      </Button>

      {workflow ? (
        workflow.workflowId === "G2" ? (
          g2NeedsUpdate ? (
            <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={openG2UpdateDialog}>
              <Sparkles data-icon="inline-start" />
              {g2PrimaryCopy}
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm">
              <a href="#latest-outcome">
                <ArrowRight data-icon="inline-start" />
                {g2PrimaryCopy}
              </a>
            </Button>
          )
        ) : primaryAction?.kind === "open_checks" ? (
          <Button asChild variant="outline" className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm">
            <a href="#latest-outcome">
              <ArrowRight data-icon="inline-start" />
              {primaryAction.label ?? "View Details"}
            </a>
          </Button>
        ) : primaryAction?.kind === "refresh_status" ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm"
            onClick={() => {
              void refreshDetail();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
            {refreshing ? "Refreshing..." : primaryAction.label ?? "Refresh Status"}
          </Button>
        ) : primaryAction?.kind === "generate_recommendation" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={() => setRunOpen(true)}>
            <Sparkles data-icon="inline-start" />
            {primaryAction.label ?? "Generate Recommendation"}
          </Button>
        ) : primaryAction?.kind === "run_dry_run" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={() => setRunOpen(true)}>
            <Play data-icon="inline-start" />
            {primaryAction.label ?? "Run Dry Run"}
          </Button>
        ) : primaryAction?.kind === "run" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={() => setRunOpen(true)} disabled={!workflow.runEnabled}>
            <Play data-icon="inline-start" />
            {primaryAction.label ?? "Run Workflow"}
          </Button>
        ) : null
      ) : null}
    </>
  );

  const latestOutcomeBadge = latestOutcome ? (
    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome.result))}>
      {getWorkflowStatusLabel(latestOutcome.result)}
    </Badge>
  ) : (
    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
      {workflow ? getWorkflowStatusLabel(workflow.status) : "Loading"}
    </Badge>
  );

  const actionsNeededText =
    workflow?.workflowId === "G2"
      ? latestOutcome?.actionNeeded ?? workflow?.emptyStateCopy ?? "No action needed."
      : latestOutcome
        ? latestOutcome.result === "PASS"
          ? "Nothing needed right now. Latest check is good."
          : latestOutcome.result === "RECOMMENDATION_ONLY"
            ? "Recommendation created. Review it before any next step."
            : latestOutcome.actionNeeded
        : workflow?.emptyStateCopy ?? "No action needed right now.";

  const actionsNeededHelper =
    workflow?.workflowId === "G2"
      ? g2NeedsUpdate
        ? "Blocked safely because the current account state is not clean."
        : "Use the safe refresh button to reload the latest account health snapshot."
      : primaryAction?.note ?? (latestOutcome?.whyItBlocked ?? null);

  const actionsNeededButton =
    workflow ? (
      workflow.workflowId === "G2" ? (
        g2NeedsUpdate ? (
          <Button type="button" className="h-10 rounded-full px-5" onClick={openG2UpdateDialog}>
            <Sparkles data-icon="inline-start" />
            Update Account Status
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-white px-5"
            onClick={() => {
              void refreshDetail();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
            Refresh Status
          </Button>
        )
      ) : primaryAction?.kind === "refresh_status" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-border/70 bg-white px-5"
          onClick={() => {
            void refreshDetail();
          }}
          disabled={loading || refreshing}
        >
          <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
          {primaryAction.label ?? "Refresh Status"}
        </Button>
      ) : primaryAction?.kind === "open_checks" ? (
        <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
          <a href="#recent-outcomes">
            <ArrowRight data-icon="inline-start" />
            {primaryAction.label ?? "View Details"}
          </a>
        </Button>
      ) : primaryAction?.kind === "generate_recommendation" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)}>
          <Sparkles data-icon="inline-start" />
          {primaryAction.label ?? "Generate Recommendation"}
        </Button>
      ) : primaryAction?.kind === "run_dry_run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)}>
          <Play data-icon="inline-start" />
          {primaryAction.label ?? "Run Dry Run"}
        </Button>
      ) : primaryAction?.kind === "run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)} disabled={!workflow.runEnabled}>
          <Play data-icon="inline-start" />
          {primaryAction.label ?? "Run Workflow"}
        </Button>
      ) : (
        <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
          <a href="#recent-outcomes">
            <ArrowRight data-icon="inline-start" />
            View Recent Outcomes
          </a>
        </Button>
      )
    ) : null;

  if (error && !workflow) {
    return (
      <WorkflowDashboardShell
        eyebrow="Workflow detail"
        title={`Workflow ${workflowId}`}
        description="Loading workflow detail."
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
      eyebrow="Workflow detail"
      title={workflow?.title ?? `Workflow ${workflowId}`}
      description={workflow ? getWorkflowStatusDetailCopy(workflow.workflowId, workflow.status) : "Loading workflow detail."}
      badges={headerBadges}
      actions={headerActions}
    >
      {error ? (
        <Card role="alert" className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-amber-950">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !workflow ? (
        <LoadingSkeleton />
      ) : workflow ? (
        <>
          <Card id="latest-outcome" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.latest}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    The most recent checked result, shown in plain language.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {latestOutcomeBadge}
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Handled {formatRowTimeLabel(latestOutcome?.time ?? workflow.lastRunAt)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestOutcome ? (
                <>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened</p>
                    <p className="mt-2 text-sm leading-6 text-foreground text-pretty">{getLatestOutcomeSummary(workflow.workflowId, latestOutcome)}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailField
                      label="What was checked"
                      value={latestOutcome.whatWasChecked}
                    />
                    <DetailField
                      label="Action needed"
                      value={latestOutcome.actionNeeded}
                    />
                    <DetailField
                      label="Checked time"
                      value={formatRowTimeLabel(latestOutcome.time)}
                    />
                    <DetailField
                      label="Result"
                      value={
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome.result))}>
                          {getWorkflowStatusLabel(latestOutcome.result)}
                        </Badge>
                      }
                    />
                  </div>

                  {latestOutcome.whyItBlocked ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Why it blocked</p>
                      <p className="mt-2 text-sm leading-6 text-amber-950 text-pretty">{latestOutcome.whyItBlocked}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
                      <a href="#recent-outcomes">
                        <ArrowRight data-icon="inline-start" />
                        View Recent Outcomes
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  {workflow.emptyStateCopy}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card id="actions-needed" className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Actions Needed</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The next safe step, written for the client.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-sm leading-6 text-foreground text-pretty">{actionsNeededText}</p>
                  {actionsNeededHelper ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{actionsNeededHelper}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {actionsNeededButton}
                </div>
              </CardContent>
            </Card>

            {savedOutput ? (
              <Card id="saved-output" className="rounded-[28px] border-border/60 bg-white shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Saved Output</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    The clean result saved for client review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DetailField label={savedOutput.label} value={savedOutput.value} helper={savedOutput.helper} />
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card id="recent-outcomes" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.recent}</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The latest workflow events, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead>Action needed</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRecentOutcomes.length ? (
                      displayedRecentOutcomes.slice(0, 10).map((outcome, index) => (
                        <TableRow key={`${outcome.time ?? "outcome"}-${index}`}>
                          <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatRowTimeLabel(outcome.time)}</TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(outcome.result))}>
                              {getWorkflowStatusLabel(outcome.result)}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                            {outcome.whatHappened}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                            {outcome.actionNeeded}
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none"
                              onClick={() => {
                                setSelectedOutcome(outcome);
                                setOutcomeDetailsOpen(true);
                              }}
                            >
                              View Details
                              <ArrowRight data-icon="inline-end" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          {workflow.emptyStateCopy}
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

      {workflow && primaryAction && ["run", "run_dry_run", "generate_recommendation"].includes(primaryAction.kind) ? (
        <WorkflowRunDialog
          workflow={workflow}
          primaryAction={primaryAction}
          open={runOpen}
          onOpenChange={setRunOpen}
          onSubmit={handleRunSubmit}
          onSuccess={handleRunSuccess}
        />
      ) : null}

      <Dialog open={g2UpdateOpen} onOpenChange={setG2UpdateOpen}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,40rem)] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Update Account Status</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Record the latest account health state and keep the workflow safe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Health status</p>
                <Select value={g2HealthStatus} onValueChange={setG2HealthStatus}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLEAN">Clean</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="RESTRICTED">Restricted</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Notes</p>
                <Textarea
                  value={g2Notes}
                  onChange={(event) => setG2Notes(event.target.value)}
                  rows={6}
                  name="notes"
                  placeholder="Add the evidence or reason for the update."
                  className="min-h-[160px] rounded-2xl border-border/60 bg-muted/15"
                />
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <p className="text-sm leading-6 text-foreground">
                  If the account is still unknown, warning, restricted, or suspended, keep affected workflows paused until the issue is cleared.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4" onClick={() => setG2UpdateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-11 rounded-full px-4" onClick={() => void handleG2UpdateSuccess()}>
                Save Account Status
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={outcomeDetailsOpen}
        onOpenChange={(open) => {
          setOutcomeDetailsOpen(open);
          if (!open) {
            setSelectedOutcome(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[min(96vw,42rem)] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Health Check Details</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Safe client-facing summary of the selected health snapshot.
              </DialogDescription>
            </DialogHeader>

            {selectedOutcome ? (
              <div className="grid gap-3 md:grid-cols-2">
                <DetailField
                  label="Platform / account"
                  value={
                    [selectedOutcome.details?.platform, selectedOutcome.details?.account].filter(Boolean).join(" · ") || "Not available"
                  }
                />
                <DetailField
                  label="Status / result"
                  value={
                    <Badge variant="outline" className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(selectedOutcome.result))}>
                      {getWorkflowStatusLabel(selectedOutcome.result)}
                    </Badge>
                  }
                />
                <DetailField label="What was checked" value={selectedOutcome.details?.whatWasChecked ?? selectedOutcome.whatWasChecked} />
                {selectedOutcome.details?.evidenceSummary ? <DetailField label="Evidence summary" value={selectedOutcome.details.evidenceSummary} /> : null}
                <DetailField label="Action needed" value={selectedOutcome.actionNeeded} />
                <DetailField label="Checked time" value={formatRowTimeLabel(selectedOutcome.handledAt ?? selectedOutcome.time)} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                No details available.
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-4"
                onClick={() => {
                  setOutcomeDetailsOpen(false);
                  setSelectedOutcome(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
