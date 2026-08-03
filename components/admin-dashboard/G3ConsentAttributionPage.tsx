"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/admin-dashboard/n8n-automations-common";
import type {
  G3EventType,
  G3WorkflowDetail,
  G3WorkflowOutcome,
  G3WorkflowStatus,
} from "@/server/next/api/g3-consent-attribution-adapter";

type G3Action = "consent" | "opt_out" | "attribution" | "purchase" | "privacy" | "privacy_verify" | "privacy_execute";

type G3RecordResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message: string;
  action_needed: string;
  handled_at: string;
  request_id: string;
  event_type: G3EventType;
  summary: string;
  contact_identifier_masked: string | null;
};

type G3FormState = {
  contact_identifier: string;
  channel: string;
  consent_status: string;
  source: string;
  consent_text: string;
  opt_out_reason: string;
  order_id: string;
  purchase_value: string;
  currency: string;
  request_id: string;
  request_type: string;
  verification_status: string;
  execution_action: string;
  attribution_event: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  gclid: string;
  fbclid: string;
  meta_event_id: string;
};

const ROUTE_DETAIL = "/api/admin/automations/g3";
const ROUTE_RECORD = "/api/admin/automations/g3/record-consent";

const G3_STATUS_LABELS: Record<G3WorkflowStatus, string> = {
  PASS: "Recorded safely",
  BLOCK: "Blocked safely",
  MANUAL_ONLY: "Manual review",
  NOT_RUN_YET: "Ready",
  ERROR: "System issue",
};

const G3_STATUS_TONES: Record<G3WorkflowStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-800",
  MANUAL_ONLY: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_RUN_YET: "border-slate-200 bg-slate-100 text-slate-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-800",
};

const G3_ACTION_COPY: Record<
  G3Action,
  {
    title: string;
    description: string;
    submitLabel: string;
    helper: string;
  }
> = {
  consent: {
    title: "Record Consent",
    description: "Log explicit opt-in permissions for marketing channels.",
    submitLabel: "Save Consent",
    helper: "Use for explicit WhatsApp, Email, or SMS opt-ins.",
  },
  opt_out: {
    title: "Record Opt-Out",
    description: "Register a STOP or unsubscribe request to permanently block marketing.",
    submitLabel: "Save Opt-Out",
    helper: "Contacts in this list will never receive automated campaigns.",
  },
  attribution: {
    title: "Record Attribution Event",
    description: "Log consented campaign traffic and UTM tracking signals.",
    submitLabel: "Save Attribution",
    helper: "Consent must be granted prior to linking campaign touchpoints.",
  },
  purchase: {
    title: "Record Purchase",
    description: "Log an order to immediately suppress abandoned cart recovery.",
    submitLabel: "Save Purchase",
    helper: "Stops automated recovery messages for converted customers.",
  },
  privacy: {
    title: "Submit Privacy Request",
    description: "Log a customer data request under DPDP / GDPR regulations.",
    submitLabel: "Submit Request",
    helper: "Requires identity verification before execution.",
  },
  privacy_verify: {
    title: "Verify Privacy Request",
    description: "Confirm that the customer identity has been verified.",
    submitLabel: "Confirm Verification",
    helper: "Verifying identity enables data export or deletion.",
  },
  privacy_execute: {
    title: "Execute Privacy Request",
    description: "Perform the final deletion or data export package.",
    submitLabel: "Execute Request",
    helper: "Destructive actions are permanently recorded in the privacy ledger.",
  },
};

