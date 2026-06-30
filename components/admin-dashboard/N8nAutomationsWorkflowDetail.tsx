"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, Clock3, History, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import {
  buildFallbackDetail,
  formatDateTime,
  formatRelativeTime,
  normalizeWorkflowGroup,
  statusToneClasses,
  type N8nApprovalRecord,
  type N8nAuditLogRecord,
  type N8nExecutionRecord,
  type N8nWorkflowCard,
  type N8nWorkflowDetailResponse,
} from "@/components/admin-dashboard/n8n-automations-common";
import { CevonneWorkflowGroup } from "@/lib/cevonne/admin-model";

const buildRouteUrl = (path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value && value.trim()) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
};

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

type WorkflowDetailCopy = {
  name: string;
  description: string;
  whatCameIn: string;
  whatWasChecked: string;
  whatHappenedNext: string;
  approveIfApproved: string;
  approveIfRejected: string;
  approvalPrompt: string;
};

const WORKFLOW_DETAIL_COPY: Record<CevonneWorkflowGroup, WorkflowDetailCopy> = {
  G1: {
    name: "Safety Check",
    description: "Checks every risky action before it can continue.",
    whatCameIn: "A workflow asked for a safety check.",
    whatWasChecked: "Safety rules, required approvals, and blocked actions.",
    whatHappenedNext: "The workflow continued only when the checks passed.",
    approveIfApproved: "If you approve, the workflow will continue to the next safe step.",
    approveIfRejected: "If you reject, the workflow stops and the decision is recorded.",
    approvalPrompt: "Review the safety check, then approve or reject the next step.",
  },
  G2: {
    name: "Account Health Monitor",
    description: "Watches account and policy health so unsafe actions are paused.",
    whatCameIn: "Account or policy health information was checked.",
    whatWasChecked: "Account health, policy warnings, and escalation risk.",
    whatHappenedNext: "The workflow paused risky actions or confirmed the account was healthy.",
    approveIfApproved: "If you approve, the workflow can continue after the health check.",
    approveIfRejected: "If you reject, the workflow stays paused and needs a human review.",
    approvalPrompt: "Review the health check, then approve or reject the next step.",
  },
  G3: {
    name: "Customer Consent & Tracking",
    description: "Stores consent, opt-outs, purchases, and privacy requests.",
    whatCameIn: "A customer submitted a consent, opt-out, purchase, or privacy event.",
    whatWasChecked: "Customer identity, consent status, opt-out state, and event validity.",
    whatHappenedNext: "The customer record was updated and the event was logged.",
    approveIfApproved: "If you approve, the customer workflow can continue safely.",
    approveIfRejected: "If you reject, the workflow keeps the record unchanged and logs the decision.",
    approvalPrompt: "Review the customer event, then approve or reject the next step.",
  },
  G4: {
    name: "Content Review",
    description: "Reviews captions, claims, landing pages, and creatives before approval.",
    whatCameIn: "A caption, claim, landing page, or creative was sent for review.",
    whatWasChecked: "Claims, wording, sources, and approval requirements.",
    whatHappenedNext: "The content stayed in review until someone approved it.",
    approveIfApproved: "If you approve, the content can move to the next safe step.",
    approveIfRejected: "If you reject, the content stays in review and will not move forward.",
    approvalPrompt: "Review the content, then approve or reject it.",
  },
  G5: {
    name: "Asset Approval + Manual Publishing Queue",
    description: "Tracks approved assets until manual publish proof is saved.",
    whatCameIn: "An approved G4 asset was ready for human approval and manual publishing.",
    whatWasChecked: "Approval status, media availability, readiness, and post proof.",
    whatHappenedNext: "The workflow kept the asset in queue until approval and manual publish proof were recorded.",
    approveIfApproved: "If you approve, the asset can continue to readiness and manual publish proof.",
    approveIfRejected: "If you reject, the asset stays paused and will not move forward.",
    approvalPrompt: "Review the asset queue item, then approve or reject it.",
  },
  G6: {
    name: "Messaging & Recovery",
    description: "Handles quiz, WhatsApp, recovery, and safe message routing.",
    whatCameIn: "A messaging or recovery request arrived.",
    whatWasChecked: "Consent, partner routing, and message safety.",
    whatHappenedNext: "The workflow kept messaging paused until the safe route was confirmed.",
    approveIfApproved: "If you approve, the workflow can continue through the safe partner route.",
    approveIfRejected: "If you reject, messaging stays paused and the request remains in review.",
    approvalPrompt: "Review the messaging route, then approve or reject it.",
  },
  G7: {
    name: "Stock & Offer Check",
    description: "Checks stock, discounts, and urgency claims before use.",
    whatCameIn: "An offer or urgency claim was sent for checking.",
    whatWasChecked: "Stock proof, discount proof, and offer safety.",
    whatHappenedNext: "The workflow paused the claim until proof was available.",
    approveIfApproved: "If you approve, the offer can continue to the next safe step.",
    approveIfRejected: "If you reject, the offer stays paused until the proof is ready.",
    approvalPrompt: "Review the stock or offer check, then approve or reject it.",
  },
  G8: {
    name: "Customer Content Rights",
    description: "Checks permission before customer or creator content is reused.",
    whatCameIn: "Customer or creator content was sent for rights review.",
    whatWasChecked: "Permission, disclosure proof, and usage rights.",
    whatHappenedNext: "The workflow kept the content blocked until rights were confirmed.",
    approveIfApproved: "If you approve, the content can be used in the approved way.",
    approveIfRejected: "If you reject, the content remains blocked until rights are proven.",
    approvalPrompt: "Review the rights proof, then approve or reject it.",
  },
  G9: {
    name: "Ads Review",
    description: "Reviews ad recommendations and waits for approval before changes.",
    whatCameIn: "Ad performance data and a budget recommendation arrived.",
    whatWasChecked: "Audience safety, account health, budget guard, and approval requirement.",
    whatHappenedNext: "The workflow created a dry-run recommendation and is waiting for admin approval.",
    approveIfApproved: "If you approve, the workflow can continue to the next safe step. A live ad change has not happened yet.",
    approveIfRejected: "If you reject, the recommendation is stopped and the ad account stays unchanged.",
    approvalPrompt: "Review the ad recommendation, then approve or reject it.",
  },
  G10: {
    name: "Website Growth Review",
    description: "Reviews SEO and conversion ideas safely.",
    whatCameIn: "A website growth idea or experiment was sent for review.",
    whatWasChecked: "Source safety, experiment readiness, and conversion risk.",
    whatHappenedNext: "The workflow kept the idea in review until it was safe to continue.",
    approveIfApproved: "If you approve, the workflow can continue to the next safe step.",
    approveIfRejected: "If you reject, the idea stays in review and nothing changes live.",
    approvalPrompt: "Review the website growth idea, then approve or reject it.",
  },
  G11: {
    name: "Business Recommendations",
    description: "Creates recommendations only. It does not make live changes.",
    whatCameIn: "A weekly business review request or recommendation request arrived.",
    whatWasChecked: "Recommendation-only rules and safety limits.",
    whatHappenedNext: "The workflow created a recommendation without making live changes.",
    approveIfApproved: "If you approve, the workflow can continue through the recommendation path.",
    approveIfRejected: "If you reject, the recommendation is recorded but no live change is made.",
    approvalPrompt: "Review the recommendation, then approve or reject it.",
  },
};

