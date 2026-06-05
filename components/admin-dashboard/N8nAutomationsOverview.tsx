"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, ClipboardList, RefreshCw, Shield, Sparkles, TimerReset, Workflow } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  FALLBACK_OVERVIEW,
  formatRelativeTime,
  statusToneClasses,
  type N8nOverviewResponse,
  type N8nWorkflowCard,
} from "@/components/admin-dashboard/n8n-automations-common";
import { CevonneWorkflowGroup } from "@/lib/cevonne/admin-model";

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

const CLIENT_WORKFLOW_COPY: Record<CevonneWorkflowGroup, { name: string; description: string }> = {
  G1: {
    name: "Safety Check",
    description: "Makes sure every automation is safe before anything goes live.",
  },
  G2: {
    name: "Account Health Monitor",
    description: "Watches account and policy health so risky actions are paused early.",
  },
  G3: {
    name: "Customer Consent & Tracking",
    description: "Stores customer consent, opt-outs, purchases, and privacy requests.",
  },
  G4: {
    name: "Content Review",
    description: "Reviews captions, claims, landing pages, and creatives before approval.",
  },
  G5: {
    name: "Publishing Scheduler",
    description: "Schedules approved posts only after checks are complete.",
  },
  G6: {
    name: "Messaging & Recovery",
    description: "Handles quiz, WhatsApp, recovery, and message routing safely.",
  },
  G7: {
    name: "Stock & Offer Check",
    description: "Checks stock, discounts, and urgency claims before they are used.",
  },
  G8: {
    name: "Customer Content Rights",
    description: "Checks permission before using customer or creator content.",
  },
  G9: {
    name: "Ads Review",
    description: "Reviews ad recommendations and waits for approval before changes.",
  },
  G10: {
    name: "Website Growth Review",
    description: "Reviews SEO and conversion ideas for the website safely.",
  },
  G11: {
    name: "Business Recommendations",
    description: "Creates weekly recommendations without making live changes.",
  },
};

const clientStatusLabel: Record<string, string> = {
  PASS: "Working",
  ACTIVE: "Working",
  COMPLETE: "Working",
  BLOCK: "Blocked",
  ERROR: "Needs technical help",
  MANUAL_ONLY: "Needs review",
  REVIEW: "Needs review",
  PENDING: "Waiting",
  NOT_BUILT: "Not connected yet",
  DRY_RUN: "Testing only",
  RECOMMENDATION_ONLY: "Recommendation only",
};

const getClientWorkflowCopy = (workflow: N8nWorkflowCard) => CLIENT_WORKFLOW_COPY[workflow.group] ?? { name: workflow.name, description: workflow.purpose };

const getClientStatus = (workflow: N8nWorkflowCard) => {
  if (workflow.status === "RECOMMENDATION_ONLY" || workflow.lifecycleState === "RECOMMENDATION_ONLY" || workflow.recommendationOnly) {
    return clientStatusLabel.RECOMMENDATION_ONLY;
  }

  if (workflow.status === "DRY_RUN" || workflow.lifecycleState === "DRY_RUN") {
    return clientStatusLabel.DRY_RUN;
  }

  if (workflow.status === "NOT_BUILT" || workflow.lifecycleState === "NOT_BUILT") {
    return clientStatusLabel.NOT_BUILT;
  }

  if (workflow.status === "MANUAL_ONLY" || workflow.lifecycleState === "REVIEW") {
    return clientStatusLabel.MANUAL_ONLY;
  }

  if (workflow.status === "PENDING" || workflow.lifecycleState === "PENDING") {
    return clientStatusLabel.PENDING;
  }

  if (workflow.status === "BLOCK") {
    return clientStatusLabel.BLOCK;
  }

  if (workflow.status === "ERROR") {
    return clientStatusLabel.ERROR;
  }

  return clientStatusLabel[workflow.status] || clientStatusLabel.ACTIVE;
};

const getClientLastActivity = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return formatRelativeTime(value);
};

const getAttentionCount = (workflow: N8nWorkflowCard) => {
  const clientStatus = getClientStatus(workflow);
  const reviewStatuses = new Set(["Blocked", "Needs technical help", "Needs review", "Waiting", "Not connected yet"]);
  let attentionCount = workflow.pendingApprovalsCount + (workflow.latestFailureReason ? 1 : 0);

  if (attentionCount === 0 && reviewStatuses.has(clientStatus)) {
    attentionCount = 1;
  }

  return attentionCount;
};

