"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  G8_FILTER_LABELS,
  G8_QUEUE_FILTERS,
  type G8ActionResponse,
  type G8DashboardData,
  type G8FriendlyStatus,
  type G8QueueFilter,
  type G8StepState,
  type G8UgcItem,
} from "@/lib/admin/g8-creator-proof";
import { cn } from "@/lib/utils";

type ActionDialog = "PERMISSION_YES" | "PERMISSION_NO" | "SAFETY" | "DISCLOSURE" | "APPROVAL" | "REVOCATION" | null;
type RequestOptions = RequestInit & { silent?: boolean };

const DASHBOARD_ROUTE = "/api/admin/g8";
const ACTION_ROUTE = "/api/admin/g8/actions";

const SAFETY_CHECKS = [
  "No child or minor is visible",
  "No competitor product is visible",
  "No private or sensitive content is visible",
  "No prohibited or sexual content is visible",
  "Product or beauty claims are safe",
  "Copyright use is cleared",
  "Music rights are cleared or not applicable",
] as const;

const SAFETY_BLOCK_REASONS = [
  { value: "CHILD_VISIBLE", label: "A child or minor is visible" },
  { value: "COMPETITOR_VISIBLE", label: "A competitor product is visible" },
  { value: "PRIVATE_CONTENT", label: "Private or sensitive content is visible" },
  { value: "PROHIBITED_CONTENT", label: "Prohibited or sexual content is visible" },
  { value: "CLAIM_RISK", label: "Product or beauty claims need review" },
  { value: "COPYRIGHT_NOT_CLEARED", label: "Copyright use is not cleared" },
  { value: "MUSIC_NOT_CLEARED", label: "Music rights are not cleared" },
] as const;

const EMPTY_INTAKE = {
  mediaId: "",
  sourceUrl: "",
  creatorUsername: "",
  creatorDisplayName: "",
  mentionedBrand: false,
  taggedBrand: false,
  mediaType: "IMAGE",
  caption: "",
};

const defaultRequest = (url: string, options?: RequestOptions) => fetch(url, options);
const buildRouteUrl = (path: string) => new URL(path, window.location.origin).toString();

const parseJson = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

