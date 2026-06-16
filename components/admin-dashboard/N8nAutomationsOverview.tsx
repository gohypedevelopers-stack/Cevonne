"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Ban,
  Clock3,
  ExternalLink,
  RefreshCcw,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatRelativeTime,
  type N8nOverviewResponse,
  type N8nWorkflowCard,
} from "@/components/admin-dashboard/n8n-automations-common";
import { CevonneWorkflowGroup } from "@/lib/cevonne/admin-model";
import { WF1_WORKFLOW_ROUTE, WF1_WORKFLOW_TITLE, type Wf1DetailResponse } from "@/lib/wf1";

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();
const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const WORKFLOW_PILL_CLASS =
  "h-7 w-fit justify-center rounded-full px-2.5 py-0.5 text-[11px] font-medium normal-case leading-none tracking-[0.01em] whitespace-nowrap";
const SIDEBAR_PILL_CLASS =
  "h-6 w-fit justify-center rounded-full px-2 py-0.5 text-[10px] font-medium normal-case leading-none tracking-[0.01em] whitespace-nowrap";
const HEADER_CHIP_CLASS =
  "inline-flex h-10 min-w-[132px] items-center justify-center rounded-full px-3.5 text-center text-[11px] font-semibold normal-case leading-none whitespace-nowrap";

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

type WorkflowStatus = "Working" | "Needs Review" | "Blocked" | "Waiting";
type AttentionStatus = "No action needed" | "Review required" | "Blocked" | "Waiting for content" | "Waiting for approval";

type WorkflowSource = N8nWorkflowCard & {
  n8nUrl?: string | null;
  workflowUrl?: string | null;
  nextRunAt?: string | null;
  nextScheduledRunAt?: string | null;
};

type WorkflowRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: WorkflowStatus;
  statusTone: string;
  attention: AttentionStatus;
  attentionTone: string;
  lastActivityLabel: string;
  lastActivityTimestamp: number;
  nextRunLabel: string;
  detailHref: string;
  n8nUrl?: string | null;
};

type WorkflowCardProps = {
  row: WorkflowRow;
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accentClass: string;
};

const numberFormatter = new Intl.NumberFormat("en-IN");

const CATEGORY_LABELS: Record<CevonneWorkflowGroup, string> = {
  G1: "Compliance",
  G2: "Health monitor",
  G3: "Consent & CRM",
  G4: "Content review",
  G5: "Publishing",
  G6: "Messaging",
  G7: "Offer safety",
  G8: "Rights",
  G9: "Ads",
  G10: "SEO & CRO",
  G11: "Recommendations",
};

const WORKFLOW_STATUS_TONES: Record<WorkflowStatus, string> = {
  Working: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Needs Review": "border-amber-200 bg-amber-50 text-amber-700",
  Blocked: "border-rose-200 bg-rose-50 text-rose-700",
  Waiting: "border-sky-200 bg-sky-50 text-sky-700",
};

const ATTENTION_TONES: Record<AttentionStatus, string> = {
  "No action needed": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Review required": "border-amber-200 bg-amber-50 text-amber-700",
  Blocked: "border-rose-200 bg-rose-50 text-rose-700",
  "Waiting for content": "border-slate-200 bg-slate-100 text-slate-700",
  "Waiting for approval": "border-sky-200 bg-sky-50 text-sky-700",
};

const ATTENTION_LABELS: Record<AttentionStatus, string> = {
  "No action needed": "No action",
  "Review required": "Review",
  Blocked: "Blocked",
  "Waiting for content": "Waiting content",
  "Waiting for approval": "Waiting approval",
};

const EMPTY_OVERVIEW: N8nOverviewResponse = {
  summary: {
    total_workflows: 0,
    active_workflows: 0,
    manual_only_workflows: 0,
    blocked_error_workflows: 0,
    pending_approvals: 0,
    latest_execution_status: "PENDING",
    latest_execution_response_type: null,
    latest_execution_at: null,
  },
  workflows: [],
};

const WORKFLOW_SUMMARY_COPY: Record<CevonneWorkflowGroup, string> = {
  G1: "Blocks unsafe actions before they can continue.",
  G2: "Monitors account and policy health.",
  G3: "Keeps consent, attribution, and privacy events in sync.",
  G4: "Reviews claims, captions, and creative before approval.",
  G5: "Schedules approved assets only.",
  G6: "Routes messaging through safe partner paths.",
  G7: "Checks stock and offer proof before use.",
  G8: "Verifies rights and disclosure proof.",
  G9: "Keeps ad changes in dry-run mode until approved.",
  G10: "Reviews SEO and conversion ideas safely.",
  G11: "Generates recommendations without live writes.",
};

