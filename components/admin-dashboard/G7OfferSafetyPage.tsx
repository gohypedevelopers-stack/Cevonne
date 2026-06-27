"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ExternalLink, Play, RefreshCcw, Clock3 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { formatDateTime, formatRelativeTime } from "@/components/admin-dashboard/n8n-automations-common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  getG7DiscountStatusToneClass,
  getG7StockStatusToneClass,
  type G7OfferProofRecord,
  type G7WorkflowDetail,
} from "@/lib/admin/g7-offer-safety";
import {
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";

type G7WorkflowDetailResponse = G7WorkflowDetail;

type G7WorkflowRunResponse = {
  status: WorkflowUiStatus;
  message: string;
  handled_at: string;
  detail: G7WorkflowDetail;
};

type G7ProofFormState = {
  product_or_sku: string;
  offer_code: string;
  offer_url: string;
  urgency_claim_text: string;
  actor: string;
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

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const buildEmptyForm = (actor: string): G7ProofFormState => ({
  product_or_sku: "",
  offer_code: "",
  offer_url: "",
  urgency_claim_text: "",
  actor,
});

const formatCheckedTime = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatDateTime(value)} · ${formatRelativeTime(value)}`;
};

const formatProductLabel = (proof: G7OfferProofRecord) => {
  const pieces = [proof.productId, proof.sku].filter((value): value is string => Boolean(value && value.trim()));
  const uniquePieces = [...new Set(pieces.map((value) => value.trim()))];
  if (uniquePieces.length > 0) {
    return uniquePieces.join(" · ");
  }

  return proof.productOrSku || "Unknown product";
};

const formatOfferUrlLabel = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.host}${path}` || value;
  } catch {
    return value;
  }
};

