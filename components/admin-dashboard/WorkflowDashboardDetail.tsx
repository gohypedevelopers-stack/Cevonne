"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Clock3, Play, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import WorkflowRunDialog from "@/components/admin-dashboard/WorkflowRunDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  formatWorkflowDateTime,
  formatWorkflowRelativeTime,
  getWorkflowOutcomeSectionTitles,
  getWorkflowPrimaryActionConfig,
  getWorkflowStatusDetailCopy,
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
  type AdminWorkflowId,
  type WorkflowDetailView,
  type WorkflowOutcomeSummary,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";

type WorkflowDashboardDetailResponse = {
  status: WorkflowUiStatus | "EMPTY";
  message: string;
  workflowGroup?: AdminWorkflowId;
  workflow: WorkflowDetailView;
  latestOutcome?: WorkflowOutcomeSummary | null;
  recentOutcomes?: WorkflowOutcomeSummary[];
};

type WorkflowDashboardRunResponse = {
  status: WorkflowUiStatus;
  message: string;
  response_type: string | null;
  recommended_decision?: string | null;
  recommendation_only?: boolean | null;
  not_executed?: boolean | null;
  fail_reason?: string | null;
  failure_reasons?: string[] | null;
  handled_at: string;
  outcome: WorkflowOutcomeSummary;
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

type G2AccountHealthUpdateResponse = {
  status: string;
  message: string;
  response_type?: string | null;
  handled_at?: string | null;
};

type G2StatusSummaryResponse = {
  status?: string;
  message?: string;
  response_type?: string | null;
  handled_at?: string | null;
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

const formatTimeLabel = (value?: string | null) => {
  if (!value) {
    return "Not run yet";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

const formatRowTimeLabel = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }

  return `${formatWorkflowDateTime(value)} · ${formatWorkflowRelativeTime(value)}`;
};

const isG2StatusUnsafe = (status: WorkflowUiStatus) => status !== "PASS";

const deriveG2HealthStatus = (workflow: WorkflowDetailView) => {
  const source = workflow.latestOutcome?.result ?? workflow.status;

  switch (source) {
    case "PASS":
      return "CLEAN";
    case "BLOCK":
      return "RESTRICTED";
    case "MANUAL_ONLY":
      return "WARNING";
    default:
      return "UNKNOWN";
  }
};

const getLatestOutcomeSummary = (workflowId: AdminWorkflowId, outcome: WorkflowOutcomeSummary | null) => {
  if (!outcome) {
    return "No workflow outcome has been recorded yet.";
  }

  switch (outcome.result) {
    case "PASS":
      return outcome.whatHappened || "Good. The latest check completed safely.";
    case "BLOCK":
      return `Blocked safely because ${outcome.whyItBlocked ?? outcome.actionNeeded}.`;
    case "MANUAL_ONLY":
      return outcome.whatHappened || "Human review is needed before the next safe step.";
    case "PENDING_APPROVAL":
      return outcome.whatHappened || "Waiting for approval before it can continue.";
    case "DRY_RUN":
      return outcome.whatHappened || "Test only. Nothing live happened.";
    case "RECOMMENDATION_ONLY":
      return outcome.whatHappened || "Recommendation created. Nothing was executed.";
    case "DO_NOT_SCALE":
      return outcome.whatHappened || "Do not scale this yet.";
    case "FIX_FIRST":
      return outcome.whatHappened || "Fix the issue before continuing.";
    case "NEEDS_EVIDENCE":
      return outcome.whatHappened || "More proof is needed before this can continue.";
    case "ERROR":
    default:
      return workflowId === "G2" ? "Account health needs review." : "System review is needed.";
  }
};

const getSavedOutputBlock = (workflowId: AdminWorkflowId, outcome: WorkflowOutcomeSummary | null) => {
  if (!outcome) {
    return null;
  }

  switch (workflowId) {
    case "G11":
      return null;
    case "G3":
      return {
        label: "Consent / privacy summary",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G6":
      return {
        label: "Messaging result",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G7":
      return {
        label: "Offer proof",
        value: outcome.whatHappened,
        helper: outcome.actionNeeded,
      };
    case "G8":
      return {
        label: "Rights scope",
        value: outcome.whatHappened,
        helper: outcome.whatWasChecked,
      };
    case "G9":
    case "G10":
    case "G11":
      return {
        label: "Recommendation",
        value: outcome.whatHappened,
        helper: outcome.actionNeeded,
      };
    default:
      return null;
  }
};

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

const G11_RECOMMENDATION_TONES: Record<string, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SCALE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAUSE: "border-amber-200 bg-amber-50 text-amber-800",
  FIX_FIRST: "border-rose-200 bg-rose-50 text-rose-700",
  TEST: "border-sky-200 bg-sky-50 text-sky-700",
  INVESTIGATE: "border-slate-200 bg-slate-100 text-slate-700",
  NO_ACTION: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DO_NOT_SCALE: "border-orange-200 bg-orange-50 text-orange-700",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-700",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
  NEEDS_APPROVAL: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-800",
  RECOMMENDATION_ONLY: "border-slate-200 bg-slate-100 text-slate-700",
};

const G11_RISK_TONES: Record<string, string> = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  HIGH: "border-rose-200 bg-rose-50 text-rose-700",
};

const G11_SAFETY_TONES: Record<string, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLEAN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  KNOWN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  VALID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_REQUIRED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_EXECUTED: "border-slate-200 bg-slate-100 text-slate-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  UNKNOWN: "border-slate-200 bg-slate-100 text-slate-700",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-700",
};

const G11_WORKFLOW_FRIENDLY_NAMES: Record<string, string> = {
  G1: "Compliance Guard",
  G2: "Account Health",
  G3: "Consent + Attribution",
  G4: "Content Review",
  G5: "Publishing",
  G6: "Messaging + Recovery",
  G7: "Offer Safety",
  G8: "UGC + Creator Proof",
  G9: "Ads + Retargeting",
  G10: "SEO + CRO",
  G11: "Decision Engine",
  G12: "Public Trend Fetcher",
  ALL: "All workflows",
};

const G11_PLATFORM_FRIENDLY_NAMES: Record<string, string> = {
  META: "Meta Ads",
  GOOGLE: "Google",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  ALL: "All platforms",
};

const normalizeG11Label = (value?: string | null) => (typeof value === "string" ? value.trim() : "");
const normalizeG11Text = (value?: string | null) => (typeof value === "string" ? value.trim() : "");
const normalizeG11EnumValue = (value?: string | null) => normalizeG11Text(value).toUpperCase().replace(/[\s-]+/g, "_");

const getG11FriendlyWorkflowName = (value?: string | null) => {
  const normalized = normalizeG11EnumValue(value);
  if (normalized && G11_WORKFLOW_FRIENDLY_NAMES[normalized]) {
    return G11_WORKFLOW_FRIENDLY_NAMES[normalized];
  }

  const sanitized = normalizeG11Text(value);
  return sanitized || null;
};

const getG11FriendlyPlatformName = (value?: string | null) => {
  const normalized = normalizeG11EnumValue(value);
  if (normalized && G11_PLATFORM_FRIENDLY_NAMES[normalized]) {
    return G11_PLATFORM_FRIENDLY_NAMES[normalized];
  }

  const sanitized = normalizeG11Text(value);
  return sanitized || null;
};

const getG11TargetWorkflowId = (value?: string | null): AdminWorkflowId | null => {
  const normalized = normalizeG11Label(value).toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized in G11_WORKFLOW_FRIENDLY_NAMES) {
    return normalized as AdminWorkflowId;
  }

  const matchedEntry = Object.entries(G11_WORKFLOW_FRIENDLY_NAMES).find(([workflowId, label]) => workflowId === normalized || label.toUpperCase() === normalized);
  return (matchedEntry?.[0] as AdminWorkflowId | undefined) ?? null;
};