const createEmptyOverview = (): N8nOverviewResponse => ({
  summary: { ...EMPTY_OVERVIEW.summary },
  workflows: [],
});

const normalizeOverview = (body: N8nOverviewResponse | null): N8nOverviewResponse => {
  if (!body) {
    return createEmptyOverview();
  }

  return {
    summary: {
      ...EMPTY_OVERVIEW.summary,
      ...(body.summary ?? {}),
    },
    workflows: Array.isArray(body.workflows) ? body.workflows : [],
  };
};

const formatActivityLabel = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Never";
  }

  if (trimmed === "Today" || trimmed === "Yesterday" || trimmed === "Never") {
    return trimmed;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return formatRelativeTime(trimmed);
};

const parseActivityTimestamp = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed === "Today") {
    return Date.now();
  }

  if (trimmed === "Yesterday") {
    return Date.now() - 24 * 60 * 60 * 1000;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getWorkflowCategory = (group: CevonneWorkflowGroup) => CATEGORY_LABELS[group] ?? group;

const getWorkflowStatus = (workflow: N8nWorkflowCard): WorkflowStatus => {
  if (workflow.status === "BLOCK" || workflow.status === "ERROR") {
    return "Blocked";
  }

  if (workflow.status === "MANUAL_ONLY" || workflow.lifecycleState === "REVIEW") {
    return "Needs Review";
  }

  if (
    workflow.status === "PENDING" ||
    workflow.status === "NOT_BUILT" ||
    workflow.status === "DRY_RUN" ||
    workflow.status === "RECOMMENDATION_ONLY" ||
    workflow.lifecycleState === "PENDING" ||
    workflow.lifecycleState === "DRY_RUN" ||
    workflow.lifecycleState === "RECOMMENDATION_ONLY" ||
    workflow.lifecycleState === "NOT_BUILT"
  ) {
    return "Waiting";
  }

  return "Working";
};

const getWorkflowAttention = (workflow: N8nWorkflowCard): AttentionStatus => {
  if (workflow.status === "BLOCK" || workflow.status === "ERROR") {
    return "Blocked";
  }

  const failureReason = workflow.latestFailureReason?.toLowerCase() ?? "";
  const waitingForContent =
    workflow.status === "NOT_BUILT" ||
    workflow.lifecycleState === "NOT_BUILT" ||
    failureReason.includes("content") ||
    failureReason.includes("rights") ||
    failureReason.includes("proof") ||
    failureReason.includes("not confirmed");

  if (waitingForContent) {
    return "Waiting for content";
  }

  if (
    workflow.status === "PENDING" ||
    workflow.status === "DRY_RUN" ||
    workflow.status === "RECOMMENDATION_ONLY" ||
    workflow.lifecycleState === "PENDING" ||
    workflow.lifecycleState === "DRY_RUN" ||
    workflow.lifecycleState === "RECOMMENDATION_ONLY" ||
    workflow.pendingApprovalsCount > 0
  ) {
    return "Waiting for approval";
  }

  if (workflow.status === "MANUAL_ONLY" || workflow.lifecycleState === "REVIEW" || workflow.latestFailureReason) {
    return "Review required";
  }

  return "No action needed";
};

const getWf1Status = (status?: string | null): WorkflowStatus => {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (["blocked", "failed", "system error", "error"].includes(normalized)) {
    return "Blocked";
  }

  if (["needs review", "manual only"].includes(normalized)) {
    return "Needs Review";
  }

  if (["waiting", "dry run ready", "not started", "cancelled"].includes(normalized)) {
    return "Waiting";
  }

  return "Working";
};

const getWf1Attention = (workflow: NonNullable<Wf1DetailResponse["workflow"]>): AttentionStatus => {
  const message = workflow.attentionMessage?.toLowerCase() ?? "";
  const approvalStatus = workflow.approvalStatus?.toLowerCase() ?? "";

  if (message.includes("no action needed")) {
    return "No action needed";
  }

  if (message.includes("block") || workflow.status === "Blocked" || workflow.status === "Failed" || workflow.status === "System error") {
    return "Blocked";
  }

  if (message.includes("content") || workflow.bufferHealth === "Needs content") {
    return "Waiting for content";
  }

  if (message.includes("approval") || approvalStatus.includes("approval") || approvalStatus === "waiting for approval") {
    return "Waiting for approval";
  }

  return "Review required";
};

const getExternalWorkflowUrl = (workflow: WorkflowSource | NonNullable<Wf1DetailResponse["workflow"]>) => {
  const candidate = (workflow as WorkflowSource).n8nUrl ?? (workflow as WorkflowSource).workflowUrl ?? null;
  return typeof candidate === "string" && candidate.trim().length ? candidate.trim() : null;
};

const buildOverviewRow = (workflow: N8nWorkflowCard): WorkflowRow => {
  const source = workflow as WorkflowSource;
  const status = getWorkflowStatus(workflow);
  const attention = getWorkflowAttention(workflow);
  const nextRunValue = source.nextRunAt ?? source.nextScheduledRunAt ?? null;

  return {
    id: workflow.group,
    name: workflow.name,
    category: getWorkflowCategory(workflow.group),
    description: WORKFLOW_SUMMARY_COPY[workflow.group] ?? workflow.description,
    status,
    statusTone: WORKFLOW_STATUS_TONES[status],
    attention,
    attentionTone: ATTENTION_TONES[attention],
    lastActivityLabel: formatActivityLabel(workflow.lastRunAt),
    lastActivityTimestamp: parseActivityTimestamp(workflow.lastRunAt),
    nextRunLabel: nextRunValue ? (Number.isNaN(new Date(nextRunValue).getTime()) ? nextRunValue : formatDateTime(nextRunValue)) : "Not scheduled",
    detailHref: `/dashboard/n8n-automations/${workflow.group.toLowerCase()}`,
    n8nUrl: getExternalWorkflowUrl(source),
  };
};

const buildWf1Row = (workflow: NonNullable<Wf1DetailResponse["workflow"]>): WorkflowRow => {
  const status = getWf1Status(workflow.status);
  const attention = getWf1Attention(workflow);
  const nextRunLabel = workflow.nextScheduledPost?.trim() || "Not scheduled";

  return {
    id: WF1_WORKFLOW_ROUTE.split("/").pop() ?? "wf1-instagram-scheduler",
    name: WF1_WORKFLOW_TITLE,
    category: "Instagram",
    description: "Schedules approved Instagram content safely after review, approval, and compliance checks.",
    status,
    statusTone: WORKFLOW_STATUS_TONES[status],
    attention,
    attentionTone: ATTENTION_TONES[attention],
    lastActivityLabel: formatActivityLabel(workflow.lastActivity),
    lastActivityTimestamp: parseActivityTimestamp(workflow.lastActivity),
    nextRunLabel,
    detailHref: WF1_WORKFLOW_ROUTE,
    n8nUrl: getExternalWorkflowUrl(workflow),
  };
};

const sortByAttentionPriority = (label: AttentionStatus) => {
  switch (label) {
    case "Blocked":
      return 0;
    case "Review required":
      return 1;
    case "Waiting for approval":
      return 2;
    case "Waiting for content":
      return 3;
    default:
      return 4;
  }
};

const getAttentionLabel = (label: AttentionStatus) => ATTENTION_LABELS[label] ?? label;

function StatCard({ label, value, helper, icon, accentClass }: StatCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className={cn("h-1.5 w-full rounded-full", accentClass)} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="font-serif text-4xl leading-none tracking-tight text-foreground">{value}</p>
            <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
          </div>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-2xl" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="size-12 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  label,
  tone,
  className,
  compact = false,
}: {
  label: string;
  tone: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(compact ? SIDEBAR_PILL_CLASS : WORKFLOW_PILL_CLASS, tone, className)}
    >
      {label}
    </Badge>
  );
}

