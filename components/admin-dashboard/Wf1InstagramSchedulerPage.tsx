"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Clock3,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  formatWf1DateTime,
  formatWf1RelativeTime,
  getWf1ActionGuidance,
  getWf1FailureReason,
  getWf1ToneClass,
  WF1_WORKFLOW_TITLE,
  type Wf1ApprovalItem,
  type Wf1DetailResponse,
  type Wf1DryRunRecord,
  type Wf1LogRecord,
  type Wf1QueueItem,
  type Wf1Settings,
  type Wf1TimelineStep,
} from "@/lib/wf1";

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

const queueStatusOptions = ["all", "Dry run ready", "Working", "Needs review", "Waiting", "Blocked", "Manual only", "Cancelled"] as const;

type IntakeFormState = {
  assetId: string;
  approvalId: string;
  approvalStatus: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "REQUEST_CHANGES";
  g4ReviewId: string;
  contentText: string;
  mediaUrl: string;
  mediaPreviewUrl: string;
  accountId: string;
  scheduledAt: string;
};

type ApiResult = {
  status?: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message?: string;
  fail_reason?: string | null;
  guidance?: string | null;
  response_type?: string | null;
  handled_at?: string | null;
};

const emptyIntake = (): IntakeFormState => ({
  assetId: `asset-${Date.now()}`,
  approvalId: `approval-${Date.now()}`,
  approvalStatus: "PENDING_APPROVAL",
  g4ReviewId: `g4-review-${Date.now()}`,
  contentText: "Weekend glow routine is ready for review.",
  mediaUrl: "https://cdn.cevonne.com/wf1/weekend-glow-carousel.jpg",
  mediaPreviewUrl: "https://cdn.cevonne.com/wf1/weekend-glow-carousel.jpg",
  accountId: "@cevonne.official",
  scheduledAt: "",
});

type SettingsDraft = {
  instagramAccountId: string;
  postingTimezone: string;
  defaultPostingTimes: string;
  minimumBufferDays: string;
  minimumFallbackPosts: string;
  dryRunModeEnabled: boolean;
  livePublishingEnabled: boolean;
  tokenExpiresAt: string;
  alertRecipients: string;
  rollbackActionAvailable: boolean;
};

const emptySettingsDraft = (): SettingsDraft => ({
  instagramAccountId: "",
  postingTimezone: "",
  defaultPostingTimes: "",
  minimumBufferDays: "3",
  minimumFallbackPosts: "5",
  dryRunModeEnabled: true,
  livePublishingEnabled: false,
  tokenExpiresAt: "",
  alertRecipients: "",
  rollbackActionAvailable: true,
});

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDelimitedList = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
};

const settingsDraftFromSettings = (settings?: Wf1Settings | null): SettingsDraft => {
  if (!settings) {
    return emptySettingsDraft();
  }

  return {
    instagramAccountId: settings.instagramAccountId,
    postingTimezone: settings.postingTimezone,
    defaultPostingTimes: settings.defaultPostingTimes.join("\n"),
    minimumBufferDays: String(settings.minimumBufferDays),
    minimumFallbackPosts: String(settings.minimumFallbackPosts),
    dryRunModeEnabled: settings.dryRunModeEnabled,
    livePublishingEnabled: settings.livePublishingEnabled,
    tokenExpiresAt: toDateTimeLocalValue(settings.tokenExpiresAt),
    alertRecipients: settings.alertRecipients.join("\n"),
    rollbackActionAvailable: settings.rollbackActionAvailable,
  };
};

const settingsPayloadFromDraft = (draft: SettingsDraft) => {
  const minimumBufferDays = Number(draft.minimumBufferDays);
  const minimumFallbackPosts = Number(draft.minimumFallbackPosts);
  const defaultPostingTimes = parseDelimitedList(draft.defaultPostingTimes);
  const alertRecipients = parseDelimitedList(draft.alertRecipients);
  const tokenExpiresAt = draft.tokenExpiresAt ? new Date(draft.tokenExpiresAt) : null;

  if (!draft.instagramAccountId.trim()) {
    throw new Error("Instagram account ID is required.");
  }

  if (!draft.postingTimezone.trim()) {
    throw new Error("Posting timezone is required.");
  }

  if (!draft.minimumBufferDays.trim()) {
    throw new Error("Minimum buffer days is required.");
  }

  if (!draft.minimumFallbackPosts.trim()) {
    throw new Error("Minimum fallback posts is required.");
  }

  if (!Number.isInteger(minimumBufferDays) || minimumBufferDays < 0) {
    throw new Error("Minimum buffer days must be a whole number.");
  }

  if (!Number.isInteger(minimumFallbackPosts) || minimumFallbackPosts < 0) {
    throw new Error("Minimum fallback posts must be a whole number.");
  }

  if (!defaultPostingTimes.length) {
    throw new Error("Add at least one default posting time.");
  }

  if (!alertRecipients.length) {
    throw new Error("Add at least one alert recipient.");
  }

  if (draft.tokenExpiresAt && Number.isNaN(tokenExpiresAt?.getTime() ?? Number.NaN)) {
    throw new Error("Token expiry must be a valid date and time.");
  }

  return {
    instagram_account_id: draft.instagramAccountId.trim(),
    posting_timezone: draft.postingTimezone.trim(),
    default_posting_times: defaultPostingTimes,
    minimum_buffer_days: minimumBufferDays,
    minimum_fallback_posts: minimumFallbackPosts,
    dry_run_mode_enabled: draft.dryRunModeEnabled,
    live_publishing_enabled: draft.livePublishingEnabled,
    token_expires_at: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
    alert_recipients: alertRecipients,
    rollback_action_available: draft.rollbackActionAvailable,
  };
};

const statusBadge = (label?: string | null) => {
  const tone = getWf1ToneClass(label);
  return <Badge className={cn("rounded-full border", tone)}>{label || "Unknown"}</Badge>;
};

const parseResponse = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as ApiResult | null;
  if (!response.ok && !body?.message) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return body;
};

