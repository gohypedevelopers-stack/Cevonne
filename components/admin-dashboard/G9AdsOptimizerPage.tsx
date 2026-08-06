"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Gauge,
  Loader2,
  Megaphone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  G9_DATE_RANGE_LABELS,
  G9_DATE_RANGES,
  G9_ATTENTION_STATUSES,
  G9_OPEN_STATUSES,
  G9_RECOMMENDATION_FILTERS,
  G9_RECOMMENDATION_LABELS,
  G9_STATUS_FILTERS,
  G9_STATUS_FILTER_LABELS,
  formatG9Metric,
  type G9Activity as G9ActivityData,
  type G9DateRange,
  type G9Overview,
  type G9Recommendation,
  type G9RecommendationFilter,
  type G9RecommendationStatus,
  type G9StatusFilter,
} from "@/lib/admin/g9-ads-optimizer";
import { cn } from "@/lib/utils";

const ROUTES = {
  overview: "/api/admin/n8n/g9/overview",
  recommendations: "/api/admin/n8n/g9/recommendations?recommendation=ALL&status=ALL&dateRange=LAST_90_DAYS",
  activity: "/api/admin/n8n/g9/activity",
  review: "/api/admin/n8n/g9/review",
  approval: "/api/admin/n8n/g9/approval",
  dryRun: "/api/admin/n8n/g9/dry-run",
} as const;

type RecommendationsResponse = { items: G9Recommendation[] };
type MessageResponse = { message?: string; alreadyCompleted?: boolean; state?: "DRY_RUN_COMPLETE" };
type ApprovalDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

const parseJson = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
};

const formatCurrency = (value: number | null, currency: string) =>
  value === null ? "Not available" : new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