function LoadingState() {
  return (
    <>
      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6 md:p-8">
          <div className="h-5 w-44 animate-pulse rounded-full bg-muted/70" />
          <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-muted/60" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={`g7-latest-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="h-5 w-36 animate-pulse rounded-full bg-muted/70" />
            <div className="h-28 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
            <div className="h-10 w-44 animate-pulse rounded-full bg-muted/60" />
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted/70" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`g7-action-skeleton-${index}`} className="h-14 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4 md:p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`g7-table-skeleton-${index}`} className="h-14 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

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

export default function G7OfferSafetyPage() {
  const { authFetch, user } = useAuth();
  const request = authFetch ?? defaultRequest;
  const defaultActor = user?.email ?? user?.name ?? "admin";

  const [detail, setDetail] = useState<G7WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<G7ProofFormState>(() => buildEmptyForm(defaultActor));
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!runOpen) {
      return;
    }

    setForm(buildEmptyForm(defaultActor));
    setFormError(null);
  }, [defaultActor, runOpen]);

  const loadDetail = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!silent) {
        setLoadError(null);
      }

      try {
        const response = await request(buildRouteUrl("/api/admin/workflow-dashboard/g7"), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<G7WorkflowDetailResponse>(response);
        if (!response.ok || !body) {
          throw new Error("Unable to load offer checks right now.");
        }

        setDetail(body);
        hasLoadedRef.current = true;
        setLoadError(null);
        return body;
      } catch {
        const message = "Unable to load offer checks right now.";
        setLoadError(message);
        if (!silent) {
          toast.error(message);
        }
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadDetail({ silent: true });
  }, [loadDetail]);

  const latestProof = detail?.latestProof ?? null;
  const workflowStatus: WorkflowUiStatus = latestProof?.result ?? (detail?.status === "EMPTY" ? "NOT_RUN_YET" : detail?.workflow.status ?? "NOT_RUN_YET");
  const headerStatusLabel = detail ? (detail.status === "EMPTY" ? "Not run yet" : getWorkflowStatusLabel(workflowStatus)) : "Loading";
  const headerStatusTone = detail ? getWorkflowStatusTone(workflowStatus) : "border-slate-200 bg-slate-100 text-slate-700";
  const headerTimeLabel = detail ? formatCheckedTime(latestProof?.checkedAt ?? detail.lastRunAt) : "Loading offer checks";
  const hasRecords = Boolean(detail?.recentChecks.length);

  const openRunDialog = () => {
    if (!detail || loading || submitting) {
      return;
    }

    setForm(buildEmptyForm(defaultActor));
    setFormError(null);
    setRunOpen(true);
  };

  const handleRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail) {
      return;
    }

    const productOrSku = form.product_or_sku.trim();
    const offerCode = form.offer_code.trim();
    const offerUrl = form.offer_url.trim();
    const urgencyClaimText = form.urgency_claim_text.trim();
    const actor = form.actor.trim();

    if (!productOrSku || !offerCode || !offerUrl || !urgencyClaimText || !actor) {
      setFormError("Please fill in every required field before checking offer proof.");
      return;
    }

    if (!isValidHttpUrl(offerUrl)) {
      setFormError("Please enter a valid offer URL.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await request(buildRouteUrl("/api/admin/workflow-dashboard/g7/run"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_or_sku: productOrSku,
          offer_code: offerCode,
          offer_url: offerUrl,
          urgency_claim_text: urgencyClaimText,
          actor,
        }),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<G7WorkflowRunResponse>(response);
      if (!response.ok || !body) {
        throw new Error("Unable to check offer proof right now.");
      }

      if (body.detail) {
        setDetail(body.detail);
        hasLoadedRef.current = true;
      }

      if (body.status === "PASS") {
        toast.success(body.message || "Offer proof checked.");
      } else if (body.status === "BLOCK") {
        toast.error(body.message || "Offer proof was blocked.");
      } else if (body.status === "NEEDS_EVIDENCE") {
        toast.info(body.message || "More proof is required.");
      } else {
        toast.error(body.message || "Unable to check offer proof right now.");
      }

      setRunOpen(false);
      await loadDetail({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check offer proof right now.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const headerBadges = loading && !detail ? (
    <>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        Loading
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        Fetching rows
      </Badge>
    </>
  ) : (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", headerStatusTone)}>
        {headerStatusLabel}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 data-icon="inline-start" className="size-3.5" />
        {headerTimeLabel}
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
        disabled={loading || refreshing || submitting || !detail}
      >
        <Play data-icon="inline-start" />
        Check Offer Proof
      </Button>
    </>
  );

  const content = !detail ? null : (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-3 p-6 pb-0 md:p-8 md:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="font-serif text-3xl tracking-tight text-primary">Latest Offer Proof</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {latestProof ? latestProof.whatHappened : "The most recent verified row, shown in plain language."}
                </CardDescription>
              </div>

              {latestProof ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestProof.result))}>
                    {latestProof.result}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7StockStatusToneClass(latestProof.stockStatus))}>
                    {latestProof.stockStatus}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7DiscountStatusToneClass(latestProof.discountStatus))}>
                    {latestProof.discountStatus}
                  </Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-6 md:p-8 md:pt-6">
            {latestProof ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DetailField label="Product / SKU" value={<span className="font-medium text-foreground">{formatProductLabel(latestProof)}</span>} />
                <DetailField
                  label="Stock status"
                  value={
                    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7StockStatusToneClass(latestProof.stockStatus))}>
                      {latestProof.stockStatus}
                    </Badge>
                  }
                />
                <DetailField
                  label="Discount code"
                  value={<span className="font-medium text-foreground">{latestProof.discountCode ?? "Not set"}</span>}
                />
                <DetailField
                  label="Discount status"
                  value={
                    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7DiscountStatusToneClass(latestProof.discountStatus))}>
                      {latestProof.discountStatus}
                    </Badge>
                  }
                />
                <DetailField
                  label="Expiry date"
                  value={<span className="font-medium text-foreground">{latestProof.expiryDate ? formatDateTime(latestProof.expiryDate) : "Not set"}</span>}
                />
                <DetailField
                  label="Checked time"
                  value={<span className="font-medium text-foreground">{formatCheckedTime(latestProof.checkedAt ?? latestProof.time)}</span>}
                />
                <DetailField
                  label="Result"
                  value={
                    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestProof.result))}>
                      {latestProof.result}
                    </Badge>
                  }
                />
                <DetailField
                  label="Action needed"
                  value={<span className="font-medium text-foreground">{latestProof.actionNeeded}</span>}
                  className="md:col-span-2 xl:col-span-2"
                />
                <DetailField
                  label="Offer URL"
                  value={
                    latestProof.offerUrl ? (
                      <a
                        href={latestProof.offerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all font-medium text-primary underline underline-offset-4"
                      >
                        {formatOfferUrlLabel(latestProof.offerUrl)}
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">Not set</span>
                    )
                  }
                  className="md:col-span-2 xl:col-span-3"
                />
                <DetailField
                  label="Urgency claim"
                  value={<span className="font-medium text-foreground">{latestProof.urgencyClaimText ?? "Not set"}</span>}
                  className="md:col-span-2 xl:col-span-3"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
                {detail.emptyStateCopy}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
            <CardTitle className="font-serif text-2xl tracking-tight text-primary">Actions Needed</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              The next safe step, written for the client.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-6 md:p-8 md:pt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm leading-6 text-foreground text-pretty">
              {detail.mainActionNeeded}
            </div>
            <Button
              type="button"
              className="h-11 justify-center rounded-full px-5"
              onClick={openRunDialog}
              disabled={loading || refreshing || submitting}
            >
              <Play data-icon="inline-start" />
              Check Offer Proof
            </Button>
            <p className="text-sm leading-6 text-muted-foreground">
              G7 blocks fake urgency, expired discounts, stock mismatch, missing proof, and offer URL mismatch.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Offer Checks</CardTitle>
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
          <div className="overflow-x-auto">
            <Table className="min-w-[1080px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Time</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Product / SKU</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Stock</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Discount</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Result</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Action needed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hasRecords
                  ? detail.recentChecks.map((proof) => (
                      <TableRow key={[proof.time, proof.productOrSku, proof.discountCode, proof.offerUrl, proof.result].join("|")} className="group hover:bg-primary/5">
                        <TableCell className="align-top px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          <div className="space-y-1">
                            <p>{formatDateTime(proof.checkedAt ?? proof.time)}</p>
                            <p className="text-xs text-muted-foreground">{formatRelativeTime(proof.checkedAt ?? proof.time)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top px-6 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{formatProductLabel(proof)}</p>
                            <p className="text-xs text-muted-foreground">{proof.discountCode ?? "No discount code"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top px-6 py-4">
                          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7StockStatusToneClass(proof.stockStatus))}>
                            {proof.stockStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top px-6 py-4">
                          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG7DiscountStatusToneClass(proof.discountStatus))}>
                            {proof.discountStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top px-6 py-4">
                          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(proof.result))}>
                            {proof.result}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top px-6 py-4 text-sm leading-6 text-foreground text-pretty">{proof.actionNeeded}</TableCell>
                      </TableRow>
                    ))
                  : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-sm leading-6 text-muted-foreground">
                        {detail.emptyStateCopy}
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title="G7 - Inventory + Offer Safety"
      description="This page verifies stock, discount, expiry, and offer proof before claims are used."
      badges={headerBadges}
      actions={headerActions}
    >
      {loading && !detail ? (
        <LoadingState />
      ) : detail ? (
        content
      ) : (
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Unable to load offer checks right now.</p>
                <p className="text-sm leading-6 text-amber-900/80">
                  {loadError ?? "Try again in a moment. The page will show the latest saved G7 rows once the data source is available."}
                </p>
              </div>
            </div>
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => void loadDetail({ silent: false })} disabled={refreshing || loading}>
              <RefreshCcw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={runOpen} onOpenChange={(open) => {
        setRunOpen(open);
        if (!open) {
          setFormError(null);
        }
      }}>
        <DialogContent showCloseButton className="flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleRunSubmit}>
            <div className="border-b border-border/60 bg-muted/20 px-6 py-5">
              <DialogHeader className="items-start text-left">
                <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Check Offer Proof</DialogTitle>
                <DialogDescription className="max-w-prose text-sm leading-6 text-muted-foreground">
                  Use only the essential fields. G7 will verify stock, discount expiry, offer URL, and urgency proof before anything is used.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {formError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                    {formError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="g7-product" className="text-sm font-medium text-foreground">
                    Product ID or SKU
                  </label>
                  <Input
                    id="g7-product"
                    value={form.product_or_sku}
                    onChange={(event) => setForm((current) => ({ ...current, product_or_sku: event.target.value }))}
                    placeholder="Product ID or SKU"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="g7-code" className="text-sm font-medium text-foreground">
                    Offer / discount code
                  </label>
                  <Input
                    id="g7-code"
                    value={form.offer_code}
                    onChange={(event) => setForm((current) => ({ ...current, offer_code: event.target.value }))}
                    placeholder="SUMMER15"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="g7-url" className="text-sm font-medium text-foreground">
                    Offer URL
                  </label>
                  <Input
                    id="g7-url"
                    type="url"
                    value={form.offer_url}
                    onChange={(event) => setForm((current) => ({ ...current, offer_url: event.target.value }))}
                    placeholder="https://..."
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="g7-urgency" className="text-sm font-medium text-foreground">
                    Urgency claim text
                  </label>
                  <Textarea
                    id="g7-urgency"
                    value={form.urgency_claim_text}
                    onChange={(event) => setForm((current) => ({ ...current, urgency_claim_text: event.target.value }))}
                    placeholder="today only, only 3 left, ends tonight, or similar claim"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="g7-actor" className="text-sm font-medium text-foreground">
                    Actor
                  </label>
                  <Input
                    id="g7-actor"
                    value={form.actor}
                    onChange={(event) => setForm((current) => ({ ...current, actor: event.target.value }))}
                    placeholder={defaultActor}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 px-6 py-4">
              <Button type="button" variant="outline" className="rounded-full border-border/70 bg-white px-5" onClick={() => setRunOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={submitting}>
                <Play data-icon="inline-start" />
                {submitting ? "Checking..." : "Check Offer Proof"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
