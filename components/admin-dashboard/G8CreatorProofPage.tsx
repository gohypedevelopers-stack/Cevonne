"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Eye,
  ImageIcon,
  Loader2,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/context/AuthContext";
import {
  G8_FILTER_LABELS,
  G8_QUEUE_FILTERS,
  type G8ActionResponse,
  type G8DashboardData,
  type G8FriendlyStatus,
  type G8NextActionKind,
  type G8QueueFilter,
  type G8StepState,
  type G8UgcItem,
} from "@/lib/admin/g8-creator-proof";
import { cn } from "@/lib/utils";

type ActionSurface = "PERMISSION" | "SAFETY" | "DISCLOSURE" | "SEND_TO_G4" | "STORY_MEDIA" | null;
type ContentFilter = "ALL" | "STORY" | "POST" | "REEL";
type RequestOptions = RequestInit & { silent?: boolean };
type PermissionProof = { storedUrl: string; fileName: string; previewUrl: string | null };

const DASHBOARD_ROUTE = "/api/admin/n8n/g8/items";
const STORY_MEDIA_ROUTE = "/api/admin/n8n/g8/evidence";
const PERMISSION_MESSAGE = "Thanks for mentioning Cevonne! May Cevonne repost this content on our Instagram and Facebook organic social channels for 12 months, worldwide, with credit to your Instagram account? We may crop or resize it only for formatting. This permission does not include paid advertising. Reply YES to give permission or NO to decline.";
const SAFETY_CHECKS = [
  "No child or minor is visible",
  "No competitor product is visible",
  "No private or sensitive content is visible",
  "No prohibited or sexual content is visible",
  "Product or beauty claims are safe",
  "Copyright use is cleared",
  "Music rights are cleared or not applicable",
] as const;

const SAFETY_CONTROLS = [
  { key: "children", label: "Children visible?", options: [{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }], safeValue: "NO", blockReason: "CHILD_VISIBLE" },
  { key: "competitor", label: "Competitor visible?", options: [{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }], safeValue: "NO", blockReason: "COMPETITOR_VISIBLE" },
  { key: "sensitive", label: "Sensitive content?", options: [{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }], safeValue: "NO", blockReason: "PRIVATE_CONTENT" },
  { key: "prohibited", label: "Prohibited content?", options: [{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }], safeValue: "NO", blockReason: "PROHIBITED_CONTENT" },
  { key: "claims", label: "Claims", options: [{ value: "SAFE", label: "Safe" }, { value: "RISK", label: "Risk" }], safeValue: "SAFE", blockReason: "CLAIM_RISK" },
  { key: "copyright", label: "Copyright", options: [{ value: "CLEARED", label: "Cleared" }, { value: "ISSUE", label: "Issue" }], safeValue: "CLEARED", blockReason: "COPYRIGHT_NOT_CLEARED" },
  { key: "music", label: "Music", options: [{ value: "PASS", label: "Cleared" }, { value: "NOT_APPLICABLE", label: "Not applicable" }, { value: "BLOCK", label: "Issue" }], safeValue: "PASS", safeValues: ["PASS", "NOT_APPLICABLE"], blockReason: "MUSIC_NOT_CLEARED" },
] as const;

type SafetyKey = (typeof SAFETY_CONTROLS)[number]["key"];
type SafetyAnswers = Record<SafetyKey, string>;

const emptySafetyAnswers = (): SafetyAnswers => ({
  children: "",
  competitor: "",
  sensitive: "",
  prohibited: "",
  claims: "",
  copyright: "",
  music: "",
});

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

const actionRoute = (action: string) => {
  if (action === "PERMISSION_YES" || action === "PERMISSION_NO") return "/api/admin/n8n/g8/permission";
  if (action === "SAFETY_PASS" || action === "SAFETY_BLOCK") return "/api/admin/n8n/g8/brand-safety";
  if (action === "DISCLOSURE") return "/api/admin/n8n/g8/disclosure";
  return "/api/admin/n8n/g8/send-to-review";
};

const formatReceived = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) {
    const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
    return `Today, ${time}`;
  }
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const actionSurfaceFor = (kind: G8NextActionKind): ActionSurface => {
  if (kind === "REQUEST_PERMISSION") return "PERMISSION";
  if (kind === "ADD_STORY_MEDIA") return "STORY_MEDIA";
  if (kind === "REVIEW_SAFETY") return "SAFETY";
  if (kind === "REVIEW_DISCLOSURE") return "DISCLOSURE";
  if (kind === "SEND_TO_G4") return "SEND_TO_G4";
  return null;
};

const statusVariant = (status: G8FriendlyStatus): "default" | "secondary" | "destructive" | "outline" =>
  ["Blocked", "Permission Declined", "Safety Blocked", "Rights Expired", "Rights Revoked"].includes(status) ? "destructive" : "outline";

