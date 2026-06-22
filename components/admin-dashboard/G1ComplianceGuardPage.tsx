"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { type G1ComplianceGuardSnapshot, type G1DecisionLabel } from "@/lib/g1-compliance-guard";

type G1ResponseBody = G1ComplianceGuardSnapshot & {
  status?: string;
  response_type?: string;
  message?: string;
};

type G1DisplayStatus = "Working" | "Blocked" | "Needs Review";
type G1DisplayResult = "PASS" | "BLOCK" | "MANUAL_ONLY";

const buildRouteUrl = (path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value && value.trim()) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
};

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

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

const statusToneClasses: Record<G1DisplayStatus, string> = {
  Working: "border-emerald-200 bg-emerald-100 text-emerald-800",
  Blocked: "border-rose-200 bg-rose-100 text-rose-800",
  "Needs Review": "border-amber-200 bg-amber-100 text-amber-800",
};

const statusTextClasses: Record<G1DisplayStatus, string> = {
  Working: "text-emerald-700",
  Blocked: "text-rose-700",
  "Needs Review": "text-amber-700",
};

const resultToneClasses: Record<G1DisplayResult, string> = {
  PASS: "border-emerald-200 bg-emerald-100 text-emerald-800",
  BLOCK: "border-rose-200 bg-rose-100 text-rose-800",
  MANUAL_ONLY: "border-amber-200 bg-amber-100 text-amber-800",
};

const displayStatusMessages: Record<G1DisplayStatus, string> = {
  Working: "Safety Check is working normally.",
  Blocked: "Safety Check blocked an unsafe action.",
  "Needs Review": "Safety Check needs manual review.",
};

const displayResultTitles: Record<G1DisplayResult, string> = {
  PASS: "PASS",
  BLOCK: "BLOCK",
  MANUAL_ONLY: "MANUAL_ONLY",
};

const getDisplayStatus = (decision?: G1DecisionLabel | null): G1DisplayStatus => {
  switch (decision) {
    case "PASS":
      return "Working";
    case "BLOCK":
    case "ERROR":
    case "NEEDS_EVIDENCE":
    case "FIX_FIRST":
    case "DO_NOT_SCALE":
      return "Blocked";
    default:
      return "Needs Review";
  }
};

const getDisplayResult = (decision?: G1DecisionLabel | null): G1DisplayResult => {
  switch (decision) {
    case "PASS":
      return "PASS";
    case "BLOCK":
    case "ERROR":
    case "NEEDS_EVIDENCE":
    case "FIX_FIRST":
    case "DO_NOT_SCALE":
      return "BLOCK";
    default:
      return "MANUAL_ONLY";
  }
};

const getStatusTone = (decision: G1DecisionLabel | null) => statusToneClasses[getDisplayStatus(decision)];

const getResultTone = (decision: G1DecisionLabel | null) => resultToneClasses[getDisplayResult(decision)];

const formatLastChecked = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (date.toDateString() === new Date().toDateString()) {
    return `Today, ${time}`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCheckTime = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getIndefiniteArticle = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /^[aeiou]/i.test(trimmed) ? `an ${trimmed}` : `a ${trimmed}`;
};

const getLatestOutputSentence = (
  decision:
    | {
        requested_by_workflow: string;
        action_type_label: string;
        platform: string;
      }
    | null,
) => {
  if (!decision) {
    return "G1 is active, but no workflow action has been checked yet.";
  }

  const workflowLabel = decision.requested_by_workflow || "Unknown workflow";
  const platformLabel = decision.platform || "internal system";
  const actionLabel = decision.action_type_label || "workflow action";
  return `G1 checked ${getIndefiniteArticle(actionLabel)} request from ${workflowLabel} on ${platformLabel}.`;
};

const getLatestOutputMeaning = (result: G1DisplayResult | null) => {
  switch (result) {
    case "PASS":
      return "This action passed the safety check.";
    case "BLOCK":
      return "G1 stopped this action because something was unsafe or missing.";
    case "MANUAL_ONLY":
      return "This action needs human review before it can continue.";
    default:
      return "No G1 decision is available yet.";
  }
};

const getStatusActionNeededLabel = (result: G1DisplayResult) => {
  switch (result) {
    case "PASS":
      return "No action needed";
    case "MANUAL_ONLY":
      return "Human review needed";
    case "BLOCK":
      return "Fix missing proof";
    default:
      return "Review required";
  }
};