const statusTone = (status: G9RecommendationStatus) => {
  if (["READY", "APPROVED_FOR_DRY_RUN", "DRY_RUN_COMPLETE"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (["PENDING_APPROVAL", "NEEDS_REVIEW", "CHANGES_REQUESTED"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-950";
  if (["BLOCKED", "CONNECTION_ISSUE", "REJECTED"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-border bg-muted text-foreground";
};

function StatusBadge({ item }: { item: Pick<G9Recommendation, "status" | "statusLabel"> }) {
  const Icon = ["READY", "APPROVED_FOR_DRY_RUN", "DRY_RUN_COMPLETE"].includes(item.status)
    ? CheckCircle2
    : ["BLOCKED", "CONNECTION_ISSUE", "REJECTED"].includes(item.status) ? CircleAlert : Clock3;
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-1 font-medium", statusTone(item.status))}>
      <Icon aria-hidden="true" />
      {item.statusLabel}
    </Badge>
  );
}

type SummaryTarget = "OPEN" | "PENDING" | "ATTENTION" | "DRY_RUN";

function SummaryCards({ overview, onSelect }: { overview: G9Overview; onSelect: (target: SummaryTarget) => void }) {
  const cards = [
    { label: "Open recommendations", value: overview.counts.openRecommendations, icon: Sparkles, accent: "bg-primary", target: "OPEN" as const },
    { label: "Pending approval", value: overview.counts.pendingApproval, icon: Clock3, accent: "bg-amber-400", target: "PENDING" as const },
    { label: "Needs attention", value: overview.counts.needsAttention, icon: CircleAlert, accent: "bg-rose-400", target: "ATTENTION" as const },
    { label: "Dry runs completed", value: overview.counts.dryRunsCompleted, icon: ShieldCheck, accent: "bg-emerald-400", target: "DRY_RUN" as const },
  ];
  return (
    <div role="region" aria-labelledby="g9-overview-title" className="flex w-full flex-col gap-3">
      <h2 id="g9-overview-title" className="sr-only">Ads optimizer overview</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, accent, target }) => (
          <button key={label} type="button" onClick={() => onSelect(target)} className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`Show ${label.toLowerCase()}`}>
            <Card className="relative h-full gap-0 overflow-hidden rounded-2xl border-border/70 bg-white py-0 shadow-sm transition-[border-color,box-shadow] hover:border-primary/45 hover:bg-white hover:shadow-md">
              <span className={cn("absolute inset-x-0 top-0 h-1", accent)} aria-hidden="true" />
              <CardContent className="flex items-start justify-between gap-3 p-4 pt-5 lg:p-5 lg:pt-6">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-medium text-muted-foreground" title={label}>{label}</p>
                  <p className="mt-2 font-serif text-3xl leading-none tabular-nums text-primary">{value}</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary/65 text-primary"><Icon aria-hidden="true" /></span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConnectionSummary({ overview }: { overview: G9Overview }) {
  const items = [
    { label: "Meta Ads", value: overview.connection.metaAds === "CONNECTED" ? "Connected" : "Needs attention", good: overview.connection.metaAds === "CONNECTED" },
    { label: "AI analysis", value: overview.connection.aiAnalysis === "READY" ? "Ready" : "Needs attention", good: overview.connection.aiAnalysis === "READY" },
    { label: "Execution mode", value: "Safe dry run", good: true },
    { label: "Account", value: overview.connection.accountLabel, good: true },
  ];
  return (
    <Card className="gap-0 rounded-2xl border-border/70 bg-white py-0 shadow-sm">
      <CardContent className="grid gap-0 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <div key={item.label} className={cn("flex items-center justify-between gap-3 px-4 py-3", index > 0 && "border-t sm:border-t-0", index > 0 && "xl:border-l", index === 1 && "sm:border-l")}>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
              <p className="line-clamp-1 text-sm font-medium text-foreground" title={item.value}>{item.value}</p>
            </div>
            {item.good ? <Check className="size-4 shrink-0 text-emerald-700" aria-label="Ready" /> : <CircleAlert className="size-4 shrink-0 text-rose-700" aria-label="Needs attention" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label="Loading ads optimizer">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-16 rounded-2xl" />
      <Card className="rounded-2xl bg-white"><CardContent className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</CardContent></Card>
    </div>
  );
}

function Filters({ recommendation, status, dateRange, onRecommendationChange, onStatusChange, onDateRangeChange }: {
  recommendation: G9RecommendationFilter;
  status: G9StatusFilter;
  dateRange: G9DateRange;
  onRecommendationChange: (value: G9RecommendationFilter) => void;
  onStatusChange: (value: G9StatusFilter) => void;
  onDateRangeChange: (value: G9DateRange) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-border/70 p-4 md:grid-cols-3 lg:px-5" aria-label="Recommendation filters">
      <Field>
        <FieldLabel htmlFor="g9-recommendation-filter">Recommendation</FieldLabel>
        <Select value={recommendation} onValueChange={(value) => onRecommendationChange(value as G9RecommendationFilter)}>
          <SelectTrigger id="g9-recommendation-filter" className="h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup><SelectItem value="ALL">All recommendations</SelectItem>{Object.entries(G9_RECOMMENDATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="g9-status-filter">Status</FieldLabel>
        <Select value={status} onValueChange={(value) => onStatusChange(value as G9StatusFilter)}>
          <SelectTrigger id="g9-status-filter" className="h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup><SelectItem value="ALL">All statuses</SelectItem>{Object.entries(G9_STATUS_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="g9-date-filter">Created</FieldLabel>
        <Select value={dateRange} onValueChange={(value) => onDateRangeChange(value as G9DateRange)}>
          <SelectTrigger id="g9-date-filter" className="h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{Object.entries(G9_DATE_RANGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function RecommendationTable({ items, onOpen, onApproval, onDryRun }: { items: G9Recommendation[]; onOpen: (item: G9Recommendation) => void; onApproval: (item: G9Recommendation) => void; onDryRun: (item: G9Recommendation) => void }) {
  const runPrimaryAction = (item: G9Recommendation) => item.canDryRun ? onDryRun(item) : item.canReview ? onApproval(item) : onOpen(item);
  const primaryActionLabel = (item: G9Recommendation) => item.canDryRun ? "Run dry run" : item.canReview ? "Review" : item.status === "DRY_RUN_COMPLETE" ? "View result" : "View details";
  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="h-12 px-5">Recommendation</TableHead><TableHead>Campaign / ad</TableHead><TableHead>Main reason</TableHead><TableHead>Performance</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="pr-5 text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell className="max-w-52 px-5 py-4 font-medium text-primary"><button type="button" onClick={() => onOpen(item)} className="line-clamp-2 whitespace-normal text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.kindLabel}</button></TableCell>
                <TableCell className="max-w-44"><span className="line-clamp-1 whitespace-normal" title={item.subjectLabel}>{item.subjectLabel}</span></TableCell>
                <TableCell className="max-w-64 text-muted-foreground"><span className="line-clamp-2 whitespace-normal">{item.mainReason}</span></TableCell>
                <TableCell className="font-medium tabular-nums">{item.performanceLabel}</TableCell>
                <TableCell><StatusBadge item={item} /></TableCell>
                <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                <TableCell className="pr-5 text-right"><Button variant={item.canReview || item.canDryRun ? "default" : "outline"} className="h-11" onClick={() => runPrimaryAction(item)}>{primaryActionLabel(item)}<ArrowRight aria-hidden="true" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 p-4 lg:hidden">
        {items.map((item) => (
          <Card key={item.reference} className="gap-4 rounded-2xl border-border/70 bg-white p-4 py-4 shadow-none">
            <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpen(item)} className="text-left font-serif text-xl leading-tight text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.kindLabel}</button><StatusBadge item={item} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-medium text-muted-foreground">Campaign / ad</p><p className="line-clamp-1 text-sm font-medium" title={item.subjectLabel}>{item.subjectLabel}</p></div>
              <div><p className="text-xs font-medium text-muted-foreground">Performance</p><p className="text-sm font-medium">{item.performanceLabel}</p></div>
            </div>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.mainReason}</p>
            <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span><Button variant={item.canReview || item.canDryRun ? "default" : "outline"} className="h-11" onClick={() => runPrimaryAction(item)}>{primaryActionLabel(item)}<ArrowRight aria-hidden="true" /></Button></div>
          </Card>
        ))}
      </div>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border border-border/70 bg-muted/20 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums" title={value}>{value}</p></div>;
}

function RecommendationDetails({ item, open, onOpenChange, onApproval, onDryRun }: {
  item: G9Recommendation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproval: (item: G9Recommendation) => void;
  onDryRun: (item: G9Recommendation) => void;
}) {
  if (!item) return null;
  const metrics = [
    ["Spend", formatCurrency(item.metrics.spend, item.metrics.currency)],
    ["Impressions", formatG9Metric(item.metrics.impressions)],
    ["Clicks", formatG9Metric(item.metrics.clicks)],
    ["CTR", item.metrics.ctr === null ? "Not available" : `${formatG9Metric(item.metrics.ctr, { maximumFractionDigits: 2 })}%`],
    ["CPC", formatCurrency(item.metrics.cpc, item.metrics.currency)],
    ["CPM", formatCurrency(item.metrics.cpm, item.metrics.currency)],
    ["Purchases", formatG9Metric(item.metrics.purchases)],
    ["Purchase value", formatCurrency(item.metrics.purchaseValue, item.metrics.currency)],
    ["ROAS", item.metrics.roas === null ? "Not available" : `${formatG9Metric(item.metrics.roas, { maximumFractionDigits: 2 })}×`],
    ["Current daily budget", formatCurrency(item.metrics.currentDailyBudget, item.metrics.currency)],
    ["Suggested daily budget", formatCurrency(item.metrics.suggestedDailyBudget, item.metrics.currency)],
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overscroll-contain p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border/70 px-5 py-5 pr-14 text-left">
          <div className="flex flex-col gap-2"><StatusBadge item={item} /><SheetTitle className="font-serif text-2xl text-primary md:text-3xl">{item.kindLabel}</SheetTitle><SheetDescription className="line-clamp-1" title={item.subjectLabel}>{item.subjectLabel}</SheetDescription></div>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-5">
            {item.status === "DRY_RUN_COMPLETE" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950"><ShieldCheck aria-hidden="true" /><AlertTitle>Dry run complete</AlertTitle><AlertDescription>The approved recommendation was safely simulated. No live Meta change was made.</AlertDescription></Alert> : <Alert className="border-violet-200 bg-violet-50/70 text-violet-950"><Sparkles aria-hidden="true" /><AlertTitle>AI advisory</AlertTitle><AlertDescription>This recommendation is advisory. A human must approve supported changes, and this dashboard can only run a safe simulation.</AlertDescription></Alert>}
            <div role="region" className="flex flex-col gap-3" aria-labelledby="g9-reason-title"><h3 id="g9-reason-title" className="font-serif text-xl text-primary">Why this was recommended</h3><ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
            <Separator />
            <div role="region" className="flex flex-col gap-3" aria-labelledby="g9-metrics-title"><h3 id="g9-metrics-title" className="font-serif text-xl text-primary">Performance</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div></div>
            <Separator />
            <div role="region" className="flex flex-col gap-3" aria-labelledby="g9-safety-title"><h3 id="g9-safety-title" className="font-serif text-xl text-primary">Safety checks</h3><div className="grid gap-2 sm:grid-cols-2">{item.safetyChecks.map((check) => <div key={check.label} className="flex items-start gap-3 border border-border/70 p-3">{check.state === "PASSED" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-label="Passed" /> : check.state === "NEEDS_ATTENTION" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-label="Needs attention" /> : <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not available" />}<div><p className="text-sm font-medium">{check.label}</p><p className="text-xs text-muted-foreground">{check.detail}</p></div></div>)}</div></div>
          </div>
        </ScrollArea>
        {(item.canReview || item.canDryRun) && <div className="flex flex-col gap-2 border-t border-border/70 bg-background p-4 sm:flex-row sm:justify-end">{item.canReview && <Button className="h-11" onClick={() => onApproval(item)}>Review recommendation</Button>}{item.canDryRun && <Button className="h-11" onClick={() => onDryRun(item)}><ShieldCheck aria-hidden="true" />Run safe dry run</Button>}</div>}
      </SheetContent>
    </Sheet>
  );
}

function ReviewDialog({ open, onOpenChange, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; onSubmit: (dateRange: G9DateRange, note: string | null) => void }) {
  const [dateRange, setDateRange] = useState<G9DateRange>("LAST_30_DAYS");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Run ad review</DialogTitle><DialogDescription>Analyze recent Meta performance and prepare recommendations. This does not change any live ads.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="g9-account">Ad account</FieldLabel><Input id="g9-account" name="g9-account" value="Cevonne ad account" readOnly aria-readonly="true" autoComplete="off" className="h-11 bg-muted/40" /><FieldDescription>The account is securely configured on the server.</FieldDescription></Field>
          <Field><FieldLabel htmlFor="g9-review-range">Performance period</FieldLabel><Select value={dateRange} onValueChange={(value) => setDateRange(value as G9DateRange)}><SelectTrigger id="g9-review-range" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(G9_DATE_RANGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field><FieldLabel htmlFor="g9-review-note">Note <span className="text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g9-review-note" name="g9-review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1_000} autoComplete="off" placeholder="Add context for this review…" rows={4} /></Field>
        </FieldGroup>
        <DialogFooter><Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button className="h-11" onClick={() => onSubmit(dateRange, note.trim() || null)} disabled={busy}>{busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <BarChart3 aria-hidden="true" />}Analyze ad performance</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalDialog({ item, open, onOpenChange, busy, onSubmit }: { item: G9Recommendation | null; open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; onSubmit: (decision: ApprovalDecision, note: string | null) => void }) {
  const [decision, setDecision] = useState<ApprovalDecision>("APPROVE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setDecision("APPROVE"); setNote(""); setError(null); } }, [open]);
  if (!item) return null;
  const submit = () => {
    if (decision === "REJECT" && note.trim().length < 3) { setError("Add a short reason for rejecting this recommendation."); return; }
    if (decision === "REQUEST_CHANGES" && note.trim().length < 3) { setError("Describe the changes needed."); return; }
    setError(null);
    onSubmit(decision, note.trim() || null);
  };
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Review recommendation</DialogTitle><DialogDescription>{item.kindLabel} for {item.subjectLabel}.</DialogDescription></DialogHeader>
        <Alert className="border-amber-200 bg-amber-50 text-amber-950"><ShieldCheck aria-hidden="true" /><AlertTitle>No live change</AlertTitle><AlertDescription>Approval only unlocks a safe dry run. It does not update your Meta ads.</AlertDescription></Alert>
        <FieldGroup>
          <Field><FieldLabel htmlFor="g9-decision">Decision</FieldLabel><Select value={decision} onValueChange={(value) => { setDecision(value as ApprovalDecision); setError(null); }}><SelectTrigger id="g9-decision" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="APPROVE">Approve for dry run</SelectItem><SelectItem value="REQUEST_CHANGES">Request changes</SelectItem><SelectItem value="REJECT">Reject recommendation</SelectItem></SelectGroup></SelectContent></Select></Field>
          <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="g9-decision-note">{decision === "REJECT" ? "Rejection reason" : decision === "REQUEST_CHANGES" ? "Changes needed" : "Reviewer note (optional)"}</FieldLabel><Textarea id="g9-decision-note" name="g9-decision-note" value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} maxLength={1_000} autoComplete="off" placeholder={decision === "REJECT" ? "Explain why this should not continue…" : decision === "REQUEST_CHANGES" ? "Describe the changes needed…" : "Add context for this approval…"} rows={4} aria-invalid={Boolean(error)} /><FieldError>{error}</FieldError></Field>
        </FieldGroup>
        <DialogFooter><Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant={decision === "REJECT" ? "destructive" : "default"} className="h-11" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : decision === "REJECT" ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}{decision === "REJECT" ? "Reject" : decision === "REQUEST_CHANGES" ? "Request changes" : "Approve for dry run"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DryRunDialog({ item, open, onOpenChange, busy, onSubmit }: { item: G9Recommendation | null; open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; onSubmit: () => void }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Run safe dry run?</DialogTitle><DialogDescription>Simulate “{item.kindLabel}” for {item.subjectLabel}.</DialogDescription></DialogHeader>
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950"><ShieldCheck aria-hidden="true" /><AlertTitle>Simulation only</AlertTitle><AlertDescription>This records what would happen. It will not send a live change to Meta.</AlertDescription></Alert>
        <DialogFooter><Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button className="h-11" onClick={onSubmit} disabled={busy}>{busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}Run safe dry run</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecentActivity({ data, recommendations, onView, onApproval, onDryRun, onViewMore, loadingMore }: {
  data: G9ActivityData;
  recommendations: G9Recommendation[];
  onView: (item: G9Recommendation) => void;
  onApproval: (item: G9Recommendation) => void;
  onDryRun: (item: G9Recommendation) => void;
  onViewMore: () => void;
  loadingMore: boolean;
}) {
  const runActivityAction = (action: G9ActivityData["items"][number]["action"], recommendation: G9Recommendation) => {
    if (action === "REVIEW") onApproval(recommendation);
    else if (action === "DRY_RUN") onDryRun(recommendation);
    else onView(recommendation);
  };
  return (
    <Card className="gap-0 rounded-2xl border-border/70 bg-white py-0 shadow-sm">
      <CardHeader className="border-b border-border/70 px-4 py-4 lg:px-5"><CardTitle><h2 className="flex items-center gap-2 font-serif text-xl text-primary"><Activity aria-hidden="true" />Recent activity</h2></CardTitle><CardDescription className="line-clamp-1">Friendly updates from reviews, approvals, and dry runs.</CardDescription></CardHeader>
      <CardContent className="p-0">
        {data.items.length ? <div className="divide-y divide-border/70">{data.items.map((item) => {
          const recommendation = item.recommendationKey ? recommendations.find((candidate) => candidate.key === item.recommendationKey) : null;
          const actionLabel = item.action === "REVIEW" ? "Review & decide" : item.action === "DRY_RUN" ? "Run dry run" : "View recommendation";
          return (
            <div key={item.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
              <div className="min-w-0"><p className="font-medium">{item.title}</p><p className="line-clamp-1 text-sm text-muted-foreground" title={item.description}>{item.description}</p></div>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <div className="text-left sm:text-right"><p className="text-xs font-medium text-primary">{item.statusLabel}</p><p className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</p></div>
                {recommendation && item.action ? <Button variant={item.action === "VIEW" ? "outline" : "default"} className="h-11" onClick={() => runActivityAction(item.action, recommendation)}>{actionLabel}<ArrowRight aria-hidden="true" /></Button> : null}
              </div>
            </div>
          );
        })}</div> : <div className="p-8 text-center"><p className="font-medium">No recent activity yet</p><p className="mt-1 text-sm text-muted-foreground">Run an ad review to create the first update.</p></div>}
        {data.hasMore && <div className="border-t border-border/70 p-3 text-center"><Button variant="ghost" className="h-11" onClick={onViewMore} disabled={loadingMore}>{loadingMore && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}View more</Button></div>}
      </CardContent>
    </Card>
  );
}

export default function G9AdsOptimizerPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<G9Overview | null>(null);
  const [recommendations, setRecommendations] = useState<G9Recommendation[]>([]);
  const [activity, setActivity] = useState<G9ActivityData>({ items: [], hasMore: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendationFilter, setRecommendationFilter] = useState<G9RecommendationFilter>(() => {
    const value = searchParams.get("g9Recommendation");
    return G9_RECOMMENDATION_FILTERS.includes(value as G9RecommendationFilter) ? value as G9RecommendationFilter : "ALL";
  });
  const [statusFilter, setStatusFilter] = useState<G9StatusFilter>(() => {
    const value = searchParams.get("g9Status");
    return G9_STATUS_FILTERS.includes(value as G9StatusFilter) ? value as G9StatusFilter : "OPEN";
  });
  const [dateRange, setDateRange] = useState<G9DateRange>(() => {
    const value = searchParams.get("g9DateRange");
    return G9_DATE_RANGES.includes(value as G9DateRange) ? value as G9DateRange : "LAST_90_DAYS";
  });
  const activityLimitRef = useRef(6);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<G9Recommendation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"review" | "approval" | "dry-run" | null>(null);

  const requestJson = useCallback(async <T,>(url: string, options?: RequestInit) => {
    const response = await authFetch(url, { ...options, cache: "no-store", silent: true });
    const body = await parseJson<T & MessageResponse>(response);
    if (!response.ok) throw new Error(body?.message || "The request could not be completed.");
    if (!body) throw new Error("The server returned an empty response.");
    return body;
  }, [authFetch]);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [overviewData, recommendationData, activityData] = await Promise.all([
        requestJson<G9Overview>(ROUTES.overview),
        requestJson<RecommendationsResponse>(ROUTES.recommendations),
        requestJson<G9ActivityData>(`${ROUTES.activity}?limit=${activityLimitRef.current}`),
      ]);
      setOverview(overviewData);
      setRecommendations(recommendationData.items);
      setActivity(activityData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Ads optimizer data could not be loaded. Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestJson]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("recommendation");
    next.delete("status");
    next.delete("dateRange");
    next.set("g9Recommendation", recommendationFilter);
    next.set("g9Status", statusFilter);
    next.set("g9DateRange", dateRange);
    const nextQuery = next.toString();
    if (nextQuery !== searchParams.toString()) router.replace(`${pathname}?${nextQuery}`, { scroll: false });
  }, [dateRange, pathname, recommendationFilter, router, searchParams, statusFilter]);

  const filteredRecommendations = useMemo(() => {
    const days = dateRange === "LAST_7_DAYS" ? 7 : dateRange === "LAST_30_DAYS" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1_000;
    const matchesStatus = (item: G9Recommendation) => statusFilter === "ALL" ||
      (statusFilter === "OPEN" && G9_OPEN_STATUSES.includes(item.status)) ||
      (statusFilter === "NEEDS_ATTENTION" && G9_ATTENTION_STATUSES.includes(item.status)) ||
      item.status === statusFilter;
    return recommendations.filter((item) =>
      new Date(item.createdAt).getTime() >= cutoff &&
      (recommendationFilter === "ALL" || item.kind === recommendationFilter) &&
      matchesStatus(item)
    );
  }, [dateRange, recommendationFilter, recommendations, statusFilter]);

  const postAction = useCallback(async (url: string, payload: unknown) => requestJson<MessageResponse>(url, { method: "POST", body: JSON.stringify(payload) }), [requestJson]);

  const finishMutation = useCallback(async (message: string) => {
    toast.success(message);
    setDetailsOpen(false);
    setSelected(null);
    await loadDashboard(true);
  }, [loadDashboard]);

  const submitReview = async (reviewDateRange: G9DateRange, note: string | null) => {
    if (busyAction) return;
    setBusyAction("review");
    try {
      const result = await postAction(ROUTES.review, { dateRange: reviewDateRange, note });
      setReviewOpen(false);
      await finishMutation(result.message || "Ad performance analysis started.");
    } catch (actionError) { toast.error(actionError instanceof Error ? actionError.message : "The ad review could not be started."); }
    finally { setBusyAction(null); }
  };

  const submitApproval = async (decision: ApprovalDecision, note: string | null) => {
    if (!selected || busyAction) return;
    setBusyAction("approval");
    try {
      const result = await postAction(ROUTES.approval, { reference: selected.reference, decision, note });
      setApprovalOpen(false);
      await finishMutation(result.message || "Decision saved.");
    } catch (actionError) { toast.error(actionError instanceof Error ? actionError.message : "The decision could not be saved."); }
    finally { setBusyAction(null); }
  };

  const submitDryRun = async () => {
    if (!selected || busyAction) return;
    setBusyAction("dry-run");
    try {
      const result = await postAction(ROUTES.dryRun, { reference: selected.reference });
      setDryRunOpen(false);
      await finishMutation(result.alreadyCompleted ? "Dry run already completed. No live Meta change was made." : result.message || "Dry run completed. No live Meta ad was changed.");
    } catch (actionError) { toast.error(actionError instanceof Error ? actionError.message : "The dry run could not be completed."); }
    finally { setBusyAction(null); }
  };

  const openDetails = (item: G9Recommendation) => { setSelected(item); setDetailsOpen(true); };
  const openApproval = (item: G9Recommendation) => { setSelected(item); setDetailsOpen(false); setApprovalOpen(true); };
  const openDryRun = (item: G9Recommendation) => { setSelected(item); setDetailsOpen(false); setDryRunOpen(true); };

  const revealSummary = (target: SummaryTarget) => {
    setRecommendationFilter("ALL");
    setDateRange("LAST_90_DAYS");
    if (target === "PENDING") setStatusFilter("PENDING_APPROVAL");
    else if (target === "DRY_RUN") setStatusFilter("DRY_RUN_COMPLETE");
    else if (target === "ATTENTION") setStatusFilter("NEEDS_ATTENTION");
    else setStatusFilter("OPEN");
    requestAnimationFrame(() => document.getElementById("g9-recommendations")?.scrollIntoView({ block: "start" }));
  };

  const clearFilters = () => {
    setRecommendationFilter("ALL");
    setStatusFilter("ALL");
    setDateRange("LAST_90_DAYS");
  };

  const viewMoreActivity = async () => {
    const nextLimit = Math.min(activityLimitRef.current + 6, 30);
    setLoadingMore(true);
    try {
      const next = await requestJson<G9ActivityData>(`${ROUTES.activity}?limit=${nextLimit}`);
      setActivity(next);
      activityLimitRef.current = nextLimit;
    } catch (activityError) { toast.error(activityError instanceof Error ? activityError.message : "More activity could not be loaded."); }
    finally { setLoadingMore(false); }
  };

  const connectionReady = overview?.connection.metaAds === "CONNECTED" && overview?.connection.aiAnalysis === "READY";

  return (
    <WorkflowDashboardShell
      eyebrow="AI automations · G9"
      title="G9 — Ads Optimizer"
      description="Analyze Meta ad performance, review AI recommendations, and safely test approved changes."
      badges={<><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-900"><ShieldCheck aria-hidden="true" />Safe dry-run mode</Badge><Badge variant="outline" className={cn("rounded-full", connectionReady ? "border-violet-200 bg-violet-50 text-violet-900" : "border-amber-200 bg-amber-50 text-amber-950")}>{connectionReady ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{overview ? connectionReady ? "Connections ready" : "Connection needs attention" : "Checking connections"}</Badge></>}
      actions={<><Button variant="outline" className="h-11" onClick={() => void loadDashboard(true)} disabled={refreshing}><RefreshCcw className={cn(refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />Refresh</Button><Button className="h-11" onClick={() => setReviewOpen(true)} disabled={!connectionReady}><Megaphone aria-hidden="true" />Run ad review</Button></>}
    >
      {loading ? <LoadingState /> : error && !overview ? <Alert variant="destructive"><CircleAlert aria-hidden="true" /><AlertTitle>Ads optimizer could not load</AlertTitle><AlertDescription>{error}</AlertDescription><Button variant="outline" className="mt-3 h-11 w-fit" onClick={() => void loadDashboard()}>Try again</Button></Alert> : overview ? <>
        {error && <Alert variant="destructive"><CircleAlert aria-hidden="true" /><AlertTitle>Some data could not refresh</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <SummaryCards overview={overview} onSelect={revealSummary} />
        <ConnectionSummary overview={overview} />
        <Card id="g9-recommendations" className="scroll-mt-6 gap-0 overflow-hidden rounded-2xl border-border/70 bg-white py-0 shadow-sm">
          <CardHeader className="border-b border-border/70 px-4 py-4 lg:px-5"><CardTitle><h2 className="font-serif text-2xl text-primary">Recommendations</h2></CardTitle><CardDescription className="line-clamp-1">Review AI guidance before approving a safe simulation.</CardDescription></CardHeader>
          <Filters recommendation={recommendationFilter} status={statusFilter} dateRange={dateRange} onRecommendationChange={setRecommendationFilter} onStatusChange={setStatusFilter} onDateRangeChange={setDateRange} />
          {filteredRecommendations.length ? <RecommendationTable items={filteredRecommendations} onOpen={openDetails} onApproval={openApproval} onDryRun={openDryRun} /> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary/70 text-primary"><Gauge aria-hidden="true" /></span><p className="mt-4 font-serif text-xl text-primary">{recommendations.length ? "No recommendations match these filters" : "No ad recommendations yet"}</p><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{recommendations.length ? "Clear the filters to see available recommendations and approval actions." : "Run an ad review to analyze recent Meta performance."}</p>{recommendations.length ? <Button variant="outline" className="mt-4 h-11" onClick={clearFilters}>Show all recommendations</Button> : <Button className="mt-4 h-11" onClick={() => setReviewOpen(true)} disabled={!connectionReady}><BarChart3 aria-hidden="true" />Run ad review</Button>}</div>}
        </Card>
        <RecentActivity data={activity} recommendations={recommendations} onView={openDetails} onApproval={openApproval} onDryRun={openDryRun} onViewMore={() => void viewMoreActivity()} loadingMore={loadingMore} />
        <Alert className="border-border/70 bg-white"><CircleDollarSign aria-hidden="true" /><AlertTitle>Live Meta changes remain disabled</AlertTitle><AlertDescription>G9 only analyzes, records decisions, and simulates approved actions. No live budget or ad status change is sent from this dashboard.</AlertDescription></Alert>
      </> : null}

      <RecommendationDetails item={selected} open={detailsOpen} onOpenChange={setDetailsOpen} onApproval={openApproval} onDryRun={openDryRun} />
      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} busy={busyAction === "review"} onSubmit={(range, note) => void submitReview(range, note)} />
      <ApprovalDialog item={selected} open={approvalOpen} onOpenChange={setApprovalOpen} busy={busyAction === "approval"} onSubmit={(decision, note) => void submitApproval(decision, note)} />
      <DryRunDialog item={selected} open={dryRunOpen} onOpenChange={setDryRunOpen} busy={busyAction === "dry-run"} onSubmit={() => void submitDryRun()} />
    </WorkflowDashboardShell>
  );
}
