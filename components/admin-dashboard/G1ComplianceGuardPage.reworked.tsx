"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Clock3, Eye } from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  getG1RemediationAction,
  type G1ComplianceGuardSnapshot,
  type G1ComplianceGuardStatus,
} from "@/server/next/api/g1-compliance-guard-ui";

type G1UiStatus = G1ComplianceGuardStatus;
type G1RemediationAction = ReturnType<typeof getG1RemediationAction>;

type G1ResponseBody = {
  status: "PASS" | "EMPTY" | "ERROR";
  response_type?: string;
  message?: string;
  snapshot?: G1ComplianceGuardSnapshot;
};

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

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

const statusLabels: Record<G1UiStatus, string> = {
  PASS: "Pass",
  BLOCK: "Blocked",
  MANUAL_ONLY: "Manual review",
  PENDING_APPROVAL: "Pending approval",
  NEEDS_EVIDENCE: "Needs evidence",
  ERROR: "Error",
};

const statusTones: Record<G1UiStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-700",
  MANUAL_ONLY: "border-amber-200 bg-amber-50 text-amber-700",
  PENDING_APPROVAL: "border-sky-200 bg-sky-50 text-sky-700",
  NEEDS_EVIDENCE: "border-amber-200 bg-amber-50 text-amber-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Not yet checked";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatTimeForTable = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function LoadingCard() {
  return (
    <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Skeleton className="h-8 w-72 rounded-2xl" />
        <Skeleton className="h-4 w-96 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl md:col-span-2" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableLoadingCard() {
  return (
    <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-2xl" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`g1-table-skeleton-${index}`} className="h-12 rounded-2xl" />
        ))}
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/15 p-4", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

function G1ActionButton({
  action,
  className,
}: {
  action: G1RemediationAction;
  className?: string;
}) {
  const content = (
    <span className="flex w-full items-start gap-2 whitespace-normal text-left leading-tight">
      <ArrowRight data-icon="inline-start" className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 whitespace-normal break-words">{action.label}</span>
    </span>
  );
  const buttonClassName = cn(
    "h-auto min-h-9 w-full items-start justify-start whitespace-normal rounded-full border-border/70 bg-white px-3 py-2 text-left text-xs font-medium leading-tight shadow-sm",
    className,
  );

  if (!action.href || action.disabled) {
    return (
      <Button type="button" variant="outline" className={buttonClassName} disabled>
        {content}
      </Button>
    );
  }

  if (action.href.startsWith("#")) {
    return (
      <Button asChild variant="outline" className={buttonClassName}>
        <a href={action.href}>{content}</a>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className={buttonClassName}>
      <Link href={action.href}>{content}</Link>
    </Button>
  );
}

export default function G1ComplianceGuardPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [snapshot, setSnapshot] = useState<G1ComplianceGuardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSnapshot = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await request(buildRouteUrl("/api/admin/g1-compliance-guard/latest"), {
          cache: "no-store",
        });

        const body = await parseJsonResponse<G1ResponseBody>(response);
        if (!active) {
          return;
        }

        if (!response.ok || !body?.snapshot) {
          throw new Error(body?.message ?? `Unable to load G1 compliance data (${response.status}).`);
        }

        setSnapshot(body.snapshot);
      } catch (error) {
        if (!active) {
          return;
        }

        setSnapshot(null);
        setLoadError(error instanceof Error ? error.message : "Unable to load G1 compliance data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, [request]);

  const headerStatus = loadError && !snapshot ? "ERROR" : snapshot?.status ?? "PENDING_APPROVAL";
  const latestOutcome = snapshot?.latestOutcome ?? null;
  const recentOutcomes = (snapshot?.recentOutcomes ?? []).slice(0, 8);
  const showSkeleton = loading && !snapshot;
  const hasLatestOutcomeRecord = Boolean(latestOutcome?.time);
  const latestOutcomeAction = hasLatestOutcomeRecord && latestOutcome
    ? getG1RemediationAction(latestOutcome)
    : {
      label: "View Safety Checks",
      helperText: "No action needed.",
      href: "#recent-safety-checks",
      disabled: false,
    };
  const latestWorkflowSentence = hasLatestOutcomeRecord
    ? `This check applied to ${latestOutcome?.requestedByWorkflow ?? "Unknown workflow"} on ${latestOutcome?.platformLabel ?? "Internal system"}.`
    : "No workflow actions have been checked yet.";

  return (
    <WorkflowDashboardShell
      eyebrow="Compliance gate"
      title="G1 — Compliance Guard"
      description="Checks whether risky workflow actions are safe before they run."
      badges={
        <>
          <Badge variant="outline" className={cn("h-10 rounded-full border px-4 text-xs font-semibold", statusTones[headerStatus])}>
            {statusLabels[headerStatus]}
          </Badge>
          <Badge variant="outline" className="h-10 rounded-full border-border/70 bg-secondary/20 px-4 text-xs font-semibold text-muted-foreground">
            <Clock3 className="mr-2 size-3.5" />
            {formatDateTime(snapshot?.lastRunAt)}
          </Badge>
        </>
      }
      actions={
        <>
          <Button asChild className="h-10 min-w-[152px] justify-center rounded-full px-5">
            <a href="#recent-safety-checks">
              <Eye data-icon="inline-start" />
              View Safety Checks
            </a>
          </Button>
        </>
      }
    >
      {loadError && !snapshot ? (
        <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{loadError}</CardContent>
        </Card>
      ) : null}

      {showSkeleton ? (
        <>
          <LoadingCard />
          <TableLoadingCard />
        </>
      ) : snapshot ? (
        <>
          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest Safety Outcome</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">What G1 recorded most recently, and the workflow it applies to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTones[latestOutcome?.result ?? headerStatus])}>
                    {statusLabels[latestOutcome?.result ?? headerStatus]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Handled {formatDateTime(latestOutcome?.handledAt ?? snapshot.lastRunAt)}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <G1ActionButton action={latestOutcomeAction} className="min-w-[184px]" />
                  <p className="max-w-xs text-xs leading-5 text-muted-foreground lg:text-right">{latestOutcomeAction.helperText}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium leading-6 text-foreground text-pretty">{latestWorkflowSentence}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <DetailField label="Checked workflow" value={latestOutcome?.requestedByWorkflow ?? "No workflow actions have been checked yet."} className="md:col-span-2" />
                <DetailField label="Action type" value={latestOutcome?.actionTypeLabel ?? "Workflow action check"} />
                <DetailField label="Platform" value={latestOutcome?.platformLabel ?? "Internal system"} />
                <DetailField label="What happened" value={latestOutcome?.whatHappened ?? "This is waiting for approval."} />
                <DetailField label="Action needed" value={latestOutcome?.actionNeeded ?? "Approve the publishing action first."} />
                <DetailField label="Handled time" value={formatTimeForTable(latestOutcome?.handledAt ?? snapshot.lastRunAt)} />
                {latestOutcome?.result === "BLOCK" && latestOutcome.whyItBlocked ? (
                  <DetailField label="Why it blocked" value={latestOutcome.whyItBlocked} className="md:col-span-2 border-amber-200 bg-amber-50/80" />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card id="recent-safety-checks" className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Safety Checks</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">Latest checks from Supabase, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[1430px] table-fixed">
                  <colgroup>
                    <col className="w-[160px]" />
                    <col className="w-[120px]" />
                    <col className="w-[240px]" />
                    <col className="w-[280px]" />
                    <col className="w-[230px]" />
                    <col className="w-[240px]" />
                    <col className="w-[160px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Time</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Checked</TableHead>
                      <TableHead className="px-4">Happened</TableHead>
                      <TableHead className="px-4">Action needed</TableHead>
                      <TableHead className="px-4">Insights</TableHead>
                      <TableHead className="px-4 text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOutcomes.length ? (
                      recentOutcomes.map((outcome, index) => {
                        const rowAction = getG1RemediationAction(outcome);

                        return (
                          <TableRow key={`${outcome.time ?? "g1-outcome"}-${index}`} className={cn(index === 0 && "bg-primary/5")}>
                            <TableCell className="align-top whitespace-nowrap px-4 font-medium text-foreground">{formatTimeForTable(outcome.time)}</TableCell>
                            <TableCell className="align-top px-4">
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTones[outcome.result])}>
                                {statusLabels[outcome.result]}
                              </Badge>
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-foreground break-words">
                              {outcome.checked}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-foreground break-words">
                              {outcome.whatHappened}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-foreground break-words">
                              {outcome.actionNeeded}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-muted-foreground break-words">
                              {outcome.insight ?? "—"}
                            </TableCell>
                            <TableCell className="align-top px-4">
                              <G1ActionButton action={rowAction} className="h-8 w-full justify-center px-3 text-[11px]" />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No safety checks have loaded yet.
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
