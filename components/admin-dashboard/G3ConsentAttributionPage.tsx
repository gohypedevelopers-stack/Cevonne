"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock3, History, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/components/admin-dashboard/n8n-automations-common";
import type { G3EventType, G3WorkflowDetail, G3WorkflowOutcome, G3WorkflowStatus } from "@/server/next/api/g3-consent-attribution-adapter";

type G3Action = "consent" | "opt_out" | "attribution" | "purchase" | "privacy";

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

type G3DetailResponse = G3WorkflowDetail;

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
  request_type: string;
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
  MANUAL_ONLY: "Manual review needed",
  NOT_RUN_YET: "Not run yet",
  ERROR: "System issue",
};

const G3_STATUS_TONES: Record<G3WorkflowStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-800",
  MANUAL_ONLY: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_RUN_YET: "border-slate-200 bg-slate-100 text-slate-700",
  ERROR: "border-slate-200 bg-slate-100 text-slate-700",
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
    description: "Log an explicit consent event through the admin backend.",
    submitLabel: "Record Consent",
    helper: "This should be used for active opt-ins only.",
  },
  opt_out: {
    title: "Record Opt-Out",
    description: "Log a stop request so marketing messages stay blocked.",
    submitLabel: "Record Opt-Out",
    helper: "Use this when the contact has opted out or sent STOP.",
  },
  attribution: {
    title: "Record Attribution Event",
    description: "Log a consented attribution event with masked identifiers.",
    submitLabel: "Record Attribution Event",
    helper: "Tracking consent must already exist before identifiable attribution.",
  },
  purchase: {
    title: "Record Purchase",
    description: "Log a purchase event and mark recovery suppression as needed.",
    submitLabel: "Record Purchase",
    helper: "Use the order ID and any safe contact identifier you have.",
  },
  privacy: {
    title: "Submit Privacy Request",
    description: "Log a privacy request for manual handling.",
    submitLabel: "Submit Privacy Request",
    helper: "Destructive handling stays blocked until the privacy review is approved.",
  },
};

const buildInitialFormState = (action: G3Action, contactIdentifier = ""): G3FormState => ({
  contact_identifier: contactIdentifier,
  channel: action === "privacy" || action === "purchase" ? "WEBSITE" : action === "attribution" ? "WEBSITE" : "WHATSAPP",
  consent_status: "YES",
  source: "ADMIN_TEST",
  consent_text: "User agreed to receive WhatsApp updates.",
  opt_out_reason: "user_unsubscribe",
  order_id: "",
  purchase_value: "0",
  currency: "INR",
  request_type: "DELETE",
  attribution_event: "ADMIN_TRACKING_EVENT",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  gclid: "",
  fbclid: "",
  meta_event_id: "",
});

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

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

