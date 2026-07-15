"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Ban, Clock3, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  formatWorkflowRelativeTime,
  type WorkflowOverviewCard,
} from "@/lib/admin/workflows";
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

const lastRunLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);

  return `${dateLabel} · ${formatWorkflowRelativeTime(value)}`;
};

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 12 }).map((_, index) => (
        <Card key={index} className="gap-0 overflow-hidden rounded-[24px] border-border/60 bg-white py-0 shadow-sm">
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
  const detailHref = workflow.detailHref;
  const urgentAction = workflow.mainActionNeeded || workflow.emptyStateCopy || "Nothing needed right now.";

  return (
    <Card className="group gap-0 overflow-hidden rounded-[24px] border-border/60 bg-white py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <h3 className="font-serif text-xl leading-tight tracking-tight text-primary">{workflow.title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{workflow.purpose}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last checked</p>
            <p className="mt-1 text-sm font-medium text-foreground">{lastRunLabel(workflow.lastRunAt)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Urgent action</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{urgentAction}</p>
          </div>
        </div>

        <div className="mt-auto">
          <Button asChild variant="outline" className="h-9 w-full rounded-full border-border/70 bg-white px-3 text-xs shadow-none">
            <Link href={detailHref}>
              View Details
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
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOverviewRef = useRef(false);

  useEffect(() => {
    hasLoadedOverviewRef.current = Boolean(overview);
  }, [overview]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      if (!hasLoadedOverviewRef.current) {
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
        }
      }
    };

    void loadOverview();

    return () => {
      active = false;
    };
  }, [authFetch, request]);

  const workflows = overview?.workflows ?? [];

  const stats: OverviewStat[] = [
    {
      label: "Workflows",
      value: String(workflows.length || 0),
      helper: "G1 through G12",
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

  return (
    <WorkflowDashboardShell
      eyebrow="Cevonne Admin"
      title="Workflow Dashboard"
      description="One-page summaries for every workflow. Open a workflow to inspect its latest outcome and next safe action."
      descriptionClassName="max-w-none whitespace-nowrap"
    >
      {error ? (
        <Card role="alert" className="gap-0 rounded-[24px] border-rose-200 bg-rose-50 py-0 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white py-0 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-10 w-20 rounded-2xl" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label} className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white py-0 shadow-sm">
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
