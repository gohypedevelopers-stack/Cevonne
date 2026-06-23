"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatRelativeTime,
  type G5PublishingAssetSnapshot,
  type N8nApprovalRecord,
  type N8nWorkflowDetailResponse,
} from "@/components/admin-dashboard/n8n-automations-common";
import {
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
  normalizeWorkflowUiStatus,
  type AdminWorkflowId,
  type WorkflowDetailView,
  type WorkflowOutcomeSummary,
  type WorkflowOverviewCard,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";

type WorkflowDashboardOverviewResponse = {
  status?: "PASS" | "EMPTY";
  message?: string;
  workflows?: WorkflowOverviewCard[];
};

type WorkflowDashboardDetailResponse = {
  status?: "PASS" | "EMPTY";
  message?: string;
  workflowGroup?: AdminWorkflowId;
  workflow: WorkflowDetailView;
  recentOutcomes?: WorkflowOutcomeSummary[];
};

type WorkflowDashboardRunResponse = {
  status: WorkflowUiStatus;
  message: string;
  response_type: string | null;
  handled_at: string;
  outcome: WorkflowOutcomeSummary;
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

type RequestOptions = RequestInit;

type PrimaryActionKind = "review" | "dry_run" | "schedule" | "checklist" | "refresh";

type PrimaryActionConfig = {
  kind: PrimaryActionKind;
  label: string;
  description: string;
  tone: "default" | "outline";
};

type ChecklistItem = {
  label: string;
  stateLabel: string;
  helper: string;
  ready: boolean;
  tone: "good" | "warning" | "danger" | "neutral";
};

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

const getApprovalStatusLabel = (status?: N8nApprovalRecord["status"] | null) => {
  switch (status) {
    case "PENDING":
      return "Waiting for review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    default:
      return "Not available";
  }
};

const getApprovalStatusTone = (status?: N8nApprovalRecord["status"] | null) => {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "REJECTED":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "CHANGES_REQUESTED":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "PENDING":
    default:
      return "border-sky-200 bg-sky-100 text-sky-800";
  }
};

const getGateTone = (ready: boolean, blocked = false) => {
  if (ready) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (blocked) {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  return "border-amber-200 bg-amber-100 text-amber-800";
};

const isReadyStatus = (value?: string | null, readyValues: string[] = ["PASS", "ACTIVE"]) =>
  typeof value === "string" && readyValues.includes(value.trim().toUpperCase());

const isDryRunOutcome = (outcome: WorkflowOutcomeSummary) => {
  const stage = inferOutcomeStage(outcome);
  return stage === "Dry run" || outcome.result === "DRY_RUN";
};

const inferOutcomeStage = (outcome: WorkflowOutcomeSummary) => {
  const source = `${outcome.sourceLabel ?? ""} ${outcome.whatWasChecked} ${outcome.whatHappened}`.toLowerCase();
  if (source.includes("approval")) return "Approval";
  if (source.includes("dry run")) return "Dry run";
  if (source.includes("schedule")) return "Schedule";
  if (source.includes("publish")) return "Publish";
  return "Review";
};

const formatHandledTime = (value?: string | null) => {
  if (!value) {
    return "Not yet handled";
  }

  return `${formatDateTime(value)} · ${formatRelativeTime(value)}`;
};

const formatAssetReference = (value?: string | null) => value?.trim() || "Not available";

const resolveGateReady = (card: WorkflowOverviewCard | null, snapshotValue: string | null, readyValues: string[]) =>
  card ? isReadyStatus(card.status, readyValues) : isReadyStatus(snapshotValue, readyValues);

const getCurrentStatusLabel = (approval: N8nApprovalRecord | null, dryRunSucceeded: boolean, liveReady: boolean, blockers: string[]) => {
  if (!approval) {
    return "No approved asset";
  }

  switch (approval.status) {
    case "PENDING":
      return "Pending approval";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REJECTED":
      return "Rejected";
    case "APPROVED":
      if (!dryRunSucceeded) {
        return "Approved, dry-run needed";
      }

      if (liveReady) {
        return "Ready to schedule";
      }

      return blockers.length > 0 ? "Approved, blocked by checks" : "Approved, waiting on next step";
    default:
      return "Pending review";
  }
};

const getCurrentStatusCopy = (approval: N8nApprovalRecord | null, dryRunSucceeded: boolean, liveReady: boolean, blockers: string[]) => {
  if (!approval) {
    return "No approved asset is ready yet. Review the pending asset before anything moves forward.";
  }

  switch (approval.status) {
    case "PENDING":
      return "A reviewer still needs to approve the asset before the scheduler can continue.";
    case "CHANGES_REQUESTED":
      return "The reviewer asked for changes. Update the asset and resubmit it for review.";
    case "REJECTED":
      return "The asset was rejected and cannot move into scheduling yet.";
    case "APPROVED":
      if (!dryRunSucceeded) {
        return "The asset is approved, but the publishing dry-run has not been completed yet.";
      }

      if (liveReady) {
        return "All required checks are green. The asset can be scheduled.";
      }

      return blockers.length > 0 ? blockers[0] : "The dry-run passed, but one or more live checks still need attention.";
    default:
      return "The publishing scheduler is waiting for the next review step.";
  }
};

const getOutcomeFallbackCopy = (outcome: WorkflowOutcomeSummary | null, approval: N8nApprovalRecord | null) => {
  if (outcome) {
    return outcome.whatHappened;
  }

  if (!approval) {
    return "No asset has been reviewed yet.";
  }

  switch (approval.status) {
    case "PENDING":
      return "This asset is waiting for review.";
    case "APPROVED":
      return "The asset is approved and ready for the next publishing step.";
    case "CHANGES_REQUESTED":
      return "The reviewer asked for changes before this can continue.";
    case "REJECTED":
      return "The asset was rejected and stopped safely.";
    default:
      return "The current scheduler state is ready for review.";
  }
};

function DetailBlock({
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
    <div className={cn("rounded-[22px] border border-border/60 bg-white p-4 shadow-sm", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ChecklistItemCard({
  item,
}: {
  item: ChecklistItem;
}) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="text-sm leading-6 text-muted-foreground">{item.helper}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getGateTone(item.ready, item.tone === "danger"))}>
          {item.stateLabel}
        </Badge>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardHeader>
        <Skeleton className="h-6 w-56 rounded-full" />
        <Skeleton className="h-4 w-96 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </CardContent>
    </Card>
  );
}

export default function G5PublishingSchedulerPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [overview, setOverview] = useState<WorkflowDashboardOverviewResponse | null>(null);
  const [dashboard, setDashboard] = useState<WorkflowDashboardDetailResponse | null>(null);
  const [storeDetail, setStoreDetail] = useState<N8nWorkflowDetailResponse | null>(null);
  const [localOutcomes, setLocalOutcomes] = useState<WorkflowOutcomeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingAction, setSavingAction] = useState<PrimaryActionKind | null>(null);
  const hasLoadedRef = useRef(false);

  const loadSnapshots = useCallback(async () => {
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const [overviewResponse, dashboardResponse, storeResponse] = await Promise.all([
        request(buildRouteUrl("/api/admin/workflow-dashboard"), { cache: "no-store" }),
        request(buildRouteUrl("/api/admin/workflow-dashboard/G5"), { cache: "no-store" }),
        request(buildRouteUrl("/api/cevonne/admin/workflows/G5"), { cache: "no-store" }),
      ]);

      const [overviewBody, dashboardBody, storeBody] = await Promise.all([
        parseJsonResponse<WorkflowDashboardOverviewResponse>(overviewResponse),
        parseJsonResponse<WorkflowDashboardDetailResponse>(dashboardResponse),
        parseJsonResponse<N8nWorkflowDetailResponse>(storeResponse),
      ]);

      setOverview(overviewBody && Array.isArray(overviewBody.workflows) ? overviewBody : null);
      setDashboard(dashboardBody && dashboardBody.workflow ? dashboardBody : null);
      setStoreDetail(storeBody && storeBody.workflow ? storeBody : null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load the publishing scheduler.";
      setError(message);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const workflowCards = overview?.workflows ?? [];
  const workflowById = useMemo(
    () => new Map(workflowCards.map((workflow) => [workflow.workflowId, workflow] as const)),
    [workflowCards],
  );

  const dashboardWorkflow = dashboard?.workflow ?? null;
  const storeWorkflow = storeDetail?.workflow ?? null;
  const approvals = storeDetail?.approvals ?? [];
  const activeApproval = useMemo(() => approvals.find((approval) => approval.status === "PENDING") ?? approvals.find((approval) => approval.status === "APPROVED") ?? approvals[0] ?? null, [approvals]);
  const selectedApproval = useMemo(() => approvals.find((approval) => approval.approvalId === selectedApprovalId) ?? activeApproval, [approvals, activeApproval, selectedApprovalId]);
  const assetSnapshot: G5PublishingAssetSnapshot | null = selectedApproval?.assetSnapshot ?? activeApproval?.assetSnapshot ?? null;

  useEffect(() => {
    const nextApprovalId = approvals.find((approval) => approval.status === "PENDING")?.approvalId ?? approvals[0]?.approvalId ?? null;
    setSelectedApprovalId((current) => current ?? nextApprovalId);
  }, [approvals]);

  useEffect(() => {
    if (!reviewOpen) {
      return;
    }

    setReviewNotes(selectedApproval?.approvalNotes ?? selectedApproval?.summary ?? "");
  }, [reviewOpen, selectedApproval]);

  const recentOutcomes = useMemo(() => {
    const combined = [...localOutcomes, ...(dashboardWorkflow?.recentOutcomes ?? [])];
    const seen = new Set<string>();
    const keyForOutcome = (outcome: WorkflowOutcomeSummary) =>
      `${outcome.time ?? ""}|${outcome.result}|${outcome.whatWasChecked}|${outcome.whatHappened}|${outcome.actionNeeded}`;

    return combined
      .sort((left, right) => new Date(right.time ?? 0).getTime() - new Date(left.time ?? 0).getTime())
      .filter((outcome) => {
        const key = keyForOutcome(outcome);
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }, [dashboardWorkflow?.recentOutcomes, localOutcomes]);

  const latestOutcome = recentOutcomes[0] ?? dashboardWorkflow?.latestOutcome ?? null;
  const currentUiStatus = normalizeWorkflowUiStatus(
    latestOutcome?.result ?? storeWorkflow?.status ?? dashboardWorkflow?.status ?? "PENDING",
    "PENDING_APPROVAL",
  );
  const approvalStateLabel = getApprovalStatusLabel(selectedApproval?.status ?? null);
  const approvalTone = getApprovalStatusTone(selectedApproval?.status ?? null);

  const g1Card = workflowById.get("G1") ?? null;
  const g2Card = workflowById.get("G2") ?? null;
  const g4Card = workflowById.get("G4") ?? null;
  const g7Card = workflowById.get("G7") ?? null;
  const g8Card = workflowById.get("G8") ?? null;

  const g1Ready = resolveGateReady(g1Card, assetSnapshot?.g1GateStatus ?? null, ["PASS", "ACTIVE"]);
  const g2Ready = resolveGateReady(g2Card, assetSnapshot?.g2GateStatus ?? null, ["PASS", "ACTIVE", "CLEAN"]);
  const g4Ready = resolveGateReady(g4Card, assetSnapshot?.g4ReviewStatus ?? null, ["PASS", "ACTIVE"]);
  const g7Ready = resolveGateReady(g7Card, assetSnapshot?.g7ProofStatus ?? null, ["PASS", "ACTIVE", "READY"]);
  const g8Ready = resolveGateReady(g8Card, assetSnapshot?.g8ProofStatus ?? null, ["PASS", "ACTIVE", "READY"]);
  const rollbackReady = assetSnapshot?.rollbackPayloadReady ?? false;
  const approvalApproved = selectedApproval?.status === "APPROVED" || assetSnapshot?.finalHumanApprovalState === "APPROVED";
  const approvalPending = selectedApproval?.status === "PENDING";
  const approvalNeedsFix = selectedApproval?.status === "CHANGES_REQUESTED" || selectedApproval?.status === "REJECTED";
  const dryRunSucceeded =
    assetSnapshot?.dryRunStatus === "SUCCESS" || recentOutcomes.some((outcome) => isDryRunOutcome(outcome) && (outcome.result === "PASS" || outcome.result === "DRY_RUN"));
  const livePublishReady =
    approvalApproved && g1Ready && g2Ready && g4Ready && g7Ready && g8Ready && rollbackReady && dryRunSucceeded;

  const blockers = useMemo(() => {
    const items: string[] = [];

    if (!selectedApproval) {
      items.push("No asset is ready for review yet.");
      return items;
    }

    if (approvalPending) {
      items.push("The asset still needs a reviewer decision.");
    }

    if (approvalNeedsFix) {
      items.push("The reviewer requested changes before this can move forward.");
    }

    if (approvalApproved && !dryRunSucceeded) {
      items.push("A publishing dry-run has not been completed yet.");
    }

    if (!g1Ready) items.push("G1 safety gate is not clear yet.");
    if (!g2Ready) items.push("G2 account health is not clean yet.");
    if (!g4Ready) items.push("G4 content review still needs a pass.");
    if (!g7Ready) items.push("G7 proof is still missing.");
    if (!g8Ready) items.push("G8 rights proof is still missing.");
    if (!rollbackReady) items.push("Rollback payload has not been prepared.");
    if (approvalApproved && dryRunSucceeded && !livePublishReady) {
      items.push("One or more live publishing checks still need attention.");
    }

    return items;
  }, [
    approvalApproved,
    approvalNeedsFix,
    approvalPending,
    dryRunSucceeded,
    g1Ready,
    g2Ready,
    g4Ready,
    g7Ready,
    g8Ready,
    livePublishReady,
    rollbackReady,
    selectedApproval,
  ]);

  const currentStatusLabel = getCurrentStatusLabel(selectedApproval ?? null, dryRunSucceeded, livePublishReady, blockers);
  const currentStatusCopy = getCurrentStatusCopy(selectedApproval ?? null, dryRunSucceeded, livePublishReady, blockers);
  const currentOutcomeCopy = getOutcomeFallbackCopy(latestOutcome, selectedApproval ?? null);

  const primaryAction = useMemo<PrimaryActionConfig>(() => {
    if (!selectedApproval) {
      return {
        kind: "refresh",
        label: "Refresh Status",
        description: "Load the latest publishing scheduler state.",
        tone: "outline",
      };
    }

    if (approvalPending) {
      return {
        kind: "review",
        label: "Review Pending Asset",
        description: "Open the asset review panel and make a decision.",
        tone: "default",
      };
    }

    if (approvalNeedsFix) {
      return {
        kind: "review",
        label: "Review Fix Request",
        description: "Open the reviewer notes and update the asset.",
        tone: "outline",
      };
    }

    if (approvalApproved && !dryRunSucceeded) {
      return {
        kind: "dry_run",
        label: "Run Publishing Dry Run",
        description: "Validate the approved asset before scheduling.",
        tone: "default",
      };
    }

    if (approvalApproved && dryRunSucceeded && livePublishReady) {
      return {
        kind: "schedule",
        label: "Schedule Approved Asset",
        description: "Queue the approved asset for publishing.",
        tone: "default",
      };
    }

    if (approvalApproved && dryRunSucceeded && blockers.length > 0) {
      return {
        kind: "checklist",
        label: "Review Blockers",
        description: "One or more live checks still need attention.",
        tone: "outline",
      };
    }

    return {
      kind: "refresh",
      label: "Refresh Status",
      description: "Load the latest publishing scheduler state.",
      tone: "outline",
    };
  }, [approvalApproved, approvalNeedsFix, approvalPending, blockers.length, dryRunSucceeded, livePublishReady, selectedApproval]);

  const latestHandledAt =
    latestOutcome?.time ?? dashboardWorkflow?.lastRunAt ?? storeWorkflow?.lastRunAt ?? selectedApproval?.createdAt ?? null;
  const assetHeadline = assetSnapshot?.headline ?? selectedApproval?.summary ?? "No asset selected";
  const assetCaption = assetSnapshot?.caption ?? selectedApproval?.approvalNotes ?? selectedApproval?.summary ?? "Not available";
  const assetContent = assetSnapshot?.content ?? assetSnapshot?.caption ?? selectedApproval?.approvalNotes ?? selectedApproval?.summary ?? null;
  const assetReference = assetSnapshot?.assetId ?? selectedApproval?.approvalId ?? null;
  const assetMediaReference = assetSnapshot?.mediaReference ?? null;
  const assetStorageReference = assetSnapshot?.storageReference ?? null;
  const assetRiskSummary = assetSnapshot?.riskSummary ?? "Not available";
  const assetApprovalNotes = assetSnapshot?.approvalNotes ?? selectedApproval?.approvalNotes ?? selectedApproval?.summary ?? "No notes recorded.";

  const checklist = useMemo<ChecklistItem[]>(
    () => [
      {
        label: "G1 safety gate",
        stateLabel: g1Ready ? "Pass" : "Waiting",
        helper: g1Ready ? g1Card?.mainActionNeeded ?? "The compliance gate is clear." : g1Card?.mainActionNeeded ?? "The compliance gate still needs attention.",
        ready: g1Ready,
        tone: g1Ready ? "good" : "warning",
      },
      {
        label: "G2 account health",
        stateLabel: g2Ready ? "Clean" : "Needs review",
        helper: g2Ready ? g2Card?.mainActionNeeded ?? "Account health is clean." : g2Card?.mainActionNeeded ?? "Account health still needs review.",
        ready: g2Ready,
        tone: g2Ready ? "good" : "warning",
      },
      {
        label: "G4 content review",
        stateLabel: g4Ready ? "Pass" : "Waiting",
        helper: g4Ready ? g4Card?.mainActionNeeded ?? "The content review passed." : g4Card?.mainActionNeeded ?? "The content review still needs a pass.",
        ready: g4Ready,
        tone: g4Ready ? "good" : "warning",
      },
      {
        label: "G5 human approval",
        stateLabel: selectedApproval ? approvalStateLabel : "Not ready",
        helper: selectedApproval
          ? selectedApproval.status === "APPROVED"
            ? "The asset has been approved by a reviewer."
            : "The asset is still in review."
          : "No approval record was found.",
        ready: approvalApproved,
        tone: approvalApproved ? "good" : "warning",
      },
      {
        label: "G7 proof",
        stateLabel: g7Ready ? "Ready" : "Missing",
        helper: g7Ready ? g7Card?.mainActionNeeded ?? "Offer proof is ready." : g7Card?.mainActionNeeded ?? "Offer proof still needs attention.",
        ready: g7Ready,
        tone: g7Ready ? "good" : "warning",
      },
      {
        label: "G8 rights proof",
        stateLabel: g8Ready ? "Ready" : "Missing",
        helper: g8Ready ? g8Card?.mainActionNeeded ?? "Rights proof is ready." : g8Card?.mainActionNeeded ?? "Rights proof still needs attention.",
        ready: g8Ready,
        tone: g8Ready ? "good" : "warning",
      },
      {
        label: "Rollback payload",
        stateLabel: rollbackReady ? "Ready" : "Missing",
        helper: rollbackReady ? "Rollback details are available if needed." : "Rollback details still need to be prepared.",
        ready: rollbackReady,
        tone: rollbackReady ? "good" : "warning",
      },
      {
        label: "Publishing dry-run",
        stateLabel: dryRunSucceeded ? "Passed" : "Not run",
        helper: dryRunSucceeded
          ? "A safe publishing dry-run has already succeeded."
          : "Run a dry-run before any live schedule is available.",
        ready: dryRunSucceeded,
        tone: dryRunSucceeded ? "good" : "warning",
      },
      {
        label: "Final human approval",
        stateLabel: approvalApproved ? "Approved" : "Pending",
        helper: approvalApproved ? "The final human approval is recorded." : "The final human approval is still pending.",
        ready: approvalApproved,
        tone: approvalApproved ? "good" : "warning",
      },
    ],
    [
      approvalApproved,
      approvalStateLabel,
      assetSnapshot,
      approvalStateLabel,
      approvalApproved,
      dryRunSucceeded,
      g1Card?.mainActionNeeded,
      g1Ready,
      g2Card?.mainActionNeeded,
      g2Ready,
      g4Card?.mainActionNeeded,
      g4Ready,
      g7Card?.mainActionNeeded,
      g7Ready,
      g8Card?.mainActionNeeded,
      g8Ready,
      rollbackReady,
    ],
  );

  const scrollToChecklist = () => {
    document.getElementById("publishing-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openReviewModal = () => {
    if (!selectedApproval) {
      return;
    }

    setReviewNotes(selectedApproval.approvalNotes ?? selectedApproval.summary ?? "");
    setReviewOpen(true);
  };

  const runPublishingAction = async (kind: "dry_run" | "schedule") => {
    const approval = selectedApproval ?? activeApproval;
    if (!approval?.assetSnapshot) {
      toast.error("No asset is ready yet.");
      return;
    }

    if (kind === "schedule" && !livePublishReady) {
      toast.error("This asset is not ready to schedule yet.");
      return;
    }

    setSavingAction(kind);
    try {
      const response = await request(buildRouteUrl("/api/admin/workflow-dashboard/G5/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: "admin",
          dry_run: kind === "dry_run",
          notes:
            kind === "dry_run"
              ? "Publishing dry-run started from the G5 scheduler."
              : "Approved asset scheduled from the G5 scheduler.",
          asset_id: approval.assetSnapshot.assetId ?? approval.approvalId,
          platform: approval.assetSnapshot.platform ?? "INSTAGRAM",
          schedule_mode: kind === "dry_run" ? "dry_run" : "schedule_later",
          scheduled_for: kind === "schedule" ? approval.assetSnapshot.scheduledFor ?? null : null,
        }),
      });

      const body = await parseJsonResponse<WorkflowDashboardRunResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to ${kind === "dry_run" ? "run the dry-run" : "schedule the asset"}.`);
      }

      toast.success(body.message || (kind === "dry_run" ? "Dry-run completed." : "Asset scheduled."));
      setLocalOutcomes((current) => [body.outcome, ...current].slice(0, 5));
      setReviewOpen(false);
      await loadSnapshots();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to complete the action.";
      toast.error(message);
    } finally {
      setSavingAction(null);
    }
  };

  const submitApprovalDecision = async (decision: "APPROVED" | "REJECTED" | "REQUEST_CHANGES") => {
    if (!selectedApproval) {
      toast.error("No approval record is available.");
      return;
    }

    if (decision === "APPROVED" && (selectedApproval.requireConfirmation || selectedApproval.riskLevel === "HIGH" || selectedApproval.riskLevel === "CRITICAL")) {
      const confirmed = window.confirm("Approve this asset and allow the publishing scheduler to continue?");
      if (!confirmed) {
        return;
      }
    }

    const notes = reviewNotes.trim() || selectedApproval.approvalNotes || selectedApproval.summary;

    setSavingAction(decision === "APPROVED" ? "dry_run" : decision === "REJECTED" ? "schedule" : "checklist");
    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/approval-decision"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowGroup: "G5",
          approvalId: selectedApproval.approvalId,
          decision,
          reviewerNote: notes,
          confirmed: decision === "APPROVED",
        }),
      });

      const body = await parseJsonResponse<{ status?: string; message?: string; fail_reason?: string }>(response);
      if (!response.ok || body?.status === "ERROR") {
        throw new Error(body?.message ?? body?.fail_reason ?? `Unable to record the ${decision.toLowerCase()} decision.`);
      }

      toast.success(body?.message ?? "Approval updated.");
      setReviewOpen(false);
      await loadSnapshots();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to update the approval.";
      toast.error(message);
    } finally {
      setSavingAction(null);
    }
  };

  const currentOutcomeTime = latestHandledAt;
  const currentAssetBeingReviewed = assetHeadline;
  const currentApprovalReviewerState = selectedApproval?.status === "PENDING" ? "Waiting for review" : selectedApproval?.reviewerAction ?? "Reviewed";
  const livePublishLabel = livePublishReady ? "Ready to schedule" : approvalApproved && dryRunSucceeded ? "Blocked by checks" : "Not ready";

  const topBadges = (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(currentUiStatus))}>
        {getWorkflowStatusLabel(currentUiStatus)}
      </Badge>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", approvalTone)}>
        {approvalStateLabel}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        {currentOutcomeTime ? formatHandledTime(currentOutcomeTime) : "Not handled yet"}
      </Badge>
    </>
  );

  const topActions = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full border-border/70 bg-white px-4"
        onClick={() => void loadSnapshots()}
        disabled={loading || refreshing}
      >
        <RefreshCcw className={cn("mr-2 h-4 w-4", (loading || refreshing) && "animate-spin")} />
        {loading ? "Loading..." : refreshing ? "Refreshing..." : "Refresh"}
      </Button>
      <Button asChild variant="outline" className="h-10 rounded-full border-border/70 bg-white px-4">
        <Link href="/dashboard/n8n-automations">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>
    </>
  );

  const actionButtonLabel = primaryAction.label;
  const actionButtonTone = primaryAction.tone;

  const actionButton = (
    <Button
      type="button"
      className={cn("h-11 rounded-full px-5", actionButtonTone === "outline" && "border-border/70 bg-white text-foreground hover:bg-muted/40")}
      variant={actionButtonTone === "outline" ? "outline" : "default"}
      onClick={() => {
        if (primaryAction.kind === "review") {
          openReviewModal();
          return;
        }

        if (primaryAction.kind === "dry_run") {
          void runPublishingAction("dry_run");
          return;
        }

        if (primaryAction.kind === "schedule") {
          void runPublishingAction("schedule");
          return;
        }

        if (primaryAction.kind === "checklist") {
          scrollToChecklist();
          return;
        }

        void loadSnapshots();
      }}
      disabled={loading || refreshing || Boolean(savingAction)}
    >
      {savingAction ? "Working..." : actionButtonLabel}
    </Button>
  );

  return (
    <WorkflowDashboardShell
      eyebrow="Workflow detail"
      title="G5 - Publishing Scheduler"
      description="Schedules approved assets only after review, dry-run, and live safety checks are complete."
      badges={topBadges}
      actions={topActions}
    >
      {error ? (
        <Card role="alert" className="rounded-[24px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">
            {error}
            <div className="mt-3">
              <Button type="button" variant="outline" className="rounded-full border-rose-200 bg-white" onClick={() => void loadSnapshots()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !dashboardWorkflow && !storeWorkflow ? <LoadingCard /> : null}

      {(dashboardWorkflow || storeWorkflow || selectedApproval) && !loading ? (
        <>
          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Current status</CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">{currentStatusCopy}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(currentUiStatus))}>
                    {currentStatusLabel}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", approvalTone)}>
                    {approvalStateLabel}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <DetailBlock
                    label="Asset in focus"
                    value={currentAssetBeingReviewed}
                    helper={assetReference ? `Asset ID: ${assetReference}` : "No asset reference available."}
                  />
                  <DetailBlock
                    label="Handled time"
                    value={currentOutcomeTime ? formatHandledTime(currentOutcomeTime) : "Not yet handled"}
                    helper="Latest checked or handled time."
                  />
                  <DetailBlock
                    label="Next step"
                    value={primaryAction.description}
                    helper={livePublishLabel}
                  />
                </div>
                <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">{currentOutcomeCopy}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {blockers.length > 0 ? blockers[0] : "The scheduler is waiting for the next safe step."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 xl:items-end">
                {actionButton}
                <p className="max-w-sm text-right text-sm leading-6 text-muted-foreground">{primaryAction.description}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest Outcome</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  What happened the last time the scheduler checked or moved this asset.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(latestOutcome?.result ?? currentUiStatus))}>
                    {getWorkflowStatusLabel(latestOutcome?.result ?? currentUiStatus)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {inferOutcomeStage(latestOutcome ?? { time: null, result: currentUiStatus, whatWasChecked: "Publishing scheduler", whatHappened: currentOutcomeCopy, actionNeeded: primaryAction.description, whyItBlocked: null, sourceLabel: null })}
                  </Badge>
                </div>

                <DetailBlock label="What happened" value={latestOutcome?.whatHappened ?? currentOutcomeCopy} />
                <DetailBlock
                  label="Asset being reviewed"
                  value={assetHeadline}
                  helper={assetContent ? "Caption, headline, and asset content are shown below in the review panel." : "No asset content was provided."}
                />
                <DetailBlock
                  label="Why it is blocked or pending"
                  value={latestOutcome?.whyItBlocked ?? blockers[0] ?? "No blockers are currently recorded."}
                />
                <DetailBlock
                  label="Action needed"
                  value={latestOutcome?.actionNeeded ?? primaryAction.description}
                />
                <DetailBlock
                  label="Reviewer / approval state"
                  value={currentApprovalReviewerState}
                  helper={selectedApproval ? `Approval state: ${approvalStateLabel}` : "No review state yet."}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Actions Needed</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  One clear next step, written for the client and backed by a working button.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">{primaryAction.description}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{currentStatusCopy}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {actionButton}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailBlock label="Review notes" value={assetApprovalNotes} />
                  <DetailBlock
                    label="Publishing readiness"
                    value={livePublishLabel}
                    helper={
                      livePublishReady
                        ? "All live execution checks are satisfied."
                        : "Live publish stays hidden until every required check is ready."
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm" id="publishing-checklist">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Publishing checklist</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                Live scheduling stays hidden until every item below is ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {checklist.map((item) => (
                  <ChecklistItemCard key={item.label} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Review Queue</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The current asset, media reference, review notes, and readiness state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedApproval ? (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3 rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected asset</p>
                        <p className="mt-1 text-lg font-semibold text-primary">{assetHeadline}</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", approvalTone)}>
                        {approvalStateLabel}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailBlock label="Media reference" value={formatAssetReference(assetMediaReference)} />
                      <DetailBlock label="Storage reference" value={formatAssetReference(assetStorageReference)} />
                    </div>

                    <DetailBlock
                      label="Content preview"
                      value={assetContent ?? "No content preview available."}
                      helper="Caption, headline, or content copy from the current asset."
                    />
                  </div>

                  <div className="space-y-3 rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
                    <DetailBlock label="G4 review status" value={assetSnapshot?.g4ReviewStatus ?? "Not available"} />
                    <DetailBlock label="Risk summary" value={assetRiskSummary} />
                    <DetailBlock label="Approval notes" value={assetApprovalNotes} />

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" className="h-10 rounded-full px-4" onClick={openReviewModal}>
                        <BadgeCheck className="mr-2 h-4 w-4" />
                        {selectedApproval?.status === "PENDING"
                          ? "Review Pending Asset"
                          : selectedApproval?.status === "APPROVED"
                            ? "Open Review"
                            : "Review Asset"}
                      </Button>
                      {approvalApproved && !dryRunSucceeded ? (
                        <Button type="button" variant="outline" className="h-10 rounded-full border-border/70 bg-white px-4" onClick={() => void runPublishingAction("dry_run")}>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Run Publishing Dry Run
                        </Button>
                      ) : null}
                      {livePublishReady ? (
                        <Button type="button" variant="outline" className="h-10 rounded-full border-border/70 bg-white px-4" onClick={() => void runPublishingAction("schedule")}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Schedule Approved Asset
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 p-5 text-sm leading-6 text-muted-foreground">
                  No asset is waiting for review right now. Refresh the scheduler to load the latest approval state.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Outcomes</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                The latest approval, dry-run, schedule, and publish events, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>Action needed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOutcomes.length ? (
                    recentOutcomes.map((outcome, index) => (
                      <TableRow key={`${outcome.time ?? "outcome"}-${index}`}>
                        <TableCell className="align-top whitespace-nowrap font-medium text-foreground">{formatHandledTime(outcome.time)}</TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                            {inferOutcomeStage(outcome)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getWorkflowStatusTone(outcome.result))}>
                            {getWorkflowStatusLabel(outcome.result)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                          <div className="space-y-2">
                            <p>{outcome.whatHappened}</p>
                            <p className="text-sm leading-6 text-muted-foreground">{outcome.whatWasChecked}</p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">{outcome.actionNeeded}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No publishing outcomes have been recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-[1180px] overflow-y-auto rounded-[28px] border-border/60 bg-white p-0 shadow-2xl">
          <div className="space-y-6 p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">
                {selectedApproval?.status === "APPROVED"
                  ? "Review Approved Asset"
                  : selectedApproval?.status === "CHANGES_REQUESTED"
                    ? "Review Fix Request"
                    : selectedApproval?.status === "REJECTED"
                      ? "Review Rejection"
                      : "Review Pending Asset"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Review the asset, note the risk, and choose the next safe step.
              </DialogDescription>
            </DialogHeader>

            {selectedApproval ? (
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asset headline</p>
                        <p className="text-xl font-semibold text-primary">{assetHeadline}</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", approvalTone)}>
                        {approvalStateLabel}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">{assetContent ?? "No content preview available."}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <DetailBlock label="Headline" value={assetSnapshot?.headline ?? selectedApproval.summary} />
                    <DetailBlock label="Caption" value={assetCaption} />
                    <DetailBlock label="Media reference" value={formatAssetReference(assetMediaReference)} />
                    <DetailBlock label="Storage reference" value={formatAssetReference(assetStorageReference)} />
                    <DetailBlock label="Asset ID" value={assetReference ?? "Not available"} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <DetailBlock label="G4 review status" value={assetSnapshot?.g4ReviewStatus ?? "Not available"} />
                    <DetailBlock label="Risk summary" value={assetRiskSummary} />
                  </div>

                  <div className="rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Approval notes</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{assetApprovalNotes}</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reviewer note</p>
                    <Textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      placeholder="Add a short note for the reviewer."
                      rows={7}
                      className="min-h-40 rounded-3xl border-border/70 bg-white"
                    />
                  </div>

                  <div className="space-y-2 rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Current approval state</p>
                    <p className="text-sm leading-6 text-muted-foreground">{currentApprovalReviewerState}</p>
                  </div>

                  <div className="rounded-[22px] border border-border/60 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safety summary</p>
                    <div className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                      <p>G1: {g1Ready ? "Ready" : "Waiting"}</p>
                      <p>G2: {g2Ready ? "Clean" : "Waiting"}</p>
                      <p>G4: {g4Ready ? "Passed" : "Waiting"}</p>
                      <p>G7: {g7Ready ? "Ready" : "Missing"}</p>
                      <p>G8: {g8Ready ? "Ready" : "Missing"}</p>
                      <p>Rollback payload: {rollbackReady ? "Ready" : "Missing"}</p>
                      <p>Dry-run: {dryRunSucceeded ? "Passed" : "Not run yet"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4" onClick={() => setReviewOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedApproval?.status === "PENDING" ? (
                  <>
                    <Button
                      type="button"
                      className="h-11 rounded-full px-4"
                      disabled={savingAction !== null}
                      onClick={() => void submitApprovalDecision("APPROVED")}
                    >
                      Approve Asset
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 rounded-full px-4"
                      disabled={savingAction !== null}
                      onClick={() => void submitApprovalDecision("REJECTED")}
                    >
                      Reject Asset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full border-border/70 bg-white px-4"
                      disabled={savingAction !== null}
                      onClick={() => void submitApprovalDecision("REQUEST_CHANGES")}
                    >
                      Request Fix
                    </Button>
                  </>
                ) : null}

                {selectedApproval?.status === "APPROVED" && !dryRunSucceeded ? (
                  <Button type="button" className="h-11 rounded-full px-4" disabled={savingAction !== null} onClick={() => void runPublishingAction("dry_run")}>
                    Run Publishing Dry Run
                  </Button>
                ) : null}

                {selectedApproval?.status === "APPROVED" && dryRunSucceeded && livePublishReady ? (
                  <Button type="button" className="h-11 rounded-full px-4" disabled={savingAction !== null} onClick={() => void runPublishingAction("schedule")}>
                    Schedule Approved Asset
                  </Button>
                ) : null}

                {(selectedApproval?.status === "CHANGES_REQUESTED" || selectedApproval?.status === "REJECTED" || (selectedApproval?.status === "APPROVED" && dryRunSucceeded && !livePublishReady)) ? (
                  <Button type="button" className="h-11 rounded-full px-4" disabled={savingAction !== null} onClick={scrollToChecklist}>
                    Review Blockers
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowDashboardShell>
  );
}
