"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { formatDateTime, formatRelativeTime } from "@/components/admin-dashboard/n8n-automations-common";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  type G7DashboardSummary,
  type G7ProofResultBadge,
  type G7ProofView,
  getG7ProofResultLabel,
  getG7ProofResultToneClass,
  getG7SubmissionDisplayResult,
} from "@/lib/admin/g7-dashboard-summary";

type G7DashboardResponse = G7DashboardSummary;

type G7RunResponse = {
  status: "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "ERROR";
  message: string;
  handled_at: string;
};

type RequestOptions = RequestInit & { silent?: boolean };

type G7IntendedUse = "ORGANIC_POST" | "LANDING_PAGE" | "AD_COPY" | "SOCIAL_POST" | "OTHER";
type G7RequestedByWorkflow = "G4" | "G5" | "G6" | "G7" | "G12";

type G7ProofFormState = {
  sku: string;
  urgencyClaim: string;
  discountCode: string;
  intendedUse: G7IntendedUse;
  requestedByWorkflow: G7RequestedByWorkflow;
  actor: string;
};

type SubmissionFeedback = {
  status: G7RunResponse["status"];
  message: string;
  handledAt: string | null;
};

const G7_DASHBOARD_ROUTE = "/api/admin/workflow-dashboard/g7";
const G7_RUN_ROUTE = "/api/admin/workflow-dashboard/g7/run";

const DEFAULT_FORM: G7ProofFormState = {
  sku: "",
  urgencyClaim: "",
  discountCode: "",
  intendedUse: "ORGANIC_POST",
  requestedByWorkflow: "G4",
  actor: "admin_ui",
};

const INTENDED_USE_OPTIONS: Array<{ label: string; value: G7IntendedUse }> = [
  { label: "Organic post", value: "ORGANIC_POST" },
  { label: "Landing page", value: "LANDING_PAGE" },
  { label: "Ad copy", value: "AD_COPY" },
  { label: "Social post", value: "SOCIAL_POST" },
  { label: "Other", value: "OTHER" },
];

const REQUESTED_BY_WORKFLOW_OPTIONS: Array<{ label: string; value: G7RequestedByWorkflow }> = [
  { label: "G4", value: "G4" },
  { label: "G5", value: "G5" },
  { label: "G6", value: "G6" },
  { label: "G7", value: "G7" },
  { label: "G12", value: "G12" },
];

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

const formatLastCheckedLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return formatDateTime(value);
};

const formatRowTimeLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatDateTime(value)} · ${formatRelativeTime(value)}`;
};

const formatDisplayValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "—";
  }

  const text = String(value).trim();
  return text || "—";
};

const formatSecondStockProof = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Second proof missing";
  }
  return "Second proof verified";
};

const formatDiscountStatus = (value: string | null | undefined) => {
  if (!value || value.trim() === "") {
    return "No discount";
  }
  
  const text = value.trim().toLowerCase();
  if (text === "active") return "Active";
  if (text === "expired") return "Expired";
  if (text === "paused") return "Paused";
  
  // Return title-cased fallback if unknown
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const isActionIssueListVisible = (issues: string[]) => issues.length > 0;

const getSummaryResultTone = (result: G7ProofResultBadge) => getG7ProofResultToneClass(result);

const getSummaryResultLabel = (result: G7ProofResultBadge) => getG7ProofResultLabel(result);

function SummaryCard({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  helper?: string | null;
  valueClassName?: string;
}) {
  return (
    <Card className="rounded-[24px] border-border/60 bg-white shadow-sm">
      <CardContent className="space-y-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <div className={cn("text-xl font-semibold tracking-tight text-foreground", valueClassName)}>{value}</div>
        {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProofField({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: ReactNode;
  helper?: string | null;
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

function LoadingState() {
  return (
    <>
      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6 md:p-8">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="h-10 w-3/5 rounded-[20px]" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`g7-summary-skeleton-${index}`} className="h-24 rounded-[22px]" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-28 rounded-[22px]" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={`g7-proof-skeleton-${index}`} className="h-20 rounded-[22px]" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-24 rounded-[22px]" />
            <Skeleton className="h-11 w-48 rounded-full" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4 md:p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`g7-table-skeleton-${index}`} className="h-14 rounded-[18px]" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function ResultCallout({
  proof,
  className,
}: {
  proof: G7ProofView;
  className?: string;
}) {
  const toneClass =
    proof.displayResult === "PASS"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : proof.displayResult === "NEEDS_EVIDENCE"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-rose-200 bg-rose-50 text-rose-950";

  const icon = proof.rawResult === "PASS" ? <ShieldCheck /> : <AlertTriangle />;

  return (
    <Alert variant="default" className={cn("rounded-[22px] border p-4 shadow-sm", toneClass, className)}>
      {icon}
      <AlertTitle className="text-sm font-semibold tracking-tight text-foreground">{proof.clientSummary}</AlertTitle>
      <AlertDescription className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p className="text-foreground">{proof.actionNeeded}</p>
        {isActionIssueListVisible(proof.otherProofIssues) ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Other proof issues</p>
            <ul className="ml-4 list-disc space-y-1">
              {proof.otherProofIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function EmptyStateCard({ message }: { message: string }) {
  return (
    <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardContent className="p-6 md:p-8">
        <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
          {message}
        </div>
      </CardContent>
    </Card>
  );
}

function getProofActionButtonLabel(submitting: boolean) {
  return submitting ? "Checking..." : "Check Proof";
}

function getSubmissionDisplayTone(status: SubmissionFeedback["status"], message: string) {
  const displayResult = getG7SubmissionDisplayResult(status, message);
  return displayResult === "PASS" ? "PASS" : displayResult === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCK";
}

export default function G7OfferSafetyPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [dashboard, setDashboard] = useState<G7DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState<SubmissionFeedback | null>(null);
  const [form, setForm] = useState<G7ProofFormState>(DEFAULT_FORM);
  const hasLoadedRef = useRef(false);

  const [selectedProofDrawer, setSelectedProofDrawer] = useState<G7ProofView | null>(null);

  const loadDashboard = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!silent) {
        setError(null);
      }

      try {
        const response = await request(buildRouteUrl(G7_DASHBOARD_ROUTE), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<G7DashboardResponse>(response);
        if (!response.ok || !body) {
          throw new Error("G7 data could not be loaded. Check the n8n connection.");
        }

        setDashboard(body);
        hasLoadedRef.current = true;
        setError(null);
        return body;
      } catch {
        const message = "G7 data could not be loaded. Check the n8n connection.";
        setError(message);
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadDashboard({ silent: true });
  }, [loadDashboard]);

  useEffect(() => {
    if (!runOpen) {
      return;
    }

    setForm(DEFAULT_FORM);
    setFormError(null);
    setSubmissionFeedback(null);
  }, [runOpen]);

  const hasRecentChecks = Boolean(dashboard?.recentOfferChecks.length);
  const latestProof = hasRecentChecks ? dashboard?.latestOfferProof ?? dashboard?.recentOfferChecks[0] ?? null : null;
  const latestResult = latestProof?.rawResult ?? "NOT_RUN";
  const latestResultBadgeTone = getSummaryResultTone(latestResult);
  const latestCheckedLabel = formatLastCheckedLabel(
    hasRecentChecks ? latestProof?.checkedAt ?? dashboard?.counts.latestCheckedAt ?? dashboard?.checkedAt ?? null : null,
  );

  const openRunDialog = () => {
    if (!dashboard || loading || refreshing || submitting) {
      return;
    }

    setRunOpen(true);
  };

  const handleRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sku = form.sku.trim();
    if (!sku) {
      setFormError("Please add a SKU before checking proof.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSubmissionFeedback(null);

    try {
      const response = await request(buildRouteUrl(G7_RUN_ROUTE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku,
          urgency_claim: form.urgencyClaim.trim() || null,
          discount_code: form.discountCode.trim() || null,
          intended_use: form.intendedUse,
          requested_by_workflow: form.requestedByWorkflow,
          actor: form.actor.trim() || "admin_ui",
        }),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<G7RunResponse>(response);
      if (!response.ok || !body) {
        throw new Error("Proof check failed. No claim was approved.");
      }

      if (body.status === "ERROR") {
        throw new Error(body.message || "Proof check failed. No claim was approved.");
      }

      setSubmissionFeedback({
        status: body.status,
        message: body.message,
        handledAt: body.handled_at ?? null,
      });

      await loadDashboard({ silent: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Proof check failed. No claim was approved.";
      setFormError(message);
      setSubmissionFeedback(null);
    } finally {
      setSubmitting(false);
    }
  };

  const headerBadges = loading && !dashboard ? (
    <>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        Loading
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        Fetching dashboard
      </Badge>
    </>
  ) : (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", latestResultBadgeTone)}>
        Latest result: {latestResult}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 data-icon="inline-start" />
        Last checked: {latestCheckedLabel}
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

      <Button
        type="button"
        className="h-10 min-w-[170px] justify-center rounded-full px-4"
        onClick={openRunDialog}
        disabled={loading || refreshing || submitting || !dashboard}
      >
        <Play data-icon="inline-start" />
        Check Proof
      </Button>
    </>
  );

  const proofResultBadge = (proof: G7ProofView) => (
    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getSummaryResultTone(proof.displayResult))}>
      {getSummaryResultLabel(proof.displayResult)}
    </Badge>
  );

  const topActionNeeded = hasRecentChecks ? dashboard?.actionNeeded ?? "Proof needs attention." : dashboard?.emptyStateCopy ?? "Proof needs attention.";

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title="G7 — Inventory + Offer Safety"
      description="Verifies stock, discount, expiry, and proof before claims are used."
      badges={headerBadges}
      actions={headerActions}
    >
      {error && !dashboard ? (
        <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="flex items-start gap-3 rounded-[22px] border border-rose-200 bg-white/80 p-4 text-rose-950">
              <AlertTriangle className="mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">{error}</p>
                <p className="text-sm leading-6 text-rose-900/80">Try again once the n8n connection is available.</p>
              </div>
            </div>
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => void loadDashboard({ silent: false })} disabled={refreshing || loading}>
              <RefreshCcw data-icon="inline-start" className={cn(refreshing || loading ? "animate-spin" : undefined)} />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading && !dashboard ? (
        <LoadingState />
      ) : dashboard ? (
        <>
          {error ? (
            <Card role="alert" className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-4 text-sm leading-6 text-amber-950">{error}</CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Latest Result"
              value={
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getSummaryResultTone(latestResult))}>
                  {latestResult}
                </Badge>
              }
              helper="Value from the latest proof."
            />
            <SummaryCard
              label="Verified Proofs"
              value={dashboard.counts.pass}
              helper="Checks that were verified safely."
            />
            <SummaryCard
              label="Blocked Checks"
              value={dashboard.counts.block}
              helper="Checks that were safely stopped."
            />
            <SummaryCard
              label="Action Needed"
              value={<span className="text-base font-medium leading-6 text-foreground">{topActionNeeded}</span>}
              helper="Client-friendly next step."
              valueClassName="text-base font-medium tracking-normal"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest Proof</CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      The most recent proof, shown in plain language and without backend details.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-6 pt-6 md:p-8 md:pt-6">
                {latestProof ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <ProofField
                      label="Result"
                      value={proofResultBadge(latestProof)}
                    />
                    <ProofField
                      label="Product"
                      value={<span className="font-medium text-foreground">{formatDisplayValue(latestProof.productName)}</span>}
                    />
                    <ProofField
                      label="SKU"
                      value={<span translate="no" className="font-medium text-foreground">{formatDisplayValue(latestProof.sku)}</span>}
                    />
                    <ProofField
                      label="Urgency claim"
                      value={<span className="font-medium text-foreground">{formatDisplayValue(latestProof.urgencyClaim)}</span>}
                    />
                    <ProofField
                      label="Stock available"
                      value={<span className="font-medium text-foreground">{formatDisplayValue(latestProof.stockAvailable)}</span>}
                    />
                    <ProofField
                      label="Second stock proof"
                      value={<span className="font-medium text-foreground">{formatSecondStockProof(latestProof.secondStockProof)}</span>}
                    />
                    <ProofField
                      label="Discount"
                      value={<span className="font-medium text-foreground">{formatDiscountStatus(latestProof.discountStatus)}</span>}
                    />
                    <ProofField
                      label="Action needed"
                      value={<span className="font-medium text-foreground">{latestProof.actionNeeded}</span>}
                      className="md:col-span-2 xl:col-span-2"
                    />
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    {dashboard.emptyStateCopy}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm flex flex-col">
              <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Next Step</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6 p-6 pt-6 md:p-8 flex-1 flex flex-col justify-between">
                {latestProof ? (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">{latestProof.clientSummary}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{latestProof.actionNeeded}</p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-foreground text-pretty">{dashboard.emptyStateCopy}</p>
                )}

                <div>
                  <Button
                    type="button"
                    className="h-11 justify-center rounded-full px-5"
                    onClick={openRunDialog}
                    disabled={loading || refreshing || submitting}
                  >
                    <Play data-icon="inline-start" />
                    Check Proof
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Proof Checks</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">Latest checks, newest first.</CardDescription>
                </div>
                {refreshing ? (
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Updating
                  </Badge>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {hasRecentChecks ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[1080px] table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Time</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Product / SKU</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Claim</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Stock</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Discount</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Result</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Action Needed</TableHead>
                        <TableHead className="px-6 py-4 w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recentOfferChecks.slice(0, 8).map((proof, index) => (
                        <TableRow
                          key={`${proof.checkedAt ?? "g7"}-${proof.sku ?? "sku"}-${proof.displayResult}-${index}`}
                          className={cn("group hover:bg-primary/5", proof.displayResult === "NEEDS_EVIDENCE" && "bg-amber-50/30")}
                        >
                          <TableCell className="align-top px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            <div className="space-y-1">
                              <p>{formatRowTimeLabel(proof.checkedAt)}</p>
                              <p className="text-xs text-muted-foreground">{proof.checkedAt ? formatRelativeTime(proof.checkedAt) : "Not run yet"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top px-6 py-4">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{formatDisplayValue(proof.productName)}</p>
                              <p className="text-xs text-muted-foreground" translate="no">
                                {formatDisplayValue(proof.sku)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top px-6 py-4 text-sm leading-6 text-foreground">{formatDisplayValue(proof.urgencyClaim)}</TableCell>
                          <TableCell className="align-top px-6 py-4 text-sm leading-6 text-foreground">{formatDisplayValue(proof.stockAvailable)}</TableCell>
                          <TableCell className="align-top px-6 py-4 text-sm leading-6 text-foreground">{formatDisplayValue(proof.discountCode)}</TableCell>
                          <TableCell className="align-top px-6 py-4 whitespace-nowrap">{proofResultBadge(proof)}</TableCell>
                          <TableCell className="align-top px-6 py-4 text-sm leading-6 text-foreground max-w-[200px]">
                            <div className="space-y-1">
                              <p className="truncate">{proof.actionNeeded}</p>
                              {isActionIssueListVisible(proof.otherProofIssues) ? (
                                <p className="text-xs leading-5 text-muted-foreground truncate">
                                  + {proof.otherProofIssues.length} other issue{proof.otherProofIssues.length !== 1 ? 's' : ''}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top px-6 py-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 rounded-full px-3 text-xs font-medium"
                              onClick={() => setSelectedProofDrawer(proof)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-4 md:p-6">
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    {dashboard.emptyStateCopy}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog
        open={runOpen}
        onOpenChange={(open) => {
          setRunOpen(open);
          if (!open) {
            setFormError(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,58rem)] flex-col overflow-hidden rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleRunSubmit}>
            <div className="border-b border-border/60 bg-muted/20 px-6 py-5">
              <DialogHeader className="items-start text-left">
                <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Check Proof</DialogTitle>
                <DialogDescription className="max-w-prose text-sm leading-6 text-muted-foreground">
                  Use the smallest safe set of fields. The result will stay client-friendly and the dashboard will refresh after the check.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <FieldGroup className="gap-4">
                {formError ? (
                  <Alert variant="destructive" className="rounded-[22px] border-rose-200 bg-rose-50">
                    <AlertTriangle />
                    <AlertTitle className="text-foreground">Proof check failed</AlertTitle>
                    <AlertDescription className="text-rose-900">{formError}</AlertDescription>
                  </Alert>
                ) : null}

                {submissionFeedback ? (
                  <Alert
                    variant="default"
                    className={cn(
                      "rounded-[22px] border",
                      getSubmissionDisplayTone(submissionFeedback.status, submissionFeedback.message) === "PASS"
                        ? "border-emerald-200 bg-emerald-50"
                        : getSubmissionDisplayTone(submissionFeedback.status, submissionFeedback.message) === "NEEDS_EVIDENCE"
                          ? "border-amber-200 bg-amber-50"
                          : "border-rose-200 bg-rose-50",
                    )}
                  >
                    {getSubmissionDisplayTone(submissionFeedback.status, submissionFeedback.message) === "PASS" ? (
                      <CheckCircle2 />
                    ) : (
                      <AlertTriangle />
                    )}
                    <AlertTitle className="text-foreground">Result</AlertTitle>
                    <AlertDescription className="space-y-1 text-foreground">
                      <p>{submissionFeedback.message}</p>
                      {submissionFeedback.handledAt ? (
                        <p className="text-xs text-muted-foreground">Processed {formatDateTime(submissionFeedback.handledAt)}</p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="g7-sku">SKU</FieldLabel>
                  <FieldContent>
                    <Input
                      id="g7-sku"
                      value={form.sku}
                      onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                      placeholder="SKU-9002"
                      autoComplete="off"
                      required
                      className="h-11 rounded-[20px] border-border/70 bg-white"
                    />
                    <FieldDescription>The SKU the client can recognize. Required.</FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="g7-urgency-claim">Urgency claim</FieldLabel>
                  <FieldContent>
                    <Input
                      id="g7-urgency-claim"
                      value={form.urgencyClaim}
                      onChange={(event) => setForm((current) => ({ ...current, urgencyClaim: event.target.value }))}
                      placeholder="Low stock"
                      autoComplete="off"
                      className="h-11 rounded-[20px] border-border/70 bg-white"
                    />
                    <FieldDescription>Leave blank if no urgency wording is being used.</FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="g7-discount-code">Discount code</FieldLabel>
                  <FieldContent>
                    <Input
                      id="g7-discount-code"
                      value={form.discountCode}
                      onChange={(event) => setForm((current) => ({ ...current, discountCode: event.target.value }))}
                      placeholder="Optional"
                      autoComplete="off"
                      className="h-11 rounded-[20px] border-border/70 bg-white"
                    />
                    <FieldDescription>If you do not have a code, leave this empty. Nothing placeholder-like is sent.</FieldDescription>
                  </FieldContent>
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="g7-intended-use">Intended use</FieldLabel>
                    <FieldContent>
                      <Select
                        value={form.intendedUse}
                        onValueChange={(value) => setForm((current) => ({ ...current, intendedUse: value as G7IntendedUse }))}
                      >
                        <SelectTrigger id="g7-intended-use" className="h-11 w-full rounded-[20px] border-border/70 bg-white">
                          <SelectValue placeholder="Select intended use" />
                        </SelectTrigger>
                        <SelectContent>
                          {INTENDED_USE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>Defaults to ORGANIC_POST.</FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="g7-requested-by-workflow">Requested by workflow</FieldLabel>
                    <FieldContent>
                      <Select
                        value={form.requestedByWorkflow}
                        onValueChange={(value) => setForm((current) => ({ ...current, requestedByWorkflow: value as G7RequestedByWorkflow }))}
                      >
                        <SelectTrigger id="g7-requested-by-workflow" className="h-11 w-full rounded-[20px] border-border/70 bg-white">
                          <SelectValue placeholder="Select workflow" />
                        </SelectTrigger>
                        <SelectContent>
                          {REQUESTED_BY_WORKFLOW_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>Defaults to G4.</FieldDescription>
                    </FieldContent>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="g7-actor">Actor</FieldLabel>
                  <FieldContent>
                    <Input
                      id="g7-actor"
                      value={form.actor}
                      onChange={(event) => setForm((current) => ({ ...current, actor: event.target.value }))}
                      placeholder="admin_ui"
                      autoComplete="off"
                      className="h-11 rounded-[20px] border-border/70 bg-white"
                    />
                    <FieldDescription>Defaults to admin_ui.</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter className="border-t border-border/60 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-5"
                onClick={() => setRunOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 rounded-full px-5" disabled={submitting}>
                <Loader2 data-icon="inline-start" className={cn(submitting ? "animate-spin" : undefined)} />
                {getProofActionButtonLabel(submitting)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedProofDrawer} onOpenChange={(open) => !open && setSelectedProofDrawer(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white p-6 sm:p-8">
          <SheetHeader className="mb-6 px-0 pt-0">
            <SheetTitle className="font-serif text-2xl text-primary">Proof Details</SheetTitle>
            <SheetDescription>
              Details of the safety check run on {selectedProofDrawer?.checkedAt ? formatDateTime(selectedProofDrawer.checkedAt) : "unknown"}.
            </SheetDescription>
          </SheetHeader>
          
          {selectedProofDrawer && (
            <div className="space-y-6 pb-8">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Status</h4>
                <div className="flex items-start">
                  {proofResultBadge(selectedProofDrawer)}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Action Needed</h4>
                <p className="text-sm leading-6 font-medium text-foreground text-pretty">
                  {selectedProofDrawer.actionNeeded}
                </p>
                {isActionIssueListVisible(selectedProofDrawer.otherProofIssues) && (
                  <div className="mt-2 rounded-xl bg-muted/20 p-4 border border-border/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Other issues found</p>
                    <ul className="ml-4 list-disc space-y-1 text-sm leading-6 text-foreground">
                      {selectedProofDrawer.otherProofIssues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product Details</h4>
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/50 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Product Name</p>
                    <p className="text-sm font-medium">{formatDisplayValue(selectedProofDrawer.productName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">SKU</p>
                    <p className="text-sm font-medium break-all" translate="no">{formatDisplayValue(selectedProofDrawer.sku)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Claims & Evidence</h4>
                <div className="space-y-4 rounded-xl border border-border/50 p-4">
                  <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Urgency Claim</p>
                      <p className="text-sm font-medium">{formatDisplayValue(selectedProofDrawer.urgencyClaim)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Stock Checked</p>
                      <p className="text-sm font-medium">{formatDisplayValue(selectedProofDrawer.stockAvailable)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Second Stock Proof</p>
                    <p className="text-sm font-medium">{formatSecondStockProof(selectedProofDrawer.secondStockProof)}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Discount Info</h4>
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/50 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Discount Code</p>
                    <p className="text-sm font-medium break-all" translate="no">{formatDisplayValue(selectedProofDrawer.discountCode)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-medium">{formatDiscountStatus(selectedProofDrawer.discountStatus)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </WorkflowDashboardShell>
  );
}