const APPROVAL_RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
};

const APPROVAL_COPY_BY_ACTION: Record<
  string,
  {
    title: string;
    why: string;
    nextStep: string;
    safetyStatus: string;
    approveIfApproved: string;
    approveIfRejected: string;
  }
> = {
  APPROVE_DRY_RUN: {
    title: "Dry-run ad recommendation",
    why: "This approval is needed before the Ads Review workflow can continue.",
    nextStep: "Review the recommendation, then choose Approve or Reject.",
    safetyStatus: "Current mode: Dry-run / no live ad change yet.",
    approveIfApproved: "If you approve, the workflow will continue to the next safe step.",
    approveIfRejected: "If you reject, the recommendation stops and the ad account stays unchanged.",
  },
  PUBLISH_BATCH: {
    title: "Publishing batch review",
    why: "This approval is needed before approved content can be scheduled.",
    nextStep: "Review the batch, then choose Approve or Reject.",
    safetyStatus: "Publishing is paused until the batch is approved.",
    approveIfApproved: "If you approve, the post can move into the publishing queue.",
    approveIfRejected: "If you reject, the post stays paused and will not be scheduled.",
  },
  CONFIRM_PARTNER_ROUTE: {
    title: "Partner route confirmation",
    why: "This approval is needed before messaging can continue through the verified partner route.",
    nextStep: "Confirm the route or reject to keep messaging paused.",
    safetyStatus: "No live messaging until the route is confirmed.",
    approveIfApproved: "If you approve, the workflow can continue through the safe partner route.",
    approveIfRejected: "If you reject, messaging stays paused and the request remains in review.",
  },
  VERIFY_RIGHTS: {
    title: "Creator rights review",
    why: "This approval checks permission and disclosure proof before customer or creator content is reused.",
    nextStep: "Review the rights proof, then choose Approve or Reject.",
    safetyStatus: "Rights proof required before use.",
    approveIfApproved: "If you approve, the content can be used in the approved way.",
    approveIfRejected: "If you reject, the content remains blocked until rights are proven.",
  },
  REVIEW_ACTION_PACKET: {
    title: "Draft action packet review",
    why: "This approval reviews the draft recommendation packet before any next step is taken.",
    nextStep: "Review the draft, then choose Approve or Reject.",
    safetyStatus: "Recommendation only. No live execution.",
    approveIfApproved: "If you approve, the workflow can continue through the recommendation path.",
    approveIfRejected: "If you reject, the recommendation is recorded but no live change is made.",
  },
  APPROVE_GROWTH_RECOMMENDATION: {
    title: "Growth recommendation review",
    why: "This approval checks the website growth suggestion before it can be used.",
    nextStep: "Review the recommendation, then choose Approve or Reject.",
    safetyStatus: "No live website changes yet.",
    approveIfApproved: "If you approve, the workflow can continue to the next safe step.",
    approveIfRejected: "If you reject, the idea stays in review and nothing changes live.",
  },
};

type ApprovalDetailCopy = {
  title: string;
  why: string;
  nextStep: string;
  safetyStatus: string;
  approveIfApproved: string;
  approveIfRejected: string;
};

const CLIENT_STATUS_LABEL: Record<string, string> = {
  PASS: "Working",
  ACTIVE: "Working",
  COMPLETE: "Working",
  BLOCK: "Blocked",
  ERROR: "Needs technical help",
  MANUAL_ONLY: "Needs review",
  REVIEW: "Needs review",
  PENDING: "Waiting",
  NOT_BUILT: "Not connected yet",
  DRY_RUN: "Testing only",
  RECOMMENDATION_ONLY: "Recommendation only",
};

const getFriendlyWorkflowCopy = (workflowGroup?: CevonneWorkflowGroup | null) => {
  if (!workflowGroup) {
    return {
      name: "Workflow",
      description: "Workflow details",
      whatCameIn: "A workflow event arrived.",
      whatWasChecked: "Safety checks and review rules.",
      whatHappenedNext: "The workflow moved forward if the checks passed.",
      approveIfApproved: "If you approve, the workflow continues to the next safe step.",
      approveIfRejected: "If you reject, the workflow stops and the decision is recorded.",
      approvalPrompt: "Review the workflow, then approve or reject it.",
    };
  }

  return WORKFLOW_DETAIL_COPY[workflowGroup];
};

const getFriendlyWorkflowName = (workflowGroup?: CevonneWorkflowGroup | null) => getFriendlyWorkflowCopy(workflowGroup).name;

const getClientStatusLabel = (workflow?: N8nWorkflowCard | null) => {
  if (!workflow) {
    return CLIENT_STATUS_LABEL.PENDING;
  }

  if (workflow.recommendationOnly || workflow.lifecycleState === "RECOMMENDATION_ONLY" || workflow.status === "RECOMMENDATION_ONLY") {
    return CLIENT_STATUS_LABEL.RECOMMENDATION_ONLY;
  }

  if (workflow.lifecycleState === "DRY_RUN" || workflow.status === "DRY_RUN") {
    return CLIENT_STATUS_LABEL.DRY_RUN;
  }

  if (workflow.lifecycleState === "NOT_BUILT" || workflow.status === "NOT_BUILT") {
    return CLIENT_STATUS_LABEL.NOT_BUILT;
  }

  if (workflow.lifecycleState === "REVIEW" || workflow.status === "MANUAL_ONLY") {
    return CLIENT_STATUS_LABEL.MANUAL_ONLY;
  }

  if (workflow.lifecycleState === "PENDING" || workflow.status === "PENDING") {
    return CLIENT_STATUS_LABEL.PENDING;
  }

  if (workflow.status === "BLOCK") {
    return CLIENT_STATUS_LABEL.BLOCK;
  }

  if (workflow.status === "ERROR") {
    return CLIENT_STATUS_LABEL.ERROR;
  }

  if (workflow.status === "PASS" || workflow.status === "ACTIVE" || workflow.status === "COMPLETE") {
    return CLIENT_STATUS_LABEL.COMPLETE;
  }

  return CLIENT_STATUS_LABEL[workflow.status] || CLIENT_STATUS_LABEL.PENDING;
};