const getEventTypeLabel = (value: G3EventType) => {
  switch (value) {
    case "CONSENT_RECORDED":
      return "Consent recorded";
    case "OPT_OUT_RECORDED":
      return "Opt-out recorded";
    case "ATTRIBUTION_RECORDED":
      return "Attribution recorded";
    case "PURCHASE_RECORDED":
      return "Purchase recorded";
    case "RECOVERY_SUPPRESSED":
      return "Recovery suppressed";
    case "PRIVACY_REQUEST_RECORDED":
      return "Privacy request recorded";
    case "BLOCKED_NO_CONSENT":
      return "Blocked for no consent";
    case "BLOCKED_STOP_OPT_OUT":
      return "Blocked by stop request";
    case "MANUAL_ONLY_PRIVACY_REVIEW":
      return "Manual privacy review";
    default:
      return value;
  }
};

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
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function G3ConsentAttributionPage() {
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<G3DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<G3Action>("consent");
  const [submitting, setSubmitting] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<G3WorkflowOutcome | null>(null);
  const [formState, setFormState] = useState<G3FormState>(() => buildInitialFormState("consent"));

  const loadDetail = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await authFetch(buildRouteUrl(ROUTE_DETAIL), { silent: true });
        const body = await parseJsonResponse<G3DetailResponse>(response);

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
    (action: G3Action) => {
      setActiveAction(action);
      setFormState((current) => ({
        ...buildInitialFormState(action, current.contact_identifier),
        source: current.source || "ADMIN_TEST",
        contact_identifier: current.contact_identifier,
      }));
      setDialogOpen(true);
    },
    [],
  );

  const updateField = useCallback(<K extends keyof G3FormState>(key: K, value: G3FormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  }, []);

  const submitEvent = useCallback(async () => {
    if (!dialogOpen) {
      return;
    }

    const payload =
      activeAction === "consent"
        ? {
            event_type: "CONSENT_RECORDED",
            contact_identifier: formState.contact_identifier.trim(),
            channel: formState.channel.trim() || "WHATSAPP",
            consent_status: formState.consent_status.trim() || "YES",
            source: formState.source.trim() || "ADMIN_TEST",
            consent_text: formState.consent_text.trim() || undefined,
            workflow_group: "G3",
            workflow_id: "G3",
          }
        : activeAction === "opt_out"
          ? {
              event_type: "OPT_OUT_RECORDED",
              contact_identifier: formState.contact_identifier.trim(),
              channel: formState.channel.trim() || "WHATSAPP",
              opt_out_reason: formState.opt_out_reason.trim() || "user_unsubscribe",
              source: formState.source.trim() || "ADMIN_TEST",
              workflow_group: "G3",
              workflow_id: "G3",
            }
          : activeAction === "attribution"
            ? {
                event_type: "ATTRIBUTION_RECORDED",
                contact_identifier: formState.contact_identifier.trim(),
                channel: formState.channel.trim() || "WEBSITE",
                consent_status: formState.consent_status.trim() || "YES",
                source: formState.source.trim() || "ADMIN_TEST",
                attribution_event: formState.attribution_event.trim() || undefined,
                utm_source: formState.utm_source.trim() || undefined,
                utm_medium: formState.utm_medium.trim() || undefined,
                utm_campaign: formState.utm_campaign.trim() || undefined,
                gclid: formState.gclid.trim() || undefined,
                fbclid: formState.fbclid.trim() || undefined,
                meta_event_id: formState.meta_event_id.trim() || undefined,
                workflow_group: "G3",
                workflow_id: "G3",
              }
            : activeAction === "purchase"
              ? {
                  event_type: "PURCHASE_RECORDED",
                  contact_identifier: formState.contact_identifier.trim(),
                  order_id: formState.order_id.trim(),
                  purchase_value: formState.purchase_value.trim() ? Number(formState.purchase_value) : undefined,
                  currency: formState.currency.trim() || "INR",
                  source: formState.source.trim() || "ADMIN_TEST",
                  workflow_group: "G3",
                  workflow_id: "G3",
                }
              : {
                  event_type: "PRIVACY_REQUEST_RECORDED",
                  contact_identifier: formState.contact_identifier.trim(),
                  request_type: formState.request_type.trim() || "DELETE",
                  source: formState.source.trim() || "ADMIN_TEST",
                  workflow_group: "G3",
                  workflow_id: "G3",
                };

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
        throw new Error(body?.message ?? `Unable to record ${G3_ACTION_COPY[activeAction].title.toLowerCase()}.`);
      }

      if (body.status === "PASS") {
        toast.success(body.message);
      } else if (body.status === "MANUAL_ONLY") {
        toast.info(body.message);
      } else if (body.status === "BLOCK") {
        toast.warning(body.message);
      } else {
        toast.error(body.message);
      }

      setDialogOpen(false);
      setSelectedOutcome(null);
      await loadDetail("refresh");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to record the event.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [activeAction, authFetch, dialogOpen, formState, loadDetail]);

  const recentOutcomes = detail?.recentOutcomes ?? [];
  const eventCount = recentOutcomes.length;
  const passCount = recentOutcomes.filter((outcome) => outcome.result === "PASS").length;
  const blockedCount = recentOutcomes.filter((outcome) => outcome.result === "BLOCK").length;
  const manualCount = recentOutcomes.filter((outcome) => outcome.result === "MANUAL_ONLY").length;

  const latestOutcomeBadge = detail ? (
    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", G3_STATUS_TONES[detail.status])}>
      {G3_STATUS_LABELS[detail.status]}
    </Badge>
  ) : (
    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
      Loading
    </Badge>
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
        variant="outline"
        className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm"
        onClick={() => {
          void loadDetail("refresh");
        }}
        disabled={loading || refreshing}
      >
        <RefreshCw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
        {refreshing ? "Refreshing..." : "Refresh events"}
      </Button>
    </>
  );

  const renderActionFields = () => {
    if (activeAction === "consent") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Contact identifier</p>
              <Input
                value={formState.contact_identifier}
                onChange={(event) => updateField("contact_identifier", event.target.value)}
                placeholder="user@example.com, +91 98765 43210, or customer ID"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Channel</p>
              <Select value={formState.channel} onValueChange={(value) => updateField("channel", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Consent status</p>
              <Select value={formState.consent_status} onValueChange={(value) => updateField("consent_status", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  <SelectItem value="REVIEW">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Source</p>
              <Input
                value={formState.source}
                onChange={(event) => updateField("source", event.target.value)}
                placeholder="ADMIN_TEST"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Consent text</p>
            <Textarea
              value={formState.consent_text}
              onChange={(event) => updateField("consent_text", event.target.value)}
              rows={4}
              placeholder="User agreed to receive WhatsApp updates."
              className="min-h-[120px] rounded-2xl border-border/60 bg-muted/15"
            />
          </div>
        </div>
      );
    }

    if (activeAction === "opt_out") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Contact identifier</p>
              <Input
                value={formState.contact_identifier}
                onChange={(event) => updateField("contact_identifier", event.target.value)}
                placeholder="user@example.com, +91 98765 43210, or customer ID"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Channel</p>
              <Select value={formState.channel} onValueChange={(value) => updateField("channel", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Opt-out reason</p>
            <Textarea
              value={formState.opt_out_reason}
              onChange={(event) => updateField("opt_out_reason", event.target.value)}
              rows={3}
              placeholder="user_unsubscribe"
              className="min-h-[100px] rounded-2xl border-border/60 bg-muted/15"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Source</p>
            <Input
              value={formState.source}
              onChange={(event) => updateField("source", event.target.value)}
              placeholder="ADMIN_TEST"
              className="h-11 rounded-2xl border-border/60 bg-muted/15"
            />
          </div>
        </div>
      );
    }

    if (activeAction === "attribution") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Contact identifier</p>
              <Input
                value={formState.contact_identifier}
                onChange={(event) => updateField("contact_identifier", event.target.value)}
                placeholder="user@example.com, +91 98765 43210, or customer ID"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Channel</p>
              <Select value={formState.channel} onValueChange={(value) => updateField("channel", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Consent status</p>
              <Select value={formState.consent_status} onValueChange={(value) => updateField("consent_status", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  <SelectItem value="REVIEW">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Source</p>
              <Input
                value={formState.source}
                onChange={(event) => updateField("source", event.target.value)}
                placeholder="ADMIN_TEST"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Attribution event</p>
            <Input
              value={formState.attribution_event}
              onChange={(event) => updateField("attribution_event", event.target.value)}
              placeholder="ADMIN_TRACKING_EVENT"
              className="h-11 rounded-2xl border-border/60 bg-muted/15"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">UTM source</p>
              <Input value={formState.utm_source} onChange={(event) => updateField("utm_source", event.target.value)} placeholder="instagram" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">UTM medium</p>
              <Input value={formState.utm_medium} onChange={(event) => updateField("utm_medium", event.target.value)} placeholder="paid_social" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">UTM campaign</p>
              <Input value={formState.utm_campaign} onChange={(event) => updateField("utm_campaign", event.target.value)} placeholder="campaign-name" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Meta event ID</p>
              <Input value={formState.meta_event_id} onChange={(event) => updateField("meta_event_id", event.target.value)} placeholder="dedupe-event-id" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">gclid</p>
              <Input value={formState.gclid} onChange={(event) => updateField("gclid", event.target.value)} placeholder="gclid" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">fbclid</p>
              <Input value={formState.fbclid} onChange={(event) => updateField("fbclid", event.target.value)} placeholder="fbclid" className="h-11 rounded-2xl border-border/60 bg-muted/15" />
            </div>
          </div>
        </div>
      );
    }

    if (activeAction === "purchase") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Contact identifier</p>
              <Input
                value={formState.contact_identifier}
                onChange={(event) => updateField("contact_identifier", event.target.value)}
                placeholder="user@example.com, +91 98765 43210, or customer ID"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Order ID</p>
              <Input
                value={formState.order_id}
                onChange={(event) => updateField("order_id", event.target.value)}
                placeholder="shopify_order_123"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Purchase value</p>
              <Input
                value={formState.purchase_value}
                onChange={(event) => updateField("purchase_value", event.target.value)}
                placeholder="2499"
                inputMode="decimal"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Currency</p>
              <Input
                value={formState.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                placeholder="INR"
                className="h-11 rounded-2xl border-border/60 bg-muted/15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Source</p>
            <Input
              value={formState.source}
              onChange={(event) => updateField("source", event.target.value)}
              placeholder="ADMIN_TEST"
              className="h-11 rounded-2xl border-border/60 bg-muted/15"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Contact identifier</p>
            <Input
              value={formState.contact_identifier}
              onChange={(event) => updateField("contact_identifier", event.target.value)}
              placeholder="user@example.com, +91 98765 43210, or customer ID"
              className="h-11 rounded-2xl border-border/60 bg-muted/15"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Request type</p>
            <Select value={formState.request_type} onValueChange={(value) => updateField("request_type", value)}>
              <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                <SelectValue placeholder="Select request type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCESS">Access</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="CORRECTION">Correction</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Source</p>
          <Input
            value={formState.source}
            onChange={(event) => updateField("source", event.target.value)}
            placeholder="ADMIN_TEST"
            className="h-11 rounded-2xl border-border/60 bg-muted/15"
          />
        </div>
      </div>
    );
  };

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title={detail?.title ?? "G3 - CRM + Consent + Attribution"}
      description={
        "Real G3 records from Supabase. Consent, opt-outs, attribution, purchases, recovery suppression, and privacy activity are masked before they reach the client."
      }
      badges={
        <>
          {latestOutcomeBadge}
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <Clock3 data-icon="inline-start" className="size-3.5" />
            {detail ? formatDateTime(detail.lastRunAt) : "Loading events"}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <History data-icon="inline-start" className="size-3.5" />
            {eventCount} recent events
          </Badge>
        </>
      }
      actions={headerActions}
    >
      {error ? (
        <Card role="alert" className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">G3 event source warning</p>
              <p className="mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !detail ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-[28px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[420px] w-full rounded-[28px]" />
        </div>
      ) : detail ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Card className={cn("overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm", G3_STATUS_TONES[detail.status])}>
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest G3 event</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      The most recent consent, opt-out, attribution, purchase, recovery, or privacy signal.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", G3_STATUS_TONES[detail.status])}>
                      {G3_STATUS_LABELS[detail.status]}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      Handled {formatRelativeTime(detail.lastRunAt)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.latestOutcome ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField
                        label="What happened"
                        value={detail.latestOutcome.whatHappened}
                        helper={detail.latestOutcome.summary}
                      />
                      <DetailField
                        label="Action needed"
                        value={detail.latestOutcome.actionNeeded}
                        helper="No raw payloads or webhook details are shown here."
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <DetailField
                        label="Event type"
                        value={<Badge className="rounded-full border border-border/60 bg-muted/40 text-foreground">{getEventTypeLabel(detail.latestOutcome.eventType)}</Badge>}
                      />
                      <DetailField
                        label="Status"
                        value={<Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", G3_STATUS_TONES[detail.latestOutcome.result])}>{G3_STATUS_LABELS[detail.latestOutcome.result]}</Badge>}
                      />
                      <DetailField label="Source" value={detail.latestOutcome.sourceLabel} />
                      <DetailField label="Time" value={formatDateTime(detail.latestOutcome.time)} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
                        <a href="#recent-g3-events">
                          <ArrowRight data-icon="inline-start" />
                          View recent events
                        </a>
                      </Button>
                      <Button type="button" className="h-10 rounded-full px-5" onClick={() => openAction("consent")}>
                        <Sparkles data-icon="inline-start" />
                        Record Consent
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    <p className="font-medium text-foreground">{detail.emptyStateCopy}</p>
                    <p className="mt-2">{detail.mainActionNeeded}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Recent events" value={String(eventCount)} helper="Rows loaded from the real G3 event source." />
              <StatCard label="Recorded safely" value={String(passCount)} helper="Pass events from the current recent set." />
              <StatCard label="Blocked safely" value={String(blockedCount)} helper="Blocked rows in the recent event set." />
              <StatCard label="Manual review" value={String(manualCount)} helper="Privacy or review-needed items." />
            </div>

            <Card id="recent-g3-events" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent G3 events</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      The latest 5 to 10 events, with PII masked and raw payloads hidden.
                    </CardDescription>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => void loadDetail("refresh")} disabled={refreshing}>
                    <RefreshCw className={cn("mr-2 size-4", refreshing ? "animate-spin" : undefined)} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[920px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>What happened</TableHead>
                        <TableHead>Action needed</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOutcomes.length ? (
                        recentOutcomes.map((outcome, index) => (
                          <TableRow key={`${outcome.time ?? "g3-event"}-${outcome.eventType}-${index}`}>
                            <TableCell className="align-top whitespace-nowrap font-medium text-foreground">
                              <div className="space-y-1">
                                <p>{formatDateTime(outcome.time)}</p>
                                <p className="text-xs text-muted-foreground">{formatRelativeTime(outcome.time)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-2">
                                <Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", G3_STATUS_TONES[outcome.result])}>
                                  {G3_STATUS_LABELS[outcome.result]}
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                                  {getEventTypeLabel(outcome.eventType)}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">{outcome.whatHappened}</TableCell>
                            <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">{outcome.actionNeeded}</TableCell>
                            <TableCell className="align-top">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none"
                                onClick={() => setSelectedOutcome(outcome)}
                              >
                                View
                                <ArrowRight data-icon="inline-end" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            No G3 events found yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">What this workflow is doing</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The G3 ledger keeps customer consent and attribution events in a safe, client-facing shape.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-sm leading-6 text-foreground text-pretty">{detail.purpose}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Action needed</p>
                  <p className="mt-2 text-sm leading-6 text-foreground text-pretty">{detail.mainActionNeeded}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safe shortcuts</p>
                  <div className="mt-3 space-y-2">
                    <Button className="w-full rounded-full" onClick={() => openAction("consent")}>
                      Record Consent
                    </Button>
                    <Button variant="outline" className="w-full rounded-full" onClick={() => openAction("opt_out")}>
                      Record Opt-Out
                    </Button>
                    <Button variant="outline" className="w-full rounded-full" onClick={() => openAction("attribution")}>
                      Record Attribution Event
                    </Button>
                    <Button variant="outline" className="w-full rounded-full" onClick={() => openAction("purchase")}>
                      Record Purchase
                    </Button>
                    <Button variant="outline" className="w-full rounded-full" onClick={() => openAction("privacy")}>
                      Submit Privacy Request
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">PII policy</p>
                  <p className="mt-2 text-sm leading-6 text-foreground text-pretty">
                    Emails, phone numbers, customer IDs, and request details are masked before they reach the UI.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Event mix</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  Recent signal counts from the current sample set.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <span className="text-sm font-medium text-foreground">Consent events</span>
                  <span className="text-sm font-semibold text-primary">{detail.counts.consentEvents}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <span className="text-sm font-medium text-foreground">Opt-outs</span>
                  <span className="text-sm font-semibold text-primary">{detail.counts.optOutEvents}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <span className="text-sm font-medium text-foreground">Attribution</span>
                  <span className="text-sm font-semibold text-primary">{detail.counts.attributionEvents}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <span className="text-sm font-medium text-foreground">Purchase + recovery</span>
                  <span className="text-sm font-semibold text-primary">{detail.counts.purchaseEvents + detail.counts.recoveryEvents}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <span className="text-sm font-medium text-foreground">Privacy review</span>
                  <span className="text-sm font-semibold text-primary">{detail.counts.privacyEvents}</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSubmitting(false);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,46rem)] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">{G3_ACTION_COPY[activeAction].title}</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">{G3_ACTION_COPY[activeAction].description}</DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
              <p className="text-sm leading-6 text-foreground">{G3_ACTION_COPY[activeAction].helper}</p>
            </div>

            <div className="space-y-4">
              {renderActionFields()}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" className="h-11 rounded-full px-4" onClick={() => void submitEvent()} disabled={submitting}>
                {submitting ? "Recording..." : G3_ACTION_COPY[activeAction].submitLabel}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedOutcome)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOutcome(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,42rem)] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Event details</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Safe client-facing details for the selected G3 event.
              </DialogDescription>
            </DialogHeader>

            {selectedOutcome ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField
                    label="Event type"
                    value={<Badge className="rounded-full border border-border/60 bg-muted/40 text-foreground">{getEventTypeLabel(selectedOutcome.eventType)}</Badge>}
                  />
                  <DetailField
                    label="Status"
                    value={<Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", G3_STATUS_TONES[selectedOutcome.result])}>{G3_STATUS_LABELS[selectedOutcome.result]}</Badge>}
                  />
                  <DetailField label="What happened" value={selectedOutcome.whatHappened} />
                  <DetailField label="Action needed" value={selectedOutcome.actionNeeded} />
                  <DetailField label="Source" value={selectedOutcome.sourceLabel} />
                  <DetailField label="Handled" value={formatDateTime(selectedOutcome.handledAt)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField
                    label="Contact"
                    value={selectedOutcome.details.contactIdentifierMasked || "Not available"}
                    helper="Masked before it reached the UI."
                  />
                  <DetailField label="Channel" value={selectedOutcome.details.channel || "Not available"} />
                  <DetailField label="Source event" value={selectedOutcome.details.sourceEvent || "Not available"} />
                  <DetailField label="Source platform" value={selectedOutcome.details.sourcePlatform || "Not available"} />
                  {selectedOutcome.details.requestType ? <DetailField label="Request type" value={selectedOutcome.details.requestType} /> : null}
                  {selectedOutcome.details.consentStatus ? <DetailField label="Consent status" value={selectedOutcome.details.consentStatus} /> : null}
                  {selectedOutcome.details.orderIdMasked ? <DetailField label="Order ID" value={selectedOutcome.details.orderIdMasked} /> : null}
                  {selectedOutcome.details.purchaseValue ? <DetailField label="Purchase value" value={selectedOutcome.details.purchaseValue} /> : null}
                  {selectedOutcome.details.attributionEvent ? <DetailField label="Attribution event" value={selectedOutcome.details.attributionEvent} /> : null}
                  {selectedOutcome.details.verificationStatus ? <DetailField label="Verification status" value={selectedOutcome.details.verificationStatus} /> : null}
                  {selectedOutcome.details.executionStatus ? <DetailField label="Execution status" value={selectedOutcome.details.executionStatus} /> : null}
                  {selectedOutcome.details.suppressionReason ? <DetailField label="Suppression reason" value={selectedOutcome.details.suppressionReason} /> : null}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                No details available.
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4" onClick={() => setSelectedOutcome(null)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