const getStatusMessage = (result: ApiResult, fallback = "Updated.") => {
  const message = result.message?.trim() || fallback;
  const guidance = result.guidance?.trim();
  return guidance ? `${message} ${guidance}` : message;
};

const severityToast = (result: ApiResult, fallback = "Updated.") => {
  const message = getStatusMessage(result, fallback);

  if (result.status === "PASS") {
    toast.success(message);
    return;
  }

  if (result.status === "MANUAL_ONLY") {
    toast(message);
    return;
  }

  if (result.status === "BLOCK") {
    toast.error(message);
    return;
  }

  toast.error(message);
};

export default function Wf1InstagramSchedulerPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [data, setData] = useState<Wf1DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [rescheduleQueueId, setRescheduleQueueId] = useState<string | null>(null);
  const [dryRunQueueId, setDryRunQueueId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<(typeof queueStatusOptions)[number]>("all");
  const [intake, setIntake] = useState<IntakeFormState>(() => emptyIntake());
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => emptySettingsDraft());
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [savingAction, setSavingAction] = useState<string | null>(null);

  const loadWorkflow = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setRefreshing(true);

    try {
      const response = await request(buildRouteUrl("/api/admin/workflows/wf1"));
      const body = (await parseResponse(response)) as Wf1DetailResponse | null;

      if (!body) {
        throw new Error("Invalid WF1 response.");
      }

      setData(body);
    } catch (error) {
      console.error("Failed to load WF1", error);
      toast.error("Unable to load WF1 Instagram Scheduler.");
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    if (!data?.queue.length) {
      return;
    }

    setDryRunQueueId((current) => current ?? data.queue.find((item) => item.dryRunStatus === "Ready")?.id ?? data.queue[0]?.id ?? null);
    setIntake((current) => {
      if (current.scheduledAt) {
        return current;
      }

      const nextScheduled = data.queue[0]?.scheduledAt || new Date().toISOString();
      const dt = new Date(nextScheduled);
      dt.setMinutes(dt.getMinutes() + 30);
      return {
        ...current,
        scheduledAt: dt.toISOString().slice(0, 16),
        approvalId: data.queue[0]?.technical.approvalId || current.approvalId,
        assetId: data.queue[0]?.technical.assetId || current.assetId,
        g4ReviewId: data.queue[0]?.technical.g4ReviewId || current.g4ReviewId,
      };
    });
  }, [data]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  const queue = data?.queue || [];
  const approvals = data?.approvals || [];
  const dryRuns = data?.dryRuns || [];
  const logs = data?.logs || [];
  const workflow = data?.workflow;
  const bufferHealth = data?.bufferHealth;
  const settings = data?.settings;
  const timeline = data?.timeline || [];
  const settingsSnapshot = useMemo(() => settingsDraftFromSettings(settings), [settings]);
  const settingsChanged = useMemo(
    () => JSON.stringify(settingsSnapshot) !== JSON.stringify(settingsDraft),
    [settingsSnapshot, settingsDraft],
  );

  useEffect(() => {
    setSettingsDraft(settingsDraftFromSettings(settings));
  }, [settings]);

  const selectedQueueItem = useMemo(
    () => queue.find((item) => item.id === selectedQueueId) || null,
    [queue, selectedQueueId],
  );

  const rescheduleTarget = useMemo(
    () => queue.find((item) => item.id === rescheduleQueueId) || null,
    [queue, rescheduleQueueId],
  );

  useEffect(() => {
    if (!rescheduleTarget || rescheduleAt) {
      return;
    }

    setRescheduleAt(new Date(rescheduleTarget.scheduledAt).toISOString().slice(0, 16));
  }, [rescheduleTarget, rescheduleAt]);

  const dryRunTarget = useMemo(
    () => queue.find((item) => item.id === dryRunQueueId) || queue.find((item) => item.dryRunStatus === "Ready") || selectedQueueItem,
    [queue, dryRunQueueId, selectedQueueItem],
  );

  const filteredQueue = useMemo(() => {
    if (queueFilter === "all") {
      return queue;
    }

    return queue.filter((item) => item.status === queueFilter);
  }, [queue, queueFilter]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Scheduler status",
        value: workflow?.status || "Loading",
        helper: workflow?.attentionMessage || "Loading workflow...",
        icon: <Sparkles className="h-5 w-5 text-muted-foreground" />,
      },
      {
        label: "Next scheduled post",
        value: workflow?.nextScheduledPost || "Loading",
        helper: "Next approved post.",
        icon: <CalendarClock className="h-5 w-5 text-muted-foreground" />,
      },
      {
        label: "Approval queue",
        value: workflow?.approvalQueueCount ?? 0,
        helper: workflow?.approvalStatus || "Waiting for approval",
        icon: <BadgeCheck className="h-5 w-5 text-muted-foreground" />,
      },
      {
        label: "Buffer health",
        value: workflow?.bufferHealth || "Loading",
        helper: bufferHealth?.urgentAction || "Checking buffer...",
        icon: <Shield className="h-5 w-5 text-muted-foreground" />,
      },
      {
        label: "Last safety check",
        value: workflow?.lastSafetyCheck || "Loading",
        helper: workflow?.livePublishing === "Disabled" ? "Live publishing stays off by default." : "Live publishing is enabled.",
        icon: <Clock3 className="h-5 w-5 text-muted-foreground" />,
      },
    ],
    [workflow, bufferHealth],
  );

  const callAction = useCallback(
    async (path: string, body: Record<string, unknown>, options?: { success?: string; refresh?: boolean }) => {
      setSavingAction(path);
      try {
        const response = await request(buildRouteUrl(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = (await parseResponse(response)) as ApiResult;
        severityToast(result, options?.success || "Updated.");

        if (options?.refresh !== false) {
          await loadWorkflow(true);
        }

        return result;
      } catch (error) {
        console.error(`Failed action ${path}`, error);
        toast.error("Unable to complete the action.");
        throw error;
      } finally {
        setSavingAction(null);
      }
    },
    [request, loadWorkflow],
  );

  const runIntake = useCallback(async () => {
    const scheduledAt = intake.scheduledAt ? new Date(intake.scheduledAt).toISOString() : new Date().toISOString();
    const result = await callAction(
      "/api/admin/workflows/wf1/intake",
      {
        asset_id: intake.assetId,
        approval_id: intake.approvalId,
        approval_status: intake.approvalStatus,
        g4_review_id: intake.g4ReviewId,
        content_text: intake.contentText,
        media_url: intake.mediaUrl,
        media_preview_url: intake.mediaPreviewUrl,
        account_id: intake.accountId,
        scheduled_at: scheduledAt,
        actor: "admin",
      },
      { success: "Content intake sent.", refresh: true },
    );

    if (result.status === "PASS" || result.status === "MANUAL_ONLY") {
      setIntake((current) => ({ ...current, contentText: "", mediaUrl: "", mediaPreviewUrl: "" }));
    }
  }, [callAction, intake]);

  const runDryRun = useCallback(
    async (item?: Wf1QueueItem | null) => {
      const target = item || dryRunTarget;
      if (!target) {
        toast.error("Select a post first.");
        return;
      }

      await callAction(
        "/api/admin/workflows/wf1/dry-run",
        {
          asset_id: target.technical.assetId,
          approval_id: target.technical.approvalId,
          approval_status: target.approvalStatus === "Approved" ? "APPROVED" : target.approvalStatus === "Rejected" ? "REJECTED" : "PENDING_APPROVAL",
          g4_review_id: target.technical.g4ReviewId,
          content_text: target.fullCaption,
          media_url: target.mediaUrl,
          account_id: target.technical.accountId,
          scheduled_at: target.scheduledAt,
          actor: "admin",
          queue_id: target.id,
        },
        {
          success: "Dry-run prepared successfully. No live Instagram post was published.",
          refresh: true,
        },
      );
    },
    [callAction, dryRunTarget],
  );

  const approveItem = useCallback(
    async (item: Wf1ApprovalItem | null, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") => {
      if (!item) {
        toast.error("Approval not found.");
        return;
      }

      const path =
        decision === "APPROVE" ? "/api/admin/workflows/wf1/approve" : decision === "REJECT" ? "/api/admin/workflows/wf1/reject" : "/api/admin/workflows/wf1/request-changes";

      await callAction(
        path,
        {
          approval_id: item.approvalId,
          queue_id: item.queueId,
          decision,
          note: decision === "REQUEST_CHANGES" ? "Please update the post and send it back." : undefined,
        },
        { refresh: true },
      );
    },
    [callAction],
  );

  const rescheduleCurrent = useCallback(async () => {
    if (!rescheduleTarget || !rescheduleAt) {
      toast.error("Choose a new time.");
      return;
    }

    await callAction(
      "/api/admin/workflows/wf1/reschedule",
      {
        queue_id: rescheduleTarget.id,
        scheduled_at: new Date(rescheduleAt).toISOString(),
        note: rescheduleNote || undefined,
      },
      { refresh: true },
    );

    setRescheduleQueueId(null);
    setRescheduleAt("");
    setRescheduleNote("");
  }, [callAction, rescheduleTarget, rescheduleAt, rescheduleNote]);

  const cancelCurrent = useCallback(
    async (item: Wf1QueueItem | null) => {
      if (!item) {
        toast.error("Queue item not found.");
        return;
      }

      await callAction(
        "/api/admin/workflows/wf1/cancel",
        {
          queue_id: item.id,
          reason: "Cancelled from the admin panel.",
        },
        { refresh: true },
      );
    },
    [callAction],
  );

  const fallbackCurrent = useCallback(
    async (item: Wf1QueueItem | null) => {
      if (!item) {
        toast.error("Queue item not found.");
        return;
      }

      await callAction(
        "/api/admin/workflows/wf1/mark-fallback",
        {
          queue_id: item.id,
          fallback: true,
        },
        { refresh: true },
      );
    },
    [callAction],
  );

  const saveSettings = useCallback(async () => {
    let payload;

    try {
      payload = settingsPayloadFromDraft(settingsDraft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to prepare settings.");
      return;
    }

    await callAction("/api/admin/workflows/wf1/settings", payload, {
      success: "Settings saved.",
      refresh: true,
    });
  }, [callAction, settingsDraft]);

  const refreshBufferHealth = useCallback(async () => {
    await callAction(
      "/api/admin/workflows/wf1/buffer-health",
      {
        approved_buffer_days: bufferHealth?.approvedBufferDays,
        evergreen_fallback_count: bufferHealth?.evergreenFallbackCount,
        token_expires_at: bufferHealth?.tokenExpiresAt,
        account_health: bufferHealth?.accountHealth,
        missing_content_warnings: bufferHealth?.missingContentWarnings,
        urgent_action: bufferHealth?.urgentAction,
        recent_dry_run_completed_at: bufferHealth?.recentDryRunCompletedAt,
      },
      { success: "Buffer health refreshed.", refresh: true },
    );
  }, [callAction, bufferHealth]);

  const logDeveloperRows = (log: Wf1LogRecord) => {
    return (
      <AccordionItem key={log.logId} value={log.logId}>
        <AccordionTrigger className="text-left text-sm">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="truncate font-medium text-foreground">{log.event}</span>
            <Badge className={cn("rounded-full border", getWf1ToneClass(log.status))}>{log.status}</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <p>
              Log ID: <span className="font-mono text-foreground">{log.logId}</span>
            </p>
            <p>
              Queue ID: <span className="font-mono text-foreground">{log.queueId || "None"}</span>
            </p>
            <p>
              Approval ID: <span className="font-mono text-foreground">{log.approvalId || "None"}</span>
            </p>
            <p>
              Dry-run ID: <span className="font-mono text-foreground">{log.dryRunId || "None"}</span>
            </p>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            {JSON.stringify(log.technical, null, 2)}
          </pre>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const selectedQueueTechnical = selectedQueueItem?.technical;

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
              <header className="rounded-[2rem] border border-border/60 bg-white shadow-sm">
                <div className="flex flex-col gap-5 px-6 py-6 md:px-8 md:py-8 xl:flex-row xl:items-end xl:justify-between">
                  <div className="space-y-4">
                    <Breadcrumb className="">
                      <BreadcrumbList className="">
                        <BreadcrumbItem className="">
                          <BreadcrumbLink asChild className="">
                            <Link href="/dashboard/n8n-automations">N8N Automations</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="">/</BreadcrumbSeparator>
                        <BreadcrumbItem className="">
                          <BreadcrumbPage className="">{WF1_WORKFLOW_TITLE}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-border/70 bg-muted/30 text-foreground hover:bg-muted/30">WF1</Badge>
                        <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Safe mode</Badge>
                        <Badge className="rounded-full border border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/30">Publishing off by default</Badge>
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{WF1_WORKFLOW_TITLE}</h1>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                        Keep Instagram posts in review, dry-run, and buffer-safe until you choose to publish.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" className="rounded-full border-border/70 bg-white shadow-none">
                      <Link href="/dashboard/n8n-automations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-border/70 bg-white shadow-none"
                      onClick={() => void loadWorkflow(true)}
                    >
                      <RefreshCw className={cn("mr-2 h-4 w-4", refreshing ? "animate-spin" : "")} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                {loading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <Card key={index} className="overflow-hidden border border-border/60 bg-white shadow-sm">
                        <CardContent className="space-y-3 p-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </CardContent>
                      </Card>
                    ))
                  : summaryCards.map((card) => (
                      <Card key={card.label} className="overflow-hidden border border-border/60 bg-white shadow-sm">
                        <CardContent className="flex min-w-0 flex-col gap-3 p-4">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                              <p className="break-words text-lg font-semibold text-foreground">{card.value}</p>
                              <p className="break-words text-xs text-muted-foreground">{card.helper}</p>
                            </div>
                            <div className="rounded-full bg-muted/30 p-3">{card.icon}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
              </div>

              {settings?.livePublishingEnabled === false ? (
                <Alert variant="default" className="border-border/60 bg-muted/20 text-foreground">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle className="">Live publishing is off.</AlertTitle>
                  <AlertDescription className="">WF1 stays in safe dry-run mode until you turn it on in Settings.</AlertDescription>
                </Alert>
              ) : null}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                <TabsList className="flex w-full flex-wrap justify-start gap-2 rounded-full bg-white/85 p-1 shadow-sm">
                  <TabsTrigger value="overview" className="rounded-full">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="queue" className="rounded-full">
                    Content Queue
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="rounded-full">
                    Approvals
                  </TabsTrigger>
                  <TabsTrigger value="dry-runs" className="rounded-full">
                    Dry Runs
                  </TabsTrigger>
                  <TabsTrigger value="buffer" className="rounded-full">
                    Buffer Health
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="rounded-full">
                    Activity Logs
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="rounded-full">
                    Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                    <Card className="border border-border/60 bg-white/95 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary">Workflow timeline</CardTitle>
                        <CardDescription>A plain-language path from caption receipt to safe publishing readiness.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {loading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {timeline.map((step) => {
                              const classes =
                                step.status === "Done"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : step.status === "Waiting"
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : step.status === "Blocked"
                                      ? "border-rose-200 bg-rose-50 text-rose-800"
                                      : "border-border/60 bg-muted/20 text-muted-foreground";

                              return (
                                <div key={step.label} className={cn("rounded-2xl border p-4", classes)}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                                    {statusBadge(step.status)}
                                  </div>
                                  <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-white/95 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary">New content intake</CardTitle>
                        <CardDescription>Send a new caption into WF1 without exposing any webhook details.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="caption">Caption</Label>
                          <Textarea
                            id="caption"
                            value={intake.contentText}
                            onChange={(event) => setIntake((current) => ({ ...current, contentText: event.target.value }))}
                            placeholder="Write the caption preview here"
                            className="min-h-[120px]"
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="media-url">Media URL</Label>
                            <Input
                              id="media-url"
                              value={intake.mediaUrl}
                              onChange={(event) => setIntake((current) => ({ ...current, mediaUrl: event.target.value }))}
                              placeholder="https://..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="preview-url">Preview URL</Label>
                            <Input
                              id="preview-url"
                              value={intake.mediaPreviewUrl}
                              onChange={(event) => setIntake((current) => ({ ...current, mediaPreviewUrl: event.target.value }))}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="scheduled-at">Scheduled time</Label>
                            <Input
                              id="scheduled-at"
                              type="datetime-local"
                              value={intake.scheduledAt}
                              onChange={(event) => setIntake((current) => ({ ...current, scheduledAt: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="approval-status">Approval status</Label>
                            <Select
                              value={intake.approvalStatus}
                              onValueChange={(value) => setIntake((current) => ({ ...current, approvalStatus: value as IntakeFormState["approvalStatus"] }))}
                            >
                              <SelectTrigger id="approval-status">
                                <SelectValue placeholder="Choose a status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING_APPROVAL">Waiting for approval</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="REQUEST_CHANGES">Changes requested</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="asset-id">Asset ID</Label>
                            <Input
                              id="asset-id"
                              value={intake.assetId}
                              onChange={(event) => setIntake((current) => ({ ...current, assetId: event.target.value }))}
                              placeholder="asset-..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="approval-id">Approval ID</Label>
                            <Input
                              id="approval-id"
                              value={intake.approvalId}
                              onChange={(event) => setIntake((current) => ({ ...current, approvalId: event.target.value }))}
                              placeholder="approval-..."
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="review-id">G4 review ID</Label>
                            <Input
                              id="review-id"
                              value={intake.g4ReviewId}
                              onChange={(event) => setIntake((current) => ({ ...current, g4ReviewId: event.target.value }))}
                              placeholder="g4-review-..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="account-id">Account ID</Label>
                            <Input
                              id="account-id"
                              value={intake.accountId}
                              onChange={(event) => setIntake((current) => ({ ...current, accountId: event.target.value }))}
                              placeholder="@cevonne.official"
                            />
                          </div>
                        </div>
                        <Button className="w-full rounded-full" onClick={() => void runIntake()} disabled={savingAction === "/api/admin/workflows/wf1/intake"}>
                          Send to WF1
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="queue" className="space-y-4">
                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-primary">Content queue</CardTitle>
                        <CardDescription>Review each caption in plain language. Hidden technical details stay inside the details sheet.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="min-w-[220px]">
                          <Select value={queueFilter} onValueChange={(value) => setQueueFilter(value as typeof queueFilter)}>
                            <SelectTrigger>
                              <Filter className="mr-2 h-4 w-4" />
                              <SelectValue placeholder="Filter queue" />
                            </SelectTrigger>
                            <SelectContent>
                              {queueStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status === "all" ? "All posts" : status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="outline" className="rounded-full" onClick={() => void loadWorkflow(true)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Caption preview</TableHead>
                            <TableHead>Media</TableHead>
                            <TableHead>Scheduled time</TableHead>
                            <TableHead>Content review</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead>Safety check</TableHead>
                            <TableHead>Dry-run</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                                Loading queue...
                              </TableCell>
                            </TableRow>
                          ) : filteredQueue.length ? (
                            filteredQueue.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="max-w-[240px]">
                                  <p className="font-medium text-foreground">{item.captionPreview}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{item.fallback ? "Marked as fallback content" : item.nextStep}</p>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium text-foreground">{item.mediaType}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={item.mediaUrl}>
                                      {item.mediaUrl}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium text-foreground">{formatWf1DateTime(item.scheduledAt)}</p>
                                    <p className="text-xs text-muted-foreground">{formatWf1RelativeTime(item.scheduledAt)}</p>
                                  </div>
                                </TableCell>
                                <TableCell>{statusBadge(item.contentReviewStatus)}</TableCell>
                                <TableCell>{statusBadge(item.approvalStatus)}</TableCell>
                                <TableCell>{statusBadge(item.safetyCheckStatus)}</TableCell>
                                <TableCell>{statusBadge(item.dryRunStatus)}</TableCell>
                                <TableCell>{statusBadge(item.status)}</TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Actions</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => setSelectedQueueId(item.id)}>View</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => void approveItem(approvals.find((approval) => approval.queueId === item.id) || null, "APPROVE")}>
                                        Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => void approveItem(approvals.find((approval) => approval.queueId === item.id) || null, "REJECT")}>
                                        Reject
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => void runDryRun(item)}>Run dry-run</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setRescheduleQueueId(item.id)}>Reschedule</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => void fallbackCurrent(item)}>Mark as fallback</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => void cancelCurrent(item)} className="text-rose-700">
                                        Cancel
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                                No posts match the current filter.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="approvals" className="space-y-4">
                  <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="">Approval queue</AlertTitle>
                    <AlertDescription className="">Approve or reject items from the website. No raw webhook details are shown here.</AlertDescription>
                  </Alert>

                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-primary">Pending approvals</CardTitle>
                        <CardDescription>Items waiting for a decision.</CardDescription>
                      </div>
                      <Button variant="outline" className="rounded-full" onClick={() => void loadWorkflow(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Caption preview</TableHead>
                            <TableHead>Media</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Reviewer</TableHead>
                            <TableHead>Risk summary</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                                Loading approvals...
                              </TableCell>
                            </TableRow>
                          ) : approvals.length ? (
                            approvals.map((approval) => (
                              <TableRow key={approval.approvalId}>
                                <TableCell className="max-w-[240px] font-medium text-foreground">{approval.captionPreview}</TableCell>
                                <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground" title={approval.mediaPreviewUrl || undefined}>
                                  {approval.mediaPreviewUrl || "No preview"}
                                </TableCell>
                                <TableCell>{formatWf1DateTime(approval.createdAt)}</TableCell>
                                <TableCell>{approval.reviewer}</TableCell>
                                <TableCell>{approval.riskSummary}</TableCell>
                                <TableCell>{statusBadge(approval.status)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" className="rounded-full" onClick={() => void approveItem(approval, "APPROVE")} disabled={savingAction === "/api/admin/workflows/wf1/approve"}>
                                      Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => void approveItem(approval, "REJECT")} disabled={savingAction === "/api/admin/workflows/wf1/reject"}>
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-full"
                                      onClick={() => void approveItem(approval, "REQUEST_CHANGES")}
                                      disabled={savingAction === "/api/admin/workflows/wf1/request-changes"}
                                    >
                                      Request changes
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                                No posts waiting for approval.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="dry-runs" className="space-y-4">
                  <Alert variant="default" className="border-cyan-200 bg-cyan-50 text-cyan-900">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle className="">No live post was published.</AlertTitle>
                    <AlertDescription className="">This was only a safe dry-run.</AlertDescription>
                  </Alert>

                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-primary">Dry-run history</CardTitle>
                        <CardDescription>Check the safe test result before anything ever goes live.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={dryRunTarget?.id || ""} onValueChange={(value) => setDryRunQueueId(value)}>
                          <SelectTrigger className="min-w-[220px]">
                            <SelectValue placeholder="Choose a post" />
                          </SelectTrigger>
                          <SelectContent>
                            {queue.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.captionPreview}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button className="rounded-full" onClick={() => void runDryRun()} disabled={savingAction === "/api/admin/workflows/wf1/dry-run"}>
                          Run Dry Run
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Caption preview</TableHead>
                            <TableHead>Scheduled time</TableHead>
                            <TableHead>Safety status</TableHead>
                            <TableHead>Dry-run status</TableHead>
                            <TableHead>Not executed</TableHead>
                            <TableHead>Last run</TableHead>
                            <TableHead>Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                                Loading dry-runs...
                              </TableCell>
                            </TableRow>
                          ) : dryRuns.length ? (
                            dryRuns.map((record) => (
                              <TableRow key={record.dryRunId}>
                                <TableCell className="max-w-[220px] font-medium text-foreground">{record.captionPreview}</TableCell>
                                <TableCell>{formatWf1DateTime(record.scheduledAt)}</TableCell>
                                <TableCell>{statusBadge(record.safetyStatus)}</TableCell>
                                <TableCell>{statusBadge(record.dryRunStatus)}</TableCell>
                                <TableCell>{record.notExecuted ? "Yes" : "No"}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p>{formatWf1DateTime(record.lastRunAt)}</p>
                                    <p className="text-xs text-muted-foreground">{formatWf1RelativeTime(record.lastRunAt)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-[300px] text-sm text-muted-foreground">{record.result}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                                No dry-runs yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="buffer" className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card className="border border-border/60 bg-white/95 shadow-none">
                      <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg text-primary">Buffer health</CardTitle>
                          <CardDescription>WF1 needs enough approved content, fallback posts, and a healthy token.</CardDescription>
                        </div>
                        <Button variant="outline" className="rounded-full" onClick={() => void refreshBufferHealth()} disabled={savingAction === "/api/admin/workflows/wf1/buffer-health"}>
                          Refresh
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Approved buffer days</p>
                            <p className="mt-2 text-3xl font-semibold text-foreground">{bufferHealth?.approvedBufferDays ?? 0}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              WF1 needs at least {settings?.minimumBufferDays ?? 3} days of approved posts.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fallback posts</p>
                            <p className="mt-2 text-3xl font-semibold text-foreground">{bufferHealth?.evergreenFallbackCount ?? 0}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              WF1 needs at least {settings?.minimumFallbackPosts ?? 5} evergreen fallback posts.
                            </p>
                          </div>
                        </div>

                        <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="">Urgent action</AlertTitle>
                          <AlertDescription className="">
                            {bufferHealth?.urgentAction || "Add more approved content and fallback posts before publishing."}
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2 rounded-2xl border border-border/60 bg-white p-4">
                          <p className="text-sm font-semibold text-primary">Warnings</p>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {(bufferHealth?.missingContentWarnings || []).length ? (
                              bufferHealth?.missingContentWarnings.map((warning) => (
                                <li key={warning} className="flex items-start gap-2">
                                  <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                                  <span>{warning}</span>
                                </li>
                              ))
                            ) : (
                              <li>No missing content warnings.</li>
                            )}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-white/95 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary">Checklist</CardTitle>
                        <CardDescription>Track the minimum requirements before WF1 is considered safe.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(bufferHealth?.checklist || []).map((item) => (
                          <div key={item.label} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              {statusBadge(item.status)}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-primary">Activity logs</CardTitle>
                        <CardDescription>Recent workflow activity in simple language.</CardDescription>
                      </div>
                      <Button variant="outline" className="rounded-full" onClick={() => void loadWorkflow(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Actor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                Loading logs...
                              </TableCell>
                            </TableRow>
                          ) : logs.length ? (
                            logs.map((log) => (
                              <TableRow key={log.logId}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p>{formatWf1DateTime(log.time)}</p>
                                    <p className="text-xs text-muted-foreground">{formatWf1RelativeTime(log.time)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">{log.event}</TableCell>
                                <TableCell>{statusBadge(log.status)}</TableCell>
                                <TableCell className="max-w-[300px] text-sm text-muted-foreground">{log.message}</TableCell>
                                <TableCell className="capitalize">{log.actor}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                No logs found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Developer details</CardTitle>
                      <CardDescription>Hidden by default and only expanded when someone needs the technical names.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="developer-logs">
                          <AccordionTrigger>Advanced details</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              {logs.slice(0, 4).map(logDeveloperRows)}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <Card className="border border-border/60 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Workflow settings</CardTitle>
                      <CardDescription>Edit WF1 defaults and save them back to the workflow store. Live publishing starts off.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Alert variant="default" className="border-border/60 bg-muted/20 text-foreground">
                        <Shield className="h-4 w-4" />
                        <AlertTitle className="">{settingsDraft.livePublishingEnabled ? "Live publishing is on." : "Live publishing is off."}</AlertTitle>
                        <AlertDescription className="">
                          {settingsDraft.livePublishingEnabled
                            ? "This affects the real Instagram path. Keep approvals and account health current."
                            : "WF1 stays in safe dry-run mode until you turn it on."}
                        </AlertDescription>
                      </Alert>

                      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <FieldGroup className="gap-5">
                          <Field>
                            <FieldContent>
                              <FieldLabel htmlFor="instagram-account-id">Instagram account ID</FieldLabel>
                              <Input
                                id="instagram-account-id"
                                className="rounded-2xl"
                                value={settingsDraft.instagramAccountId}
                                onChange={(event) => setSettingsDraft((current) => ({ ...current, instagramAccountId: event.target.value }))}
                                placeholder="@cevonne.official"
                              />
                              <FieldDescription>Used when WF1 builds the publish payload.</FieldDescription>
                            </FieldContent>
                          </Field>

                          <Field>
                            <FieldContent>
                              <FieldLabel htmlFor="posting-timezone">Posting timezone</FieldLabel>
                              <Input
                                id="posting-timezone"
                                className="rounded-2xl"
                                value={settingsDraft.postingTimezone}
                                onChange={(event) => setSettingsDraft((current) => ({ ...current, postingTimezone: event.target.value }))}
                                placeholder="Asia/Kolkata"
                              />
                              <FieldDescription>Used to render scheduled times and reminders.</FieldDescription>
                            </FieldContent>
                          </Field>

                          <Field>
                            <FieldContent>
                              <FieldLabel htmlFor="default-posting-times">Default posting times</FieldLabel>
                              <Textarea
                                id="default-posting-times"
                                className="min-h-[110px] rounded-2xl"
                                value={settingsDraft.defaultPostingTimes}
                                onChange={(event) => setSettingsDraft((current) => ({ ...current, defaultPostingTimes: event.target.value }))}
                                placeholder={"10:00 AM\n1:00 PM\n6:30 PM"}
                              />
                              <FieldDescription>Use commas or new lines for multiple times.</FieldDescription>
                            </FieldContent>
                          </Field>

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="minimum-buffer-days">Minimum buffer days</FieldLabel>
                                <Input
                                  id="minimum-buffer-days"
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="rounded-2xl"
                                  value={settingsDraft.minimumBufferDays}
                                  onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumBufferDays: event.target.value }))}
                                />
                                <FieldDescription>How much approved content WF1 wants before publishing.</FieldDescription>
                              </FieldContent>
                            </Field>

                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="minimum-fallback-posts">Minimum fallback posts</FieldLabel>
                                <Input
                                  id="minimum-fallback-posts"
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="rounded-2xl"
                                  value={settingsDraft.minimumFallbackPosts}
                                  onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumFallbackPosts: event.target.value }))}
                                />
                                <FieldDescription>Evergreen backups needed before live publishing opens up.</FieldDescription>
                              </FieldContent>
                            </Field>
                          </div>

                          <Field>
                            <FieldContent>
                              <FieldLabel htmlFor="token-expires-at">Token expiry</FieldLabel>
                              <Input
                                id="token-expires-at"
                                type="datetime-local"
                                className="rounded-2xl"
                                value={settingsDraft.tokenExpiresAt}
                                onChange={(event) => setSettingsDraft((current) => ({ ...current, tokenExpiresAt: event.target.value }))}
                              />
                              <FieldDescription>Leave this blank if you do not have a confirmed expiry yet.</FieldDescription>
                            </FieldContent>
                          </Field>

                          <Field>
                            <FieldContent>
                              <FieldLabel htmlFor="alert-recipients">Alert recipients</FieldLabel>
                              <Textarea
                                id="alert-recipients"
                                className="min-h-[110px] rounded-2xl"
                                value={settingsDraft.alertRecipients}
                                onChange={(event) => setSettingsDraft((current) => ({ ...current, alertRecipients: event.target.value }))}
                                placeholder={"admin@cevonne.com\ngrowth@cevonne.com"}
                              />
                              <FieldDescription>Use commas or new lines for multiple email addresses.</FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldGroup>

                        <div className="space-y-4">
                          <FieldSet className="rounded-3xl border border-border/60 bg-muted/30 p-4 shadow-sm">
                            <FieldLegend variant="label" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Publishing controls
                            </FieldLegend>
                            <FieldGroup className="gap-4">
                              <Field orientation="horizontal">
                                <FieldContent>
                                  <FieldTitle>Dry-run mode</FieldTitle>
                                  <FieldDescription>Keep changes inside the safe lane.</FieldDescription>
                                </FieldContent>
                                <Switch
                                  id="dry-run-mode-enabled"
                                  aria-label="Dry-run mode"
                                  checked={settingsDraft.dryRunModeEnabled}
                                  onCheckedChange={(checked) => setSettingsDraft((current) => ({ ...current, dryRunModeEnabled: checked }))}
                                />
                              </Field>

                              <Separator />

                              <Field orientation="horizontal">
                                <FieldContent>
                                  <FieldTitle>Live publishing</FieldTitle>
                                  <FieldDescription>Turn this on only when the backend is ready for real posts.</FieldDescription>
                                </FieldContent>
                                <Switch
                                  id="live-publishing-enabled"
                                  aria-label="Live publishing"
                                  checked={settingsDraft.livePublishingEnabled}
                                  onCheckedChange={(checked) => setSettingsDraft((current) => ({ ...current, livePublishingEnabled: checked }))}
                                />
                              </Field>

                              <Separator />

                              <Field orientation="horizontal">
                                <FieldContent>
                                  <FieldTitle>Rollback action</FieldTitle>
                                  <FieldDescription>Keep the rollback route available for admin recovery.</FieldDescription>
                                </FieldContent>
                                <Switch
                                  id="rollback-action-available"
                                  aria-label="Rollback action"
                                  checked={settingsDraft.rollbackActionAvailable}
                                  onCheckedChange={(checked) => setSettingsDraft((current) => ({ ...current, rollbackActionAvailable: checked }))}
                                />
                              </Field>
                            </FieldGroup>
                          </FieldSet>

                          <Card className="border border-border/60 bg-white shadow-none">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base text-primary">Current snapshot</CardTitle>
                              <CardDescription>What saves when you click the button.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Default posting times</span>
                                <span className="text-right font-medium text-foreground">
                                  {parseDelimitedList(settingsDraft.defaultPostingTimes).join(" • ") || "Not set"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Alert recipients</span>
                                <span className="font-medium text-foreground">{parseDelimitedList(settingsDraft.alertRecipients).length || 0}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Dry-run mode</span>
                                <Badge variant={settingsDraft.dryRunModeEnabled ? "default" : "secondary"} className="rounded-full">
                                  {settingsDraft.dryRunModeEnabled ? "On" : "Off"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Live publishing</span>
                                <Badge variant={settingsDraft.livePublishingEnabled ? "default" : "secondary"} className="rounded-full">
                                  {settingsDraft.livePublishingEnabled ? "On" : "Off"}
                                </Badge>
                              </div>
                              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                                Save changes here to update the live WF1 settings without leaving the page.
                              </div>
                            </CardContent>
                          </Card>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-full" onClick={() => setSettingsDraft(settingsSnapshot)} disabled={!settingsChanged || savingAction === "/api/admin/workflows/wf1/settings"}>
                              Reset
                            </Button>
                            <Button
                              className="rounded-full"
                              onClick={() => void saveSettings()}
                              disabled={!settingsChanged || savingAction === "/api/admin/workflows/wf1/settings"}
                            >
                              {savingAction === "/api/admin/workflows/wf1/settings" ? "Saving..." : "Save changes"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Accordion type="single" collapsible>
                        <AccordionItem value="developer-settings">
                          <AccordionTrigger>Developer details</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 text-sm text-muted-foreground">
                              <p>
                                Intake path: <span className="font-mono text-foreground">{data?.developerNotes.webhookPaths.intake}</span>
                              </p>
                              <p>
                                Dry-run path: <span className="font-mono text-foreground">{data?.developerNotes.webhookPaths.dryRun}</span>
                              </p>
                              <p>
                                Buffer health path: <span className="font-mono text-foreground">{data?.developerNotes.webhookPaths.bufferHealth}</span>
                              </p>
                              <p>
                                Approval decision path: <span className="font-mono text-foreground">{data?.developerNotes.webhookPaths.approvalDecision}</span>
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border border-border/60 bg-white/95 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Next step</CardTitle>
                    <CardDescription>Plain-language guidance for the current workflow state.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                      <p className="text-sm font-semibold text-primary">Current guidance</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{workflow?.attentionMessage || "Review the current queue."}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-4">
                      <p className="text-sm font-semibold text-primary">Approve or reject?</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Approving moves the post forward. Rejecting stops it safely. Nothing goes live unless live publishing is enabled.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/60 bg-white/95 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Recent activity</CardTitle>
                    <CardDescription>The latest workflow events at a glance.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {logs.slice(0, 3).map((log) => (
                      <div key={log.logId} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{log.event}</p>
                          {statusBadge(log.status)}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{log.message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>

      <Sheet open={Boolean(selectedQueueId)} onOpenChange={(open) => !open && setSelectedQueueId(null)}>
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-xl">
          {selectedQueueItem ? (
            <ScrollArea className="h-full">
              <div className="space-y-6 p-6">
                <SheetHeader className="space-y-2">
                  <SheetTitle>{selectedQueueItem.captionPreview}</SheetTitle>
                  <SheetDescription>Plain-language post details with hidden developer data below.</SheetDescription>
                </SheetHeader>

                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    {statusBadge(selectedQueueItem.status)}
                    {statusBadge(selectedQueueItem.dryRunStatus)}
                    {statusBadge(selectedQueueItem.approvalStatus)}
                  </div>
                  <p className="text-sm leading-6 text-foreground">{selectedQueueItem.fullCaption}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scheduled time</p>
                      <p className="mt-1 text-sm text-foreground">{formatWf1DateTime(selectedQueueItem.scheduledAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last activity</p>
                      <p className="mt-1 text-sm text-foreground">{formatWf1RelativeTime(selectedQueueItem.lastActivity)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Content review</p>
                      <p className="mt-1 text-sm text-foreground">{selectedQueueItem.contentReviewStatus}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safety check</p>
                      <p className="mt-1 text-sm text-foreground">{selectedQueueItem.safetyCheckStatus}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dry-run</p>
                      <p className="mt-1 text-sm text-foreground">{selectedQueueItem.dryRunStatus}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human reason</p>
                      <p className="mt-1 text-sm text-foreground">{getWf1FailureReason(selectedQueueItem.humanReason, "Everything is ready.")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Next step: {getWf1ActionGuidance(selectedQueueItem.humanReason, selectedQueueItem.nextStep)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-4">
                  <p className="text-sm font-semibold text-primary">Media</p>
                  <p className="text-sm text-muted-foreground break-all">{selectedQueueItem.mediaUrl}</p>
                  {selectedQueueItem.mediaPreviewUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-border/60">
                      <img src={selectedQueueItem.mediaPreviewUrl} alt={selectedQueueItem.captionPreview} className="h-auto w-full object-cover" />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runDryRun(selectedQueueItem)} className="rounded-full">
                    Run dry-run
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => void approveItem(approvals.find((approval) => approval.queueId === selectedQueueItem.id) || null, "APPROVE")}>
                    Approve
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => void approveItem(approvals.find((approval) => approval.queueId === selectedQueueItem.id) || null, "REJECT")}>
                    Reject
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setRescheduleQueueId(selectedQueueItem.id)}>
                    Reschedule
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => void fallbackCurrent(selectedQueueItem)}>
                    Mark as fallback
                  </Button>
                  <Button variant="ghost" className="rounded-full text-rose-700" onClick={() => void cancelCurrent(selectedQueueItem)}>
                    Cancel
                  </Button>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="developer-details">
                    <AccordionTrigger>Advanced details</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          Asset ID: <span className="font-mono text-foreground">{selectedQueueTechnical?.assetId}</span>
                        </p>
                        <p>
                          Approval ID: <span className="font-mono text-foreground">{selectedQueueTechnical?.approvalId}</span>
                        </p>
                        <p>
                          G4 review ID: <span className="font-mono text-foreground">{selectedQueueTechnical?.g4ReviewId}</span>
                        </p>
                        <p>
                          Compliance run ID: <span className="font-mono text-foreground">{selectedQueueTechnical?.complianceRunId}</span>
                        </p>
                        <p>
                          Compliance token: <span className="font-mono text-foreground">{selectedQueueTechnical?.complianceToken}</span>
                        </p>
                        <p>
                          Account ID: <span className="font-mono text-foreground">{selectedQueueTechnical?.accountId}</span>
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(rescheduleQueueId)}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleQueueId(null);
            setRescheduleAt("");
            setRescheduleNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule post</DialogTitle>
            <DialogDescription>Choose a new time for this post. The action stays inside the admin panel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">New scheduled time</Label>
              <Input id="reschedule-time" type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-note">Note</Label>
              <Textarea
                id="reschedule-note"
                value={rescheduleNote}
                onChange={(event) => setRescheduleNote(event.target.value)}
                placeholder="Optional note for the activity log"
              />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              Current time: {rescheduleTarget ? formatWf1DateTime(rescheduleTarget.scheduledAt) : "Unknown"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleQueueId(null)}>
              Cancel
            </Button>
            <Button onClick={() => void rescheduleCurrent()} disabled={savingAction === "/api/admin/workflows/wf1/reschedule"}>
              Save new time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