const buildInitialFormState = (action: G3Action, contactIdentifier = ""): G3FormState => ({
  contact_identifier: contactIdentifier,
  channel: action === "privacy" || action === "purchase" || action === "attribution" ? "WEBSITE" : "WHATSAPP",
  consent_status: "GRANTED",
  source: "ADMIN_ACTION",
  consent_text: "User explicitly agreed to receive WhatsApp & Email communications.",
  opt_out_reason: "User requested unsubscribe / STOP",
  order_id: "",
  purchase_value: "2499",
  currency: "INR",
  request_id: "",
  request_type: "DELETE",
  verification_status: "VERIFIED",
  execution_action: "DELETE",
  attribution_event: "WEBSITE_VISIT",
  utm_source: "instagram",
  utm_medium: "paid_social",
  utm_campaign: "summer_launch",
  gclid: "",
  fbclid: "",
  meta_event_id: "",
});

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const getEventTypeLabel = (value: G3EventType) => {
  switch (value) {
    case "CONSENT_RECORDED":
      return "Consent granted";
    case "OPT_OUT_RECORDED":
      return "Opt-out recorded";
    case "ATTRIBUTION_RECORDED":
      return "Attribution recorded";
    case "PURCHASE_RECORDED":
      return "Purchase recorded";
    case "RECOVERY_SUPPRESSED":
      return "Recovery suppressed";
    case "PRIVACY_REQUEST_RECORDED":
      return "Privacy request";
    case "BLOCKED_NO_CONSENT":
      return "Blocked (No consent)";
    case "BLOCKED_STOP_OPT_OUT":
      return "Blocked (Opt-out active)";
    case "MANUAL_ONLY_PRIVACY_REVIEW":
      return "Manual privacy review";
    default:
      return value;
  }
};

const getChannelIcon = (channel: string) => {
  const norm = channel.toUpperCase();
  if (norm.includes("WHATSAPP")) return <MessageSquare className="size-3.5 text-emerald-600 shrink-0" />;
  if (norm.includes("SMS") || norm.includes("PHONE")) return <Phone className="size-3.5 text-sky-600 shrink-0" />;
  if (norm.includes("EMAIL")) return <Mail className="size-3.5 text-indigo-600 shrink-0" />;
  return <Shield className="size-3.5 text-primary shrink-0" />;
};

function StatCard({
  label,
  value,
  helper,
  icon,
  accent = "text-primary",
}: {
  label: string;
  value: string | number;
  helper: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">{label}</p>
        <div className="rounded-full bg-muted/30 p-2">{icon}</div>
      </div>
      <p className={cn("mt-2 text-2xl font-bold tracking-tight sm:mt-3 sm:text-3xl", accent)}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-1">{helper}</p>
    </div>
  );
}