function WorkflowRowCard({ row }: WorkflowCardProps) {
  return (
    <Card className="rounded-2xl border-border/60 bg-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
            <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
          </div>
          <StatusBadge label={row.status} tone={row.statusTone} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={cn(WORKFLOW_PILL_CLASS, "border-border/70 bg-secondary/20 font-medium text-muted-foreground")}
          >
            {row.category}
          </Badge>
          <Badge variant="outline" className={cn(WORKFLOW_PILL_CLASS, row.attentionTone)}>
            {getAttentionLabel(row.attention)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="uppercase tracking-[0.18em] text-muted-foreground">Last activity</p>
            <p className="font-medium text-foreground">{row.lastActivityLabel}</p>
          </div>
          <div className="space-y-1 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="uppercase tracking-[0.18em] text-muted-foreground">Next run</p>
            <p className="font-medium text-foreground">{row.nextRunLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            variant="outline"
            size="xs"
            className="h-8 flex-1 rounded-full border-border/70 bg-white px-2.5 text-[11px] shadow-none"
          >
            <Link href={row.detailHref}>
              View Details
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>

          {row.n8nUrl ? (
            <Button
              asChild
              variant="outline"
              size="xs"
              className="h-8 flex-1 rounded-full border-border/70 bg-white px-2.5 text-[11px] shadow-none"
            >
              <a href={row.n8nUrl} target="_blank" rel="noreferrer" aria-label="Open in n8n">
                n8n
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowTable({
  loading,
  rows,
  onRefresh,
}: {
  loading: boolean;
  rows: WorkflowRow[];
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <>
        <div className="grid gap-3 px-6 pb-6 pt-4 lg:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border-border/60 bg-white shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded-full" />
                  <Skeleton className="h-9 flex-1 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="hidden min-w-0 px-4 pb-5 pt-4 lg:block">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[980px]">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="mb-3 grid grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.8fr)_minmax(0,1.15fr)] items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 shadow-sm last:mb-0"
                >
                  <Skeleton className="h-10 w-full rounded-2xl" />
                  <Skeleton className="h-8 w-full rounded-full" />
                  <Skeleton className="h-8 w-full rounded-full" />
                  <Skeleton className="h-8 w-full rounded-full" />
                  <Skeleton className="h-8 w-full rounded-full" />
                  <Skeleton className="h-8 w-full rounded-full" />
                  <Skeleton className="h-8 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!rows.length) {
    return (
      <div className="px-6 pb-6 pt-4">
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
            <Workflow />
          </div>
          <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">No workflows found.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Connect or configure n8n workflows to start monitoring automation health.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6 rounded-full border-border/70 bg-white shadow-none"
            onClick={onRefresh}
          >
            <RefreshCcw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 px-6 pb-6 pt-4 lg:hidden">
        {rows.map((row) => (
          <WorkflowRowCard key={row.id} row={row} />
        ))}
      </div>

      <div className="hidden min-w-0 px-4 pb-5 pt-4 lg:block">
        <Table className="min-w-[980px] table-fixed">
          <colgroup>
            <col className="w-[29%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Workflow
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Attention
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Last Activity
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Next Run
              </TableHead>
              <TableHead className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="group hover:bg-primary/5">
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <Badge
                    variant="outline"
                    className={cn(WORKFLOW_PILL_CLASS, "border-border/70 bg-secondary/20 font-medium text-muted-foreground")}
                  >
                    {row.category}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <StatusBadge label={row.status} tone={row.statusTone} />
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <Badge
                    variant="outline"
                    className={cn(WORKFLOW_PILL_CLASS, row.attentionTone)}
                  >
                    {getAttentionLabel(row.attention)}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-foreground">{row.lastActivityLabel}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.lastActivityTimestamp ? formatDateTime(new Date(row.lastActivityTimestamp).toISOString()) : "No timestamp"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <p className="text-[11px] text-muted-foreground">{row.nextRunLabel}</p>
                </TableCell>
                <TableCell className="px-3 py-3 align-top !whitespace-normal">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button asChild variant="outline" size="xs" className="h-8 rounded-full border-border/70 bg-white px-2.5 text-[11px] shadow-none">
                      <Link href={row.detailHref}>
                        View Details
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>

                    {row.n8nUrl ? (
                      <Button asChild variant="outline" size="xs" className="h-8 rounded-full border-border/70 bg-white px-2.5 text-[11px] shadow-none">
                        <a href={row.n8nUrl} target="_blank" rel="noreferrer" aria-label="Open in n8n">
                          n8n
                          <ExternalLink data-icon="inline-end" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function N8nAutomationsOverview() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [overview, setOverview] = useState<N8nOverviewResponse>(() => createEmptyOverview());
  const [wf1Detail, setWf1Detail] = useState<Wf1DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [wf1Loading, setWf1Loading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);

    try {
      const response = await request(buildRouteUrl("/api/cevonne/admin/workflows"));
      const body = await parseJsonResponse<N8nOverviewResponse>(response);

      if (body?.workflows) {
        setOverview(normalizeOverview(body));
        return;
      }

      if (response.ok) {
        setOverview(createEmptyOverview());
      }
    } catch {
      // Keep the current snapshot visible if the request fails.
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadWf1 = useCallback(async () => {
    setWf1Loading(true);

    try {
      const response = await request(buildRouteUrl("/api/admin/workflows/wf1"));
      const body = await parseJsonResponse<Wf1DetailResponse>(response);

      if (body?.workflow) {
        setWf1Detail(body);
        return;
      }

      if (response.ok) {
        setWf1Detail(null);
      }
    } catch {
      // Keep the current WF1 snapshot visible if the request fails.
    } finally {
      setWf1Loading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadWf1();
  }, [loadWf1]);

  const workflowRows = useMemo(() => {
    const rows = (overview.workflows ?? []).map(buildOverviewRow);

    if (wf1Detail?.workflow) {
      rows.push(buildWf1Row(wf1Detail.workflow));
    }

    return rows;
  }, [overview.workflows, wf1Detail]);

  const latestRow = useMemo(() => {
    return workflowRows.reduce<WorkflowRow | null>((current, row) => {
      if (!current) {
        return row;
      }

      return row.lastActivityTimestamp > current.lastActivityTimestamp ? row : current;
    }, null);
  }, [workflowRows]);

  const activeWorkflows = useMemo(
    () => workflowRows.filter((row) => row.status === "Working").length,
    [workflowRows],
  );
  const needsReviewWorkflows = useMemo(
    () => workflowRows.filter((row) => row.status === "Needs Review").length,
    [workflowRows],
  );
  const blockedWorkflows = useMemo(
    () => workflowRows.filter((row) => row.status === "Blocked").length,
    [workflowRows],
  );
  const waitingWorkflows = useMemo(
    () => workflowRows.filter((row) => row.status === "Waiting").length,
    [workflowRows],
  );

  const attentionQueue = useMemo(
    () =>
      [...workflowRows]
        .filter((row) => row.attention !== "No action needed")
        .sort((left, right) => sortByAttentionPriority(left.attention) - sortByAttentionPriority(right.attention) || right.lastActivityTimestamp - left.lastActivityTimestamp)
        .slice(0, 5),
    [workflowRows],
  );

  const recentActivity = useMemo(
    () =>
      [...workflowRows]
        .sort((left, right) => right.lastActivityTimestamp - left.lastActivityTimestamp)
        .slice(0, 4),
    [workflowRows],
  );

  const stats = useMemo<StatCardProps[]>(
    () => [
      {
        label: "Total Workflows",
        value: numberFormatter.format(workflowRows.length),
        helper: "G1 through G11 plus WF1",
        icon: <Workflow className="h-5 w-5" />,
        accentClass: "bg-primary",
      },
      {
        label: "Active Workflows",
        value: numberFormatter.format(activeWorkflows),
        helper: "Running smoothly",
        icon: <BadgeCheck className="h-5 w-5" />,
        accentClass: "bg-emerald-300",
      },
      {
        label: "Needs Review",
        value: numberFormatter.format(needsReviewWorkflows),
        helper: "Waiting on attention",
        icon: <ShieldAlert className="h-5 w-5" />,
        accentClass: "bg-amber-300",
      },
      {
        label: "Blocked",
        value: numberFormatter.format(blockedWorkflows),
        helper: "Paused for safety",
        icon: <Ban className="h-5 w-5" />,
        accentClass: "bg-rose-300",
      },
      {
        label: "Waiting",
        value: numberFormatter.format(waitingWorkflows),
        helper: "Queued for the next step",
        icon: <Clock3 className="h-5 w-5" />,
        accentClass: "bg-sky-300",
      },
      {
        label: "Latest Activity",
        value: latestRow ? latestRow.lastActivityLabel : "No activity yet",
        helper: latestRow ? `${latestRow.category} · ${latestRow.name}` : "Awaiting the first sync",
        icon: <Activity className="h-5 w-5" />,
        accentClass: "bg-secondary",
      },
    ],
    [
      activeWorkflows,
      blockedWorkflows,
      latestRow,
      needsReviewWorkflows,
      waitingWorkflows,
      workflowRows.length,
    ],
  );

  const lastSyncedBadge = latestRow
    ? latestRow.lastActivityLabel === "Never"
      ? "Last synced recently"
      : `Last synced ${latestRow.lastActivityLabel.toLowerCase()}`
    : "Last synced today";

  const handleRefresh = useCallback(() => {
    void loadOverview();
    void loadWf1();
  }, [loadOverview, loadWf1]);

  const hasWorkflowData = workflowRows.length > 0;

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1] text-foreground">
        <div className="pointer-events-none absolute -left-24 top-8 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-secondary/35 blur-3xl" />

        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 min-w-0 px-4 pb-8 pt-6 lg:px-8">
              <div className="flex w-full min-w-0 flex-col gap-6">
                <header className="sticky top-0 z-10 rounded-[28px] border border-border/60 bg-background/90 px-4 py-4 shadow-sm backdrop-blur-xl lg:px-6 lg:py-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 md:hidden">
                      <SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />
                      <span className="text-sm font-medium text-muted-foreground">Menu</span>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-2xl space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                          Cevonne Admin
                        </p>
                        <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">
                          N8N Automations
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Monitor automation workflows, review issues, and manage workflow health.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:max-w-3xl lg:flex-1 lg:justify-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              HEADER_CHIP_CLASS,
                              "border-border/70 bg-secondary/20 text-muted-foreground",
                            )}
                          >
                            Safe overview
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              HEADER_CHIP_CLASS,
                              "border-border/70 bg-secondary/20 text-muted-foreground",
                            )}
                          >
                            No live changes
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              HEADER_CHIP_CLASS,
                              "border-border/70 bg-secondary/20 text-muted-foreground",
                            )}
                          >
                            {lastSyncedBadge}
                          </Badge>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 min-w-[132px] justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm"
                          onClick={handleRefresh}
                        >
                          <RefreshCcw data-icon="inline-start" />
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="bg-border/70" />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {loading
                    ? Array.from({ length: 6 }).map((_, index) => <StatCardSkeleton key={index} />)
                    : stats.map((card) => <StatCard key={card.label} {...card} />)}
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
                  <Card className="min-w-0 self-start h-fit overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
                    <CardHeader className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">
                            Workflow Health
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold normal-case text-muted-foreground"
                          >
                            {numberFormatter.format(workflowRows.length)} workflows
                          </Badge>
                        </div>
                        <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                          Review workflow status, attention items, and the next safe step.
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold normal-case text-muted-foreground"
                      >
                        {wf1Loading ? "Syncing WF1..." : "WF1 included"}
                      </Badge>
                    </CardHeader>

                    <Separator className="bg-border/70" />

                    <CardContent className="min-w-0 p-0">
                      <WorkflowTable loading={loading} rows={hasWorkflowData ? workflowRows : []} onRefresh={handleRefresh} />
                    </CardContent>
                  </Card>

                  <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
                    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="font-serif text-xl font-semibold tracking-tight text-primary">
                            Attention Queue
                          </CardTitle>
                          <CardDescription>Workflows that need a closer look.</CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold normal-case text-muted-foreground"
                        >
                          {numberFormatter.format(attentionQueue.length)} items
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {loading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                              <Skeleton key={index} className="h-20 rounded-2xl" />
                            ))}
                          </div>
                        ) : attentionQueue.length ? (
                          attentionQueue.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{row.category}</p>
                                </div>
                                <StatusBadge label={getAttentionLabel(row.attention)} tone={row.attentionTone} compact />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">{row.description}</p>
                              <Button asChild variant="outline" className="mt-4 h-9 rounded-full border-border/70 bg-white px-3 shadow-none">
                                <Link href={row.detailHref}>
                                  View details
                                  <ArrowRight data-icon="inline-end" />
                                </Link>
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                            No workflows need attention right now.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="font-serif text-xl font-semibold tracking-tight text-primary">
                            Recent Activity
                          </CardTitle>
                          <CardDescription>The latest workflow updates from the admin store.</CardDescription>
                        </div>
                        <Activity className="mt-1 h-5 w-5 text-primary" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {loading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <Skeleton key={index} className="h-16 rounded-2xl" />
                            ))}
                          </div>
                        ) : recentActivity.length ? (
                          recentActivity.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{row.category}</p>
                                </div>
                                <StatusBadge label={row.status} tone={row.statusTone} compact />
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span>{row.lastActivityLabel}</span>
                                <span>{row.nextRunLabel}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                            No recent activity yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </aside>
                </div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