const getApprovalDetailCopy = (workflowGroup: CevonneWorkflowGroup, approval: N8nApprovalRecord): ApprovalDetailCopy => {
  const friendlyWorkflow = getFriendlyWorkflowCopy(workflowGroup);

  if (workflowGroup === "G9") {
    return APPROVAL_COPY_BY_ACTION.APPROVE_DRY_RUN;
  }

  return APPROVAL_COPY_BY_ACTION[approval.actionType] ?? {
    title: `${friendlyWorkflow.name} approval`,
    why: `This approval is needed before ${friendlyWorkflow.name} can continue.`,
    nextStep: "Review the request, then choose Approve or Reject.",
    safetyStatus: approval.requireConfirmation ? "Confirmation required before approval." : "Standard review.",
    approveIfApproved: "If you approve, the workflow will continue to the next safe step.",
    approveIfRejected: "If you reject, the workflow stops and the decision is recorded.",
  };
};

const getApprovalStatusLabel = (status: N8nApprovalRecord["status"]) => APPROVAL_STATUS_LABELS[status] ?? status;

const getRiskLabel = (riskLevel: N8nApprovalRecord["riskLevel"]) => APPROVAL_RISK_LABELS[riskLevel] ?? riskLevel;

type ListResponse<T> = {
  [key: string]: unknown;
} & Record<string, T[]>;

const getActionPanelCopy = (workflow: N8nWorkflowCard, pendingApprovals: N8nApprovalRecord[]) => {
  const friendlyWorkflow = getFriendlyWorkflowCopy(workflow.group);

  if (!pendingApprovals.length) {
    return {
      title: "No admin action needed.",
      message: "This workflow is currently clear.",
      details: [] as string[],
      ctaLabel: null as string | null,
    };
  }

  return {
    title: "Action needed",
    message: `${pendingApprovals.length} item${pendingApprovals.length === 1 ? "" : "s"} need your review before ${friendlyWorkflow.name} can continue.`,
    details: pendingApprovals.slice(0, 3).map((approval) => getApprovalDetailCopy(workflow.group, approval).title),
    ctaLabel: "Review pending approvals",
  };
};

const formatApprovalActionType = (workflow: N8nWorkflowCard, approval: N8nApprovalRecord) => {
  return getApprovalDetailCopy(workflow.group, approval).title;
};

const getBannerCopy = (workflow: N8nWorkflowCard, pendingApprovals: N8nApprovalRecord[]) => {
  const friendlyWorkflow = getFriendlyWorkflowCopy(workflow.group);
  const statusLabel = getClientStatusLabel(workflow);
  const firstFailureReason = workflow.latestFailureReason?.trim();

  if (pendingApprovals.length > 0) {
    return {
      statusLabel,
      title: `${friendlyWorkflow.name} is waiting for your approval.`,
      message: `${pendingApprovals.length} item${pendingApprovals.length === 1 ? "" : "s"} need review before this workflow can continue.`,
      nextStep: "Review and approve or reject the pending items.",
      buttonLabel: "Review pending approvals",
      tabTarget: "approvals",
    };
  }

  if (workflow.status === "BLOCK" || workflow.status === "ERROR") {
    return {
      statusLabel,
      title: `${friendlyWorkflow.name} is blocked.`,
      message: workflow.safetyNote || firstFailureReason || "A safety issue is stopping the workflow.",
      nextStep: "Review the problem, then use Manual review if you need a human to step in.",
      buttonLabel: "Manual review",
      tabTarget: "actions",
    };
  }

  if (workflow.status === "MANUAL_ONLY" || workflow.lifecycleState === "REVIEW") {
    return {
      statusLabel,
      title: `${friendlyWorkflow.name} needs review.`,
      message: workflow.safetyNote || firstFailureReason || "A human review is required before the next safe step.",
      nextStep: "Open the approvals or review section to continue.",
      buttonLabel: "Review details",
      tabTarget: "actions",
    };
  }

  if (workflow.status === "DRY_RUN" || workflow.lifecycleState === "DRY_RUN") {
    return {
      statusLabel,
      title: `${friendlyWorkflow.name} is testing only.`,
      message: "No live change has happened yet.",
      nextStep: "Review the test result and continue when ready.",
      buttonLabel: "View details",
      tabTarget: "overview",
    };
  }

  if (workflow.status === "RECOMMENDATION_ONLY" || workflow.lifecycleState === "RECOMMENDATION_ONLY" || workflow.recommendationOnly) {
    return {
      statusLabel,
      title: `${friendlyWorkflow.name} is recommendation only.`,
      message: "It creates suggestions without making live changes.",
      nextStep: "Review the recommendation when you need it.",
      buttonLabel: "View details",
      tabTarget: "overview",
    };
  }

  return {
    statusLabel,
    title: `${friendlyWorkflow.name} is working normally.`,
    message: "No action is needed right now.",
    nextStep: "You can check the latest activity or move to the next tab if you want more detail.",
    buttonLabel: null as string | null,
    tabTarget: null as string | null,
  };
};

const getWhatHappenedCopy = (workflow: N8nWorkflowCard, _latestExecution?: N8nExecutionRecord | null) => {
  const friendlyWorkflow = getFriendlyWorkflowCopy(workflow.group);

  return {
    whatCameIn: friendlyWorkflow.whatCameIn,
    whatWasChecked: friendlyWorkflow.whatWasChecked,
    whatHappenedNext: friendlyWorkflow.whatHappenedNext,
  };
};