function DetailField({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">{label}</p>
      <div className="mt-1.5 text-sm font-medium text-foreground text-pretty">{value}</div>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export default function G3ConsentAttributionPage() {
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<G3WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<G3Action>("consent");
  const [submitting, setSubmitting] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<G3WorkflowOutcome | null>(null);
  const [formState, setFormState] = useState<G3FormState>(() => buildInitialFormState("consent"));
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const loadDetail = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        const response = await authFetch(buildRouteUrl(ROUTE_DETAIL), { silent: true });
        const body = await parseJsonResponse<G3WorkflowDetail>(response);

        if (!response.ok || !body) {
          throw new Error(body?.message ?? `Unable to load G3 detail (${response.status}).`);
        }

        setDetail(body);
        setError(null);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load G3 detail.";
        setError(message);
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    void loadDetail("initial");
  }, [loadDetail]);

  const openAction = useCallback(
    (action: G3Action, context?: { contactIdentifier?: string; requestId?: string }) => {
      setActiveAction(action);
      setFormState((current) => ({
        ...buildInitialFormState(action, context?.contactIdentifier || current.contact_identifier),
        source: "ADMIN_ACTION",
        request_id: context?.requestId || "",
        contact_identifier: context?.contactIdentifier || current.contact_identifier,
      }));
      setDialogOpen(true);
    },
    [],
  );

  const updateField = useCallback(<K extends keyof G3FormState>(key: K, value: G3FormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  }, []);

  const submitEvent = useCallback(async () => {
    if (!dialogOpen) return;

    let payload: Record<string, unknown> = {};

    if (activeAction === "consent") {
      payload = {
        event_type: "CONSENT_RECORDED",
        contact_identifier: formState.contact_identifier.trim(),
        channel: formState.channel.trim() || "WHATSAPP",
        consent_status: formState.consent_status.trim() || "GRANTED",
        source: formState.source.trim() || "ADMIN_ACTION",
        consent_text: formState.consent_text.trim() || undefined,
        workflow_group: "G3",
      };
    } else if (activeAction === "opt_out") {
      payload = {
        event_type: "OPT_OUT_RECORDED",
        contact_identifier: formState.contact_identifier.trim(),
        channel: formState.channel.trim() || "WHATSAPP",
        opt_out_reason: formState.opt_out_reason.trim() || "user_unsubscribe",
        source: formState.source.trim() || "ADMIN_ACTION",
        workflow_group: "G3",
      };
    } else if (activeAction === "attribution") {
      payload = {
        event_type: "ATTRIBUTION_RECORDED",
        contact_identifier: formState.contact_identifier.trim(),
        channel: formState.channel.trim() || "WEBSITE",
        consent_status: "GRANTED",
        source: formState.source.trim() || "ADMIN_ACTION",
        attribution_event: formState.attribution_event.trim() || undefined,
        utm_source: formState.utm_source.trim() || undefined,
        utm_medium: formState.utm_medium.trim() || undefined,
        utm_campaign: formState.utm_campaign.trim() || undefined,
        gclid: formState.gclid.trim() || undefined,
        fbclid: formState.fbclid.trim() || undefined,
        meta_event_id: formState.meta_event_id.trim() || undefined,
        workflow_group: "G3",
      };
    } else if (activeAction === "purchase") {
      payload = {
        event_type: "PURCHASE_RECORDED",
        contact_identifier: formState.contact_identifier.trim(),
        order_id: formState.order_id.trim() || `ORD-${Date.now()}`,
        purchase_value: formState.purchase_value.trim() ? Number(formState.purchase_value) : 0,
        currency: formState.currency.trim() || "INR",
        source: formState.source.trim() || "ADMIN_ACTION",
        workflow_group: "G3",
      };
    } else if (activeAction === "privacy") {
      payload = {
        event_type: "PRIVACY_REQUEST_RECORDED",
        contact_identifier: formState.contact_identifier.trim(),
        request_type: formState.request_type.trim() || "DELETE",
        source: formState.source.trim() || "ADMIN_ACTION",
        workflow_group: "G3",
      };
    } else if (activeAction === "privacy_verify") {
      payload = {
        event_type: "PRIVACY_VERIFY",
        request_id: formState.request_id.trim(),
        verification_status: formState.verification_status.trim() || "VERIFIED",
        workflow_group: "G3",
      };
    } else if (activeAction === "privacy_execute") {
      payload = {
        event_type: "PRIVACY_EXECUTE",
        request_id: formState.request_id.trim(),
        execution_action: formState.execution_action.trim() || "DELETE",
        workflow_group: "G3",
      };
    }

    setSubmitting(true);
    try {
      const response = await authFetch(buildRouteUrl(ROUTE_RECORD), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        silent: true,
      });

      const body = await parseJsonResponse<G3RecordResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to process ${G3_ACTION_COPY[activeAction].title.toLowerCase()}.`);
      }

      if (body.status === "PASS") toast.success(body.message);
      else if (body.status === "MANUAL_ONLY") toast.info(body.message);
      else if (body.status === "BLOCK") toast.warning(body.message);
      else toast.error(body.message);

      setDialogOpen(false);
      setSelectedOutcome(null);
      await loadDetail("refresh");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to record event.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [activeAction, authFetch, dialogOpen, formState, loadDetail]);

  const recentOutcomes = detail?.recentOutcomes ?? [];
  const consents = detail?.consents ?? [];
  const optOuts = detail?.optOuts ?? [];
  const purchases = detail?.purchases ?? [];
  const privacyRequests = detail?.privacyRequests ?? [];
  const channelBreakdown = detail?.channelBreakdown ?? [];
  const counts = detail?.counts ?? {
    totalEvents: 0,
    consentEvents: 0,
    optOutEvents: 0,
    attributionEvents: 0,
    purchaseEvents: 0,
    recoveryEvents: 0,
    privacyEvents: 0,
    blockedEvents: 0,
    manualReviewEvents: 0,
    passEvents: 0,
  };

  const filteredConsents = consents.filter((c) =>
    searchQuery ? c.contactIdentifierMasked?.toLowerCase().includes(searchQuery.toLowerCase()) || c.channel.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  );
  const filteredOptOuts = optOuts.filter((o) =>
    searchQuery ? o.contactIdentifierMasked?.toLowerCase().includes(searchQuery.toLowerCase()) || o.channel.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  );
  const filteredPurchases = purchases.filter((p) =>
    searchQuery ? p.orderId.toLowerCase().includes(searchQuery.toLowerCase()) || p.contactIdentifierMasked?.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  );
  const filteredPrivacy = privacyRequests.filter((pr) =>
    searchQuery ? pr.requestId.toLowerCase().includes(searchQuery.toLowerCase()) || pr.contactIdentifierMasked?.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  );

  const headerActions = (
    <>
      <Button asChild variant="outline" className="h-9 rounded-full border-border/70 bg-white px-3.5 text-xs font-medium shadow-sm hover:bg-muted/50 sm:h-10 sm:px-4">
        <Link href="/dashboard/n8n-automations">
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-full border-border/70 bg-white px-3.5 text-xs font-medium shadow-sm hover:bg-muted/50 sm:h-10 sm:px-4"
        onClick={() => void loadDetail("refresh")}
        disabled={loading || refreshing}
      >
        <RefreshCw className={cn("mr-1.5 size-3.5", loading || refreshing ? "animate-spin" : undefined)} />
        {refreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </>
  );

  return (
    <WorkflowDashboardShell
      eyebrow="G3 Automation"
      title="G3 – Customer Consent & Privacy"
      description="Keeps customer permissions, opt-outs, purchases, marketing attribution and privacy requests synchronized safely across the website and CRM."
      badges={
        <>
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap", detail ? G3_STATUS_TONES[detail.status] : "")}>
            {detail ? G3_STATUS_LABELS[detail.status] : "Connecting"}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
            <Clock3 className="mr-1.5 size-3.5" />
            {detail?.lastRunAt ? formatDateTime(detail.lastRunAt) : "Live Database"}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
            <Database className="mr-1.5 size-3.5" />
            {counts.totalEvents} Records
          </Badge>
        </>
      }
      actions={headerActions}
    >
      {error ? (
        <Card role="alert" className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-xs leading-relaxed text-amber-950 sm:text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Sync Status Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !detail ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : detail ? (
        <div className="space-y-5 sm:space-y-6">
          {/* Responsive Stat Cards (2 cols mobile, 4 cols desktop) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="Active Consents"
              value={counts.consentEvents}
              helper="Explicit opt-ins logged"
              icon={<UserCheck className="size-4 text-emerald-600" />}
              accent="text-emerald-700"
            />
            <StatCard
              label="Opt-Outs"
              value={counts.optOutEvents}
              helper="Blocked contacts (STOP)"
              icon={<UserX className="size-4 text-rose-600" />}
              accent="text-rose-700"
            />
            <StatCard
              label="Purchases"
              value={counts.purchaseEvents}
              helper="Recovery suppressed"
              icon={<ShoppingBag className="size-4 text-primary" />}
              accent="text-primary"
            />
            <StatCard
              label="Privacy Requests"
              value={counts.privacyEvents}
              helper="DPDP / GDPR requests"
              icon={<ShieldAlert className="size-4 text-amber-600" />}
              accent="text-amber-700"
            />
          </div>

          {/* Clean Action Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground sm:text-sm">Quick Actions:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button size="sm" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("consent")}>
                <UserCheck className="mr-1 size-3.5" />
                Record Consent
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("opt_out")}>
                <UserX className="mr-1 size-3.5 text-rose-600" />
                Record Opt-Out
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("attribution")}>
                <Send className="mr-1 size-3.5 text-primary" />
                Attribution
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("purchase")}>
                <ShoppingBag className="mr-1 size-3.5 text-emerald-600" />
                Purchase
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("privacy")}>
                <ShieldCheck className="mr-1 size-3.5 text-amber-600" />
                Privacy Request
              </Button>
            </div>
          </div>

          {/* Responsive Navigation Tabs with Horizontal Scroll Support */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="overflow-x-auto pb-1 sm:pb-0">
                <TabsList className="inline-flex h-9 rounded-full border border-border/60 bg-muted/40 p-1 sm:h-10">
                  <TabsTrigger value="overview" className="rounded-full px-3 text-xs font-semibold">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="consents" className="rounded-full px-3 text-xs font-semibold">
                    Consents ({consents.length})
                  </TabsTrigger>
                  <TabsTrigger value="opt_outs" className="rounded-full px-3 text-xs font-semibold">
                    Opt-Outs ({optOuts.length})
                  </TabsTrigger>
                  <TabsTrigger value="purchases" className="rounded-full px-3 text-xs font-semibold">
                    Purchases ({purchases.length})
                  </TabsTrigger>
                  <TabsTrigger value="privacy" className="rounded-full px-3 text-xs font-semibold">
                    Privacy ({privacyRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="rounded-full px-3 text-xs font-semibold">
                    Audit
                  </TabsTrigger>
                </TabsList>
              </div>

              {activeTab !== "overview" ? (
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 rounded-full pl-8 text-xs sm:h-9"
                  />
                </div>
              ) : null}
            </div>

            {/* TAB 1: OVERVIEW & HEALTH */}
            <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                <div className="space-y-4 sm:space-y-6">
                  {/* Latest Event Card */}
                  <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Latest Synchronized Event</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Most recent event processed through G3.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", G3_STATUS_TONES[detail.status])}>
                          {G3_STATUS_LABELS[detail.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                      {detail.latestOutcome ? (
                        <>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <DetailField label="What happened" value={detail.latestOutcome.whatHappened} helper={detail.latestOutcome.summary} />
                            <DetailField label="Action taken" value={detail.latestOutcome.actionNeeded} helper="Synchronized safely." />
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <DetailField
                              label="Event type"
                              value={<Badge variant="outline" className="text-[10px]">{getEventTypeLabel(detail.latestOutcome.eventType)}</Badge>}
                            />
                            <DetailField
                              label="Status"
                              value={<Badge className={cn("text-[10px]", G3_STATUS_TONES[detail.latestOutcome.result])}>{G3_STATUS_LABELS[detail.latestOutcome.result]}</Badge>}
                            />
                            <DetailField label="Source" value={detail.latestOutcome.sourceLabel} />
                            <DetailField label="Timestamp" value={formatDateTime(detail.latestOutcome.time)} />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground text-center">
                          {detail.emptyStateCopy}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Channel Breakdown Card */}
                  <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Channel Permissions Health</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Granted permissions vs. opt-outs across channels.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                      {channelBreakdown.length > 0 ? (
                        channelBreakdown.map((ch) => {
                          const total = ch.total || ch.granted + ch.optedOut || 1;
                          const grantedPercent = Math.round((ch.granted / total) * 100);
                          return (
                            <div key={ch.channel} className="space-y-1.5 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-3.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                  {getChannelIcon(ch.channel)}
                                  <span>{ch.channel}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-semibold text-emerald-700">{ch.granted} Granted ({grantedPercent}%)</span>
                                  <span>•</span>
                                  <span className="font-semibold text-rose-700">{ch.optedOut} Opted Out</span>
                                </div>
                              </div>
                              <Progress value={grantedPercent} className="h-1.5 rounded-full bg-rose-100 [&>div]:bg-emerald-600" />
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                          Channel statistics will appear as consent events are recorded.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Sidebar Architecture Cards */}
                <div className="space-y-4 sm:space-y-6">
                  <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Safety & Governance Rules</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        How G3 enforces compliance standards.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0 text-xs leading-relaxed text-muted-foreground sm:p-6 sm:pt-0">
                      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                        <p className="font-semibold text-foreground">1. Permanent STOP Enforcement</p>
                        <p className="mt-1">Opt-out keywords (STOP, Unsubscribe) immediately block automated outbound messages across all integrated services.</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                        <p className="font-semibold text-foreground">2. Cart Recovery Suppression</p>
                        <p className="mt-1">When an order is registered, G3 marks the customer converted and immediately stops abandoned cart follow-up triggers.</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                        <p className="font-semibold text-foreground">3. Masked PII Protection</p>
                        <p className="mt-1">Customer contact identifiers and phone numbers are masked on the server before rendering in the browser.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CONSENT LEDGER */}
            <TabsContent value="consents" className="space-y-4">
              <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Consent Ledger</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Verifiable opt-in records with channel, source, and agreement text.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Contact (Masked)</TableHead>
                          <TableHead className="text-xs">Channel</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Consent Agreement</TableHead>
                          <TableHead className="text-xs">Synced At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredConsents.length > 0 ? (
                          filteredConsents.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs font-semibold text-primary">
                                {item.contactIdentifierMasked || "Masked Contact"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-xs font-medium">
                                  {getChannelIcon(item.channel)}
                                  <span>{item.channel}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
                                  {item.consentStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {item.sourcePlatform || "WEBSITE"}
                              </TableCell>
                              <TableCell className="max-w-[240px] truncate text-xs text-foreground" title={item.consentText || ""}>
                                {item.consentText || item.payloadSummary || "Explicit consent confirmed."}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(item.syncedAt)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                              No consent records found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: OPT-OUT REGISTRY */}
            <TabsContent value="opt_outs" className="space-y-4">
              <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Opt-Out & Stop Registry</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Contacts who requested to stop communications. Marketing is permanently suppressed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Blocked Contact</TableHead>
                          <TableHead className="text-xs">Channel</TableHead>
                          <TableHead className="text-xs">Keyword</TableHead>
                          <TableHead className="text-xs">Reason</TableHead>
                          <TableHead className="text-xs">Opted Out At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOptOuts.length > 0 ? (
                          filteredOptOuts.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs font-semibold text-rose-800">
                                {item.contactIdentifierMasked || "Masked Contact"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-xs font-medium">
                                  {getChannelIcon(item.channel)}
                                  <span>{item.channel}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] font-mono font-semibold text-rose-800">
                                  {item.keyword || "STOP"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-foreground">{item.reason || "User unsubscribe"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(item.syncedAt)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                              No opt-out records found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: PURCHASES & ATTRIBUTION */}
            <TabsContent value="purchases" className="space-y-4">
              <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Purchases & Suppression Registry</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Purchases registered for abandoned cart recovery suppression and marketing attribution.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Order ID</TableHead>
                          <TableHead className="text-xs">Customer (Masked)</TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs">Recovery Suppression</TableHead>
                          <TableHead className="text-xs">Campaign / Source</TableHead>
                          <TableHead className="text-xs">Purchased At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchases.length > 0 ? (
                          filteredPurchases.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs font-semibold text-primary">{item.orderId}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{item.contactIdentifierMasked || "Masked Contact"}</TableCell>
                              <TableCell className="text-xs font-semibold text-foreground">
                                {item.amount ? `${item.currency} ${item.amount}` : "Recorded"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
                                  <CheckCircle2 className="mr-1 size-2.5" />
                                  Active ({item.suppressionReason || "Completed"})
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {item.attribution?.utmCampaign ? `${item.attribution.utmSource || "ad"} / ${item.attribution.utmCampaign}` : "Direct"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(item.purchasedAt)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                              No purchase records found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 5: PRIVACY REQUESTS & GOVERNANCE */}
            <TabsContent value="privacy" className="space-y-4">
              <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Privacy Rights (DPDP / GDPR)</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Verify and process customer data deletion and export requests safely.
                    </CardDescription>
                  </div>
                  <Button size="sm" className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4" onClick={() => openAction("privacy")}>
                    <ShieldCheck className="mr-1.5 size-3.5" />
                    New Request
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Request ID</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Verification</TableHead>
                          <TableHead className="text-xs">Execution</TableHead>
                          <TableHead className="text-xs">Created At</TableHead>
                          <TableHead className="text-right text-xs">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPrivacy.length > 0 ? (
                          filteredPrivacy.map((item) => (
                            <TableRow key={item.requestId}>
                              <TableCell className="font-mono text-xs font-semibold text-primary">{item.requestId}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-semibold">
                                  {item.requestType}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{item.contactIdentifierMasked || "Masked"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    item.verificationStatus === "VERIFIED"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-amber-200 bg-amber-50 text-amber-800",
                                  )}
                                >
                                  {item.verificationStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    item.executionStatus === "EXECUTED"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-slate-200 bg-slate-50 text-slate-700",
                                  )}
                                >
                                  {item.executionStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(item.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.verificationStatus !== "VERIFIED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 rounded-full px-2 text-[10px] text-emerald-700 hover:bg-emerald-50 sm:h-7 sm:px-2.5 sm:text-xs"
                                    onClick={() => openAction("privacy_verify", { requestId: item.requestId, contactIdentifier: item.contactIdentifierMasked || "" })}
                                  >
                                    Verify ID
                                  </Button>
                                ) : item.executionStatus !== "EXECUTED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 rounded-full px-2 text-[10px] text-rose-700 hover:bg-rose-50 sm:h-7 sm:px-2.5 sm:text-xs"
                                    onClick={() => openAction("privacy_execute", { requestId: item.requestId, contactIdentifier: item.contactIdentifierMasked || "" })}
                                  >
                                    Execute
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground sm:text-xs">Done</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                              No privacy requests registered.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 6: AUDIT STREAM */}
            <TabsContent value="audit" className="space-y-4">
              <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="font-serif text-lg tracking-tight text-primary sm:text-xl">Audit Stream</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Chronological ledger of recent events and compliance decisions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Summary</TableHead>
                          <TableHead className="text-right text-xs">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentOutcomes.length > 0 ? (
                          recentOutcomes.map((outcome, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(outcome.time)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
                                  {getEventTypeLabel(outcome.eventType)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn("text-[10px] font-semibold", G3_STATUS_TONES[outcome.result])}>
                                  {G3_STATUS_LABELS[outcome.result]}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate text-xs text-foreground" title={outcome.whatHappened}>
                                {outcome.whatHappened}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 rounded-full px-2 text-[10px] text-primary sm:h-7 sm:px-2.5 sm:text-xs"
                                  onClick={() => setSelectedOutcome(outcome)}
                                >
                                  <Eye className="mr-1 size-3" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                              No recent audit events.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}

      {/* ACTION DIALOG MODAL (Clean, responsive width) */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSubmitting(false);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[94vw] max-w-lg overflow-y-auto rounded-2xl border-border/60 bg-white p-5 shadow-2xl sm:p-6">
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-serif text-xl tracking-tight text-primary sm:text-2xl">
                {G3_ACTION_COPY[activeAction].title}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {G3_ACTION_COPY[activeAction].description}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
              {G3_ACTION_COPY[activeAction].helper}
            </div>

            <div className="space-y-3.5">
              {activeAction !== "privacy_verify" && activeAction !== "privacy_execute" ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Identifier</p>
                  <Input
                    value={formState.contact_identifier}
                    onChange={(e) => updateField("contact_identifier", e.target.value)}
                    placeholder="user@example.com or +91 98765 43210"
                    className="h-10 rounded-xl bg-muted/15 text-xs sm:text-sm"
                  />
                </div>
              ) : null}

              {activeAction === "consent" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Channel</p>
                      <Select value={formState.channel} onValueChange={(v) => updateField("channel", v)}>
                        <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="WEBSITE">Website</SelectItem>
                          <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                      <Select value={formState.consent_status} onValueChange={(v) => updateField("consent_status", v)}>
                        <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GRANTED">Granted (Explicit)</SelectItem>
                          <SelectItem value="REVIEW">Pending Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Agreement Text</p>
                    <Textarea
                      value={formState.consent_text}
                      onChange={(e) => updateField("consent_text", e.target.value)}
                      rows={2}
                      className="rounded-xl bg-muted/15 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activeAction === "opt_out" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Channel</p>
                    <Select value={formState.channel} onValueChange={(v) => updateField("channel", v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="ALL">All Channels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason</p>
                    <Input
                      value={formState.opt_out_reason}
                      onChange={(e) => updateField("opt_out_reason", e.target.value)}
                      placeholder="User replied STOP"
                      className="h-10 rounded-xl bg-muted/15 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activeAction === "attribution" ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source</p>
                    <Input value={formState.utm_source} onChange={(e) => updateField("utm_source", e.target.value)} placeholder="instagram" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Medium</p>
                    <Input value={formState.utm_medium} onChange={(e) => updateField("utm_medium", e.target.value)} placeholder="paid_social" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaign</p>
                    <Input value={formState.utm_campaign} onChange={(e) => updateField("utm_campaign", e.target.value)} placeholder="summer_launch" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                </div>
              ) : null}

              {activeAction === "purchase" ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order ID</p>
                    <Input value={formState.order_id} onChange={(e) => updateField("order_id", e.target.value)} placeholder="ORD-98721" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount</p>
                    <Input value={formState.purchase_value} onChange={(e) => updateField("purchase_value", e.target.value)} placeholder="2499" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Currency</p>
                    <Input value={formState.currency} onChange={(e) => updateField("currency", e.target.value)} placeholder="INR" className="h-9 rounded-xl bg-muted/15 text-xs" />
                  </div>
                </div>
              ) : null}

              {activeAction === "privacy" ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request Type</p>
                  <Select value={formState.request_type} onValueChange={(v) => updateField("request_type", v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELETE">Data Deletion (Right to Erasure)</SelectItem>
                      <SelectItem value="ACCESS">Data Access (Right to Access)</SelectItem>
                      <SelectItem value="CORRECTION">Correction (Right to Rectify)</SelectItem>
                      <SelectItem value="EXPORT">Data Export (Right to Portability)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {activeAction === "privacy_verify" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request ID</p>
                    <Input value={formState.request_id} disabled className="h-9 rounded-xl bg-muted/30 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verification Decision</p>
                    <Select value={formState.verification_status} onValueChange={(v) => updateField("verification_status", v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VERIFIED">Verified (Identity Confirmed)</SelectItem>
                        <SelectItem value="REJECTED">Rejected (Failed Verification)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {activeAction === "privacy_execute" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request ID</p>
                    <Input value={formState.request_id} disabled className="h-9 rounded-xl bg-muted/30 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action</p>
                    <Select value={formState.execution_action} onValueChange={(v) => updateField("execution_action", v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-muted/15 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DELETE">Execute Data Deletion</SelectItem>
                        <SelectItem value="EXPORT">Execute Data Export</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs sm:h-10" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" className="h-9 rounded-full px-4 text-xs sm:h-10" onClick={() => void submitEvent()} disabled={submitting}>
                {submitting ? "Processing..." : G3_ACTION_COPY[activeAction].submitLabel}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW EVENT DETAIL MODAL */}
      <Dialog
        open={Boolean(selectedOutcome)}
        onOpenChange={(open) => {
          if (!open) setSelectedOutcome(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[94vw] max-w-md overflow-y-auto rounded-2xl border-border/60 bg-white p-5 shadow-2xl sm:p-6">
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-serif text-xl tracking-tight text-primary sm:text-2xl">Event Details</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sanitized compliance event information.
              </DialogDescription>
            </DialogHeader>

            {selectedOutcome ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <DetailField
                    label="Event type"
                    value={<Badge variant="outline" className="text-[10px]">{getEventTypeLabel(selectedOutcome.eventType)}</Badge>}
                  />
                  <DetailField
                    label="Result"
                    value={<Badge className={cn("text-[10px]", G3_STATUS_TONES[selectedOutcome.result])}>{G3_STATUS_LABELS[selectedOutcome.result]}</Badge>}
                  />
                </div>
                <DetailField label="What happened" value={selectedOutcome.whatHappened} />
                <DetailField label="Action taken" value={selectedOutcome.actionNeeded} />
                <div className="grid grid-cols-2 gap-2.5">
                  <DetailField label="Contact (Masked)" value={selectedOutcome.details.contactIdentifierMasked || "Masked Contact"} />
                  <DetailField label="Channel" value={selectedOutcome.details.channel || "Website"} />
                  <DetailField label="Source" value={selectedOutcome.details.sourceEvent || "ADMIN"} />
                  <DetailField label="Timestamp" value={formatDateTime(selectedOutcome.handledAt)} />
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-9 w-full rounded-full text-xs sm:w-auto" onClick={() => setSelectedOutcome(null)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