const getG11NextStepCopy = (decision?: string | null, targetWorkflow?: string | null) => {
  const normalizedDecision = normalizeG11EnumValue(decision);

  switch (normalizedDecision) {
    case "SCALE":
      return getG11TargetWorkflowId(targetWorkflow) === "G9" ? "Send to G9 approval" : "Review and approve before taking action";
    case "FIX_FIRST":
      return "Fix the issue first";
    case "DO_NOT_SCALE":
      return "Do not scale";
    case "TEST":
      return "Review test recommendation";
    case "PAUSE":
      return "Send to approval before pausing";
    case "INVESTIGATE":
      return "Review the data before deciding";
    case "NO_ACTION":
      return "No action needed";
    default:
      return null;
  }
};

const getG11RiskNoteCopy = (riskLevel?: string | null, riskNote?: string | null) => {
  if (normalizeG11EnumValue(riskLevel) === "HIGH") {
    return "This needs human review before any action.";
  }

  return riskNote ?? null;
};

const getG11OutcomeNextStepCopy = (outcome: WorkflowOutcomeSummary) =>
  getG11NextStepCopy(getG11RecommendationValue(outcome), outcome.details?.targetWorkflow ?? outcome.details?.target) ??
  outcome.details?.nextStep ??
  outcome.actionNeeded;

const getG11DisplayStatus = (value?: string | null) => {
  const normalized = normalizeG11EnumValue(value);
  if (!normalized) {
    return "UNKNOWN";
  }

  if (normalized === "NOT_EXECUTED") {
    return "Not executed by G11";
  }

  if (normalized === "NOT_REQUIRED") {
    return "Not required";
  }

  return normalized.replace(/_/g, " ");
};

const getG11RecommendationTone = (recommendation?: string | null) => {
  const normalized = normalizeG11EnumValue(recommendation);
  return G11_RECOMMENDATION_TONES[normalized] ?? "border-slate-200 bg-slate-100 text-slate-700";
};

const getG11RiskTone = (riskLevel?: string | null) => {
  const normalized = normalizeG11EnumValue(riskLevel);
  return G11_RISK_TONES[normalized] ?? "border-slate-200 bg-slate-100 text-slate-700";
};

const getG11SafetyTone = (value?: string | null) => {
  const normalized = normalizeG11EnumValue(value);
  return G11_SAFETY_TONES[normalized] ?? "border-slate-200 bg-slate-100 text-slate-700";
};

const getG11RecommendationValue = (outcome: WorkflowOutcomeSummary) =>
  outcome.details?.recommendation ?? outcome.details?.recommendationLabel ?? getWorkflowStatusLabel(outcome.result);

const getG11SafetySummary = (outcome: WorkflowOutcomeSummary) => {
  const details = outcome.details;

  if (!details) {
    return {
      label: "UNKNOWN",
      tone: getG11SafetyTone("UNKNOWN"),
      description: "No safety status was stored for this recommendation.",
    };
  }

  const complianceStatus = normalizeG11EnumValue(details.complianceStatus);
  const accountHealthStatus = normalizeG11EnumValue(details.accountHealthStatus);
  const consentStatus = normalizeG11EnumValue(details.consentStatus);
  const rightsStatus = normalizeG11EnumValue(details.rightsStatus);
  const offerStatus = normalizeG11EnumValue(details.offerStatus);
  const executionStatus = normalizeG11EnumValue(details.executionStatus ?? (details.notExecuted ? "NOT_EXECUTED" : null));

  if (complianceStatus === "BLOCK" || rightsStatus === "BLOCK" || offerStatus === "BLOCK" || outcome.result === "BLOCK") {
    return {
      label: "BLOCK",
      tone: getG11SafetyTone("BLOCK"),
      description: "One or more safety checks blocked this recommendation.",
    };
  }

  if (accountHealthStatus === "WARNING") {
    return {
      label: "REVIEW",
      tone: getG11SafetyTone("REVIEW"),
      description: "Account health needs review before any action.",
    };
  }

  const safetyStatuses = [
    complianceStatus,
    accountHealthStatus,
    consentStatus,
    rightsStatus,
    offerStatus,
    executionStatus,
  ];

  const hasUnknown = safetyStatuses.some((status) => !status || status === "UNKNOWN");
  if (hasUnknown) {
    return {
      label: "REVIEW",
      tone: getG11SafetyTone("REVIEW"),
      description: "One or more safety signals still needs review.",
    };
  }

  return {
    label: "PASS",
    tone: getG11SafetyTone("PASS"),
    description: "Safety signals are clean.",
  };
};