const statusClassName = (status: G8FriendlyStatus) => {
  if (["Blocked", "Permission Declined", "Safety Blocked", "Rights Expired", "Rights Revoked"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-800";
  if (["Ready", "Ready for G4", "Permission Granted", "Safety Passed", "Disclosure Passed", "Disclosure Not Required", "Sent to Content Review"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["Awaiting Permission", "Permission Required"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-violet-200 bg-violet-50 text-violet-800";
};

const filterMatches = (item: G8UgcItem, filter: G8QueueFilter) => {
  if (filter === "ALL") return true;
  if (filter === "NEEDS_ACTION") return !["WAITING_FOR_CREATOR", "SENT_TO_G4", "NONE", "VIEW_REASON"].includes(item.nextActionKind);
  if (filter === "AWAITING_PERMISSION") return ["Awaiting Permission", "Permission Required"].includes(item.currentStatus);
  if (filter === "NEEDS_SAFETY") return ["Safety Review Needed", "Disclosure Review Needed", "Needs Review", "Could Not Complete"].includes(item.currentStatus);
  if (filter === "APPROVED") return ["Ready", "Ready for G4"].includes(item.currentStatus);
  return item.isTerminallyBlocked;
};

const stagePills = (item: G8UgcItem) => {
  if (item.isTerminallyBlocked) {
    const label = item.permissionLabel === "Permission Denied" ? "Permission Denied" : item.safetyLabel === "Safety Blocked" ? "Safety Blocked" : "Blocked";
    return [{ label, state: "BLOCKED" as const }];
  }
  const stages: Array<{ label: string; state: G8StepState }> = [];
  if (item.permissionLabel === "Permission Granted") stages.push({ label: "Permission", state: "COMPLETE" });
  else stages.push({ label: item.permissionLabel === "Permission Pending" ? "Permission Pending" : "Permission Needed", state: "CURRENT" });

  if (item.permissionLabel === "Permission Granted") {
    if (item.safetyLabel === "Safety Passed") stages.push({ label: "Safety", state: "COMPLETE" });
    else stages.push({ label: "Safety Needed", state: "CURRENT" });
  }
  if (item.safetyLabel === "Safety Passed") {
    if (item.disclosureLabel === "Disclosure Passed") stages.push({ label: "Disclosure", state: "COMPLETE" });
    else if (item.disclosureLabel === "Disclosure Not Required") stages.push({ label: "Disclosure N/A", state: "COMPLETE" });
    else stages.push({ label: "Disclosure Needed", state: "CURRENT" });
  }
  return stages.slice(0, 3);
};

function MediaPreview({ item, className }: { item: G8UgcItem; className?: string }) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => setUnavailable(false), [item.mediaType, item.mediaUrl]);
  const isVideo = /VIDEO|REEL/.test(item.mediaType.toUpperCase());

  if (!item.mediaUrl || unavailable) {
    return (
      <div className={cn("grid place-items-center gap-1 rounded-xl bg-muted text-muted-foreground", className)} aria-label={`${item.contentType} preview unavailable`}>
        <ImageIcon aria-hidden="true" />
        {item.isStoryMention ? <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Story</span> : null}
      </div>
    );
  }
  if (isVideo) return <video src={item.mediaUrl} muted playsInline preload="metadata" aria-label={`Instagram video shared by ${item.creatorUsername}`} className={cn("rounded-xl bg-muted object-cover", className)} onError={() => setUnavailable(true)} />;
  return <img src={item.mediaUrl} alt={`Instagram content shared by ${item.creatorUsername}`} width={400} height={500} className={cn("rounded-xl bg-muted object-cover", className)} loading="lazy" onError={() => setUnavailable(true)} />;
}

function StatusBadge({ status }: { status: G8FriendlyStatus }) {
  return <Badge variant={statusVariant(status)} className={cn("rounded-full border px-2.5 py-1 font-medium", statusClassName(status))}>{status}</Badge>;
}

function ProgressPills({ item }: { item: G8UgcItem }) {
  return (
    <div className="flex min-w-[168px] flex-wrap gap-1.5">
      {stagePills(item).map((stage) => (
        <Badge key={stage.label} variant={stage.state === "BLOCKED" ? "destructive" : stage.state === "COMPLETE" ? "secondary" : "outline"} className={cn("rounded-full font-normal", stage.state === "COMPLETE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : stage.state === "CURRENT" ? "border-amber-200 bg-amber-50 text-amber-900" : "")}>
          {stage.state === "COMPLETE" ? <Check aria-hidden="true" /> : null}
          {stage.label}
        </Badge>
      ))}
    </div>
  );
}

function PrimaryAction({ item, onAction, isSubmitting = false }: { item: G8UgcItem; onAction: (item: G8UgcItem) => void; isSubmitting?: boolean }) {
  const disabled = ["WAITING_FOR_CREATOR", "SENT_TO_G4", "NONE", "VIEW_REASON"].includes(item.nextActionKind);
  const label: Record<G8NextActionKind, string> = {
    WAITING_FOR_CREATOR: "Waiting for Creator",
    REQUEST_PERMISSION: "Request Permission",
    ADD_STORY_MEDIA: "Add Story Media",
    REVIEW_SAFETY: "Review Safety",
    REVIEW_DISCLOSURE: "Review Disclosure",
    SEND_TO_G4: "Send to G4",
    SENT_TO_G4: "Sent to G4 ✓",
    VIEW_REASON: "Blocked",
    NONE: "Ready for Reuse",
  };
  if (item.nextActionKind === "WAITING_FOR_CREATOR") return <span className="whitespace-nowrap text-sm text-muted-foreground">Waiting for Creator</span>;
  if (item.nextActionKind === "VIEW_REASON") return <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800">Blocked</span>;
  const variant = item.nextActionKind === "SENT_TO_G4" || item.nextActionKind === "NONE" ? "secondary" : "default";
  const classes = item.nextActionKind === "SENT_TO_G4" || item.nextActionKind === "NONE" ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50" : "";
  return <Button size="sm" variant={variant} className={cn("min-w-32 rounded-full px-4 shadow-sm", classes)} disabled={disabled || isSubmitting} onClick={() => onAction(item)}>{isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}{isSubmitting ? "Sending…" : label[item.nextActionKind]}</Button>;
}

function PermissionProofUpload({
  id,
  label,
  proof,
  uploading,
  onSelect,
}: {
  id: string;
  label: string;
  proof: PermissionProof | null;
  uploading: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <Field className="gap-2 rounded-xl border p-3">
      <FieldLabel htmlFor={id}>Conversation proof</FieldLabel>
      <Input id={id} name={id} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(event) => { onSelect(event.target.files?.[0] || null); event.currentTarget.value = ""; }} disabled={uploading} />
      <Button type="button" variant="outline" className="w-fit rounded-full" onClick={() => document.getElementById(id)?.click()} disabled={uploading}>
        {uploading ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}
        {label}
      </Button>
      {proof ? <div className="flex items-center gap-3 rounded-lg bg-muted/70 p-2.5"><div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-background text-muted-foreground">{proof.previewUrl ? <img src={proof.previewUrl} alt="Selected conversation screenshot preview" width={80} height={80} className="size-full object-cover" /> : <ImageIcon aria-hidden="true" />}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{proof.fileName}</p><p className="text-xs text-muted-foreground">Attached</p></div><CheckCircle2 className="ml-auto shrink-0 text-primary" aria-label="Conversation proof attached" /></div> : <FieldDescription>Attach a screenshot that shows the message and the creator’s answer.</FieldDescription>}
    </Field>
  );
}

function QueueSummary({ data }: { data: G8DashboardData }) {
  const cards = [
    { label: "New UGC", detail: "Content recently received", value: data.summary.newUgc, icon: ImageIcon },
    { label: "Waiting for Permission", detail: "Waiting on creators", value: data.summary.awaitingPermission, icon: Clock3 },
    { label: "Needs Review", detail: "Safety or disclosure", value: data.summary.needsReview, icon: ShieldCheck },
    { label: "Ready for G4", detail: "All G8 checks passed", value: data.summary.readyApproved, icon: CheckCircle2 },
  ];

  return (
    <section aria-labelledby="g8-summary-title" className="w-full px-0">
      <h2 id="g8-summary-title" className="sr-only">UGC queue summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, detail, value, icon: Icon }) => (
          <Card key={label} className="rounded-2xl border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Icon aria-hidden="true" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <p className="sr-only">Loading UGC queue</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
      <Card className="rounded-3xl"><CardContent className="flex flex-col gap-3 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</CardContent></Card>
    </div>
  );
}

function DetailSheet({ item, open, onOpenChange, onAction }: { item: G8UgcItem | null; open: boolean; onOpenChange: (open: boolean) => void; onAction: (item: G8UgcItem) => void }) {
  if (!item) return null;
  const blockIndex = item.progress.findIndex((step) => step.state === "BLOCKED");
  const detailProgress = item.isTerminallyBlocked && blockIndex >= 0 ? item.progress.slice(0, blockIndex + 1) : item.progress;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 pr-14 text-left">
          <SheetTitle className="font-serif text-2xl">@{item.creatorUsername.replace(/^@/, "")}</SheetTitle>
          <SheetDescription>Instagram · {item.sourceType} · Received {formatReceived(item.receivedAt)}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-5">
            <section className="grid gap-4 sm:grid-cols-[152px_1fr]" aria-label="Content preview">
              <MediaPreview item={item} className="aspect-[4/5] w-full" />
              <div className="flex min-w-0 flex-col items-start gap-3">
                <StatusBadge status={item.currentStatus} />
                {item.caption ? <p className="text-sm leading-6 text-foreground">{item.caption}</p> : null}
                {item.sourceUrl ? <Button asChild size="sm" variant="outline" className="rounded-full"><a href={item.sourceUrl} target="_blank" rel="noreferrer">Open original post</a></Button> : null}
              </div>
            </section>

            {item.latestMessage ? <Alert><AlertTriangle aria-hidden="true" /><AlertTitle>Attention needed</AlertTitle><AlertDescription>{item.latestMessage}</AlertDescription></Alert> : null}

            <section className="flex flex-col gap-3" aria-labelledby="g8-detail-next-step">
              <div className="flex items-center justify-between gap-3"><h3 id="g8-detail-next-step" className="font-serif text-xl">Next step</h3><PrimaryAction item={item} onAction={onAction} /></div>
              {item.nextActionKind === "WAITING_FOR_CREATOR" ? <p className="text-sm leading-6 text-muted-foreground">Permission request sent automatically through Instagram. This item refreshes when the creator responds.</p> : null}
              {item.nextActionKind === "ADD_STORY_MEDIA" ? <p className="text-sm leading-6 text-muted-foreground">Add the Story screenshot or video once. It will become the content preview and be used automatically for review.</p> : null}
            </section>

            <Separator />
            <section className="flex flex-col gap-3" aria-labelledby="g8-detail-progress">
              <h3 id="g8-detail-progress" className="font-serif text-xl">Progress</h3>
              <div className="flex flex-col gap-2">
                {detailProgress.map((step) => <div key={step.label} className="flex items-center justify-between gap-3"><span className="text-sm text-foreground">{step.label}</span><Badge variant={step.state === "BLOCKED" ? "destructive" : step.state === "COMPLETE" ? "secondary" : "outline"} className="rounded-full">{step.state === "COMPLETE" ? "Complete" : step.state === "BLOCKED" ? "Blocked" : step.state === "CURRENT" ? "In review" : "Not started"}</Badge></div>)}
              </div>
            </section>

            <Separator />
            <section className="flex flex-col gap-2" aria-labelledby="g8-detail-permission">
              <div className="flex items-center justify-between gap-3"><h3 id="g8-detail-permission" className="font-serif text-xl">Permission</h3><Badge variant={item.permissionLabel === "Permission Granted" ? "secondary" : item.permissionLabel === "Permission Denied" ? "destructive" : "outline"} className="rounded-full">{item.permissionLabel}</Badge></div>
              {item.permissionLabel === "Permission Granted" ? <><p className="text-sm text-foreground">Organic Instagram + Facebook · Worldwide</p><p className="text-sm text-muted-foreground">Paid ads not allowed · Attribution required</p>{item.rightsExpiresAt ? <p className="text-sm text-muted-foreground">Valid until {formatDate(item.rightsExpiresAt)}</p> : null}</> : <p className="text-sm text-muted-foreground">{item.isAutomaticPermissionFlow ? "Permission is being handled through Instagram." : "Permission has not been recorded yet."}</p>}
            </section>

            <Separator />
            <section className="flex flex-col gap-2" aria-labelledby="g8-detail-safety">
              <div className="flex items-center justify-between gap-3"><h3 id="g8-detail-safety" className="font-serif text-xl">Safety</h3><Badge variant={item.safetyLabel === "Safety Passed" ? "secondary" : item.safetyLabel === "Safety Blocked" ? "destructive" : "outline"} className="rounded-full">{item.safetyLabel}</Badge></div>
            </section>

            <Separator />
            <section className="flex flex-col gap-2" aria-labelledby="g8-detail-disclosure">
              <div className="flex items-center justify-between gap-3"><h3 id="g8-detail-disclosure" className="font-serif text-xl">Disclosure</h3><Badge variant={item.disclosureLabel === "Disclosure Passed" || item.disclosureLabel === "Disclosure Not Required" ? "secondary" : "outline"} className="rounded-full">{item.disclosureLabel}</Badge></div>
            </section>

            <Separator />
            <section className="flex flex-col gap-3" aria-labelledby="g8-detail-activity">
              <h3 id="g8-detail-activity" className="font-serif text-xl">Activity</h3>
              <div className="flex flex-col gap-3">
                {item.activity.map((event) => <div key={`${event.label}-${event.occurredAt}`} className="flex items-start justify-between gap-4"><p className="text-sm text-foreground">{event.label}</p><time dateTime={event.occurredAt} className="shrink-0 text-xs text-muted-foreground">{formatReceived(event.occurredAt)}</time></div>)}
              </div>
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
  const [contentFilter, setContentFilter] = useState<ContentFilter>("ALL");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeSurface, setActiveSurface] = useState<ActionSurface>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingStoryMedia, setUploadingStoryMedia] = useState(false);
  const [permissionNote, setPermissionNote] = useState("");
  const [conversationProof, setConversationProof] = useState<PermissionProof | null>(null);
  const [uploadingConversationProof, setUploadingConversationProof] = useState(false);
  const [safetyAnswers, setSafetyAnswers] = useState<SafetyAnswers>(emptySafetyAnswers);
  const [safetyNote, setSafetyNote] = useState("");
  const [relationship, setRelationship] = useState<"ORGANIC" | "GIFTED" | "PAID" | "AFFILIATE">("ORGANIC");
  const [disclosureText, setDisclosureText] = useState("");
  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const [paidPartnership, setPaidPartnership] = useState(false);
  const [disclosureNote, setDisclosureNote] = useState("");
  const [blockConfirmationOpen, setBlockConfirmationOpen] = useState(false);

  const selectedItem = useMemo(() => dashboard?.items.find((item) => item.itemKey === selectedKey) ?? null, [dashboard, selectedKey]);

  const loadDashboard = useCallback(async (mode: "initial" | "refresh" | "poll" = "initial") => {
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    if (mode !== "poll") setError(null);
    try {
      const response = await request(buildRouteUrl(DASHBOARD_ROUTE), { cache: "no-store", silent: true });
      const body = await parseJson<G8DashboardData & { message?: string }>(response);
      if (!response.ok || !body?.items || !body.summary) throw new Error("The UGC queue couldn't load. Try again.");
      setDashboard(body);
    } catch {
      if (mode !== "poll") setError("The UGC queue couldn't load. Try again.");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, [request]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadDashboard("poll");
    };
    const intervalId = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadDashboard]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (dashboard?.items ?? []).filter((item) => {
      const matchesCreator = !query || item.creatorUsername.toLowerCase().includes(query) || item.creatorDisplayName?.toLowerCase().includes(query);
      const matchesContent = contentFilter === "ALL" || item.contentType.toUpperCase() === contentFilter;
      return matchesCreator && matchesContent && filterMatches(item, filter);
    });
  }, [contentFilter, dashboard, filter, search]);

  const safetyBlockReason = useMemo(() => SAFETY_CONTROLS.find((control) => {
    const safeValues = "safeValues" in control ? control.safeValues : [control.safeValue];
    return safetyAnswers[control.key] && !safeValues.includes(safetyAnswers[control.key] as never);
  })?.blockReason || null, [safetyAnswers]);
  const canApproveSafety = SAFETY_CONTROLS.every((control) => {
    const safeValues = "safeValues" in control ? control.safeValues : [control.safeValue];
    return safeValues.includes(safetyAnswers[control.key] as never);
  });

  const prepareAction = (item: G8UgcItem, surface: ActionSurface) => {
    setSelectedKey(item.itemKey);
    setDetailsOpen(false);
    setPermissionNote("");
    setConversationProof(null);
    setSafetyAnswers(emptySafetyAnswers());
    setSafetyNote("");
    setRelationship(item.relationshipType);
    setDisclosureText("");
    setDisclosureVisible(false);
    setPaidPartnership(false);
    setDisclosureNote("");
    setActiveSurface(surface);
  };

  const getCurrentItem = async (itemKey: string) => {
    const response = await request(buildRouteUrl(`${DASHBOARD_ROUTE}/${itemKey}`), { cache: "no-store", silent: true });
    const item = await parseJson<G8UgcItem & { message?: string }>(response);
    if (!response.ok || !item?.itemKey) throw new Error(item?.message || "This content could not be refreshed. Try again.");
    return item;
  };

  const handlePrimaryAction = async (item: G8UgcItem) => {
    if (item.nextActionKind === "VIEW_REASON" || item.nextActionKind === "WAITING_FOR_CREATOR" || item.nextActionKind === "SENT_TO_G4" || item.nextActionKind === "NONE") return;
    const surface = actionSurfaceFor(item.nextActionKind);
    if (!surface) return;
    if (surface !== "PERMISSION") {
      prepareAction(item, surface);
      return;
    }
    try {
      const currentItem = await getCurrentItem(item.itemKey);
      if (currentItem.nextActionKind !== "REQUEST_PERMISSION") {
        await loadDashboard("poll");
        toast.success(currentItem.currentStatus === "Blocked" ? "This permission request has been blocked." : `Permission is already recorded. ${currentItem.nextAction} is now available.`);
        return;
      }
      prepareAction(currentItem, "PERMISSION");
    } catch (refreshError) {
      toast.error(refreshError instanceof Error ? refreshError.message : "This content could not be refreshed. Try again.");
    }
  };

  const closeSurface = () => {
    if (submitting || uploadingStoryMedia || uploadingConversationProof) return;
    setActiveSurface(null);
    setBlockConfirmationOpen(false);
  };

  const submitAction = async (payload: Record<string, unknown>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await request(buildRouteUrl(actionRoute(String(payload.action))), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        silent: true,
      });
      const body = await parseJson<G8ActionResponse & { message?: string }>(response);
      if (!body) throw new Error("The request could not be completed.");
      if (!response.ok && body.status !== "BLOCKED") throw new Error(body.message || "The request could not be completed.");
      const retainG4ModalForRetry = body.status === "BLOCKED" && payload.action === "SEND_FOR_APPROVAL";
      if (body.status === "BLOCKED") toast.warning(body.message || "G4 could not confirm this handoff. Please try again.");
      else toast.success(body.message);
      if (!retainG4ModalForRetry) {
        setActiveSurface(null);
        setBlockConfirmationOpen(false);
      }
      await loadDashboard("refresh");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "The request could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadStoryMedia = async (file: File | null) => {
    if (!file || !selectedItem || uploadingStoryMedia) return;
    setUploadingStoryMedia(true);
    try {
      const formData = new FormData();
      formData.set("itemKey", selectedItem.itemKey);
      formData.set("purpose", "STORY_MEDIA");
      formData.set("file", file);
      const response = await request(buildRouteUrl(STORY_MEDIA_ROUTE), { method: "POST", body: formData, silent: true });
      const body = await parseJson<{ storedUrl?: string; message?: string }>(response);
      if (!response.ok || !body?.storedUrl) throw new Error(body?.message || "The Story media couldn't be added. Try again.");
      toast.success("Story media added. The queue is up to date.");
      setActiveSurface(null);
      await loadDashboard("refresh");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "The Story media couldn't be added. Try again.");
    } finally {
      setUploadingStoryMedia(false);
    }
  };

  const uploadConversationProof = async (file: File | null) => {
    if (!file || !selectedItem || uploadingConversationProof) return;
    setUploadingConversationProof(true);
    try {
      const formData = new FormData();
      formData.set("itemKey", selectedItem.itemKey);
      formData.set("purpose", "CONVERSATION_PROOF");
      formData.set("file", file);
      const response = await request(buildRouteUrl(STORY_MEDIA_ROUTE), { method: "POST", body: formData, silent: true });
      const body = await parseJson<{ storedUrl?: string; fileName?: string; message?: string }>(response);
      if (!response.ok || !body?.storedUrl) throw new Error(body?.message || "The proof couldn't be attached. Try again.");
      const proof = { storedUrl: body.storedUrl, fileName: body.fileName || file.name || "Attached proof", previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null };
      setConversationProof((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return proof;
      });
      toast.success("Conversation proof attached.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "The proof couldn't be attached. Try again.");
    } finally {
      setUploadingConversationProof(false);
    }
  };

  const copyPermissionMessage = async () => {
    try {
      await navigator.clipboard.writeText(PERMISSION_MESSAGE);
      toast.success("Permission message copied.");
    } catch {
      toast.error("The message couldn't be copied. Select and copy it manually.");
    }
  };

  return (
    <WorkflowDashboardShell
      eyebrow="Workflows · G8"
      title="UGC & Creator Permissions"
      description="Review creator content, permissions and approval readiness."
      actions={<Button variant="outline" className="rounded-full" onClick={() => void loadDashboard("refresh")} disabled={refreshing}>{refreshing ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <RefreshCcw data-icon="inline-start" aria-hidden="true" />}Refresh</Button>}
    >
      <a href="#g8-queue" className="sr-only focus:not-sr-only focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to UGC queue</a>
      {loading ? <LoadingState /> : error ? (
        <Alert aria-live="polite"><AlertTriangle aria-hidden="true" /><AlertTitle>Unable to load UGC</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><span>{error}</span><Button variant="outline" onClick={() => void loadDashboard()}>Try again</Button></AlertDescription></Alert>
      ) : dashboard ? (
        <div className="flex flex-col gap-6">
          <QueueSummary data={dashboard} />

          <Card id="g8-queue" className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="font-serif text-2xl">Creator approval inbox</CardTitle>
                <CardDescription>Each item has one next step. Content and proof stay together.</CardDescription>
              </div>
              <div className="flex w-full items-center gap-2 rounded-xl border bg-background px-3 lg:max-w-sm"><Search className="shrink-0 text-muted-foreground" aria-hidden="true" /><Input id="g8-creator-search" name="creator-search" aria-label="Search creator" autoComplete="off" spellCheck={false} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator" className="border-0 px-0 shadow-none focus-visible:ring-0" /></div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
                {G8_QUEUE_FILTERS.map((value) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "ghost"} className="rounded-full px-3.5" onClick={() => setFilter(value)}>{G8_FILTER_LABELS[value]}</Button>)}
                <Select value={contentFilter} onValueChange={(value: ContentFilter) => setContentFilter(value)}>
                  <SelectTrigger aria-label="Filter content type" className="ml-auto"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="ALL">All Content</SelectItem><SelectItem value="STORY">Story</SelectItem><SelectItem value="POST">Post</SelectItem><SelectItem value="REEL">Reel</SelectItem></SelectGroup></SelectContent>
                </Select>
              </div>

              {!dashboard.items.length ? <div className="grid min-h-64 place-items-center p-6 text-center"><div className="flex max-w-sm flex-col items-center gap-3"><div className="grid size-12 place-items-center rounded-full bg-muted"><ImageIcon aria-hidden="true" /></div><h3 className="font-serif text-xl">No UGC has arrived yet.</h3><p className="text-sm text-muted-foreground">New content will appear here automatically.</p></div></div> : !filteredItems.length ? <div className="grid min-h-56 place-items-center p-6 text-center"><div className="flex flex-col gap-1"><h3 className="font-serif text-xl">You’re all caught up.</h3><p className="text-sm text-muted-foreground">No content matches these filters.</p></div></div> : <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Creator & content</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => <TableRow key={item.itemKey} className="[content-visibility:auto] transition-colors hover:bg-muted/50">
                        <TableCell className="py-5"><div className="flex min-w-[280px] items-center gap-3.5"><MediaPreview item={item} className="size-[68px] shrink-0 border border-border/60" /><div className="min-w-0"><p className="truncate font-medium">@{item.creatorUsername.replace(/^@/, "")}</p><p className="mt-0.5 text-xs text-muted-foreground">Instagram · {item.sourceType}</p>{item.caption ? <p className="mt-1 line-clamp-2 max-w-72 text-sm leading-5 text-muted-foreground">{item.caption}</p> : null}</div></div></TableCell>
                        <TableCell><ProgressPills item={item} /></TableCell>
                        <TableCell><StatusBadge status={item.currentStatus} /></TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground"><time dateTime={item.receivedAt}>{formatReceived(item.receivedAt)}</time></TableCell>
                        <TableCell><div className="flex items-center justify-end gap-2"><PrimaryAction item={item} onAction={handlePrimaryAction} /><Button size="icon" variant="ghost" className="rounded-full" aria-label={`View details for ${item.creatorUsername}`} onClick={() => { setSelectedKey(item.itemKey); setDetailsOpen(true); }}><Eye aria-hidden="true" /></Button></div></TableCell>
                      </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 p-4 md:hidden">
                  {filteredItems.map((item) => <article key={item.itemKey} className="flex flex-col gap-3 rounded-2xl border p-3"><div className="flex gap-3"><MediaPreview item={item} className="size-16 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate font-medium">@{item.creatorUsername.replace(/^@/, "")}</p><p className="text-xs text-muted-foreground">Instagram · {item.sourceType} · {formatReceived(item.receivedAt)}</p>{item.caption ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.caption}</p> : null}</div><Button size="icon" variant="ghost" aria-label={`View details for ${item.creatorUsername}`} onClick={() => { setSelectedKey(item.itemKey); setDetailsOpen(true); }}><Eye aria-hidden="true" /></Button></div><ProgressPills item={item} /><div className="flex items-center justify-between gap-3"><StatusBadge status={item.currentStatus} /><PrimaryAction item={item} onAction={handlePrimaryAction} /></div></article>)}
                </div>
              </>}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <DetailSheet item={selectedItem} open={detailsOpen} onOpenChange={setDetailsOpen} onAction={handlePrimaryAction} />

      <Dialog open={activeSurface === "PERMISSION"} onOpenChange={(open) => !open && closeSurface()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Request creator permission</DialogTitle>
            <DialogDescription>Send the approved message, then record the creator’s response when it arrives.</DialogDescription>
          </DialogHeader>
          {selectedItem ? <div className="flex items-center gap-3 rounded-xl border p-3"><MediaPreview item={selectedItem} className="size-12 shrink-0" /><div className="min-w-0"><p className="truncate font-medium">@{selectedItem.creatorUsername.replace(/^@/, "")}</p><p className="text-xs text-muted-foreground">Instagram · {selectedItem.sourceType}</p></div></div> : null}
          <div className="rounded-xl bg-muted p-4 text-sm leading-6 text-foreground">{PERMISSION_MESSAGE}</div>
          <Button variant="outline" className="w-fit rounded-full" onClick={() => void copyPermissionMessage()}><Clipboard data-icon="inline-start" aria-hidden="true" />Copy message</Button>
          <FieldGroup>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><span className="font-medium">Permission status:</span> Waiting for creator response</div>
            <PermissionProofUpload id="g8-conversation-proof" label="Attach conversation screenshot" proof={conversationProof} uploading={uploadingConversationProof} onSelect={(file) => void uploadConversationProof(file)} />
            <Field>
              <FieldLabel htmlFor="g8-permission-note">Admin note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <Textarea id="g8-permission-note" name="permission-note" autoComplete="off" rows={2} value={permissionNote} onChange={(event) => setPermissionNote(event.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={closeSurface} disabled={submitting || uploadingConversationProof}>Cancel</Button>
            <Button variant="destructive" disabled={!conversationProof || submitting || uploadingConversationProof || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "PERMISSION_NO", itemKey: selectedItem.itemKey, reviewerNote: permissionNote.trim() || null, permissionRequestText: PERMISSION_MESSAGE, creatorReplyText: "NO", requestEvidenceUrl: conversationProof?.storedUrl ?? "", replyEvidenceUrl: conversationProof?.storedUrl ?? "", confirmed: true })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}Creator Declined</Button>
            <Button disabled={!conversationProof || submitting || uploadingConversationProof || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "PERMISSION_YES", itemKey: selectedItem.itemKey, reviewerNote: permissionNote.trim() || null, permissionRequestText: PERMISSION_MESSAGE, creatorReplyText: "YES", requestEvidenceUrl: conversationProof?.storedUrl ?? "", replyEvidenceUrl: conversationProof?.storedUrl ?? "", confirmed: true })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}Creator Approved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeSurface === "STORY_MEDIA"} onOpenChange={(open) => !open && closeSurface()}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="font-serif text-2xl">Add Story media</DialogTitle><DialogDescription>Add the Story screenshot or video once. It will become this item’s preview and be used automatically for safety and disclosure checks.</DialogDescription></DialogHeader>{selectedItem ? <div className="flex items-center gap-3 rounded-xl border p-3"><MediaPreview item={selectedItem} className="size-12 shrink-0" /><div className="min-w-0"><p className="truncate font-medium">@{selectedItem.creatorUsername.replace(/^@/, "")}</p><p className="text-xs text-muted-foreground">Instagram · Story Mention</p></div></div> : null}<Field><FieldLabel htmlFor="g8-story-media">Story screenshot or video</FieldLabel><Input id="g8-story-media" name="story-media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => void uploadStoryMedia(event.target.files?.[0] || null)} disabled={uploadingStoryMedia} /><FieldDescription>JPG, PNG, WebP, GIF, MP4, WebM or MOV · up to 25 MB.</FieldDescription></Field><DialogFooter><Button variant="outline" onClick={closeSurface} disabled={uploadingStoryMedia}>Cancel</Button><Button disabled>{uploadingStoryMedia ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}Choose a file above</Button></DialogFooter></DialogContent>
      </Dialog>

      <Sheet open={activeSurface === "SAFETY"} onOpenChange={(open) => !open && closeSurface()}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl"><SheetHeader className="border-b px-5 py-5 pr-14 text-left"><SheetTitle className="font-serif text-2xl">Safety review</SheetTitle><SheetDescription>Review what is visible in the content before Cevonne can reuse it.</SheetDescription></SheetHeader><ScrollArea className="min-h-0 flex-1"><div className="flex flex-col gap-6 p-5">{selectedItem ? <div className="flex items-center gap-3 rounded-xl border p-3"><MediaPreview item={selectedItem} className="size-16 shrink-0" /><div className="min-w-0"><p className="truncate font-medium">@{selectedItem.creatorUsername.replace(/^@/, "")}</p><p className="text-xs text-muted-foreground">Instagram · {selectedItem.sourceType}</p>{selectedItem.caption ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{selectedItem.caption}</p> : null}</div></div> : null}<FieldGroup className="gap-4">{SAFETY_CONTROLS.map((control) => <Field key={control.key} className="gap-2 rounded-xl border p-3"><FieldLabel id={`g8-safety-${control.key}`}>{control.label}</FieldLabel><ToggleGroup type="single" value={safetyAnswers[control.key]} onValueChange={(value) => value && setSafetyAnswers((current) => ({ ...current, [control.key]: value }))} aria-labelledby={`g8-safety-${control.key}`} variant="outline" size="sm" className="w-full">{control.options.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}</ToggleGroup></Field>)}<Field><FieldLabel htmlFor="g8-safety-note">Review note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-safety-note" name="safety-note" autoComplete="off" rows={3} value={safetyNote} onChange={(event) => setSafetyNote(event.target.value)} /></Field></FieldGroup></div></ScrollArea><SheetFooter className="border-t px-5 py-4 sm:flex-row sm:justify-end"><Button variant="destructive" disabled={!safetyBlockReason || submitting || !selectedItem} onClick={() => setBlockConfirmationOpen(true)}>Block Content</Button><Button disabled={!canApproveSafety || submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "SAFETY_PASS", itemKey: selectedItem.itemKey, musicRights: safetyAnswers.music as "PASS" | "NOT_APPLICABLE" | "BLOCK", reviewerNote: safetyNote.trim() || null, blockReason: null, confirmedChecks: SAFETY_CHECKS })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Check data-icon="inline-start" aria-hidden="true" />}Approve Safety</Button></SheetFooter></SheetContent>
      </Sheet>

      <Dialog open={blockConfirmationOpen} onOpenChange={setBlockConfirmationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Block this content?</DialogTitle><DialogDescription>This stops the item from moving to disclosure or G4. You can still view the reason in its details.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setBlockConfirmationOpen(false)} disabled={submitting}>Keep Reviewing</Button><Button variant="destructive" disabled={submitting || !selectedItem || !safetyBlockReason} onClick={() => selectedItem && void submitAction({ action: "SAFETY_BLOCK", itemKey: selectedItem.itemKey, musicRights: safetyAnswers.music || "BLOCK", reviewerNote: safetyNote.trim() || null, blockReason: safetyBlockReason, confirmedChecks: [] })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}Block Content</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeSurface === "DISCLOSURE"} onOpenChange={(open) => !open && closeSurface()}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="font-serif text-2xl">Disclosure review</DialogTitle><DialogDescription>Confirm only the disclosure details that apply to this creator relationship.</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="g8-relationship">Relationship</FieldLabel><Select value={relationship} onValueChange={(value: typeof relationship) => setRelationship(value)}><SelectTrigger id="g8-relationship"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="ORGANIC">Organic</SelectItem><SelectItem value="GIFTED">Gifted</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="AFFILIATE">Affiliate</SelectItem></SelectGroup></SelectContent></Select>{relationship === "ORGANIC" ? <FieldDescription>No disclosure is needed for organic content.</FieldDescription> : null}</Field>{relationship !== "ORGANIC" ? <><Field><FieldLabel htmlFor="g8-disclosure-text">Disclosure text</FieldLabel><Input id="g8-disclosure-text" name="disclosure-text" autoComplete="off" value={disclosureText} onChange={(event) => setDisclosureText(event.target.value)} /></Field><Field orientation="horizontal" className="items-start rounded-xl border p-3"><Checkbox id="g8-disclosure-visible" checked={disclosureVisible} onCheckedChange={(checked) => setDisclosureVisible(checked === true)} /><FieldLabel htmlFor="g8-disclosure-visible" className="leading-5">Disclosure is clearly visible in the content</FieldLabel></Field>{relationship === "PAID" ? <Field orientation="horizontal" className="items-start rounded-xl border p-3"><Checkbox id="g8-paid-label" checked={paidPartnership} onCheckedChange={(checked) => setPaidPartnership(checked === true)} /><FieldLabel htmlFor="g8-paid-label" className="leading-5">Paid partnership label is present</FieldLabel></Field> : null}</> : null}<Field><FieldLabel htmlFor="g8-disclosure-note">Review note <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="g8-disclosure-note" name="disclosure-note" autoComplete="off" rows={2} value={disclosureNote} onChange={(event) => setDisclosureNote(event.target.value)} /></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={closeSurface} disabled={submitting}>Cancel</Button><Button disabled={submitting || !selectedItem || (relationship !== "ORGANIC" && (!disclosureText.trim() || !disclosureVisible || (relationship === "PAID" && !paidPartnership)))} onClick={() => selectedItem && void submitAction({ action: "DISCLOSURE", itemKey: selectedItem.itemKey, relationshipType: relationship, disclosureText: disclosureText.trim() || null, disclosureVisible, evidenceUrl: null, paidPartnershipLabel: paidPartnership, reviewerNote: disclosureNote.trim() || null })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Check data-icon="inline-start" aria-hidden="true" />}Complete review</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={activeSurface === "SEND_TO_G4"} onOpenChange={(open) => !open && closeSurface()}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Send to G4</DialogTitle>
            <DialogDescription>G4 will review this approved creator content.</DialogDescription>
          </DialogHeader>

          {selectedItem ? <>
            <section className="flex items-center gap-3 rounded-xl border bg-card p-3" aria-label="Creator content">
              <MediaPreview item={selectedItem} className="size-16 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">@{selectedItem.creatorUsername.replace(/^@/, "")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Instagram · {selectedItem.sourceType}</p>
              </div>
            </section>

            <section className="rounded-xl border bg-emerald-50/50 p-3" aria-label="Completed checks">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">Checks complete</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="border-emerald-200 bg-white text-emerald-900"><Check aria-hidden="true" />Creator Permission</Badge>
                <Badge variant="secondary" className="border-emerald-200 bg-white text-emerald-900"><Check aria-hidden="true" />Brand Safety</Badge>
                <Badge variant="secondary" className="border-emerald-200 bg-white text-emerald-900"><Check aria-hidden="true" />{selectedItem.disclosureLabel === "Disclosure Not Required" ? "Disclosure N/A" : "Disclosure"}</Badge>
              </div>
            </section>

            {selectedItem.caption ? <section className="rounded-xl bg-muted/65 p-3" aria-label="Original caption"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Original caption</p><p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedItem.caption}</p></section> : null}
          </> : null}

          <Alert className="border-violet-200 bg-violet-50/60"><ShieldCheck aria-hidden="true" className="text-violet-800" /><AlertTitle>Organic social use only</AlertTitle><AlertDescription>Paid advertising is not permitted under these rights.</AlertDescription></Alert>

          <DialogFooter>
            <Button variant="outline" onClick={closeSurface} disabled={submitting}>Cancel</Button>
            <Button disabled={submitting || !selectedItem} onClick={() => selectedItem && void submitAction({ action: "SEND_FOR_APPROVAL", itemKey: selectedItem.itemKey })}>{submitting ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Send data-icon="inline-start" aria-hidden="true" />}{submitting ? "Sending…" : "Send to G4"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
