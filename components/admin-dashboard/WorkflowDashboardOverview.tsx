"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Ban, Clock3, RefreshCcw, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  formatWorkflowDateTime,
  formatWorkflowRelativeTime,
  getWorkflowDetailHref,
  getWorkflowPrimaryActionConfig,
  getWorkflowStatusTone,
  type WorkflowOverviewCard,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";
import { formatG4ResultLabel } from "@/lib/admin/g4-content-review";
import { cn } from "@/lib/utils";

type WorkflowDashboardOverviewResponse = {
  status: "PASS" | "EMPTY";
  message: string;
  workflows: WorkflowOverviewCard[];
};

type OverviewStat = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  toneClass: string;
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

const statusBuckets = (status: WorkflowUiStatus) => {
  switch (status) {
    case "PASS":
      return "Healthy";
    case "BLOCK":
    case "ERROR":
    case "FIX_FIRST":
      return "Blocked";
    case "MANUAL_ONLY":
    case "PENDING_APPROVAL":
    case "NEEDS_EVIDENCE":
      return "Needs review";
    case "DRY_RUN":
    case "RECOMMENDATION_ONLY":
      return "Safe test";
    case "DO_NOT_SCALE":
      return "Do not scale";
    default:
      return "Needs review";
  }
};

const bucketTone = (bucket: string) => {
  switch (bucket) {
    case "Healthy":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "Blocked":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "Safe test":
      return "border-cyan-200 bg-cyan-100 text-cyan-800";
    case "Do not scale":
      return "border-orange-200 bg-orange-100 text-orange-800";
    default:
      return "border-amber-200 bg-amber-100 text-amber-800";
  }
};

const lastRunLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 13 }).map((_, index) => (
        <Card key={index} className="overflow-hidden rounded-[24px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/5 rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-5/6 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowOverviewCard }) {
  const detailHref = getWorkflowDetailHref(workflow.workflowId);
  const statusTone = getWorkflowStatusTone(workflow.status);
  const isG4 = workflow.workflowId === "G4";
  const statusLabel = isG4 ? formatG4ResultLabel(workflow.status) : statusBuckets(workflow.status);
  const primaryAction = getWorkflowPrimaryActionConfig(workflow.workflowId, workflow.runLabel, workflow.runEnabled);
  const actionBadgeLabel = isG4 ? "Content check" : primaryAction.label ?? (workflow.runEnabled ? workflow.runLabel : "Auto / approval only");
  const title = isG4 ? "G4 Content Check" : workflow.title;
  const purpose = isG4 ? "Checks captions, claims, and landing-page wording before use." : workflow.purpose;
  const actionLabel = isG4 ? "Urgent action" : "Action needed";
  const buttonLabel = workflow.workflowId === "G1" ? primaryAction.label ?? "View Safety Checks" : isG4 ? "View Details" : "Open detail";

  if (isG4) {
    return (
      <Card className="group overflow-hidden rounded-[24px] border-border/60 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="h-1.5 w-full rounded-full bg-primary/80" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">G4</p>
              <h3 className="font-serif text-xl leading-tight tracking-tight text-primary">G4 Content Check</h3>
              <p className="text-sm leading-6 text-muted-foreground">Checks captions, claims, and landing-page wording before use.</p>
            </div>
            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTone)}>
              {statusLabel}
            </Badge>
          </div>

          <div className="space-y-3 rounded-[22px] border border-border/60 bg-muted/15 p-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest</p>
              <p className="text-sm font-medium text-foreground">{statusLabel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asset</p>
              <p className="break-words text-sm font-medium text-foreground">{workflow.latestAssetId ?? "Not available"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next step</p>
              <p className="text-sm font-medium text-foreground">{workflow.mainActionNeeded}</p>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <Button asChild variant="outline" className="h-9 w-full rounded-full border-border/70 bg-white px-3 text-xs shadow-none">
              <Link href={detailHref}>
                View details
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group overflow-hidden rounded-[24px] border-border/60 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="h-1.5 w-full rounded-full bg-primary/80" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{workflow.workflowId}</p>
            <h3 className="font-serif text-xl leading-tight tracking-tight text-primary">{title}</h3>
          </div>
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTone)}>
            {statusLabel}
          </Badge>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{purpose}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last checked</p>
            <p className="mt-1 text-sm font-medium text-foreground">{lastRunLabel(workflow.lastRunAt)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{actionLabel}</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{workflow.mainActionNeeded}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", bucketTone(statusLabel))}>
            {statusLabel}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            {actionBadgeLabel}
          </Badge>
        </div>

        <div className="mt-auto">
          <Button asChild variant="outline" className="h-9 w-full rounded-full border-border/70 bg-white px-3 text-xs shadow-none">
            <Link href={detailHref}>
              {buttonLabel}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkflowDashboardOverview() {
  const { authFetch } = useAuth();
  const request = authFetch;

  const [overview, setOverview] = useState<WorkflowDashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const hasLoadedOverviewRef = useRef(false);

  useEffect(() => {
    hasLoadedOverviewRef.current = Boolean(overview);
  }, [overview]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      if (hasLoadedOverviewRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await request(buildRouteUrl("/api/admin/workflow-dashboard"), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<WorkflowDashboardOverviewResponse>(response);
        if (!active) {
          return;
        }

        if (response.ok && body) {
          setOverview({
            status: body.status ?? "EMPTY",
            message: body.message ?? "Workflow overview loaded.",
            workflows: Array.isArray(body.workflows) ? body.workflows : [],
          });
          return;
        }

        setError(body?.message ?? `Unable to load workflow overview (${response.status}).`);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load workflow overview.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadOverview();

    return () => {
      active = false;
    };
  }, [authFetch, refreshNonce, request]);

  const workflows = overview?.workflows ?? [];

  const stats: OverviewStat[] = [
    {
      label: "Workflows",
      value: String(workflows.length || 0),
      helper: "G1 through G12 plus WF1",
      icon: <Workflow className="h-5 w-5" />,
      toneClass: "bg-primary",
    },
    {
      label: "Healthy",
      value: String(workflows.filter((workflow) => workflow.status === "PASS").length),
      helper: "Passing without intervention",
      icon: <Sparkles className="h-5 w-5" />,
      toneClass: "bg-emerald-300",
    },
    {
      label: "Needs review",
      value: String(workflows.filter((workflow) => ["MANUAL_ONLY", "PENDING_APPROVAL", "NEEDS_EVIDENCE", "FIX_FIRST"].includes(workflow.status)).length),
      helper: "Waiting on human attention",
      icon: <ShieldAlert className="h-5 w-5" />,
      toneClass: "bg-amber-300",
    },
    {
      label: "Blocked",
      value: String(workflows.filter((workflow) => workflow.status === "BLOCK" || workflow.status === "ERROR").length),
      helper: "Stopped for safety",
      icon: <Ban className="h-5 w-5" />,
      toneClass: "bg-rose-300",
    },
    {
      label: "Safe test",
      value: String(workflows.filter((workflow) => workflow.status === "DRY_RUN" || workflow.status === "RECOMMENDATION_ONLY").length),
      helper: "Dry runs and recommendations",
      icon: <Clock3 className="h-5 w-5" />,
      toneClass: "bg-cyan-300",
    },
  ];

  const badges = (
    <>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        Supabase source of truth
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        {overview?.status === "PASS" ? "Live workflow data" : "No run data yet"}
      </Badge>
    </>
  );

  const actions = (
    <Button
      type="button"
      variant="outline"
      className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm"
      onClick={() => {
        setRefreshing(true);
        setRefreshNonce((value) => value + 1);
      }}
      disabled={loading || refreshing}
    >
      <RefreshCcw data-icon="inline-start" className={cn((loading || refreshing) && "animate-spin")} />
      {loading ? "Loading..." : refreshing ? "Refreshing..." : "Refresh"}
    </Button>
  );

  return (
    <WorkflowDashboardShell
      eyebrow="Cevonne Admin"
      title="Workflow Dashboard"
      description="One-page summaries for every workflow. Open a workflow to inspect its latest outcome and next safe action."
      badges={badges}
      actions={actions}
    >
      {error ? (
        <Card role="alert" className="rounded-[24px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-10 w-20 rounded-2xl" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label} className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className={cn("h-1.5 w-full rounded-full", stat.toneClass)} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="font-serif text-4xl leading-none tracking-tight text-foreground">{stat.value}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{stat.helper}</p>
                    </div>
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-primary">
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {loading && !overview ? <OverviewSkeleton /> : null}

      {!loading && overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.workflowId} workflow={workflow} />
          ))}
        </div>
      ) : null}
    </WorkflowDashboardShell>
  );
}
