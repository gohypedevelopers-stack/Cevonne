"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import WorkflowRunDialog from "@/components/admin-dashboard/WorkflowRunDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
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
import { cn } from "@/lib/utils";

type WorkflowDashboardDetailResponse = {
  status: WorkflowUiStatus | "EMPTY";
  message: string;
  workflowGroup?: AdminWorkflowId;
  workflow: WorkflowDetailView;
  latestOutcome?: {
    result: WorkflowUiStatus;
    summary: string;
    savedInsightPreview: string | null;
    actionNeeded: string;
    fetchRunId: string | null;
    insightCount: number;
  } | null;
  savedInsights?: Array<{
    insightId: string;
    fetchRunId: string | null;
    title: string;
    trendTopic: string | null;
    platform: string | null;
    branchType: string | null;
    insightSummary: string;
    hookAngle: string | null;
    contentRecommendation: string | null;
    publishedAt: string | null;
    audioSound: string | null;
    hashtags: string[];
    riskLevel: number | null;
    brandFitScore: number | null;
    cleanMetricSummary: string | null;
    createdAt: string | null;
  }>;
  recentOutcomes?: Array<
    WorkflowOutcomeSummary & {
      fetchRunId: string | null;
      insightCount: number;
      savedInsightPreview: string | null;
    }
  >;
};

type G12DetailSavedInsight = NonNullable<WorkflowDashboardDetailResponse["savedInsights"]>[number];
type G12DetailRecentOutcome = NonNullable<WorkflowDashboardDetailResponse["recentOutcomes"]>[number];
type G12DetailLatestOutcome = NonNullable<WorkflowDashboardDetailResponse["latestOutcome"]>;
type RecentOutcomeRow = WorkflowOutcomeSummary & {
  fetchRunId?: string | null;
  insightCount?: number;
  savedInsightPreview?: string | null;
};