const statusTone = (status: G8FriendlyStatus) => {
  if (["Ready", "Permission Granted", "Safety Passed", "Disclosure Passed", "Disclosure Not Required"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["Permission Declined", "Safety Blocked", "Blocked", "Rights Revoked"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (["Waiting for Approval", "Awaiting Permission", "Permission Required"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-violet-200 bg-violet-50 text-violet-800";
};

const filterMatches = (item: G8UgcItem, filter: G8QueueFilter) => {
  if (filter === "ALL") return true;
  if (filter === "AWAITING_PERMISSION") return ["Awaiting Permission", "Permission Required"].includes(item.currentStatus);
  if (filter === "NEEDS_SAFETY") return item.currentStatus === "Safety Review Needed";
  if (filter === "NEEDS_DISCLOSURE") return item.currentStatus === "Disclosure Review Needed";
  if (filter === "PENDING_APPROVAL") return item.currentStatus === "Waiting for Approval";
  if (filter === "APPROVED") return item.currentStatus === "Ready";
  return item.isTerminallyBlocked;
};

function MediaPreview({ item, className }: { item: G8UgcItem; className?: string }) {
  if (!item.mediaUrl) {
    return (
      <div className={cn("grid place-items-center bg-[#f5eeee] text-primary/45", className)} aria-label="Media preview unavailable">
        <ImageIcon />
      </div>
    );
  }
  return <img src={item.mediaUrl} alt={`UGC from ${item.creatorUsername}`} className={cn("bg-muted object-cover", className)} />;
}

function StatusBadge({ status }: { status: G8FriendlyStatus }) {
  return <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 font-medium", statusTone(status))}>{status}</Badge>;
}

function SummaryCards({ data }: { data: G8DashboardData }) {
  const cards = [
    { label: "Total UGC", value: data.summary.total, icon: Sparkles },
    { label: "Awaiting Permission", value: data.summary.awaitingPermission, icon: Clock3 },
    { label: "Needs Review", value: data.summary.needsReview, icon: ShieldCheck },
    { label: "Pending Approval", value: data.summary.pendingApproval, icon: UserRoundCheck },
    { label: "Ready / Approved", value: data.summary.readyApproved, icon: CheckCircle2 },
  ];

  return (
    <section aria-labelledby="g8-status-overview" className="flex flex-col gap-3 px-0 md:px-0">
      <h2 id="g8-status-overview" className="sr-only">Status overview</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="rounded-2xl border-border/60 bg-white shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" title={label}>{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{value}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/7 text-primary"><Icon /></span>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">UGC cannot be reused until creator permission, safety, disclosure and human approval checks are complete.</p>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
      </div>
      <Card className="rounded-3xl bg-white"><CardContent className="flex flex-col gap-3 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</CardContent></Card>
    </div>
  );
}

function StepMarker({ state }: { state: G8StepState }) {
  if (state === "COMPLETE") return <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white"><Check /></span>;
  if (state === "BLOCKED") return <span className="grid size-6 place-items-center rounded-full bg-rose-600 text-white"><XCircle /></span>;
  if (state === "CURRENT") return <span className="grid size-6 place-items-center rounded-full bg-amber-100 text-amber-800"><Clock3 /></span>;
  return <span className="size-6 rounded-full border border-border bg-white" />;
}

function DetailSheet({
  item,
  open,
  onOpenChange,
  onAction,
}: {
  item: G8UgcItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: Exclude<ActionDialog, null>) => void;
}) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border/60 px-5 py-5 pr-14 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate font-serif text-2xl text-primary">@{item.creatorUsername.replace(/^@/, "")}</SheetTitle>
              <SheetDescription className="line-clamp-1">{item.creatorDisplayName || "Creator-submitted content"}</SheetDescription>
            </div>
            {item.canRevokePermission ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => onAction("REVOCATION")}>Revoke Permission</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-5">
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <MediaPreview item={item} className="aspect-[4/5] w-full rounded-2xl" />
              <div className="flex min-w-0 flex-col gap-3">
                <StatusBadge status={item.currentStatus} />
                <p className="text-sm leading-6 text-foreground">{item.caption}</p>
                <div className="text-xs leading-5 text-muted-foreground">
                  <p>{item.sourceType} · Received {formatDate(item.receivedAt)}</p>
                  <p className="mt-1 font-medium text-foreground">Next: {item.nextAction}</p>
                </div>
                {item.sourceUrl ? (
                  <Button asChild variant="outline" className="w-fit rounded-full">
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open Original Post <ArrowUpRight /></a>
                  </Button>
                ) : null}
              </div>
            </div>

            {item.latestMessage ? (
              <Alert className="rounded-2xl border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>Review needed</AlertTitle><AlertDescription>{item.latestMessage}</AlertDescription></Alert>
            ) : null}

            <section className="flex flex-col gap-3" aria-labelledby="g8-rights-summary">
              <h3 id="g8-rights-summary" className="font-serif text-xl text-primary">Rights summary</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Permission", item.permissionLabel],
                  ["Rights", item.rightsExpiresAt ? `${item.rightsLabel} · until ${formatDate(item.rightsExpiresAt)}` : item.rightsLabel],
                  ["Approved use", item.allowedUses.length ? item.allowedUses.map((use) => use.toLowerCase().replaceAll("_", " ")).join(", ") : "Not approved yet"],
                  ["Editing", item.editingAllowed ? "Crop or resize allowed" : "Not approved"],
                  ["Paid advertising", item.adUsageAllowed ? "Allowed" : "Not allowed"],
                  ["Creator credit", item.attributionText ? `Required · ${item.attributionText}` : "Not recorded"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-muted/15 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="g8-progress">
              <h3 id="g8-progress" className="font-serif text-xl text-primary">Workflow progress</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.progress.map((step) => (
                  <div key={step.label} className={cn("flex items-center gap-3 rounded-xl border p-3", step.state === "CURRENT" ? "border-amber-200 bg-amber-50" : step.state === "BLOCKED" ? "border-rose-200 bg-rose-50" : "border-border/60 bg-white")}>
                    <StepMarker state={step.state} />
                    <div><p className="text-sm font-medium">{step.label}</p><p className="text-xs text-muted-foreground">{step.state === "COMPLETE" ? "Complete" : step.state === "CURRENT" ? "Current action" : step.state === "BLOCKED" ? "Blocked" : "Not started"}</p></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t border-border/60 bg-white/95 px-5 py-4 backdrop-blur">
              {item.canRecordPermission ? <><Button className="rounded-full" onClick={() => onAction("PERMISSION_YES")}>Record YES</Button><Button variant="outline" className="rounded-full" onClick={() => onAction("PERMISSION_NO")}>Record NO</Button></> : null}
              {item.canReviewSafety ? <Button className="rounded-full" onClick={() => onAction("SAFETY")}>Review Safety</Button> : null}
              {item.canReviewDisclosure ? <Button className="rounded-full" onClick={() => onAction("DISCLOSURE")}>Review Disclosure</Button> : null}
              {item.canSendForApproval ? <Button className="rounded-full" onClick={() => onAction("APPROVAL")}>Send for Content Approval</Button> : null}
              {!item.canRecordPermission && !item.canReviewSafety && !item.canReviewDisclosure && !item.canSendForApproval ? <p className="py-2 text-sm text-muted-foreground">{item.nextAction}</p> : null}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function G8CreatorProofPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const [dashboard, setDashboard] = useState<G8DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<G8QueueFilter>("ALL");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActionDialog>(null);
  const [submitting, setSubmitting] = useState(false);

  const [intake, setIntake] = useState(EMPTY_INTAKE);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [permissionNote, setPermissionNote] = useState("");
  const [safetyChecks, setSafetyChecks] = useState<string[]>([]);
  const [musicRights, setMusicRights] = useState<"PASS" | "NOT_APPLICABLE" | "BLOCK">("PASS");
  const [safetyNote, setSafetyNote] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [relationship, setRelationship] = useState<"ORGANIC" | "GIFTED" | "PAID" | "AFFILIATE">("ORGANIC");
  const [disclosureText, setDisclosureText] = useState("");
  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const [disclosureEvidence, setDisclosureEvidence] = useState("");
  const [paidPartnership, setPaidPartnership] = useState(false);
  const [disclosureNote, setDisclosureNote] = useState("");
  const [assetTitle, setAssetTitle] = useState("");
  const [assetCaption, setAssetCaption] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeEvidence, setRevokeEvidence] = useState("");
  const [revokeConfirmed, setRevokeConfirmed] = useState(false);

  const selectedItem = useMemo(() => dashboard?.items.find((item) => item.itemKey === selectedKey) ?? null, [dashboard, selectedKey]);

  const loadDashboard = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    mode === "initial" ? setLoading(true) : setRefreshing(true);
    setError(null);
    try {
      const response = await request(buildRouteUrl(DASHBOARD_ROUTE), { cache: "no-store", silent: true });
      const body = await parseJson<G8DashboardData & { message?: string }>(response);
      if (!response.ok || !body?.items || !body.summary) throw new Error(body?.message || "UGC data could not be loaded.");
      setDashboard(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "UGC data could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (dashboard?.items ?? []).filter((item) => {
      const matchesSearch = !query || item.creatorUsername.toLowerCase().includes(query) || item.caption.toLowerCase().includes(query);
      return matchesSearch && filterMatches(item, filter);
    });
  }, [dashboard, filter, search]);

  const openDetails = (item: G8UgcItem) => {
    setSelectedKey(item.itemKey);
    setDetailsOpen(true);
  };

  const openAction = (action: Exclude<ActionDialog, null>) => {
    if (selectedItem) {
      setAssetTitle(`${selectedItem.creatorUsername.replace(/^@/, "")} · Cevonne UGC`);
      setAssetCaption(selectedItem.caption === "No caption provided." ? "" : selectedItem.caption);
      setRelationship(selectedItem.relationshipType);
    }
    setPermissionConfirmed(false);
    setActiveDialog(action);
  };

  const closeAction = () => {
    if (submitting) return;
    setActiveDialog(null);
    setPermissionConfirmed(false);
  };

  const submitAction = async (payload: Record<string, unknown>, onSuccess?: () => void) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await request(buildRouteUrl(ACTION_ROUTE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        silent: true,
      });
      const body = await parseJson<G8ActionResponse & { message?: string }>(response);
      if (!response.ok && body?.status !== "BLOCKED") throw new Error(body?.message || "The request could not be completed.");
      if (!body) throw new Error("The request could not be completed.");

      if (body.status === "BLOCKED") toast.warning(body.message);
      else toast.success(body.message);
      if (body.status !== "BLOCKED") {
        onSuccess?.();
        setActiveDialog(null);
        await loadDashboard("refresh");
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "The request could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitIntake = () => submitAction({
    action: "INTAKE",
    mediaId: intake.mediaId.trim() || null,
    sourceUrl: intake.sourceUrl.trim() || null,
    creatorUsername: intake.creatorUsername.trim().replace(/^@/, ""),
    creatorDisplayName: intake.creatorDisplayName.trim() || null,
    mentionedBrand: intake.mentionedBrand,
    taggedBrand: intake.taggedBrand,
    mediaType: intake.mediaType,
    caption: intake.caption.trim(),
  }, () => { setAddOpen(false); setIntake(EMPTY_INTAKE); });

  const noPerformance = !dashboard?.performance.length;

  return (
    <WorkflowDashboardShell
      eyebrow="AI Automations · G8"
      title="G8 — UGC + Creator Proof"
      description="Manage creator permission, content safety and approved UGC reuse."
      actions={
        <>
          <Button className="rounded-full" onClick={() => setAddOpen(true)}><Plus />Add UGC</Button>
          <Button variant="outline" className="rounded-full bg-white" onClick={() => void loadDashboard("refresh")} disabled={refreshing}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCcw />}Refresh</Button>
        </>
      }
    >
      {loading ? <LoadingState /> : error ? (
        <Alert className="rounded-2xl border-rose-200 bg-rose-50"><AlertTriangle /><AlertTitle>UGC could not be loaded</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><span>{error}</span><Button variant="outline" className="rounded-full bg-white" onClick={() => void loadDashboard()}>Retry</Button></AlertDescription></Alert>
      ) : dashboard ? (
        <>
          <SummaryCards data={dashboard} />

          <Card className="overflow-hidden rounded-3xl border-border/60 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-4 border-b border-border/60 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="font-serif text-2xl text-primary">UGC review queue</CardTitle>
                <CardDescription>Review each creator response and move eligible content forward.</CardDescription>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator or caption" className="h-10 rounded-full pl-10" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap gap-2 border-b border-border/60 px-5 py-3">
                {G8_QUEUE_FILTERS.map((value) => (
                  <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "ghost"} className="rounded-full" onClick={() => setFilter(value)}>{G8_FILTER_LABELS[value]}</Button>
                ))}
              </div>

              {!dashboard.items.length ? (
                <div className="grid min-h-56 place-items-center p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/7 text-primary"><ImageIcon /></span><h3 className="mt-4 font-serif text-xl text-primary">No UGC has been registered yet.</h3><p className="mt-1 text-sm text-muted-foreground">Add a tagged or mentioned Instagram post to begin.</p><Button className="mt-4 rounded-full" onClick={() => setAddOpen(true)}><Plus />Add UGC</Button></div></div>
              ) : !filteredItems.length ? (
                <div className="grid min-h-48 place-items-center p-6 text-center"><div><h3 className="font-serif text-xl text-primary">{filter === "AWAITING_PERMISSION" && !search.trim() ? "No creator responses are waiting to be recorded." : "No matching UGC"}</h3><p className="mt-1 text-sm text-muted-foreground">{filter === "AWAITING_PERMISSION" && !search.trim() ? "New pending responses will appear here." : "Try another creator, caption or status filter."}</p></div></div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Creator</TableHead><TableHead>Content</TableHead><TableHead>Received</TableHead><TableHead>Status & next action</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow key={item.itemKey} className="group">
                            <TableCell><div className="flex items-center gap-3"><MediaPreview item={item} className="size-12 shrink-0 rounded-xl" /><div className="min-w-0"><p className="max-w-44 truncate font-medium">@{item.creatorUsername.replace(/^@/, "")}</p><p className="text-xs text-muted-foreground">{item.sourceType}</p></div></div></TableCell>
                            <TableCell><p className="line-clamp-1 max-w-72 text-sm" title={item.caption}>{item.caption}</p><p className="mt-1 text-xs text-muted-foreground">{item.mediaType.toLowerCase()}</p></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.receivedAt)}</TableCell>
                            <TableCell><StatusBadge status={item.currentStatus} /><p className="mt-1.5 line-clamp-1 max-w-56 text-xs text-muted-foreground" title={item.nextAction}>{item.nextAction}</p></TableCell>
                            <TableCell className="text-right"><Button variant="ghost" className="rounded-full" onClick={() => openDetails(item)}>View Details <Eye /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="grid gap-3 p-4 md:hidden">
                    {filteredItems.map((item) => (
                      <article key={item.itemKey} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex gap-3"><MediaPreview item={item} className="size-16 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate font-medium">@{item.creatorUsername.replace(/^@/, "")}</p><p className="line-clamp-1 text-sm text-muted-foreground">{item.caption}</p><p className="mt-1 text-xs text-muted-foreground">{item.sourceType} · {formatDate(item.receivedAt)}</p></div></div>
                        <div className="mt-3 flex items-center justify-between gap-2"><div className="min-w-0"><StatusBadge status={item.currentStatus} /><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.nextAction}</p></div><Button variant="outline" size="sm" className="rounded-full" onClick={() => openDetails(item)}>View Details</Button></div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 bg-white shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-serif text-2xl text-primary">Creator performance</CardTitle><CardDescription>Simple outcomes from tracked creator activity.</CardDescription></CardHeader>
            <CardContent>
              {noPerformance ? <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-5 text-sm text-muted-foreground">No creator performance data is available yet.</div> : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {dashboard.performance.map((row) => (
                    <div key={row.creatorUsername} className="rounded-2xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">@{row.creatorUsername.replace(/^@/, "")}</p>{row.roi !== null ? <Badge variant="outline" className="rounded-full">{row.roi.toFixed(0)}% ROI</Badge> : null}</div><dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Clicks</dt><dd className="mt-1 font-semibold">{row.clicks}</dd></div><div><dt className="text-xs text-muted-foreground">Leads</dt><dd className="mt-1 font-semibold">{row.leads}</dd></div><div><dt className="text-xs text-muted-foreground">Purchases</dt><dd className="mt-1 font-semibold">{row.purchases}</dd></div><div><dt className="text-xs text-muted-foreground">Revenue</dt><dd className="mt-1 font-semibold">{formatCurrency(row.revenue, row.currency)}</dd></div><div><dt className="text-xs text-muted-foreground">Creator cost</dt><dd className="mt-1 font-semibold">{formatCurrency(row.creatorCost, row.currency)}</dd></div></dl></div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <DetailSheet item={selectedItem} open={detailsOpen} onOpenChange={setDetailsOpen} onAction={openAction} />

      <Dialog open={addOpen} onOpenChange={(open) => !submitting && setAddOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Add UGC</DialogTitle><DialogDescription>Register a tagged or mentioned Instagram post. Creator permission will still be required.</DialogDescription></DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="g8-media-id">Instagram media ID <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id="g8-media-id" value={intake.mediaId} onChange={(event) => setIntake((current) => ({ ...current, mediaId: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor="g8-source-url">Post or Story reference URL</FieldLabel><Input id="g8-source-url" type="url" value={intake.sourceUrl} onChange={(event) => setIntake((current) => ({ ...current, sourceUrl: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor="g8-creator">Creator username</FieldLabel><Input id="g8-creator" placeholder="@creator" value={intake.creatorUsername} onChange={(event) => setIntake((current) => ({ ...current, creatorUsername: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor="g8-display-name">Creator display name <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id="g8-display-name" value={intake.creatorDisplayName} onChange={(event) => setIntake((current) => ({ ...current, creatorDisplayName: event.target.value }))} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field orientation="horizontal" className="rounded-xl border p-3"><Checkbox id="g8-mentioned" checked={intake.mentionedBrand} onCheckedChange={(checked) => setIntake((current) => ({ ...current, mentionedBrand: checked === true }))} /><FieldLabel htmlFor="g8-mentioned">Cevonne was mentioned</FieldLabel></Field>
              <Field orientation="horizontal" className="rounded-xl border p-3"><Checkbox id="g8-tagged" checked={intake.taggedBrand} onCheckedChange={(checked) => setIntake((current) => ({ ...current, taggedBrand: checked === true }))} /><FieldLabel htmlFor="g8-tagged">Cevonne was tagged</FieldLabel></Field>
            </div>
            <Field><FieldLabel>Media type</FieldLabel><Select value={intake.mediaType} onValueChange={(value) => setIntake((current) => ({ ...current, mediaType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL", "UNKNOWN"].map((value) => <SelectItem key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</SelectItem>)}</SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="g8-caption">Caption <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-caption" rows={3} value={intake.caption} onChange={(event) => setIntake((current) => ({ ...current, caption: event.target.value }))} /></Field>
          </FieldGroup>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button><Button onClick={submitIntake} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <Plus />}Save UGC</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "PERMISSION_YES" || activeDialog === "PERMISSION_NO"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{activeDialog === "PERMISSION_YES" ? "Record creator permission?" : "Record permission declined?"}</DialogTitle><DialogDescription>{activeDialog === "PERMISSION_YES" ? "Check the creator’s response in ManyChat before recording the decision." : "This permanently blocks this content from being reused unless a new permission request is completed."}</DialogDescription></DialogHeader>
          {activeDialog === "PERMISSION_YES" ? <ul className="grid gap-2 rounded-2xl bg-muted/25 p-4 text-sm"><li>Instagram and Facebook organic social use</li><li>Valid for 12 months · worldwide</li><li>Creator credit required</li><li>Crop or resize allowed</li><li className="font-medium text-rose-700">Paid advertising not allowed</li></ul> : null}
          <Field><FieldLabel htmlFor="g8-permission-note">Admin note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-permission-note" rows={3} value={permissionNote} onChange={(event) => setPermissionNote(event.target.value)} /></Field>
          <Field orientation="horizontal" className="items-start rounded-xl border p-3"><Checkbox id="g8-permission-confirm" checked={permissionConfirmed} onCheckedChange={(checked) => setPermissionConfirmed(checked === true)} /><FieldLabel htmlFor="g8-permission-confirm" className="leading-5">I checked the creator’s {activeDialog === "PERMISSION_YES" ? "YES" : "NO"} response in ManyChat.</FieldLabel></Field>
          <DialogFooter><Button variant="outline" onClick={closeAction} disabled={submitting}>Cancel</Button><Button variant={activeDialog === "PERMISSION_NO" ? "destructive" : "default"} disabled={!permissionConfirmed || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: activeDialog, itemKey: selectedItem.itemKey, reviewerNote: permissionNote.trim() || null, confirmed: true })}>{submitting ? <Loader2 className="animate-spin" /> : null}{activeDialog === "PERMISSION_YES" ? "Record YES" : "Record NO"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "SAFETY"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Brand-safety review</DialogTitle><DialogDescription>Confirm every item to pass, or record a clear reason to block the content.</DialogDescription></DialogHeader>
          <FieldGroup className="gap-3">
            {SAFETY_CHECKS.map((check, index) => <Field key={check} orientation="horizontal" className="items-start rounded-xl border p-3"><Checkbox id={`g8-safety-check-${index}`} checked={safetyChecks.includes(check)} onCheckedChange={(checked) => setSafetyChecks((current) => checked === true ? [...current, check] : current.filter((value) => value !== check))} /><FieldLabel htmlFor={`g8-safety-check-${index}`} className="leading-5">{check}</FieldLabel></Field>)}
            <Field><FieldLabel>Music rights</FieldLabel><Select value={musicRights} onValueChange={(value: "PASS" | "NOT_APPLICABLE" | "BLOCK") => setMusicRights(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PASS">Cleared</SelectItem><SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem><SelectItem value="BLOCK">Not cleared</SelectItem></SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="g8-safety-note">Review note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-safety-note" rows={2} value={safetyNote} onChange={(event) => setSafetyNote(event.target.value)} /></Field>
            <Field><FieldLabel>Block reason</FieldLabel><Select value={blockReason} onValueChange={setBlockReason}><SelectTrigger><SelectValue placeholder="Choose the issue when blocking" /></SelectTrigger><SelectContent>{SAFETY_BLOCK_REASONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent></Select></Field>
          </FieldGroup>
          <DialogFooter><Button variant="destructive" disabled={!blockReason.trim() || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "SAFETY_BLOCK", itemKey: selectedItem.itemKey, musicRights, reviewerNote: safetyNote.trim() || null, blockReason: blockReason.trim(), confirmedChecks: safetyChecks })}>Block Content</Button><Button disabled={safetyChecks.length !== SAFETY_CHECKS.length || musicRights === "BLOCK" || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "SAFETY_PASS", itemKey: selectedItem.itemKey, musicRights, reviewerNote: safetyNote.trim() || null, blockReason: null, confirmedChecks: safetyChecks })}>{submitting ? <Loader2 className="animate-spin" /> : null}Pass Safety Review</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "DISCLOSURE"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Disclosure review</DialogTitle><DialogDescription>Record the creator relationship and confirm the visible disclosure when required.</DialogDescription></DialogHeader>
          <FieldGroup className="gap-4">
            <Field><FieldLabel>Relationship type</FieldLabel><Select value={relationship} onValueChange={(value: typeof relationship) => setRelationship(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ORGANIC">Organic</SelectItem><SelectItem value="GIFTED">Gifted</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="AFFILIATE">Affiliate</SelectItem></SelectContent></Select>{relationship === "ORGANIC" ? <FieldDescription>Disclosure is not required for organic content.</FieldDescription> : null}</Field>
            {relationship !== "ORGANIC" ? <><Field><FieldLabel htmlFor="g8-disclosure-text">Disclosure text</FieldLabel><Input id="g8-disclosure-text" value={disclosureText} onChange={(event) => setDisclosureText(event.target.value)} /></Field><Field><FieldLabel htmlFor="g8-disclosure-evidence">Evidence / reference URL</FieldLabel><Input id="g8-disclosure-evidence" type="url" value={disclosureEvidence} onChange={(event) => setDisclosureEvidence(event.target.value)} /></Field><Field orientation="horizontal" className="rounded-xl border p-3"><Checkbox id="g8-disclosure-visible" checked={disclosureVisible} onCheckedChange={(checked) => setDisclosureVisible(checked === true)} /><FieldLabel htmlFor="g8-disclosure-visible">Disclosure is clearly visible</FieldLabel></Field>{relationship === "PAID" ? <Field orientation="horizontal" className="rounded-xl border p-3"><Checkbox id="g8-paid-label" checked={paidPartnership} onCheckedChange={(checked) => setPaidPartnership(checked === true)} /><FieldLabel htmlFor="g8-paid-label">Paid partnership label is present</FieldLabel></Field> : null}</> : null}
            <Field><FieldLabel htmlFor="g8-disclosure-note">Review note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-disclosure-note" rows={2} value={disclosureNote} onChange={(event) => setDisclosureNote(event.target.value)} /></Field>
          </FieldGroup>
          <DialogFooter><Button variant="outline" onClick={closeAction} disabled={submitting}>Cancel</Button><Button disabled={submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "DISCLOSURE", itemKey: selectedItem.itemKey, relationshipType: relationship, disclosureText: disclosureText.trim() || null, disclosureVisible, evidenceUrl: disclosureEvidence.trim() || null, paidPartnershipLabel: paidPartnership, reviewerNote: disclosureNote.trim() || null })}>{submitting ? <Loader2 className="animate-spin" /> : <Check />}Complete Disclosure Review</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "APPROVAL"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Send for content approval</DialogTitle><DialogDescription>This content will go through content review before human approval.</DialogDescription></DialogHeader>
          {selectedItem ? <div className="flex gap-3 rounded-2xl bg-muted/20 p-3"><MediaPreview item={selectedItem} className="size-20 shrink-0 rounded-xl" /><div className="min-w-0"><p className="font-medium">Organic social</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assetCaption || "Add approved caption text below."}</p></div></div> : null}
          <Alert className="rounded-xl border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>Organic use only</AlertTitle><AlertDescription>Paid advertising requires separate creator permission.</AlertDescription></Alert>
          <FieldGroup className="gap-4"><Field><FieldLabel htmlFor="g8-asset-title">Asset title</FieldLabel><Input id="g8-asset-title" value={assetTitle} onChange={(event) => setAssetTitle(event.target.value)} /></Field><Field><FieldLabel htmlFor="g8-asset-caption">Caption / content text</FieldLabel><Textarea id="g8-asset-caption" rows={4} value={assetCaption} onChange={(event) => setAssetCaption(event.target.value)} /></Field></FieldGroup>
          <DialogFooter><Button variant="outline" onClick={closeAction} disabled={submitting}>Cancel</Button><Button disabled={!assetTitle.trim() || !assetCaption.trim() || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "SEND_FOR_APPROVAL", itemKey: selectedItem.itemKey, assetTitle: assetTitle.trim(), contentText: assetCaption.trim() })}>{submitting ? <Loader2 className="animate-spin" /> : null}Send for Content Approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "REVOCATION"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">Revoke creator permission?</DialogTitle><DialogDescription>This blocks future reuse and may place affected approval or publishing items into manual review.</DialogDescription></DialogHeader>
          <FieldGroup className="gap-4"><Field><FieldLabel htmlFor="g8-revoke-reason">Revocation reason</FieldLabel><Textarea id="g8-revoke-reason" rows={3} value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} /></Field><Field><FieldLabel htmlFor="g8-revoke-evidence">Reference / evidence link</FieldLabel><Input id="g8-revoke-evidence" type="url" value={revokeEvidence} onChange={(event) => setRevokeEvidence(event.target.value)} /></Field><Field orientation="horizontal" className="items-start rounded-xl border border-rose-200 bg-rose-50 p-3"><Checkbox id="g8-revoke-confirm" checked={revokeConfirmed} onCheckedChange={(checked) => setRevokeConfirmed(checked === true)} /><FieldLabel htmlFor="g8-revoke-confirm" className="leading-5">I understand that future use must be blocked.</FieldLabel></Field></FieldGroup>
          <DialogFooter><Button variant="outline" onClick={closeAction} disabled={submitting}>Cancel</Button><Button variant="destructive" disabled={!revokeReason.trim() || !revokeEvidence.trim() || !revokeConfirmed || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "REVOKE_PERMISSION", itemKey: selectedItem.itemKey, reason: revokeReason.trim(), evidenceUrl: revokeEvidence.trim(), confirmed: true })}>{submitting ? <Loader2 className="animate-spin" /> : null}Revoke Permission</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