const getRecentActivityLabel = (workflow: N8nWorkflowCard, execution: N8nExecutionRecord) => {
  const type = execution.responseType.toUpperCase();

  if (type.includes("SAFE_TEST")) {
    return "Safe test completed";
  }

  if (type.includes("APPROVAL")) {
    if (execution.status === "PASS") return "Approval was recorded";
    if (execution.status === "BLOCK") return "Approval was rejected";
    return "Approval is waiting for review";
  }

  if (workflow.group === "G3") {
    if (type.includes("CONSENT")) return "Customer consent was recorded";
    if (type.includes("OPT_OUT")) return "Customer opt-out was recorded";
    if (type.includes("PURCHASE")) return "Purchase event was recorded";
    if (type.includes("PRIVACY")) return "Privacy request was recorded";
    return "Customer activity was recorded";
  }

  if (workflow.group === "G9" && type.includes("RECOMMENDATION")) {
    return "Dry-run recommendation was created";
  }

  if (workflow.group === "G11") {
    if (type.includes("DIGEST")) return "Weekly recommendation was created";
    if (type.includes("RECOMMENDATION")) return "Decision recommendation was created";
    if (type.includes("DRAFT")) return "Draft action packet was created";
    return "Recommendation was created";
  }

  if (type.includes("BLOCKED")) return "A safety check stopped the workflow";
  if (type.includes("PENDING")) return "The workflow is waiting for review";
  if (type.includes("COMPLETE") || execution.status === "PASS" || execution.status === "ACTIVE") return "Workflow completed successfully";

  return "Workflow activity was recorded";
};

type TimelineItem = {
  timestamp: string;
  label: string;
  status: "success" | "warning" | "neutral" | "blocked";
  icon: typeof CheckCircle2;
};

const getRecentActivityTimeline = (
  workflow: N8nWorkflowCard,
  latestExecutions: N8nExecutionRecord[],
  workflowApprovals: N8nApprovalRecord[],
): TimelineItem[] => {
  const items: TimelineItem[] = latestExecutions.slice(0, 4).map((execution) => {
    const isBlocked = execution.status === "BLOCK" || execution.status === "ERROR";
    const isWarning = execution.status === "MANUAL_ONLY" || execution.status === "PENDING" || execution.status === "DRY_RUN";

    return {
      timestamp: execution.executedAt,
      label: getRecentActivityLabel(workflow, execution),
      status: isBlocked ? "blocked" : isWarning ? "warning" : "success",
      icon: isBlocked ? AlertTriangle : isWarning ? Clock3 : CheckCircle2,
    };
  });

  const latestPendingApproval = workflowApprovals.find((approval) => approval.status === "PENDING");
  if (latestPendingApproval) {
    items.unshift({
      timestamp: latestPendingApproval.createdAt,
      label: `Approval requested: ${getApprovalDetailCopy(workflow.group, latestPendingApproval).title}`,
      status: "warning",
      icon: Clock3,
    });
  }

  if (workflow.pendingApprovalsCount > 0) {
    items.unshift({
      timestamp: workflow.lastRunAt,
      label: `${workflow.pendingApprovalsCount} item${workflow.pendingApprovalsCount === 1 ? "" : "s"} are waiting for review`,
      status: "warning",
      icon: History,
    });
  } else if (items.length === 0) {
    items.unshift({
      timestamp: workflow.lastRunAt,
      label: "No recent activity yet",
      status: "neutral",
      icon: Clock3,
    });
  }

  return items.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()).slice(0, 5);
};