type WorkflowDashboardRunResponse = {
  status:
    | "PASS"
    | "BLOCK"
    | "MANUAL_ONLY"
    | "PENDING_APPROVAL"
    | "DRY_RUN"
    | "RECOMMENDATION_ONLY"
    | "DO_NOT_SCALE"
    | "FIX_FIRST"
    | "NEEDS_EVIDENCE"
    | "ERROR";
  message: string;
  response_type: string | null;
  handled_at: string;
  outcome: WorkflowOutcomeSummary;
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

type RequestOptions = RequestInit & { silent?: boolean };

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

const timeLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

const formatRecentLabel = (outcome: WorkflowOutcomeSummary) => {
  if (!outcome.time) {
    return "Unknown";
  }

  return `${formatWorkflowDateTime(outcome.time)} · ${formatWorkflowRelativeTime(outcome.time)}`;
};

function OutcomesSkeleton() {
  return (
    <Card className="rounded-[24px] border-border/60 bg-white shadow-sm">
      <CardHeader>
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </CardContent>
    </Card>
  );
}

export default function WorkflowDashboardDetail({ workflowId }: { workflowId: AdminWorkflowId }) {
  const { authFetch } = useAuth();
  const request = (url: string, options?: RequestOptions) =>
    authFetch ? authFetch(url, options) : defaultRequest(url, options);

  const [snapshot, setSnapshot] = useState<WorkflowDashboardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedFetchRunId, setSelectedFetchRunId] = useState<string | null>(null);
  const [showAllSavedInsights, setShowAllSavedInsights] = useState(false);
  const savedInsightsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (snapshot) {
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
          setSnapshot({
            status: body.status ?? "EMPTY",
            message: body.message ?? "Workflow detail loaded.",
            workflowGroup: body.workflowGroup ?? workflowId,
            workflow: body.workflow,
            latestOutcome: body.latestOutcome ?? null,
            savedInsights: body.savedInsights ?? [],
            recentOutcomes: body.recentOutcomes ?? [],
          });
          return;
        }

        setError(body?.message ?? `Unable to load workflow detail (${response.status}).`);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load workflow detail.";
        setError(message);
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
  }, [authFetch, refreshNonce, workflowId]);

  const workflow = snapshot?.workflow ?? null;
  const latestOutcome = workflow?.latestOutcome ?? null;
  const recentOutcomes = workflow?.recentOutcomes ?? [];
  const isG12Workflow = workflowId === "G12";
  const detailLatestOutcome = isG12Workflow ? (snapshot?.latestOutcome ?? null) : null;
  const detailRecentOutcomes = isG12Workflow ? ((snapshot?.recentOutcomes ?? []) as G12DetailRecentOutcome[]) : [];
  const detailSavedInsights = isG12Workflow ? ((snapshot?.savedInsights ?? []) as G12DetailSavedInsight[]) : [];
  const primaryAction = workflow ? getWorkflowPrimaryActionConfig(workflow.workflowId, workflow.runLabel, workflow.runEnabled) : null;
  const outcomeTitles = workflow ? getWorkflowOutcomeSectionTitles(workflow.workflowId) : { latest: "Latest Outcome", recent: "Recent Outcomes" };
  const primaryActionOpensDialog =
    primaryAction ? ["run", "generate_recommendation", "run_dry_run"].includes(primaryAction.kind) : false;
  const dialogAction = primaryActionOpensDialog && primaryAction ? primaryAction : null;

  const latestG12RunId = detailLatestOutcome?.fetchRunId ?? detailRecentOutcomes[0]?.fetchRunId ?? null;
  const selectedOutcomeExists = Boolean(selectedFetchRunId && detailRecentOutcomes.some((outcome) => outcome.fetchRunId === selectedFetchRunId));
  const activeFetchRunId = selectedOutcomeExists ? selectedFetchRunId : latestG12RunId;
  const activeOutcome = isG12Workflow
    ? detailRecentOutcomes.find((outcome) => outcome.fetchRunId === activeFetchRunId) ?? detailRecentOutcomes[0] ?? null
    : null;
  const activeSavedInsights = isG12Workflow && activeFetchRunId ? detailSavedInsights.filter((insight) => insight.fetchRunId === activeFetchRunId) : [];
  const latestRunSavedInsights = isG12Workflow && latestG12RunId ? detailSavedInsights.filter((insight) => insight.fetchRunId === latestG12RunId) : [];
  const visibleSavedInsights = showAllSavedInsights ? activeSavedInsights : activeSavedInsights.slice(0, 3);
  const activeSavedInsightCount = activeOutcome?.insightCount ?? activeSavedInsights.length;
  const activeSavedInsightMessage =
    activeOutcome && activeOutcome.insightCount > 0 && activeSavedInsights.length === 0
      ? "Insight count was recorded, but the saved insight details were not found. Ask admin/developer to check G12 Supabase logging."
      : activeOutcome?.insightCount === 0
        ? "No clean insights were saved from this run."
        : null;
  const renderedRecentOutcomes = (isG12Workflow ? detailRecentOutcomes : recentOutcomes) as RecentOutcomeRow[];
  const handleViewInsights = (fetchRunId: string | null) => {
    if (!fetchRunId) {
      return;
    }

    setSelectedFetchRunId(fetchRunId);
    setShowAllSavedInsights(false);
    savedInsightsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (isG12Workflow && selectedFetchRunId && !selectedOutcomeExists && latestG12RunId) {
      setSelectedFetchRunId(latestG12RunId);
    } else if (isG12Workflow && !selectedFetchRunId && latestG12RunId) {
      setSelectedFetchRunId(latestG12RunId);
    }
  }, [isG12Workflow, latestG12RunId, selectedFetchRunId, selectedOutcomeExists]);

  useEffect(() => {
    setShowAllSavedInsights(false);
  }, [activeFetchRunId]);

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

    setSnapshot((current) => {
      if (!current?.workflow) {
        return current;
      }

      const nextWorkflow = {
        ...current.workflow,
        status: response.status,
        lastRunAt: response.handled_at,
        latestOutcome: response.outcome,
        recentOutcomes: [response.outcome, ...current.workflow.recentOutcomes].slice(0, 10),
        mainActionNeeded: response.outcome.actionNeeded,
      };

      return {
        ...current,
        status: response.status,
        message: response.message,
        workflow: nextWorkflow,
      };
    });

    setRefreshNonce((value) => value + 1);
  };

  const badges = (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(workflow?.status ?? "ERROR"))}>
        {workflow ? getWorkflowStatusLabel(workflow.status) : "Loading"}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        {workflow ? timeLabel(workflow.lastRunAt) : "Loading workflow"}
      </Badge>
    </>
  );

  const primaryActionButton =
    workflow && primaryAction ? (
      primaryAction.kind === "open_checks" ? (
        <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
          <a href={primaryAction.href ?? "#latest-outcome"}>
            <ArrowRight data-icon="inline-start" />
            {primaryAction.label}
          </a>
        </Button>
      ) : primaryAction.kind === "refresh_status" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full px-5"
          onClick={() => {
            setRefreshing(true);
            setRefreshNonce((value) => value + 1);
          }}
          disabled={loading || refreshing}
        >
          <RefreshCcw data-icon="inline-start" className={cn((loading || refreshing) && "animate-spin")} />
          {loading ? "Loading..." : refreshing ? "Refreshing..." : primaryAction.label}
        </Button>
      ) : primaryAction.kind === "generate_recommendation" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)}>
          <Sparkles data-icon="inline-start" />
          {primaryAction.label}
        </Button>
      ) : primaryAction.kind === "run_dry_run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)}>
          <Play data-icon="inline-start" />
          {primaryAction.label}
        </Button>
      ) : primaryAction.kind === "run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={() => setRunOpen(true)} disabled={!workflow.runEnabled}>
          <Play data-icon="inline-start" />
          {primaryAction.label}
        </Button>
      ) : null
    ) : null;

  const actions = (
    <>
      <Button
        asChild
        variant="outline"
        className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm"
      >
        <Link href="/dashboard/n8n-automations">
          <ArrowLeft data-icon="inline-start" />
          Back
        </Link>
      </Button>
    </>
  );

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title={workflow?.title ?? `Workflow ${workflowId}`}
      description={workflow?.purpose ?? "Loading workflow detail."}
      badges={badges}
      actions={actions}
    >
      {error ? (
        <Card role="alert" className="rounded-[24px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !workflow ? <OutcomesSkeleton /> : null}

      {workflow ? (
        <>
          <Card className="rounded-[24px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Current status</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {getWorkflowStatusDetailCopy(workflow.workflowId, workflow.status)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(workflow.status))}>
                  {getWorkflowStatusLabel(workflow.status)}
                </Badge>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last checked</p>
                  <p className="text-sm leading-6 text-foreground">{timeLabel(workflow.lastRunAt)}</p>
                </div>
              </div>
              {primaryActionButton}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card id="latest-outcome" className="rounded-[24px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest Outcome</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  What happened the last time this workflow was checked or run.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestOutcome ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome.result))}>
                        {getWorkflowStatusLabel(latestOutcome.result)}
                      </Badge>
                      {latestOutcome.sourceLabel ? (
                        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                          {latestOutcome.sourceLabel}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What was checked</p>
                      <p className="text-sm leading-6 text-foreground">{latestOutcome.whatWasChecked}</p>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/60 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened</p>
                      <p className="text-sm leading-6 text-foreground">
                        {detailLatestOutcome?.summary ?? latestOutcome.whatHappened}
                      </p>
                    </div>

                    {isG12Workflow ? (
                      latestRunSavedInsights.length ? (
                        <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saved insight preview</p>
                            <p className="text-sm leading-6 text-foreground">
                              {detailLatestOutcome?.savedInsightPreview ?? latestRunSavedInsights[0]?.hookAngle ?? latestRunSavedInsights[0]?.title}
                            </p>
                            <p className="text-sm leading-6 text-primary/80">See the saved insight below.</p>
                          </div>

                          {latestRunSavedInsights.length > 1 ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {latestRunSavedInsights.length} insights saved
                              </p>
                              <div className="space-y-2">
                                {latestRunSavedInsights.slice(0, 3).map((insight) => (
                                  <div key={insight.insightId} className="rounded-xl border border-border/60 bg-white p-3 shadow-sm">
                                    <p className="text-sm font-medium leading-6 text-foreground">{insight.title}</p>
                                    <p className="text-sm leading-6 text-muted-foreground">{insight.hookAngle ?? insight.insightSummary}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                          {detailLatestOutcome?.summary ?? "No clean insights were saved from this run."}
                        </div>
                      )
                    ) : null}

                    <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Action needed</p>
                      <p className="text-sm leading-6 text-foreground">{detailLatestOutcome?.actionNeeded ?? latestOutcome.actionNeeded}</p>
                    </div>

                    {latestOutcome.whyItBlocked ? (
                      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Why it blocked</p>
                        <p className="text-sm leading-6 text-amber-950">{latestOutcome.whyItBlocked}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    {workflow.emptyStateCopy}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Actions Needed</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The next safe step for this workflow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-foreground">{detailLatestOutcome?.actionNeeded ?? workflow.mainActionNeeded}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {workflow.latestOutcome ? "Use the latest outcome below to see what changed." : workflow.emptyStateCopy}
                </p>
              </CardContent>
            </Card>
          </div>

          {isG12Workflow ? (
            <div ref={savedInsightsSectionRef}>
              <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Saved Insights</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    Clean insight cards for the selected fetch run.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeOutcome ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Viewing run</p>
                          <p className="text-sm leading-6 text-foreground">{formatRecentLabel(activeOutcome)}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                          {activeSavedInsightCount} insight{activeSavedInsightCount === 1 ? "" : "s"} saved
                        </Badge>
                      </div>

                      {activeSavedInsightMessage ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm leading-6 text-amber-950">{activeSavedInsightMessage}</p>
                        </div>
                      ) : activeSavedInsights.length ? (
                        <>
                          <div className={`grid gap-4 ${visibleSavedInsights.length > 1 ? "md:grid-cols-2" : ""}`}>
                            {visibleSavedInsights.map((insight) => (
                              <Card key={insight.insightId} className="rounded-[24px] border-border/60 bg-muted/10 shadow-sm">
                                <CardHeader className="space-y-2">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <CardTitle className="font-serif text-xl tracking-tight text-primary">{insight.title}</CardTitle>
                                      <CardDescription className="text-sm leading-6 text-muted-foreground">
                                        {insight.trendTopic ? `Trend topic: ${insight.trendTopic}` : "Clean insight from G12 Supabase."}
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      {insight.publishedAt ? (
                                        <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                          Published {formatWorkflowDateTime(insight.publishedAt)}
                                        </Badge>
                                      ) : insight.createdAt ? (
                                        <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                          Saved {formatWorkflowDateTime(insight.createdAt)}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="rounded-2xl border border-border/60 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Post data</p>
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Published</p>
                                        <p className="text-sm leading-6 text-foreground">{insight.publishedAt ? formatWorkflowDateTime(insight.publishedAt) : "Not available"}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Audio</p>
                                        <p className="text-sm leading-6 text-foreground">{insight.audioSound ?? "Not available"}</p>
                                      </div>
                                      <div className="space-y-2 sm:col-span-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Hashtags</p>
                                        {insight.hashtags.length ? (
                                          <div className="flex flex-wrap gap-2">
                                            {insight.hashtags.map((hashtag) => (
                                              <Badge key={`${insight.insightId}-${hashtag}`} variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                {hashtag.startsWith("#") ? hashtag : `#${hashtag}`}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm leading-6 text-muted-foreground">No clean hashtags were stored for this post.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {insight.platform ? (
                                      <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                        {insight.platform}
                                      </Badge>
                                    ) : null}
                                    {insight.branchType ? (
                                      <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                        {insight.branchType}
                                      </Badge>
                                    ) : null}
                                    {insight.brandFitScore != null ? (
                                      <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                        Brand fit {insight.brandFitScore}
                                      </Badge>
                                    ) : null}
                                    {insight.riskLevel != null ? (
                                      <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                        Risk {insight.riskLevel}
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <div className="space-y-1 rounded-2xl border border-border/60 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saved insight text</p>
                                    <p className="text-sm leading-6 text-foreground">{insight.insightSummary}</p>
                                  </div>

                                  {insight.hookAngle ? (
                                    <div className="space-y-1 rounded-2xl border border-border/60 bg-white p-4">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hook angle</p>
                                      <p className="text-sm leading-6 text-foreground">{insight.hookAngle}</p>
                                    </div>
                                  ) : null}

                                  {insight.contentRecommendation ? (
                                    <div className="space-y-1 rounded-2xl border border-border/60 bg-white p-4">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Content recommendation</p>
                                      <p className="text-sm leading-6 text-foreground">{insight.contentRecommendation}</p>
                                    </div>
                                  ) : null}

                                  {insight.cleanMetricSummary ? (
                                    <div className="space-y-1 rounded-2xl border border-border/60 bg-white p-4">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clean metric summary</p>
                                      <p className="text-sm leading-6 text-foreground">{insight.cleanMetricSummary}</p>
                                    </div>
                                  ) : null}
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          {activeSavedInsights.length > 3 ? (
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-full px-5"
                                onClick={() => setShowAllSavedInsights((value) => !value)}
                              >
                                {showAllSavedInsights ? "Show less" : "Show more"}
                              </Button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                      {workflow.emptyStateCopy}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.recent}</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The latest workflow events, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked</TableHead>
                    <TableHead>Happened</TableHead>
                    <TableHead>Action needed</TableHead>
                    <TableHead>Insights</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderedRecentOutcomes.length ? (
                    renderedRecentOutcomes.map((outcome, index) => {
                      const canViewInsights = Boolean(outcome.fetchRunId) && Number(outcome.insightCount ?? 0) > 0;
                      const selected = Boolean(outcome.fetchRunId && activeFetchRunId && outcome.fetchRunId === activeFetchRunId);

                      return (
                        <TableRow key={`${outcome.time ?? "outcome"}-${index}`} className={cn(selected && "bg-primary/5")}>
                          <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatRecentLabel(outcome)}</TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(outcome.result))}>
                              {getWorkflowStatusLabel(outcome.result)}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">{outcome.whatWasChecked}</TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                            <div className="space-y-2">
                              <p>{outcome.whatHappened}</p>
                              {outcome.whyItBlocked ? <p className="text-sm leading-6 text-amber-700">{outcome.whyItBlocked}</p> : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">{outcome.actionNeeded}</TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                            {canViewInsights ? (
                              <Button
                                type="button"
                                variant={selected ? "secondary" : "outline"}
                                className="h-8 rounded-full px-3 text-[11px] font-medium"
                                onClick={() => handleViewInsights(outcome.fetchRunId ?? null)}
                              >
                                View insights
                              </Button>
                            ) : (
                              <span className="text-sm leading-6 text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {workflow.emptyStateCopy}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {workflow && dialogAction ? (
        <WorkflowRunDialog
          workflow={workflow}
          primaryAction={dialogAction}
          open={runOpen}
          onOpenChange={setRunOpen}
          onSubmit={handleRunSubmit}
          onSuccess={handleRunSuccess}
        />
      ) : null}
    </WorkflowDashboardShell>
  );
}