const getG11BulletList = (items: string[] | null | undefined, fallback: string) => {
  const values = (items ?? []).map((item) => normalizeG11Text(item)).filter(Boolean);

  if (values.length === 0) {
    return fallback;
  }

  return (
    <ul className="space-y-2">
      {values.slice(0, 5).map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
          <span>{item}</span>
        </li>
      ))}
      </ul>
  );
};

const normalizeG11ResponseType = (value?: string | null) => (typeof value === "string" ? value.trim().toUpperCase() : "");

const getG11RecommendedDecision = (response: WorkflowDashboardRunResponse) => {
  if (typeof response.recommended_decision !== "string") {
    return null;
  }

  const decision = response.recommended_decision.trim();
  return decision || null;
};

const isG11RecommendationSuccess = (response: WorkflowDashboardRunResponse) => {
  const responseType = normalizeG11ResponseType(response.response_type);
  const decision = getG11RecommendedDecision(response);

  return (
    response.status === "PASS" ||
    response.status === "RECOMMENDATION_ONLY" ||
    response.status === "DO_NOT_SCALE" ||
    response.status === "FIX_FIRST" ||
    response.status === "DRY_RUN" ||
    responseType === "G11_DECISION_RECOMMENDATION_CREATED" ||
    (response.recommendation_only === true && response.not_executed === true && Boolean(decision)) ||
    (Boolean(decision) && response.status !== "ERROR" && response.status !== "BLOCK")
  );
};

const isG11RecommendationBlocked = (response: WorkflowDashboardRunResponse) => {
  const responseType = normalizeG11ResponseType(response.response_type);
  return response.status === "BLOCK" || response.outcome?.result === "BLOCK" || responseType.includes("BLOCK");
};