export default function N8nAutomationsWorkflowDetail({ workflowGroup }: { workflowGroup: CevonneWorkflowGroup }) {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const normalizedWorkflowGroup = normalizeWorkflowGroup(workflowGroup) ?? workflowGroup;
  const fallbackDetail = useMemo(() => buildFallbackDetail(normalizedWorkflowGroup), [normalizedWorkflowGroup]);

  const [detail, setDetail] = useState<N8nWorkflowDetailResponse | null>(null);
  const [executions, setExecutions] = useState<N8nExecutionRecord[]>([]);
  const [approvals, setApprovals] = useState<N8nApprovalRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<N8nAuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [approvalActionPendingId, setApprovalActionPendingId] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [g2HealthStatus, setG2HealthStatus] = useState<"OK" | "WARNING" | "BLOCKED">("OK");
  const [g2Notes, setG2Notes] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const routeGroup = normalizedWorkflowGroup;
      const [detailResponse, executionsResponse, approvalsResponse, auditResponse] = await Promise.all([
        request(buildRouteUrl(`/api/cevonne/admin/workflows/${routeGroup}`)),
        request(buildRouteUrl("/api/cevonne/admin/executions", { workflowGroup: routeGroup })),
        request(buildRouteUrl("/api/cevonne/admin/approvals", { workflowGroup: routeGroup })),
        request(buildRouteUrl("/api/cevonne/admin/audit-logs", { workflowGroup: routeGroup })),
      ]);

      const detailBody = (await detailResponse.json().catch(() => fallbackDetail)) as N8nWorkflowDetailResponse | null;
      const executionsBody = (await executionsResponse.json().catch(() => ({ executions: [] }))) as ListResponse<N8nExecutionRecord>;
      const approvalsBody = (await approvalsResponse.json().catch(() => ({ approvals: [] }))) as ListResponse<N8nApprovalRecord>;
      const auditBody = (await auditResponse.json().catch(() => ({ audit_logs: [] }))) as ListResponse<N8nAuditLogRecord>;

      setDetail(detailBody?.workflow ? detailBody : fallbackDetail);
      setExecutions(executionsBody.executions?.length ? executionsBody.executions : detailBody?.latest_executions || fallbackDetail?.latest_executions || []);
      setApprovals(approvalsBody.approvals?.length ? approvalsBody.approvals : detailBody?.approvals || fallbackDetail?.approvals || []);
      setAuditLogs(auditBody.audit_logs?.length ? auditBody.audit_logs : detailBody?.audit_logs || fallbackDetail?.audit_logs || []);
    } catch (error) {
      console.error("Failed to load workflow detail", error);
      setDetail(fallbackDetail);
      setExecutions(fallbackDetail?.latest_executions || []);
      setApprovals(fallbackDetail?.approvals || []);
      setAuditLogs(fallbackDetail?.audit_logs || []);
      toast.error("Unable to load workflow details");
    } finally {
      setLoading(false);
    }
  }, [fallbackDetail, normalizedWorkflowGroup, request]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const workflow = detail?.workflow || fallbackDetail?.workflow;
  const latestExecutions = useMemo(
    () => (executions.length ? executions : detail?.latest_executions || fallbackDetail?.latest_executions || []),
    [executions, detail, fallbackDetail],
  );
  const workflowApprovals = useMemo(
    () => (approvals.length ? approvals : detail?.approvals || fallbackDetail?.approvals || []),
    [approvals, detail, fallbackDetail],
  );
  const workflowAuditLogs = useMemo(
    () => (auditLogs.length ? auditLogs : detail?.audit_logs || fallbackDetail?.audit_logs || []),
    [auditLogs, detail, fallbackDetail],
  );
  const relatedG1Runs = useMemo(
    () => detail?.related_g1_compliance_runs || fallbackDetail?.related_g1_compliance_runs || [],
    [detail, fallbackDetail],
  );
  const pendingApprovals = useMemo(
    () => workflowApprovals.filter((approval) => approval.status === "PENDING"),
    [workflowApprovals],
  );
  const selectedApproval = useMemo(
    () =>
      workflowApprovals.find((approval) => approval.approvalId === selectedApprovalId) ||
      pendingApprovals[0] ||
      workflowApprovals[0] ||
      null,
    [pendingApprovals, selectedApprovalId, workflowApprovals],
  );

  useEffect(() => {
    if (!selectedApprovalId && pendingApprovals.length > 0) {
      setSelectedApprovalId(pendingApprovals[0].approvalId);
    }
  }, [pendingApprovals, selectedApprovalId]);

  useEffect(() => {
    if (selectedApprovalId && !workflowApprovals.some((approval) => approval.approvalId === selectedApprovalId)) {
      setSelectedApprovalId(pendingApprovals[0]?.approvalId ?? workflowApprovals[0]?.approvalId ?? null);
    }
  }, [pendingApprovals, selectedApprovalId, workflowApprovals]);
  const actionPanelCopy = workflow ? getActionPanelCopy(workflow, pendingApprovals) : null;
  const selectedApprovalCopy = workflow && selectedApproval ? getApprovalDetailCopy(workflow.group, selectedApproval) : null;
  const workflowCopy = workflow ? getFriendlyWorkflowCopy(workflow.group) : null;
  const bannerCopy = workflow ? getBannerCopy(workflow, pendingApprovals) : null;
  const whatHappenedCopy = workflow ? getWhatHappenedCopy(workflow, latestExecutions[0] ?? null) : null;
  const timelineItems = workflow ? getRecentActivityTimeline(workflow, latestExecutions, workflowApprovals) : [];
  const attentionCount = pendingApprovals.length;
  const attentionLabel =
    attentionCount > 0
      ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need review`
      : "No action needed";

  const safeTest = async () => {
    if (!workflow) return;
    setActionPending("safe-test");
    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/safe-test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_group: workflow.group }),
      });
      const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message || `Request failed (${response.status})`);
      }
      toast.success(body.message || "Safe test completed.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Unable to complete safe test");
    } finally {
      setActionPending(null);
    }
  };

  const manualReview = async () => {
    if (!workflow) return;
    const confirmed = window.confirm(`Send ${workflow.group} to manual review?`);
    if (!confirmed) return;

    setActionPending("manual-review");
    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/manual-review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_group: workflow.group,
          reason: "Admin dashboard manual review request",
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message || `Request failed (${response.status})`);
      }
      toast.message(body.message || "Manual review queued.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Unable to queue manual review");
    } finally {
      setActionPending(null);
    }
  };

  const scrollToApprovals = () => {
    setActiveTab("approvals");
    window.requestAnimationFrame(() => {
      document.getElementById("approvals-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openApprovalReview = (approval: N8nApprovalRecord) => {
    setSelectedApprovalId(approval.approvalId);
    scrollToApprovals();
  };

  const submitApprovalDecision = async (approval: N8nApprovalRecord, decision: "APPROVED" | "REJECTED") => {
    if (!workflow) return;

    if (decision === "APPROVED" && (approval.requireConfirmation || approval.riskLevel === "HIGH" || approval.riskLevel === "CRITICAL")) {
      const confirmed = window.confirm(
        "Are you sure you want to approve this action?\nThis will allow the workflow to continue after safety checks.",
      );
      if (!confirmed) {
        return;
      }
    }

    let reviewerNote = approval.summary;
    if (decision === "REJECTED") {
      const note = window.prompt("Reason for rejection", approval.summary);
      if (note === null) {
        return;
      }
      reviewerNote = note.trim() || approval.summary;
    }

    setApprovalActionPendingId(approval.approvalId);
    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/approval-decision"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowGroup: workflow.group,
          approvalId: approval.approvalId,
          decision,
          reviewerNote,
          confirmed: decision === "APPROVED",
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string; fail_reason?: string };
      if (!response.ok || body.status === "ERROR") {
        throw new Error(body.message || body.fail_reason || `Request failed (${response.status})`);
      }

      toast.success(body.message || "Approval updated.");
      await loadDetail();
      setSelectedApprovalId(approval.approvalId);
      scrollToApprovals();
    } catch (error: any) {
      toast.error(error?.message || "Unable to update approval");
    } finally {
      setApprovalActionPendingId(null);
    }
  };

  const refreshSection = async () => {
    await loadDetail();
  };

  const jumpToTab = (tab: string) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById("workflow-detail-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.82),_rgba(250,245,241,0.96))]" />
        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b border-border/60 bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <main className="space-y-6 px-4 pb-10 pt-6 md:px-8">
              <header className="overflow-hidden rounded-[2rem] border border-border/60 bg-white shadow-sm">
                <div className="flex flex-col gap-6 px-6 py-6 md:px-8 md:py-8 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-border/70 bg-muted/30 text-foreground hover:bg-muted/30">
                        <Sparkles className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                        N8N Automations
                      </Badge>
                      {workflow?.group === "G11" ? (
                        <Badge className="rounded-full border border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/30">Recommendation-only</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {workflow?.group || normalizedWorkflowGroup} - {workflow?.name || "Workflow detail"}
                      </h1>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                        {workflow?.purpose || "Workflow details"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" className="rounded-full border-border/70 bg-white shadow-none">
                      <Link href="/dashboard/n8n-automations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to N8N Automations
                      </Link>
                    </Button>
                    <Button variant="outline" className="rounded-full border-border/70 bg-white shadow-none" onClick={() => void refreshSection()}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </header>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <section className="min-w-0 space-y-6">
                  <Card className="border border-border/60 bg-white shadow-sm">
                    <CardHeader className="space-y-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`rounded-full border ${workflow ? statusToneClasses[workflow.status] : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                              {bannerCopy?.statusLabel || "Waiting"}
                            </Badge>
                            {workflow?.group === "G11" ? (
                              <Badge className="rounded-full border border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/30">
                                Recommendation only
                              </Badge>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <CardTitle className="text-2xl text-primary md:text-3xl">
                              {bannerCopy?.title || `${workflowCopy?.name || "Workflow"} is loading.`}
                            </CardTitle>
                            <CardDescription className="max-w-3xl text-base leading-7 text-foreground/70">
                              {bannerCopy?.message || workflowCopy?.description}
                            </CardDescription>
                            <p className="text-sm font-medium text-foreground">
                              Next step: {bannerCopy?.nextStep || "Review the details below."}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 lg:items-end">
                          {bannerCopy?.buttonLabel ? (
                            <Button className="rounded-full" onClick={() => (bannerCopy.tabTarget ? jumpToTab(bannerCopy.tabTarget) : void 0)}>
                              {bannerCopy.buttonLabel}
                            </Button>
                          ) : (
                            <p className="rounded-full border border-dashed border-border/70 bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
                              No action is needed right now.
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">This view is for guided review, not technical troubleshooting.</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current status</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{bannerCopy?.statusLabel || "Waiting"}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attention</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{attentionLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last activity</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {workflow?.lastRunAt ? formatRelativeTime(workflow.lastRunAt) : "No recent activity"}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" id="workflow-detail-tabs">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-white/85 p-1 sm:grid-cols-3 xl:grid-cols-6">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="actions">Actions needed</TabsTrigger>
                      <TabsTrigger value="approvals">Approvals</TabsTrigger>
                      <TabsTrigger value="activity">Recent activity</TabsTrigger>
                      <TabsTrigger value="logs">Logs</TabsTrigger>
                      <TabsTrigger value="technical">Technical details</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <Card className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <CardTitle className="text-lg text-primary">What happened?</CardTitle>
                            <CardDescription>Three plain-English steps that explain the current state.</CardDescription>
                          </div>
                          <Button variant="outline" className="rounded-full" onClick={() => jumpToTab("activity")}>
                            View recent activity
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {loading ? (
                            <div className="space-y-3">
                              <Skeleton className="h-24 w-full rounded-2xl" />
                              <Skeleton className="h-24 w-full rounded-2xl" />
                              <Skeleton className="h-24 w-full rounded-2xl" />
                            </div>
                          ) : workflow ? (
                            <>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border border-border/60 bg-white p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What came in</p>
                                  <p className="mt-2 text-sm leading-6 text-foreground">{whatHappenedCopy?.whatCameIn}</p>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-white p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What was checked</p>
                                  <p className="mt-2 text-sm leading-6 text-foreground">{whatHappenedCopy?.whatWasChecked}</p>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-white p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened next</p>
                                  <p className="mt-2 text-sm leading-6 text-foreground">{whatHappenedCopy?.whatHappenedNext}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What this workflow does</p>
                                <p className="mt-2 text-sm leading-6 text-foreground">{workflowCopy?.description || workflow.description}</p>
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">{workflowCopy?.approvalPrompt}</p>
                              </div>
                            </>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <CardTitle className="text-lg text-primary">Recent activity preview</CardTitle>
                            <CardDescription>A short plain-English sequence of what happened most recently.</CardDescription>
                          </div>
                          <Button variant="outline" className="rounded-full" onClick={() => jumpToTab("activity")}>
                            Open activity timeline
                          </Button>
                        </CardHeader>
                        <CardContent>
                          {latestExecutions.length === 0 && pendingApprovals.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              No recent activity yet. This workflow has not run recently.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {timelineItems.slice(0, 4).map((item) => {
                                const Icon = item.icon;
                                const toneClasses =
                                  item.status === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : item.status === "warning"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : item.status === "blocked"
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : "border-border/60 bg-muted/20 text-muted-foreground";

                                return (
                                  <div key={`${item.timestamp}-${item.label}`} className={`flex items-start gap-3 rounded-2xl border p-4 ${toneClasses}`}>
                                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {formatDateTime(item.timestamp)} · {formatRelativeTime(item.timestamp)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4">
                      <Card className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary">Action needed</CardTitle>
                          <CardDescription>Clear next steps for a non-technical admin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {pendingApprovals.length > 0 ? (
                            <>
                              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                                <p className="text-sm font-semibold text-foreground">{actionPanelCopy?.message}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Review each item below. Choose Approve if it should continue, or Reject if it should stop here.
                                </p>
                              </div>

                              <div className="space-y-3">
                                {pendingApprovals.map((approval, index) => {
                                  const approvalCopy = getApprovalDetailCopy(workflow!.group, approval);
                                  return (
                                    <div key={approval.approvalId} className="rounded-2xl border border-border/60 bg-white p-4">
                                      <p className="text-sm font-semibold text-foreground">
                                        {index + 1}. {approvalCopy.title}
                                      </p>
                                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{approval.summary}</p>
                                      <p className="mt-3 text-sm leading-6 text-foreground">{approvalCopy.why}</p>
                                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        Action: Review, then approve or reject.
                                      </p>
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => openApprovalReview(approval)}>
                                          Review details
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="rounded-full"
                                          disabled={approvalActionPendingId === approval.approvalId}
                                          onClick={() => void submitApprovalDecision(approval, "APPROVED")}
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="rounded-full"
                                          disabled={approvalActionPendingId === approval.approvalId}
                                          onClick={() => void submitApprovalDecision(approval, "REJECTED")}
                                        >
                                          Reject
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                                If you approve, the workflow continues to the next safe step. If you reject, this recommendation stops and the decision is recorded.
                              </div>

                              <Button className="rounded-full" onClick={scrollToApprovals}>
                                Review pending approvals
                              </Button>
                            </>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              No admin action needed. This workflow is currently clear.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {workflow?.group === "G2" ? (
                        <Card className="border border-border/60 bg-white/95 shadow-none">
                          <CardHeader>
                            <CardTitle className="text-lg text-primary">Account health update</CardTitle>
                            <CardDescription>Record a policy or account health state without external writes.</CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-3">
                            <Select value={g2HealthStatus} onValueChange={(value) => setG2HealthStatus(value as "OK" | "WARNING" | "BLOCKED")}>
                              <SelectTrigger className="w-full rounded-full">
                                <SelectValue placeholder="Health state" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="OK">OK</SelectItem>
                                <SelectItem value="WARNING">WARNING</SelectItem>
                                <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea value={g2Notes} onChange={(event) => setG2Notes(event.target.value)} placeholder="Optional note for the health update" />
                            <Button
                              className="rounded-full"
                              onClick={async () => {
                                if (!workflow) return;
                                setActionPending("g2-account-health-update");
                                try {
                                  const response = await request(buildRouteUrl("/api/cevonne/admin/g2-account-health-update"), {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      health_status: g2HealthStatus,
                                      notes: g2Notes || undefined,
                                    }),
                                  });
                                  const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
                                  if (!response.ok) {
                                    throw new Error(body.message || `Request failed (${response.status})`);
                                  }
                                  toast.success(body.message || "Account health updated.");
                                  await loadDetail();
                                } catch (error: any) {
                                  toast.error(error?.message || "Unable to update account health");
                                } finally {
                                  setActionPending(null);
                                }
                              }}
                              disabled={actionPending === "g2-account-health-update"}
                            >
                              Submit update
                            </Button>
                          </CardContent>
                        </Card>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="approvals" className="space-y-4">
                      <Card id="approvals-panel" className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary">Approvals</CardTitle>
                          <CardDescription>Review what is waiting, why it needs review, and what happens next.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedApproval && selectedApprovalCopy ? (
                            <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
                              <div className="flex flex-col gap-4">
                                <div className="space-y-2">
                                  <p className="text-lg font-semibold text-primary">{selectedApprovalCopy.title}</p>
                                  <p className="text-sm leading-6 text-muted-foreground">{selectedApprovalCopy.why}</p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="rounded-2xl border border-border/60 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What came in</p>
                                    <div className="mt-2 space-y-1 text-sm leading-6 text-foreground">
                                      <p>Approval type: {selectedApprovalCopy.title}</p>
                                      <p>Status: {getApprovalStatusLabel(selectedApproval.status)}</p>
                                      <p>Risk level: {getRiskLabel(selectedApproval.riskLevel)}</p>
                                      <p>Requested by: {selectedApproval.requestedBy}</p>
                                      <p>Requested at: {formatDateTime(selectedApproval.createdAt)}</p>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/60 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What was checked</p>
                                    <ul className="mt-2 space-y-1 text-sm leading-6 text-foreground">
                                      <li>- Workflow group: {workflow!.group}</li>
                                      <li>- Safety checks: {workflow!.requiredComplianceChecks.join(", ")}</li>
                                      <li>- Review mode: {selectedApproval.requireConfirmation ? "Explicit confirmation required" : "Standard review"}</li>
                                    </ul>
                                  </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="rounded-2xl border border-border/60 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What will happen next</p>
                                    <p className="mt-2 text-sm leading-6 text-foreground">{selectedApprovalCopy.nextStep}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedApprovalCopy.approveIfApproved}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedApprovalCopy.approveIfRejected}</p>
                                  </div>

                                  <div className="rounded-2xl border border-border/60 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safety status</p>
                                    <p className="mt-2 text-sm leading-6 text-foreground">{selectedApprovalCopy.safetyStatus}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">No live external action will happen unless the workflow is approved and allowed by its safety rules.</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => void openApprovalReview(selectedApproval)}>
                                    Review details
                                  </Button>
                                  {selectedApproval.status === "PENDING" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="rounded-full"
                                        disabled={approvalActionPendingId === selectedApproval.approvalId}
                                        onClick={() => void submitApprovalDecision(selectedApproval, "APPROVED")}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="rounded-full"
                                        disabled={approvalActionPendingId === selectedApproval.approvalId}
                                        onClick={() => void submitApprovalDecision(selectedApproval, "REJECTED")}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  ) : null}
                                </div>

                                <details className="rounded-2xl border border-border/60 bg-white p-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-primary">Technical details</summary>
                                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                                    <p>Approval ID: {selectedApproval.approvalId}</p>
                                    <p>Public ID: {selectedApproval.publicId}</p>
                                    <p>Internal action code: {selectedApproval.actionType}</p>
                                    <p>Internal status: {selectedApproval.status}</p>
                                    <p>Internal risk code: {selectedApproval.riskLevel}</p>
                                    <p>Confirmation required: {selectedApproval.requireConfirmation ? "Yes" : "No"}</p>
                                    <p>Reviewer note: {selectedApproval.reviewerAction || "None"}</p>
                                  </div>
                                </details>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              No approvals waiting. This workflow has nothing for you to review right now.
                            </div>
                          )}

                          {workflowApprovals.length ? (
                            <div className="space-y-3">
                              {workflowApprovals.map((approval) => (
                                <div
                                  key={approval.approvalId}
                                  className={`rounded-2xl border p-4 text-sm ${
                                    selectedApproval?.approvalId === approval.approvalId ? "border-border/60 bg-muted/20" : "border-border/60 bg-white"
                                  }`}
                                >
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">{formatApprovalActionType(workflow!, approval)}</p>
                                      <p className="text-sm leading-6 text-muted-foreground">{approval.summary}</p>
                                    </div>

                                    <div className="grid gap-2 md:grid-cols-2">
                                      <div className="space-y-1 text-xs text-muted-foreground">
                                        <p>
                                          Status: <span className="font-medium text-foreground">{getApprovalStatusLabel(approval.status)}</span>
                                        </p>
                                        <p>
                                          Risk: <span className="font-medium text-foreground">{getRiskLabel(approval.riskLevel)}</span>
                                        </p>
                                        <p>
                                          Requested by: <span className="font-medium text-foreground">{approval.requestedBy}</span>
                                        </p>
                                      </div>
                                      <div className="space-y-1 text-xs text-muted-foreground md:text-right">
                                        <p>Requested at: {formatDateTime(approval.createdAt)}</p>
                                        <p>{approval.requireConfirmation ? "Confirmation needed for approval" : "Standard review"}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => openApprovalReview(approval)}>
                                        Review details
                                      </Button>
                                      {approval.status === "PENDING" ? (
                                        <>
                                          <Button
                                            size="sm"
                                            className="rounded-full"
                                            disabled={approvalActionPendingId === approval.approvalId}
                                            onClick={() => void submitApprovalDecision(approval, "APPROVED")}
                                          >
                                            Approve
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            className="rounded-full"
                                            disabled={approvalActionPendingId === approval.approvalId}
                                            onClick={() => void submitApprovalDecision(approval, "REJECTED")}
                                          >
                                            Reject
                                          </Button>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="activity" className="space-y-4">
                      <Card className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary">Recent activity</CardTitle>
                          <CardDescription>A simple sequence of events, written for a non-technical client.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {latestExecutions.length === 0 && pendingApprovals.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              No recent activity yet. This workflow has not run recently.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {timelineItems.map((item) => {
                                const Icon = item.icon;
                                const toneClasses =
                                  item.status === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : item.status === "warning"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : item.status === "blocked"
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : "border-border/60 bg-muted/20 text-muted-foreground";

                                return (
                                  <div key={`${item.timestamp}-${item.label}`} className={`flex items-start gap-3 rounded-2xl border p-4 ${toneClasses}`}>
                                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="logs" className="space-y-4">
                      <Card id="executions" className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg text-primary">Latest executions</CardTitle>
                            <CardDescription>Backend execution records for this workflow only.</CardDescription>
                          </div>
                          <Button variant="outline" className="rounded-full" onClick={() => void refreshSection()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Response</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Failure reason</TableHead>
                                <TableHead>Executed</TableHead>
                                <TableHead>Actor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loading ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                    Loading executions...
                                  </TableCell>
                                </TableRow>
                              ) : latestExecutions.length ? (
                                latestExecutions.map((execution) => (
                                  <TableRow key={execution.executionId}>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">{execution.responseType}</p>
                                        <p className="text-xs text-muted-foreground">{execution.routeName}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={`rounded-full border ${statusToneClasses[execution.status]}`}>{execution.status}</Badge>
                                    </TableCell>
                                    <TableCell>{execution.failureReason || "None"}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p>{formatDateTime(execution.executedAt)}</p>
                                        <p className="text-xs text-muted-foreground">{formatRelativeTime(execution.executedAt)}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>{execution.actor === "admin" ? execution.adminEmail || execution.adminUserId || "Admin" : "Website"}</TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                    No execution records loaded.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      <Card id="audit-logs" className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg text-primary">Audit logs</CardTitle>
                            <CardDescription>Safe admin audit records only.</CardDescription>
                          </div>
                          <Button variant="outline" className="rounded-full" onClick={() => void refreshSection()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Payload summary</TableHead>
                                <TableHead>Timestamp</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loading ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                                    Loading audit logs...
                                  </TableCell>
                                </TableRow>
                              ) : workflowAuditLogs.length ? (
                                workflowAuditLogs.map((log) => (
                                  <TableRow key={log.auditId}>
                                    <TableCell>{log.actionType}</TableCell>
                                    <TableCell>
                                      <Badge className={`rounded-full border ${statusToneClasses[log.resultStatus]}`}>{log.resultStatus}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[320px] truncate" title={log.payloadSummary}>
                                      {log.payloadSummary}
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p>{formatDateTime(log.timestamp)}</p>
                                        <p className="text-xs text-muted-foreground">{formatRelativeTime(log.timestamp)}</p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                                    No audit logs loaded.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="technical" className="space-y-4">
                      <Card className="border border-border/60 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary">Technical details</CardTitle>
                          <CardDescription>Hidden by default in the main flow, but available here when you need it.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <p className="text-sm font-semibold text-primary">Connected backend routes</p>
                            <div className="flex flex-wrap gap-2">
                              {workflow?.connectedBackendRoutes.map((route) => (
                                <Badge key={route} variant="secondary" className="rounded-full font-mono text-[10px]">
                                  {route}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-4">
                            <p className="text-sm font-semibold text-primary">Safety checks</p>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {workflow?.requiredComplianceChecks.map((check) => (
                                <li key={check} className="flex items-start gap-2">
                                  <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                                  <span>{check}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-4">
                            <p className="text-sm font-semibold text-primary">Related G1 compliance runs</p>
                            <div className="space-y-2">
                              {relatedG1Runs.length ? (
                                relatedG1Runs.map((execution) => (
                                  <div key={execution.executionId} className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm">
                                    <p className="font-medium text-foreground">{execution.responseType}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(execution.executedAt)}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No related G1 runs are loaded for this workflow yet.</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-4">
                            <p className="text-sm font-semibold text-primary">Failure reasons</p>
                            {workflow?.latestFailureReason ? (
                              <p className="text-sm text-muted-foreground">{workflow.latestFailureReason}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">No problems found. The workflow is clear.</p>
                            )}
                            {latestExecutions.some((execution) => execution.failureReason) ? (
                              <div className="space-y-2">
                                {latestExecutions
                                  .filter((execution) => execution.failureReason)
                                  .slice(0, 2)
                                  .map((execution) => (
                                    <div key={execution.executionId} className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm">
                                      <p className="font-medium text-foreground">{execution.responseType}</p>
                                      <p className="text-xs text-muted-foreground">{execution.failureReason}</p>
                                    </div>
                                  ))}
                              </div>
                            ) : null}
                          </div>

                          <details className="rounded-2xl border border-border/60 bg-white p-4">
                            <summary className="cursor-pointer text-sm font-semibold text-primary">Technical details</summary>
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              <p>Workflow status code: {workflow?.status || "Unknown"}</p>
                              <p>Lifecycle state: {workflow?.lifecycleState || "Unknown"}</p>
                              <p>Latest execution status: {workflow?.latestExecutionStatus || "Unknown"}</p>
                              <p>Latest execution lifecycle: {workflow?.latestExecutionLifecycle || "Unknown"}</p>
                              <p>Latest public ID: {workflow?.latestPublicId || "Unknown"}</p>
                              <p>Latest execution ID: {workflow?.latestExecutionId || "Unknown"}</p>
                              <p>Route names: {workflow?.routeNames.join(", ") || "None"}</p>
                              <p>Required approvals: {workflow?.requiredApprovals.join(", ") || "None"}</p>
                              <p>Admin notes: {workflow?.adminNotes || "None"}</p>
                            </div>
                          </details>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </section>

                <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">At a glance</CardTitle>
                      <CardDescription>{workflowCopy?.description || workflow?.purpose || "Workflow detail summary"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20 w-full rounded-2xl" />
                          <Skeleton className="h-20 w-full rounded-2xl" />
                          <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>
                      ) : workflow ? (
                        <>
                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What this workflow is doing</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">{workflowCopy?.description || workflow.description}</p>
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Do you need to act?</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {attentionCount > 0 ? attentionLabel : "No action is needed right now."}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{bannerCopy?.nextStep}</p>
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happens if you approve or reject?</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {workflowCopy?.approveIfApproved}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflowCopy?.approveIfRejected}</p>
                            {workflow.group === "G9" ? (
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Approving this dry-run recommendation does not mean a live ad change has already happened. It only allows the approved
                                workflow path to continue according to the configured safety rules.
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safety note</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">{workflow.safetyNote}</p>
                            {workflow.adminNotes ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflow.adminNotes}</p> : null}
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">What to click next</CardTitle>
                      <CardDescription>Shortcuts for the next safe step.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full rounded-full" onClick={() => jumpToTab("approvals")}>
                        Review approvals
                      </Button>
                      <Button variant="outline" className="w-full rounded-full" onClick={() => jumpToTab("activity")}>
                        View recent activity
                      </Button>
                      <Button variant="outline" className="w-full rounded-full" onClick={() => jumpToTab("technical")}>
                        Show technical details
                      </Button>
                    </CardContent>
                  </Card>
                </aside>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