const getAttentionLabel = (attentionCount: number) =>
  attentionCount > 0 ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need review` : "No action needed";

const getLatestWorkflow = (workflows: N8nWorkflowCard[]) => {
  return [...workflows].sort((left, right) => {
    const leftTime = new Date(left.lastRunAt).getTime();
    const rightTime = new Date(right.lastRunAt).getTime();
    return rightTime - leftTime;
  })[0];
};

export default function N8nAutomationsOverview() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [overview, setOverview] = useState<N8nOverviewResponse>(FALLBACK_OVERVIEW);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/workflows"));
      const body = (await response.json().catch(() => FALLBACK_OVERVIEW)) as N8nOverviewResponse;

      setOverview(
        body?.workflows?.length
          ? body
          : {
              ...FALLBACK_OVERVIEW,
              summary: body?.summary || FALLBACK_OVERVIEW.summary,
            },
      );
    } catch (error) {
      console.error("Failed to load workflow overview", error);
      setOverview(FALLBACK_OVERVIEW);
      toast.error("Unable to load workflow overview");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const workflows = overview.workflows || FALLBACK_OVERVIEW.workflows;
  const latestWorkflow = useMemo(() => getLatestWorkflow(workflows), [workflows]);
  const summaryMetrics = useMemo(() => {
    return workflows.reduce(
      (acc, workflow) => {
        const status = getClientStatus(workflow);

        if (status === "Working") {
          acc.working += 1;
        } else if (status === "Needs review") {
          acc.needsReview += 1;
        } else if (status === "Blocked" || status === "Needs technical help") {
          acc.blocked += 1;
        } else if (status === "Waiting") {
          acc.waiting += 1;
        }

        return acc;
      },
      {
        working: 0,
        needsReview: 0,
        blocked: 0,
        waiting: 0,
      },
    );
  }, [workflows]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total workflows",
        value: workflows.length,
        helper: "G1 through G11",
        icon: <Workflow className="h-5 w-5 text-primary" />,
      },
      {
        label: "Working",
        value: summaryMetrics.working,
        helper: "Running smoothly",
        icon: <BadgeCheck className="h-5 w-5 text-emerald-600" />,
      },
      {
        label: "Needs review",
        value: summaryMetrics.needsReview,
        helper: "Waiting on attention",
        icon: <Shield className="h-5 w-5 text-amber-600" />,
      },
      {
        label: "Blocked",
        value: summaryMetrics.blocked,
        helper: "Paused for safety",
        icon: <Sparkles className="h-5 w-5 text-rose-600" />,
      },
      {
        label: "Waiting",
        value: summaryMetrics.waiting,
        helper: "Queued for the next step",
        icon: <ClipboardList className="h-5 w-5 text-primary" />,
      },
      {
        label: "Latest activity",
        value: getClientLastActivity(latestWorkflow?.lastRunAt),
        helper: latestWorkflow ? `${latestWorkflow.group} - ${getClientWorkflowCopy(latestWorkflow).name}` : "No activity yet",
        icon: <TimerReset className="h-5 w-5 text-cyan-600" />,
      },
    ],
    [latestWorkflow, summaryMetrics.working, summaryMetrics.needsReview, summaryMetrics.blocked, summaryMetrics.waiting, workflows.length],
  );

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#f6f1ff]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(109,40,217,0.10),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.85),_rgba(246,241,255,0.95))]" />
        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b border-border/60 bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <main className="space-y-6 px-4 pb-10 pt-6 md:px-8">
              <header className="overflow-hidden rounded-[2rem] border border-primary/15 bg-[#120f22] text-white shadow-none">
                <div className="flex flex-col gap-6 px-6 py-6 md:px-8 md:py-8 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        Workflow center
                      </Badge>
                      <Badge className="rounded-full bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/15">Safe overview</Badge>
                      <Badge className="rounded-full bg-violet-400/15 text-violet-100 hover:bg-violet-400/15">No live changes</Badge>
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Cevonne workflow control center</h1>
                      <p className="max-w-3xl text-sm leading-6 text-white/75 md:text-base">Review workflow health, attention items, and recent activity from one simple admin page.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => void loadOverview()}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                {summaryCards.map((card) => (
                  <Card key={card.label} className="min-w-0 overflow-hidden border-none bg-white/90 shadow-[0_10px_35px_rgba(40,25,74,0.08)]">
                    <CardContent className="flex min-w-0 flex-col gap-3 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                          <p className="break-words text-2xl font-semibold text-foreground">{typeof card.value === "number" ? card.value : card.value}</p>
                          <p className="break-all text-xs text-muted-foreground" title={card.helper}>
                            {card.helper}
                          </p>
                        </div>
                        <div className="rounded-full bg-primary/10 p-3">{card.icon}</div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-primary/80 via-violet-500/70 to-cyan-400/80" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <section className="w-full max-w-none space-y-4">
                <div className="flex w-full items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-primary">Workflow board</p>
                    <p className="text-sm text-muted-foreground">Each card gives a plain-language snapshot and opens a detailed workflow page.</p>
                  </div>
                  <Badge className="rounded-full bg-white text-primary shadow-sm">{workflows.length} workflows</Badge>
                </div>

                <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                  {(loading ? FALLBACK_OVERVIEW.workflows : workflows).map((workflow: N8nWorkflowCard) => {
                    const tone = statusToneClasses[workflow.status];
                    const copy = getClientWorkflowCopy(workflow);
                    const statusLabel = getClientStatus(workflow);
                    const attentionCount = getAttentionCount(workflow);
                    const attentionLabel = getAttentionLabel(attentionCount);
                    const lastActivity = getClientLastActivity(workflow.lastRunAt);
                    return (
                      <Card
                        key={workflow.group}
                        className="border border-border/60 bg-white/95 shadow-[0_18px_50px_rgba(88,57,173,0.10)] transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <CardTitle className="text-lg text-primary">
                                {workflow.group} - {copy.name}
                              </CardTitle>
                              <CardDescription>{copy.description}</CardDescription>
                            </div>
                          </div>
                          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Status</span>
                              <Badge className={`rounded-full border ${tone}`}>{statusLabel}</Badge>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Attention</span>
                              <span className={`text-sm font-medium ${attentionCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{attentionLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Last activity</span>
                              <span className="text-sm font-medium text-foreground">{lastActivity}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Button asChild className="w-full rounded-full">
                            <Link href={`/dashboard/n8n-automations/${workflow.group.toLowerCase()}`}>
                              View details
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