function LoadingSkeleton() {
  return (
    <>
      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6 md:p-8">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-9 w-3/4 rounded-2xl" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`detail-skeleton-${index}`} className="h-24 rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-32 rounded-2xl" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4 md:p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`table-skeleton-${index}`} className="h-14 rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export default function WorkflowDashboardDetail({ workflowId }: { workflowId: AdminWorkflowId }) {
  const { authFetch } = useAuth();
  const request = useCallback(
    (url: string, options?: RequestOptions) => (authFetch ? authFetch(url, options) : defaultRequest(url, options)),
    [authFetch],
  );

  const [snapshot, setSnapshot] = useState<WorkflowDashboardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [outcomeDetailsOpen, setOutcomeDetailsOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<WorkflowOutcomeSummary | null>(null);
  const [g2UpdateOpen, setG2UpdateOpen] = useState(false);
  const [g2HealthStatus, setG2HealthStatus] = useState("UNKNOWN");
  const [g2Notes, setG2Notes] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [runDialogSession, setRunDialogSession] = useState(0);
  const hasLoadedRef = useRef(false);
  const g11ToastIdRef = useRef<string | number | null>(null);
  const g11RefreshPendingRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = Boolean(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await request(buildRouteUrl(`/api/admin/workflow-dashboard/${workflowId}`), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<WorkflowDashboardDetailResponse>(response);
        if (!active) {
          return;
        }

        if (response.ok && body?.workflow) {
          const workflowRecentOutcomes = Array.isArray(body.workflow.recentOutcomes) ? body.workflow.recentOutcomes : [];
          const topLevelRecentOutcomes = Array.isArray(body.recentOutcomes) ? body.recentOutcomes : [];
          g11RefreshPendingRef.current = false;
          setSnapshot({
            status: body.status ?? "EMPTY",
            message: body.message ?? "Workflow detail loaded.",
            workflowGroup: body.workflowGroup ?? workflowId,
            workflow: body.workflow,
            latestOutcome: body.workflow.latestOutcome ?? body.latestOutcome ?? null,
            recentOutcomes: workflowRecentOutcomes.length > 0 ? workflowRecentOutcomes : topLevelRecentOutcomes,
          });
          return;
        }

        setError(body?.message ?? `Unable to load workflow detail (${response.status}).`);
      } catch (loadError) {
        if (!active) {
          return;
        }

        if (workflowId === "G11" && g11RefreshPendingRef.current) {
          g11RefreshPendingRef.current = false;
          setError(null);
          toast.warning("Recommendation was created, but the page could not refresh. Please reload.");
        } else {
          setError(loadError instanceof Error ? loadError.message : "Unable to load workflow detail.");
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [authFetch, refreshNonce, request, workflowId]);

  const workflow = snapshot?.workflow ?? null;
  const latestOutcome = snapshot?.latestOutcome ?? workflow?.latestOutcome ?? null;
  const recentOutcomes = snapshot?.recentOutcomes ?? workflow?.recentOutcomes ?? [];
  const displayedRecentOutcomes = recentOutcomes.length > 0 ? recentOutcomes : latestOutcome ? [latestOutcome] : [];
  const safeOutcomeTime = latestOutcome?.time ?? workflow?.lastRunAt ?? null;
  const workflowStatus = workflow?.status ?? snapshot?.status ?? "ERROR";
  const outcomeTitles = workflow ? getWorkflowOutcomeSectionTitles(workflow.workflowId) : { latest: "Latest Outcome", recent: "Recent Outcomes" };
  const primaryAction = workflow ? getWorkflowPrimaryActionConfig(workflow.workflowId, workflow.runLabel, workflow.runEnabled) : null;
  const g2NeedsUpdate = Boolean(workflow && workflow.workflowId === "G2" && isG2StatusUnsafe(workflow.status));
  const g2PrimaryCopy = g2NeedsUpdate ? "Update Account Status" : "View Account Health";
  const isG11Workflow = workflow?.workflowId === "G11";
  const g11Details = isG11Workflow ? latestOutcome?.details ?? null : null;
  const g11RecommendationValue = isG11Workflow && latestOutcome ? getG11RecommendationValue(latestOutcome) : null;
  const g11SafetySummary = isG11Workflow && latestOutcome ? getG11SafetySummary(latestOutcome) : null;
  const g11TargetWorkflow = isG11Workflow ? getG11FriendlyWorkflowName(g11Details?.targetWorkflow ?? g11Details?.target) : null;
  const g11TargetPlatform = isG11Workflow ? getG11FriendlyPlatformName(g11Details?.targetPlatform) : null;
  const g11ExecutionDisplay = isG11Workflow ? getG11DisplayStatus(g11Details?.executionStatus ?? (g11Details?.notExecuted ? "NOT_EXECUTED" : null)) : null;
  const g11NextStep = isG11Workflow && latestOutcome ? getG11OutcomeNextStepCopy(latestOutcome) : null;
  const g11RiskNote = isG11Workflow && latestOutcome ? getG11RiskNoteCopy(g11Details?.riskLevel, g11Details?.riskNote) : null;
  const savedOutput = workflow ? getSavedOutputBlock(workflow.workflowId, latestOutcome) : null;
  const hideActionPanels = isG11Workflow;

  const refreshDetail = useCallback(async () => {
    if (workflow?.workflowId === "G2") {
      setRefreshing(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/g2-status-summary"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          silent: true,
        });

        const body = (await parseJsonResponse<G2StatusSummaryResponse>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message ?? `Unable to refresh G2 status (${response.status}).`);
        }

        if (body?.message) {
          toast.success(body.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to refresh G2 status.";
        setRefreshing(false);
        setError(message);
        toast.error(message);
        return;
      }

      setRefreshNonce((value) => value + 1);
      return;
    }

    setRefreshing(true);
    setRefreshNonce((value) => value + 1);
  }, [request, workflow?.workflowId]);

  const openG2UpdateDialog = () => {
    if (!workflow) {
      return;
    }

    setG2HealthStatus(deriveG2HealthStatus(workflow));
    setG2Notes(latestOutcome?.whyItBlocked ?? latestOutcome?.actionNeeded ?? workflow.mainActionNeeded ?? "");
    setG2UpdateOpen(true);
  };

  const openRunDialog = () => {
    setRunDialogSession((value) => value + 1);
    setRunOpen(true);
  };

  const clearG11Toast = () => {
    if (g11ToastIdRef.current !== null) {
      toast.dismiss(g11ToastIdRef.current);
      g11ToastIdRef.current = null;
    }
  };

  const dismissStaleG11ErrorToast = () => {
    const staleMessage = "G11 could not create a recommendation. Please try again.";

    for (const entry of toast.getToasts()) {
      if (!entry || typeof entry !== "object" || !("id" in entry)) {
        continue;
      }

      const title = "title" in entry && typeof entry.title === "string" ? entry.title : "";
      const description = "description" in entry && typeof entry.description === "string" ? entry.description : "";

      if (title === staleMessage || description === staleMessage) {
        toast.dismiss(entry.id);
      }
    }

    clearG11Toast();
  };

  const handleRunSubmit = async (values: Record<string, unknown>) => {
    if (workflowId === "G11") {
      dismissStaleG11ErrorToast();
    }

    const response = await request(buildRouteUrl(`/api/admin/workflow-dashboard/${workflowId}/run`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      cache: "no-store",
      silent: true,
    });

    const body = await parseJsonResponse<WorkflowDashboardRunResponse>(response);
    if (!body) {
      throw new Error(`Unable to submit workflow action (${response.status}).`);
    }

    if (workflowId === "G11" && process.env.NODE_ENV !== "production") {
      console.log("G11 HTTP status:", response.status);
      console.log("G11 create response:", body);
    }

    if (workflowId === "G11") {
      if (isG11RecommendationSuccess(body) || isG11RecommendationBlocked(body)) {
        return body;
      }

      throw new Error(body.message ?? `Unable to submit workflow action (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(body.message ?? `Unable to submit workflow action (${response.status}).`);
    }

    return body;
  };

  const handleRunSuccess = (response: WorkflowDashboardRunResponse) => {
    if (workflow?.workflowId === "G11") {
      if (isG11RecommendationSuccess(response)) {
        clearG11Toast();
        setRunOpen(false);
        g11RefreshPendingRef.current = true;
        const toastId = toast.success("Recommendation created. Nothing was executed.");
        g11ToastIdRef.current = toastId;
        setRefreshNonce((value) => value + 1);
        return;
      }

      if (isG11RecommendationBlocked(response)) {
        clearG11Toast();
        const toastId = toast.warning("G11 blocked this recommendation safely. Review the issue before continuing.");
        g11ToastIdRef.current = toastId;
        setRefreshNonce((value) => value + 1);
        return;
      }
      return;
    }

    setRunOpen(false);

    if (response.status === "ERROR") {
      toast.error(response.message);
    } else if (response.status === "PASS") {
      toast.success(response.message);
    } else {
      toast.info(response.message);
    }

    setRefreshNonce((value) => value + 1);
  };

  const handleG2UpdateSubmit = async (): Promise<G2AccountHealthUpdateResponse> => {
    if (!workflow) {
      throw new Error("Workflow detail is not available.");
    }

    const response = await request(buildRouteUrl("/api/admin/g2-account-health-update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        health_status: g2HealthStatus,
        notes: g2Notes.trim() || undefined,
      }),
      cache: "no-store",
      silent: true,
    });

    const body = await parseJsonResponse<G2AccountHealthUpdateResponse>(response);
    if (!response.ok || !body) {
      throw new Error(body?.message ?? `Unable to update account status (${response.status}).`);
    }

    return body;
  };

  const handleG2UpdateSuccess = async () => {
    try {
      const result = await handleG2UpdateSubmit();
      toast.success(result.message || "Account status updated.");
      setG2UpdateOpen(false);
      setRefreshNonce((value) => value + 1);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to update account status.";
      toast.error(message);
    }
  };

  const headerBadges = isG11Workflow ? null : (
    <>
      <Badge
        variant="outline"
        className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(workflowStatus as WorkflowUiStatus))}
      >
        {workflow ? getWorkflowStatusLabel(workflowStatus as WorkflowUiStatus) : "Loading"}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 data-icon="inline-start" className="size-3.5" />
        {workflow ? formatTimeLabel(safeOutcomeTime) : "Loading workflow"}
      </Badge>
    </>
  );

  const headerActions = (
    <>
      {!isG11Workflow ? (
        <Button asChild variant="outline" className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm">
          <Link href="/dashboard/n8n-automations">
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
      ) : null}

      {workflow ? (
        workflow.workflowId === "G2" ? (
          g2NeedsUpdate ? (
            <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={openG2UpdateDialog}>
              <Sparkles data-icon="inline-start" />
              {g2PrimaryCopy}
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm">
              <a href="#latest-outcome">
                <ArrowRight data-icon="inline-start" />
                {g2PrimaryCopy}
              </a>
            </Button>
          )
        ) : primaryAction?.kind === "open_checks" ? (
          <Button asChild variant="outline" className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm">
            <a href="#latest-outcome">
              <ArrowRight data-icon="inline-start" />
              {primaryAction.label ?? "View Details"}
            </a>
          </Button>
        ) : primaryAction?.kind === "refresh_status" ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 text-[11px] font-medium shadow-sm"
            onClick={() => {
              void refreshDetail();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
            {refreshing ? "Refreshing..." : primaryAction.label ?? "Refresh Status"}
          </Button>
        ) : primaryAction?.kind === "generate_recommendation" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={openRunDialog}>
            <Sparkles data-icon="inline-start" />
            {primaryAction.label ?? "Generate Recommendation"}
          </Button>
        ) : primaryAction?.kind === "run_dry_run" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={openRunDialog}>
            <Play data-icon="inline-start" />
            {primaryAction.label ?? "Run Dry Run"}
          </Button>
        ) : primaryAction?.kind === "run" ? (
          <Button type="button" className="h-10 min-w-[152px] justify-center rounded-full px-4" onClick={openRunDialog} disabled={!workflow.runEnabled}>
            <Play data-icon="inline-start" />
            {primaryAction.label ?? "Run Workflow"}
          </Button>
        ) : null
      ) : null}
    </>
  );

  const latestOutcomeBadge = latestOutcome ? (
    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome.result))}>
      {getWorkflowStatusLabel(latestOutcome.result)}
    </Badge>
  ) : (
    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
      {workflow ? getWorkflowStatusLabel(workflow.status) : "Loading"}
    </Badge>
  );

  const actionsNeededText =
    workflow?.workflowId === "G2"
      ? latestOutcome?.actionNeeded ?? workflow?.emptyStateCopy ?? "No action needed."
      : latestOutcome
        ? latestOutcome.result === "PASS"
          ? "Nothing needed right now. Latest check is good."
          : latestOutcome.result === "RECOMMENDATION_ONLY"
            ? "Recommendation created. Review it before any next step."
            : latestOutcome.actionNeeded
        : workflow?.emptyStateCopy ?? "No action needed right now.";

  const actionsNeededHelper =
    workflow?.workflowId === "G2"
      ? g2NeedsUpdate
        ? "Blocked safely because the current account state is not clean."
        : "Use the safe refresh button to reload the latest account health snapshot."
      : primaryAction?.note ?? (latestOutcome?.whyItBlocked ?? null);

  const actionsNeededButton =
    workflow ? (
      workflow.workflowId === "G2" ? (
        g2NeedsUpdate ? (
          <Button type="button" className="h-10 rounded-full px-5" onClick={openG2UpdateDialog}>
            <Sparkles data-icon="inline-start" />
            Update Account Status
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-white px-5"
            onClick={() => {
              void refreshDetail();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
            Refresh Status
          </Button>
        )
      ) : primaryAction?.kind === "refresh_status" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-border/70 bg-white px-5"
          onClick={() => {
            void refreshDetail();
          }}
          disabled={loading || refreshing}
        >
          <RefreshCcw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
          {primaryAction.label ?? "Refresh Status"}
        </Button>
      ) : primaryAction?.kind === "open_checks" ? (
        <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
          <a href="#recent-outcomes">
            <ArrowRight data-icon="inline-start" />
            {primaryAction.label ?? "View Details"}
          </a>
        </Button>
      ) : primaryAction?.kind === "generate_recommendation" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={openRunDialog}>
          <Sparkles data-icon="inline-start" />
          {primaryAction.label ?? "Generate Recommendation"}
        </Button>
      ) : primaryAction?.kind === "run_dry_run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={openRunDialog}>
          <Play data-icon="inline-start" />
          {primaryAction.label ?? "Run Dry Run"}
        </Button>
      ) : primaryAction?.kind === "run" ? (
        <Button type="button" className="h-10 rounded-full px-5" onClick={openRunDialog} disabled={!workflow.runEnabled}>
          <Play data-icon="inline-start" />
          {primaryAction.label ?? "Run Workflow"}
        </Button>
      ) : (
        <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
          <a href="#recent-outcomes">
            <ArrowRight data-icon="inline-start" />
            View Recent Outcomes
          </a>
        </Button>
      )
    ) : null;

  if (error && !workflow) {
    return (
      <WorkflowDashboardShell
        eyebrow="Workflow detail"
        title={`Workflow ${workflowId}`}
        description="Loading workflow detail."
        badges={headerBadges}
        actions={headerActions}
      >
        <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{error}</CardContent>
        </Card>
      </WorkflowDashboardShell>
    );
  }

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title={workflow?.title ?? `Workflow ${workflowId}`}
      description={workflow ? getWorkflowStatusDetailCopy(workflow.workflowId, workflow.status) : "Loading workflow detail."}
      badges={headerBadges}
      actions={headerActions}
    >
      {error ? (
        <Card role="alert" className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-amber-950">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !workflow ? (
        <LoadingSkeleton />
      ) : workflow ? (
        isG11Workflow ? (
          <>
            <Card id="latest-outcome" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.latest}</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      The latest recommendation in plain language. Nothing was executed.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {latestOutcomeBadge}
                    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      Handled {formatRowTimeLabel(latestOutcome?.time ?? workflow.lastRunAt)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      Recommendation only
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {latestOutcome && g11SafetySummary ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.75fr)]">
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-border/60 bg-[linear-gradient(180deg,rgba(79,33,115,0.04),rgba(255,255,255,0))] p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recommendation</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RecommendationTone(g11RecommendationValue))}
                            >
                              {g11RecommendationValue}
                            </Badge>
                            {g11TargetWorkflow || g11Details?.target ? (
                              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                Target: {g11TargetWorkflow ?? g11Details?.target}
                              </Badge>
                            ) : null}
                            {g11TargetPlatform ? (
                              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                Platform: {g11TargetPlatform}
                              </Badge>
                            ) : null}
                            {g11Details?.riskLevel ? (
                              <Badge
                                variant="outline"
                                className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RiskTone(g11Details.riskLevel))}
                              >
                                Risk: {g11Details.riskLevel}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-4 text-lg leading-8 text-pretty text-foreground">{latestOutcome.whatHappened}</p>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            G11 did not execute anything. This is only a recommendation.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <DetailField
                            label="What G11 is recommending"
                            value={latestOutcome.whatHappened}
                            helper={
                              [g11TargetWorkflow, g11TargetPlatform]
                                .filter(Boolean)
                                .join(" · ") || undefined
                            }
                          />
                          <DetailField
                            label="Why"
                            value={getG11BulletList(g11Details?.why, "No written explanation was stored for this recommendation.")}
                          />
                          <DetailField
                            label="Next step"
                            value={g11NextStep ?? latestOutcome.actionNeeded}
                            helper={latestOutcome.result === "ERROR" ? "Recommendation output needs review." : g11RiskNote ?? undefined}
                          />
                          <DetailField
                            label="Execution"
                            value={<span className="font-medium text-foreground">{g11ExecutionDisplay ?? "Not executed"}</span>}
                            helper="G11 only writes a recommendation. Nothing live happened."
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <DetailField
                          label="Safety status"
                          value={
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.complianceStatus))}>
                                Compliance: {getG11DisplayStatus(g11Details?.complianceStatus)}
                              </Badge>
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.accountHealthStatus))}>
                                Account Health: {getG11DisplayStatus(g11Details?.accountHealthStatus)}
                              </Badge>
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.consentStatus))}>
                                Consent: {getG11DisplayStatus(g11Details?.consentStatus)}
                              </Badge>
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.rightsStatus))}>
                                Rights: {getG11DisplayStatus(g11Details?.rightsStatus)}
                              </Badge>
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.offerStatus))}>
                                Offer: {getG11DisplayStatus(g11Details?.offerStatus)}
                              </Badge>
                              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(g11Details?.executionStatus))}>
                                Execution: {g11ExecutionDisplay ?? "Not executed"}
                              </Badge>
                            </div>
                          }
                          helper={g11SafetySummary.description}
                        />
                        <DetailField
                          label="Risk level"
                          value={
                            <Badge
                              variant="outline"
                              className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RiskTone(g11Details?.riskLevel))}
                              >
                                {g11Details?.riskLevel ?? "UNKNOWN"}
                              </Badge>
                            }
                          helper={g11RiskNote ?? (latestOutcome.result === "BLOCK" ? "This needs human review before any action." : undefined)}
                        />
                        <DetailField label="Target workflow" value={g11TargetWorkflow ?? "Not available"} />
                        <DetailField label="Platform" value={g11TargetPlatform ?? "Not available"} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
                        <a href="#recent-outcomes">
                          <ArrowRight data-icon="inline-start" />
                          View Recent Recommendations
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    {workflow.emptyStateCopy}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card id="recent-outcomes" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.recent}</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  The latest recommendation events, newest first.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1120px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Safety</TableHead>
                        <TableHead>Next Step</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRecentOutcomes.length ? (
                        displayedRecentOutcomes.slice(0, 10).map((outcome, index) => {
                          const details = outcome.details ?? null;
                          const recommendationValue = getG11RecommendationValue(outcome);
                          const safetySummary = getG11SafetySummary(outcome);

                          return (
                            <TableRow key={`${outcome.time ?? "outcome"}-${index}`}>
                              <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatRowTimeLabel(outcome.time)}</TableCell>
                              <TableCell className="align-top">
                                <Badge
                                  variant="outline"
                                  className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RecommendationTone(recommendationValue))}
                                >
                                  {recommendationValue}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                                {details?.target ?? details?.targetWorkflow ?? "Not available"}
                              </TableCell>
                              <TableCell className="align-top whitespace-normal">
                                <div className="space-y-2">
                                  <Badge
                                    variant="outline"
                                    className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RiskTone(details?.riskLevel))}
                                  >
                                    {details?.riskLevel ?? "UNKNOWN"}
                                  </Badge>
                                  {getG11RiskNoteCopy(details?.riskLevel, details?.riskNote) ? (
                                    <p className="text-xs leading-5 text-muted-foreground">{getG11RiskNoteCopy(details?.riskLevel, details?.riskNote)}</p>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="align-top whitespace-normal">
                                <Badge
                                  variant="outline"
                                  className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", safetySummary.tone)}
                                >
                                  {safetySummary.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                                {getG11OutcomeNextStepCopy(outcome)}
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none"
                                  onClick={() => {
                                    setSelectedOutcome(outcome);
                                    setOutcomeDetailsOpen(true);
                                  }}
                                >
                                  View Details
                                  <ArrowRight data-icon="inline-end" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            No recommendation has been created yet. Click Generate Recommendation to create one.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <p className="px-1 text-xs leading-5 text-muted-foreground">
              G11 only recommends actions. It never executes live changes.
            </p>
          </>
        ) : (
          <>
            <Card id="latest-outcome" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.latest}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    The most recent checked result, shown in plain language.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {latestOutcomeBadge}
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Handled {formatRowTimeLabel(latestOutcome?.time ?? workflow.lastRunAt)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestOutcome ? (
                <>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened</p>
                    <p className="mt-2 text-sm leading-6 text-foreground text-pretty">{getLatestOutcomeSummary(workflow.workflowId, latestOutcome)}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailField
                      label="What was checked"
                      value={latestOutcome.whatWasChecked}
                    />
                    <DetailField
                      label="Action needed"
                      value={latestOutcome.actionNeeded}
                    />
                    <DetailField
                      label="Checked time"
                      value={formatRowTimeLabel(latestOutcome.time)}
                    />
                    <DetailField
                      label="Result"
                      value={
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome.result))}>
                          {getWorkflowStatusLabel(latestOutcome.result)}
                        </Badge>
                      }
                    />
                  </div>

                  {latestOutcome.whyItBlocked ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Why it blocked</p>
                      <p className="mt-2 text-sm leading-6 text-amber-950 text-pretty">{latestOutcome.whyItBlocked}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-5">
                      <a href="#recent-outcomes">
                        <ArrowRight data-icon="inline-start" />
                        View Recent Outcomes
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  {workflow.emptyStateCopy}
                </div>
              )}
            </CardContent>
          </Card>

          {!hideActionPanels ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card id="actions-needed" className="rounded-[28px] border-border/60 bg-white shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Actions Needed</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    The next safe step, written for the client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                    <p className="text-sm leading-6 text-foreground text-pretty">{actionsNeededText}</p>
                    {actionsNeededHelper ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{actionsNeededHelper}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {actionsNeededButton}
                  </div>
                </CardContent>
              </Card>

              {savedOutput ? (
                <Card id="saved-output" className="rounded-[28px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <CardTitle className="font-serif text-2xl tracking-tight text-primary">Saved Output</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      The clean result saved for client review.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DetailField label={savedOutput.label} value={savedOutput.value} helper={savedOutput.helper} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Card id="recent-outcomes" className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">{outcomeTitles.recent}</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The latest workflow events, newest first.
              </CardDescription>
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
                    {displayedRecentOutcomes.length ? (
                      displayedRecentOutcomes.slice(0, 10).map((outcome, index) => (
                        <TableRow key={`${outcome.time ?? "outcome"}-${index}`}>
                          <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatRowTimeLabel(outcome.time)}</TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(outcome.result))}>
                              {getWorkflowStatusLabel(outcome.result)}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                            {outcome.whatHappened}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground text-pretty">
                            {outcome.actionNeeded}
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none"
                              onClick={() => {
                                setSelectedOutcome(outcome);
                                setOutcomeDetailsOpen(true);
                              }}
                            >
                              View Details
                              <ArrowRight data-icon="inline-end" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          {workflow.emptyStateCopy}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </>
        )
      ) : null}

      {workflow && primaryAction && ["run", "run_dry_run", "generate_recommendation"].includes(primaryAction.kind) ? (
        <WorkflowRunDialog
          key={`${workflow.workflowId}-${primaryAction.kind}-${runDialogSession}`}
          workflow={workflow}
          primaryAction={primaryAction}
          open={runOpen}
          onOpenChange={setRunOpen}
          onSubmit={handleRunSubmit}
          onSuccess={handleRunSuccess}
        />
      ) : null}

      <Dialog open={g2UpdateOpen} onOpenChange={setG2UpdateOpen}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,40rem)] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Update Account Status</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Record the latest account health state and keep the workflow safe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Health status</p>
                <Select value={g2HealthStatus} onValueChange={setG2HealthStatus}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-muted/15">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLEAN">Clean</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="RESTRICTED">Restricted</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Notes</p>
                <Textarea
                  value={g2Notes}
                  onChange={(event) => setG2Notes(event.target.value)}
                  rows={6}
                  name="notes"
                  placeholder="Add the evidence or reason for the update."
                  className="min-h-[160px] rounded-2xl border-border/60 bg-muted/15"
                />
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <p className="text-sm leading-6 text-foreground">
                  If the account is still unknown, warning, restricted, or suspended, keep affected workflows paused until the issue is cleared.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4" onClick={() => setG2UpdateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-11 rounded-full px-4" onClick={() => void handleG2UpdateSuccess()}>
                Save Account Status
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={outcomeDetailsOpen}
        onOpenChange={(open) => {
          setOutcomeDetailsOpen(open);
          if (!open) {
            setSelectedOutcome(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[min(98vw,72rem)] max-w-none overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl sm:max-w-none">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">
                {isG11Workflow ? "Recommendation details" : "Health Check Details"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                {isG11Workflow
                  ? "Safe client-facing summary of the selected recommendation."
                  : "Safe client-facing summary of the selected health snapshot."}
              </DialogDescription>
            </DialogHeader>

            {selectedOutcome ? (
              isG11Workflow ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailField
                      label="Recommendation"
                      value={
                        <Badge
                          variant="outline"
                          className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RecommendationTone(getG11RecommendationValue(selectedOutcome)))}
                        >
                          {getG11RecommendationValue(selectedOutcome)}
                        </Badge>
                      }
                    />
                    <DetailField label="Target workflow" value={getG11FriendlyWorkflowName(selectedOutcome.details?.targetWorkflow ?? selectedOutcome.details?.target) ?? "Not available"} />
                    <DetailField label="Target platform" value={getG11FriendlyPlatformName(selectedOutcome.details?.targetPlatform) ?? "Not available"} />
                    <DetailField
                      label="Risk level"
                      value={
                        <Badge
                          variant="outline"
                          className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11RiskTone(selectedOutcome.details?.riskLevel))}
                        >
                          {selectedOutcome.details?.riskLevel ?? "UNKNOWN"}
                        </Badge>
                      }
                      helper={getG11RiskNoteCopy(selectedOutcome.details?.riskLevel, selectedOutcome.details?.riskNote) ?? undefined}
                    />
                  </div>

                  <DetailField label="Summary" value={selectedOutcome.whatHappened} />

                  <DetailField
                    label="Why G11 recommended it"
                    value={getG11BulletList(selectedOutcome.details?.why, "No written explanation was stored for this recommendation.")}
                  />

                  <DetailField
                    label="Evidence used"
                    value={getG11BulletList(selectedOutcome.details?.evidence, selectedOutcome.details?.evidenceSummary ?? "No evidence summary was stored.")}
                  />

                  <DetailField
                    label="Safety checks"
                    value={
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.complianceStatus))}>
                          Compliance: {getG11DisplayStatus(selectedOutcome.details?.complianceStatus)}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.accountHealthStatus))}>
                          Account Health: {getG11DisplayStatus(selectedOutcome.details?.accountHealthStatus)}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.consentStatus))}>
                          Consent: {getG11DisplayStatus(selectedOutcome.details?.consentStatus)}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.rightsStatus))}>
                          Rights: {getG11DisplayStatus(selectedOutcome.details?.rightsStatus)}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.offerStatus))}>
                          Offer: {getG11DisplayStatus(selectedOutcome.details?.offerStatus)}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getG11SafetyTone(selectedOutcome.details?.executionStatus ?? (selectedOutcome.details?.notExecuted ? "NOT_EXECUTED" : null)))}>
                          Execution: {getG11DisplayStatus(selectedOutcome.details?.executionStatus ?? (selectedOutcome.details?.notExecuted ? "NOT_EXECUTED" : null))}
                        </Badge>
                      </div>
                    }
                    helper={getG11SafetySummary(selectedOutcome).description}
                  />

                  <DetailField
                    label="Next step"
                    value={getG11OutcomeNextStepCopy(selectedOutcome)}
                    helper={getG11RiskNoteCopy(selectedOutcome.details?.riskLevel, selectedOutcome.details?.riskNote) ?? (selectedOutcome.result === "BLOCK" ? "Fix missing or blocked data first." : undefined)}
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailField
                      label="Execution status"
                      value={<span className="font-medium text-foreground">Not executed by G11</span>}
                      helper="G11 only writes a recommendation."
                    />
                    <DetailField label="Checked time" value={formatRowTimeLabel(selectedOutcome.handledAt ?? selectedOutcome.time)} />
                  </div>

                  <DetailField
                    label="Missing data"
                    value={getG11BulletList(selectedOutcome.details?.missingData, "No missing data was flagged.")}
                  />

                  {selectedOutcome.details?.technicalNotes?.length ? (
                    <details className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                        Technical details
                      </summary>
                      <div className="mt-3">
                        <DetailField
                          label="Technical notes"
                          value={getG11BulletList(selectedOutcome.details.technicalNotes, "No technical details were stored.")}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField
                    label="Platform / account"
                    value={
                      [selectedOutcome.details?.platform, selectedOutcome.details?.account].filter(Boolean).join(" · ") || "Not available"
                    }
                  />
                  <DetailField
                    label="Status / result"
                    value={
                      <Badge variant="outline" className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(selectedOutcome.result))}>
                        {getWorkflowStatusLabel(selectedOutcome.result)}
                      </Badge>
                    }
                  />
                  <DetailField label="What was checked" value={selectedOutcome.details?.whatWasChecked ?? selectedOutcome.whatWasChecked} />
                  {selectedOutcome.details?.evidenceSummary ? <DetailField label="Evidence summary" value={selectedOutcome.details.evidenceSummary} /> : null}
                  <DetailField label="Action needed" value={selectedOutcome.actionNeeded} />
                  <DetailField label="Checked time" value={formatRowTimeLabel(selectedOutcome.handledAt ?? selectedOutcome.time)} />
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                No details available.
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-4"
                onClick={() => {
                  setOutcomeDetailsOpen(false);
                  setSelectedOutcome(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