const getClientNextStepLabel = (result: G1DisplayResult | null) => {
  switch (result) {
    case "PASS":
      return "No action needed for the latest check. Previous blocked checks, if any, are listed below.";
    case "BLOCK":
      return "Action is needed. Check the blocked reason below and fix it before retrying.";
    case "MANUAL_ONLY":
      return "Human review is needed before this action can continue.";
    default:
      return "No action needed right now.";
  }
};

function InfoField({
  label,
  value,
  valueClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/15 p-4", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-2 text-sm leading-6 text-foreground text-pretty", valueClassName)}>{value}</dd>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardContent className="space-y-5 p-6 md:p-8">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-10 w-3/4 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OutputSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-6 w-56 rounded-2xl" />
        <Skeleton className="h-4 w-3/4 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Skeleton className="h-6 w-48 rounded-2xl" />
        <Skeleton className="h-4 w-60 rounded-full" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NotesGrid({ clientNextStep }: { clientNextStep: string }) {
  return (
    <div className="grid gap-4">
      <Card className="border-border/60 bg-white/95 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-xl tracking-tight text-primary text-balance">What this means</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            G1 checks risky actions before they run. If something is missing, unsafe, or not approved, it stops the action.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-white/95 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-xl tracking-tight text-primary text-balance">Safety rule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            UNKNOWN = BLOCK. Missing proof means the action will not run.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-white/95 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-xl tracking-tight text-primary text-balance">Client next step</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">{clientNextStep}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function G1ComplianceGuardPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [snapshot, setSnapshot] = useState<G1ComplianceGuardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/g1-compliance-guard/latest"), { cache: "no-store" });
      const body = (await parseJsonResponse<G1ResponseBody>(response)) ?? null;

      if (!response.ok) {
        throw new Error(body?.message || `Request failed (${response.status})`);
      }

      if (body?.workflow_group === "G1") {
        setSnapshot(body);
      } else {
        setSnapshot(null);
      }
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load G1 compliance data.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const sortedDecisions = useMemo(() => {
    const decisions = snapshot?.latest_decisions ?? [];
    return [...decisions].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
  }, [snapshot]);

  const latestDecision = sortedDecisions[0] ?? null;
  const recentChecks = sortedDecisions.slice(0, 3);
  const displayStatus = getDisplayStatus(latestDecision?.decision ?? null);
  const displayResult = getDisplayResult(latestDecision?.decision ?? null);
  const statusMessage = displayStatusMessages[displayStatus];
  const statusActionNeededLabel = getStatusActionNeededLabel(displayResult);
  const lastChecked = formatLastChecked(latestDecision?.time ?? snapshot?.last_checked_at);
  const latestOutputMeaning = getLatestOutputMeaning(latestDecision ? getDisplayResult(latestDecision.decision) : null);
  const latestOutputSentence = getLatestOutputSentence(
    latestDecision
      ? {
          requested_by_workflow: latestDecision.requested_by_workflow,
          action_type_label: latestDecision.action_type_label,
          platform: latestDecision.platform,
        }
      : null,
  );
  const clientNextStepLabel = getClientNextStepLabel(latestDecision ? displayResult : null);
  const hasContent = Boolean(latestDecision);
  const showSkeleton = loading && !snapshot;

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(61,10,69,0.08),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(207,168,124,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.88),_rgba(250,245,241,0.98))]" />
        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b border-border/60 bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <main className="w-full space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
              <header className="overflow-hidden rounded-[2rem] border border-border/60 bg-white/95 shadow-sm">
                <div className="flex flex-col gap-4 px-6 py-6 md:px-8 md:py-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground" translate="no">
                      G1 Compliance Guard
                    </p>
                    <h1 className="font-serif text-3xl tracking-tight text-foreground text-balance md:text-4xl" translate="no">
                      G1 — Compliance Guard
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty md:text-base">
                      Safety check for all risky workflow actions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-white shadow-none">
                      <Link href="/dashboard/n8n-automations">
                        <ArrowLeft data-icon="inline-start" />
                        Back to N8N Automations
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border/70 bg-white shadow-none"
                      onClick={() => void loadSnapshot()}
                      disabled={loading}
                    >
                      <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
                      {loading ? (snapshot ? "Refreshing…" : "Loading…") : "Refresh"}
                    </Button>
                  </div>
                </div>
              </header>

              {loadError ? (
                <Card role="alert" className="border-rose-200 bg-rose-50 shadow-none">
                  <CardContent className="p-4 text-sm leading-6 text-rose-900">
                    <span className="font-semibold">G1 data load failed.</span> {loadError}
                  </CardContent>
                </Card>
              ) : null}

              {showSkeleton ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    <StatusSkeleton />
                    <OutputSkeleton />
                    <TableSkeleton />
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-48 rounded-[2rem] border border-border/60 bg-white/95" />
                    <Skeleton className="h-44 rounded-[2rem] border border-border/60 bg-white/95" />
                    <Skeleton className="h-40 rounded-[2rem] border border-border/60 bg-white/95" />
                  </div>
                </div>
              ) : hasContent ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardContent className="space-y-6 p-6 md:p-8">
                        <div className="space-y-2">
                          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.24em]", statusTextClasses[displayStatus])}>
                            {displayStatus}
                          </p>
                          <h2 className="font-serif text-3xl leading-tight tracking-tight text-foreground text-balance">
                            {statusMessage}
                          </h2>
                        </div>

                        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <InfoField
                            label="Status"
                            value={
                              <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", getStatusTone(latestDecision?.decision ?? null))}>
                                {displayStatus}
                              </Badge>
                            }
                          />
                          <InfoField label="Last Checked" value={lastChecked} valueClassName="font-medium tabular-nums" />
                          <InfoField
                            label="Action Needed"
                            value={latestDecision?.action_needed ?? statusActionNeededLabel}
                            valueClassName="font-medium"
                          />
                          <InfoField
                            label="Last Result"
                            value={
                              <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", getResultTone(latestDecision?.decision ?? null))}>
                                {displayResultTitles[displayResult]}
                              </Badge>
                            }
                          />
                        </dl>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardHeader className="space-y-2">
                        <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Latest Output</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">
                          What G1 checked last.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                          <p className="text-sm font-medium leading-6 text-foreground text-pretty">{latestOutputSentence}</p>
                        </div>

                        <dl className="grid gap-3 sm:grid-cols-3">
                          <InfoField
                            label="Result"
                            value={
                              <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", getResultTone(latestDecision?.decision ?? null))}>
                                {displayResultTitles[displayResult]}
                              </Badge>
                            }
                          />
                          <InfoField
                            label="Meaning"
                            value={latestOutputMeaning}
                            valueClassName="font-medium"
                          />
                          <InfoField
                            label="Action Needed"
                            value={latestDecision?.action_needed ?? "No action needed."}
                            valueClassName="font-medium"
                          />
                        </dl>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardHeader className="space-y-2">
                        <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Recent Safety Checks</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">Latest 3 checks only.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Checked At</TableHead>
                              <TableHead>Requested By</TableHead>
                              <TableHead>What G1 Checked</TableHead>
                              <TableHead>Platform</TableHead>
                              <TableHead>Result</TableHead>
                              <TableHead>Action Needed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recentChecks.length ? (
                              recentChecks.map((decision) => {
                                const rowResult = getDisplayResult(decision.decision);

                                return (
                                  <TableRow key={`${decision.time}-${decision.requested_by_workflow}-${decision.action_type}`}>
                                    <TableCell className="align-top whitespace-nowrap font-medium tabular-nums text-foreground">
                                      {formatCheckTime(decision.time)}
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <span className="font-medium text-foreground" translate="no">
                                        {decision.requested_by_workflow}
                                      </span>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <span className="font-medium text-foreground" translate="no">
                                        {decision.action_type_label}
                                      </span>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <span className="text-sm font-medium text-foreground" translate="no">
                                        {decision.platform}
                                      </span>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", resultToneClasses[rowResult])}>
                                        {displayResultTitles[rowResult]}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="align-top text-sm leading-6 text-foreground text-pretty">
                                      {decision.action_needed}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                  No G1 checks have loaded yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        <div className="border-t border-border/60 px-4 py-3">
                          <p className="text-xs leading-5 text-muted-foreground">
                            BLOCK means G1 safely stopped the action. The action did not run.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <aside className="space-y-4">
                    <NotesGrid clientNextStep={clientNextStepLabel} />
                  </aside>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    {!loadError ? (
                      <Card className="border-border/60 bg-white/95 shadow-sm">
                        <CardContent className="p-6">
                          <p className="text-sm font-semibold text-foreground">G1 is active, but no workflow action has been checked yet.</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
                            Real workflow checks will appear here once the compliance log has a downstream action.
                          </p>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>

                  <aside className="space-y-4">
                    <NotesGrid clientNextStep={clientNextStepLabel} />
                  </aside>
                </div>
              )}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
