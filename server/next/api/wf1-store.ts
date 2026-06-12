import "server-only";

import { randomUUID } from "node:crypto";

import {
  WF1_WORKFLOW_ID,
  WF1_WORKFLOW_ROUTE,
  WF1_WORKFLOW_TITLE,
  formatWf1DateLabel,
  formatWf1DateTime,
  formatWf1RelativeTime,
  getWf1FailureReason,
  getWf1PublicStatus,
  type Wf1ApprovalItem,
  type Wf1BufferHealth,
  type Wf1ChecklistStatus,
  type Wf1ChecklistItem,
  type Wf1DetailResponse,
  type Wf1DryRunRecord,
  type Wf1DryRunStatus,
  type Wf1LogRecord,
  type Wf1PublicStatus,
  type Wf1QueueItem,
  type Wf1Settings,
  type Wf1SummaryCard,
  type Wf1TechnicalDetails,
  type Wf1TimelineStep,
} from "@/lib/wf1";
import { env } from "@/server/config";

type Wf1StoreState = {
  queue: Wf1QueueItem[];
  approvals: Wf1ApprovalItem[];
  dryRuns: Wf1DryRunRecord[];
  bufferHealth: Wf1BufferHealth;
  logs: Wf1LogRecord[];
  settings: Wf1Settings;
};

type QueueSeed = {
  id: string;
  captionPreview: string;
  fullCaption: string;
  mediaType: "Image" | "Carousel" | "Reel";
  mediaUrl: string;
  mediaPreviewUrl?: string | null;
  scheduledAt: string;
  contentReviewStatus: Wf1ChecklistStatus;
  approvalStatus: Wf1QueuedApprovalStatus;
  safetyCheckStatus: Wf1ChecklistStatus;
  dryRunStatus: Wf1DryRunStatus;
  status: Wf1PublicStatus;
  bufferState: "Healthy" | "Needs content" | "Attention needed" | "Unknown";
  lastActivity: string;
  lastRunAt?: string | null;
  nextStep: string;
  humanReason?: string | null;
  fallback: boolean;
  reviewer?: string | null;
  riskSummary?: string | null;
  technical: Wf1TechnicalDetails;
};

type Wf1QueuedApprovalStatus = "Waiting for approval" | "Approved" | "Rejected" | "Changes requested";

type Wf1ActionStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";

const NOW = Date.now();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const daysFromNow = (days: number, hour = 10, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const createPublicId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;

const createTechnicalDetails = (overrides: Partial<Wf1TechnicalDetails> = {}): Wf1TechnicalDetails => ({
  assetId: overrides.assetId || createPublicId("asset"),
  approvalId: overrides.approvalId || createPublicId("approval"),
  g4ReviewId: overrides.g4ReviewId || createPublicId("g4-review"),
  complianceRunId: overrides.complianceRunId || createPublicId("compliance-run"),
  complianceToken: overrides.complianceToken || createPublicId("compliance-token"),
  accountId: overrides.accountId || "ig-account-cevonne",
  webhookPath: overrides.webhookPath ?? null,
  requestId: overrides.requestId ?? null,
  n8nResponseType: overrides.n8nResponseType ?? null,
});

const clone = <T,>(value: T): T => structuredClone(value);

const isSoon = (value: string | null) => {
  if (!value) return false;
  const expires = new Date(value).getTime();
  if (Number.isNaN(expires)) return false;
  return expires - Date.now() < 48 * 3_600_000;
};

type BufferSnapshotInput = {
  approvedBufferDays: number;
  evergreenFallbackCount: number;
  tokenExpiresAt: string | null;
  accountHealth: Wf1BufferHealth["accountHealth"];
  recentDryRunCompletedAt: string | null;
  minimumBufferDays: number;
  minimumFallbackPosts: number;
};

const buildWf1BufferSnapshot = (input: BufferSnapshotInput) => {
  const missingContentWarnings: string[] = [];

  if (input.approvedBufferDays < input.minimumBufferDays) {
    missingContentWarnings.push(`Add approved content. WF1 needs at least ${input.minimumBufferDays} days of approved posts.`);
  }

  if (input.evergreenFallbackCount < input.minimumFallbackPosts) {
    missingContentWarnings.push(`Add fallback posts. WF1 needs at least ${input.minimumFallbackPosts} evergreen fallback posts.`);
  }

  if (isSoon(input.tokenExpiresAt)) {
    missingContentWarnings.push("Refresh the Instagram token before publishing.");
  }

  return {
    missingContentWarnings,
    urgentAction:
      missingContentWarnings.length === 0
        ? "Buffer is healthy."
        : missingContentWarnings.length === 1
          ? missingContentWarnings[0]
          : "Add approved content, fallback posts, and refresh the token before publishing.",
    checklist: [
      {
        label: `${input.minimumBufferDays}-day content buffer`,
        status: input.approvedBufferDays >= input.minimumBufferDays ? "Done" : "Waiting",
        detail: `${input.approvedBufferDays} day${input.approvedBufferDays === 1 ? "" : "s"} ready`,
      },
      {
        label: `${input.minimumFallbackPosts} fallback posts`,
        status: input.evergreenFallbackCount >= input.minimumFallbackPosts ? "Done" : "Waiting",
        detail: `${input.evergreenFallbackCount} evergreen fallback posts`,
      },
      {
        label: "Token valid",
        status: !isSoon(input.tokenExpiresAt) ? "Done" : "Waiting",
        detail: input.tokenExpiresAt ? "Token expiry is tracked" : "Token expiry needs review",
      },
      {
        label: "Account health clean",
        status: input.accountHealth === "Clean" ? "Done" : "Blocked",
        detail: input.accountHealth,
      },
      {
        label: "Recent dry-run completed",
        status: input.recentDryRunCompletedAt ? "Done" : "Not started",
        detail: input.recentDryRunCompletedAt ? formatWf1RelativeTime(input.recentDryRunCompletedAt) : "No recent dry-run yet",
      },
    ] as Wf1ChecklistItem[],
  };
};

const createInitialQueue = (): QueueSeed[] => [
  {
    id: "wf1-queue-001",
    captionPreview: "Weekend glow routine is ready for review",
    fullCaption:
      "Weekend glow routine is ready for review. We are waiting for final approval before the post is scheduled.",
    mediaType: "Carousel",
    mediaUrl: "https://cdn.cevonne.com/wf1/weekend-glow-carousel.jpg",
    mediaPreviewUrl: "https://cdn.cevonne.com/wf1/weekend-glow-carousel.jpg",
    scheduledAt: daysFromNow(0, 10, 0),
    contentReviewStatus: "Done",
    approvalStatus: "Waiting for approval",
    safetyCheckStatus: "Done",
    dryRunStatus: "Ready",
    status: "Dry run ready",
    bufferState: "Needs content",
    lastActivity: hoursAgo(1),
    lastRunAt: hoursAgo(3),
    nextStep: "Approve or reject this post.",
    humanReason: "APPROVED_CONTENT_BUFFER_BELOW_3_DAYS",
    fallback: false,
    reviewer: "Amina, Content Lead",
    riskSummary: "Low risk. Caption is ready but the content buffer is thin.",
    technical: createTechnicalDetails({
      assetId: "asset-wf1-001",
      approvalId: "approval-wf1-001",
      g4ReviewId: "g4-review-wf1-001",
      complianceRunId: "compliance-wf1-001",
      complianceToken: "compliance-token-wf1-001",
      accountId: "ig-account-cevonne",
      webhookPath: "wf1-schedule-dry-run",
      requestId: "wf1-request-001",
      n8nResponseType: "WF1_DRY_RUN_READY",
    }),
  },
  {
    id: "wf1-queue-002",
    captionPreview: "Launch day reminder is ready to go",
    fullCaption:
      "Launch day reminder is approved, dry-run complete, and ready for its scheduled window tomorrow afternoon.",
    mediaType: "Image",
    mediaUrl: "https://cdn.cevonne.com/wf1/launch-day-reminder.jpg",
    mediaPreviewUrl: "https://cdn.cevonne.com/wf1/launch-day-reminder.jpg",
    scheduledAt: daysFromNow(1, 13, 0),
    contentReviewStatus: "Done",
    approvalStatus: "Approved",
    safetyCheckStatus: "Done",
    dryRunStatus: "Completed",
    status: "Working",
    bufferState: "Healthy",
    lastActivity: minutesAgo(18),
    lastRunAt: minutesAgo(18),
    nextStep: "Keep the schedule moving.",
    fallback: false,
    reviewer: "Maya, Brand Lead",
    riskSummary: "Safe. Content review, approval, and dry-run are complete.",
    technical: createTechnicalDetails({
      assetId: "asset-wf1-002",
      approvalId: "approval-wf1-002",
      g4ReviewId: "g4-review-wf1-002",
      complianceRunId: "compliance-wf1-002",
      complianceToken: "compliance-token-wf1-002",
      accountId: "ig-account-cevonne",
      webhookPath: "wf1-schedule-dry-run",
      requestId: "wf1-request-002",
      n8nResponseType: "WF1_DRY_RUN_COMPLETED",
    }),
  },
  {
    id: "wf1-queue-003",
    captionPreview: "Evergreen backup post needs health review",
    fullCaption:
      "Evergreen backup post is paused because account health has not been confirmed yet. Please review the account before continuing.",
    mediaType: "Reel",
    mediaUrl: "https://cdn.cevonne.com/wf1/evergreen-backup-reel.mp4",
    mediaPreviewUrl: "https://cdn.cevonne.com/wf1/evergreen-backup-reel.jpg",
    scheduledAt: daysFromNow(2, 9, 30),
    contentReviewStatus: "Waiting",
    approvalStatus: "Waiting for approval",
    safetyCheckStatus: "Blocked",
    dryRunStatus: "Not executed",
    status: "Blocked",
    bufferState: "Attention needed",
    lastActivity: hoursAgo(5),
    lastRunAt: null,
    nextStep: "Update Instagram account health before the next dry-run.",
    humanReason: "ACCOUNT_HEALTH_NOT_CLEAN:UNKNOWN",
    fallback: true,
    reviewer: "Pending",
    riskSummary: "Blocked. Account health is unknown and the item is waiting for a review.",
    technical: createTechnicalDetails({
      assetId: "asset-wf1-003",
      approvalId: "approval-wf1-003",
      g4ReviewId: "g4-review-wf1-003",
      complianceRunId: "compliance-wf1-003",
      complianceToken: "compliance-token-wf1-003",
      accountId: "ig-account-cevonne",
      webhookPath: "wf1-schedule-dry-run",
      requestId: "wf1-request-003",
      n8nResponseType: "WF1_ACCOUNT_HEALTH_BLOCKED",
    }),
  },
];

const createInitialApprovals = (queue: QueueSeed[]): Wf1ApprovalItem[] => [
  {
    approvalId: queue[0].technical.approvalId,
    queueId: queue[0].id,
    captionPreview: queue[0].captionPreview,
    mediaPreviewUrl: queue[0].mediaPreviewUrl,
    createdAt: hoursAgo(4),
    reviewer: "Amina, Content Lead",
    riskSummary: queue[0].riskSummary || "Low risk.",
    status: "Waiting for approval",
    humanReason: queue[0].humanReason,
    queueStatus: queue[0].status,
    technical: queue[0].technical,
  },
  {
    approvalId: queue[2].technical.approvalId,
    queueId: queue[2].id,
    captionPreview: queue[2].captionPreview,
    mediaPreviewUrl: queue[2].mediaPreviewUrl,
    createdAt: hoursAgo(6),
    reviewer: "Brand and policy review",
    riskSummary: queue[2].riskSummary || "Medium risk.",
    status: "Waiting for approval",
    humanReason: queue[2].humanReason,
    queueStatus: queue[2].status,
    technical: queue[2].technical,
  },
];

const createInitialDryRuns = (queue: QueueSeed[]): Wf1DryRunRecord[] => [
  {
    dryRunId: createPublicId("dry-run"),
    queueId: queue[1].id,
    captionPreview: queue[1].captionPreview,
    scheduledAt: queue[1].scheduledAt,
    safetyStatus: queue[1].safetyCheckStatus,
    dryRunStatus: queue[1].dryRunStatus,
    notExecuted: false,
    lastRunAt: queue[1].lastRunAt || minutesAgo(18),
    result: "No Instagram post was published. This was only a safe dry-run.",
    humanReason: null,
    technical: queue[1].technical,
  },
  {
    dryRunId: createPublicId("dry-run"),
    queueId: queue[0].id,
    captionPreview: queue[0].captionPreview,
    scheduledAt: queue[0].scheduledAt,
    safetyStatus: queue[0].safetyCheckStatus,
    dryRunStatus: queue[0].dryRunStatus,
    notExecuted: true,
    lastRunAt: queue[0].lastRunAt || hoursAgo(3),
    result: "Waiting for approval before running the dry-run.",
    humanReason: queue[0].humanReason,
    technical: queue[0].technical,
  },
];

const createInitialBufferHealth = (): Wf1BufferHealth => ({
  approvedBufferDays: 2,
  evergreenFallbackCount: 3,
  tokenExpiresAt: new Date(NOW + 2 * 24 * 3_600_000).toISOString(),
  accountHealth: "Unknown",
  recentDryRunCompletedAt: hoursAgo(3),
  ...buildWf1BufferSnapshot({
    approvedBufferDays: 2,
    evergreenFallbackCount: 3,
    tokenExpiresAt: new Date(NOW + 2 * 24 * 3_600_000).toISOString(),
    accountHealth: "Unknown",
    recentDryRunCompletedAt: hoursAgo(3),
    minimumBufferDays: 3,
    minimumFallbackPosts: 5,
  }),
});

const createInitialSettings = (): Wf1Settings => ({
  instagramAccountId: "@cevonne.official",
  postingTimezone: "Asia/Kolkata",
  defaultPostingTimes: ["10:00 AM", "1:00 PM", "6:30 PM"],
  minimumBufferDays: 3,
  minimumFallbackPosts: 5,
  dryRunModeEnabled: true,
  livePublishingEnabled: false,
  tokenExpiresAt: new Date(NOW + 2 * 24 * 3_600_000).toISOString(),
  alertRecipients: ["admin@cevonne.com", "growth@cevonne.com"],
  rollbackActionAvailable: true,
});

const createInitialLogs = (queue: QueueSeed[]): Wf1LogRecord[] => [
  {
    logId: createPublicId("log"),
    time: hoursAgo(6),
    event: "Caption received",
    status: "Waiting",
    message: "A new caption entered the WF1 queue.",
    actor: "website",
    queueId: queue[0].id,
    approvalId: queue[0].technical.approvalId,
    severity: "info",
    technical: queue[0].technical,
  },
  {
    logId: createPublicId("log"),
    time: hoursAgo(5),
    event: "G4 content review passed",
    status: "Passed",
    message: "Content review completed without issues.",
    actor: "system",
    queueId: queue[0].id,
    approvalId: queue[0].technical.approvalId,
    severity: "success",
    technical: queue[0].technical,
  },
  {
    logId: createPublicId("log"),
    time: hoursAgo(4),
    event: "G5 approval requested",
    status: "Waiting for approval",
    message: "Human approval is still pending for the next scheduled post.",
    actor: "system",
    queueId: queue[0].id,
    approvalId: queue[0].technical.approvalId,
    severity: "warning",
    technical: queue[0].technical,
  },
  {
    logId: createPublicId("log"),
    time: hoursAgo(3),
    event: "Dry-run prepared",
    status: "Dry run ready",
    message: "No Instagram post was published. This was only a safe dry-run.",
    actor: "admin",
    queueId: queue[1].id,
    dryRunId: "dry-run-wf1-001",
    severity: "success",
    technical: queue[1].technical,
  },
  {
    logId: createPublicId("log"),
    time: hoursAgo(2),
    event: "Buffer health needs attention",
    status: "Needs review",
    message: "Approved content is below the recommended buffer.",
    actor: "system",
    severity: "warning",
    technical: queue[0].technical,
  },
  {
    logId: createPublicId("log"),
    time: hoursAgo(1),
    event: "Publishing result logged",
    status: "Manual only",
    message: "Live publishing stays off and WF1 remains in safe mode.",
    actor: "admin",
    severity: "info",
    technical: queue[1].technical,
  },
];

const createInitialState = (): Wf1StoreState => {
  const queue = createInitialQueue();
  const approvals = createInitialApprovals(queue);
  const dryRuns = createInitialDryRuns(queue);
  const bufferHealth = createInitialBufferHealth();
  const settings = createInitialSettings();
  const logs = createInitialLogs(queue);

  return {
    queue: queue.map((item) => ({
      id: item.id,
      captionPreview: item.captionPreview,
      fullCaption: item.fullCaption,
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl,
      mediaPreviewUrl: item.mediaPreviewUrl,
      scheduledAt: item.scheduledAt,
      contentReviewStatus: item.contentReviewStatus,
      approvalStatus: item.approvalStatus,
      safetyCheckStatus: item.safetyCheckStatus,
      dryRunStatus: item.dryRunStatus,
      status: item.status,
      bufferState: item.bufferState,
      lastActivity: item.lastActivity,
      lastRunAt: item.lastRunAt,
      nextStep: item.nextStep,
      humanReason: item.humanReason,
      fallback: item.fallback,
      reviewer: item.reviewer,
      riskSummary: item.riskSummary,
      technical: clone(item.technical),
    })),
    approvals: approvals.map((item) => clone(item)),
    dryRuns: dryRuns.map((item) => clone(item)),
    bufferHealth: clone(bufferHealth),
    logs: logs.map((item) => clone(item)),
    settings: clone(settings),
  };
};

const getStore = () => {
  const globalStore = globalThis as typeof globalThis & {
    __cevonneWf1Store?: Wf1StoreState;
  };

  if (!globalStore.__cevonneWf1Store) {
    globalStore.__cevonneWf1Store = createInitialState();
  }

  return globalStore.__cevonneWf1Store;
};

const trim = <T,>(records: T[], limit = 100) => {
  if (records.length > limit) {
    return records.slice(0, limit);
  }

  return records;
};

const sortByNewest = <T extends { time?: string | null; createdAt?: string | null; lastRunAt?: string | null; scheduledAt?: string | null }>(
  items: T[],
  key: "time" | "createdAt" | "lastRunAt" | "scheduledAt",
) => {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left[key] || "").getTime();
    const rightTime = new Date(right[key] || "").getTime();
    return rightTime - leftTime;
  });
};

const deriveSummary = (store: Wf1StoreState): Wf1SummaryCard => {
  const pendingApprovals = store.approvals.filter((approval) => approval.status === "Waiting for approval");
  const blockedItems = store.queue.filter((item) => item.status === "Blocked");
  const needsReviewItems = store.queue.filter(
    (item) => item.status === "Needs review" || item.contentReviewStatus === "Waiting" || item.safetyCheckStatus === "Waiting",
  );
  const dryRunReadyItems = store.queue.filter((item) => item.dryRunStatus === "Ready");
  const sortedQueue = sortByNewest(store.queue, "scheduledAt");
  const nextScheduledPost = sortedQueue.find((item) => new Date(item.scheduledAt).getTime() >= NOW) || sortedQueue[0];
  const latestLog = sortByNewest(store.logs, "time")[0];

  const bufferNeedsAttention =
    store.bufferHealth.approvedBufferDays < store.settings.minimumBufferDays ||
    store.bufferHealth.evergreenFallbackCount < store.settings.minimumFallbackPosts ||
    isSoon(store.bufferHealth.tokenExpiresAt);

  let status: Wf1PublicStatus = "Working";
  if (blockedItems.length > 0 || store.bufferHealth.accountHealth === "Unknown") {
    status = "Blocked";
  } else if (pendingApprovals.length > 0 || dryRunReadyItems.length > 0) {
    status = "Dry run ready";
  } else if (needsReviewItems.length > 0 || bufferNeedsAttention) {
    status = "Needs review";
  } else if (store.queue.some((item) => item.approvalStatus === "Waiting for approval")) {
    status = "Waiting";
  }

  const bufferLabel =
    store.bufferHealth.approvedBufferDays < store.settings.minimumBufferDays
      ? "Needs content"
      : store.bufferHealth.evergreenFallbackCount < store.settings.minimumFallbackPosts
        ? "Attention needed"
        : store.bufferHealth.accountHealth === "Clean"
          ? "Healthy"
          : "Needs content";

  const lastSafetyCheck = [
    `G4 ${pendingApprovals.length > 0 ? "waiting" : "passed"}`,
    `G5 ${pendingApprovals.length > 0 ? "waiting for approval" : "approved"}`,
    `G2 ${store.bufferHealth.accountHealth === "Clean" ? "clean" : "needs update"}`,
    `G1 ${blockedItems.length > 0 ? "blocked" : "safe"}`,
  ].join(" • ");

  const attentionParts = [
    pendingApprovals.length > 0 ? `${pendingApprovals.length} item${pendingApprovals.length === 1 ? "" : "s"} need review` : null,
    bufferNeedsAttention ? "Buffer needs attention" : null,
  ].filter(Boolean);

  return {
    workflowId: WF1_WORKFLOW_ID,
    title: WF1_WORKFLOW_TITLE,
    subtitle: "Keep Instagram posts in review, dry-run, and buffer-safe until you choose to publish.",
    status,
    attentionMessage: attentionParts.length > 0 ? attentionParts.join(" • ") : "No action needed right now.",
    lastActivity: latestLog ? formatWf1RelativeTime(latestLog.time) === "now" ? "Just now" : formatWf1RelativeTime(latestLog.time) : "Never",
    nextScheduledPost: nextScheduledPost
      ? `${formatWf1DateLabel(nextScheduledPost.scheduledAt)}, ${formatWf1DateTime(nextScheduledPost.scheduledAt).split(", ").slice(-1)[0] || ""}`
      : "No post scheduled",
    bufferHealth: bufferLabel as Wf1SummaryCard["bufferHealth"],
    approvalStatus: pendingApprovals.length > 0 ? "Waiting for approval" : "Approved",
    lastSafetyCheck,
    livePublishing: store.settings.livePublishingEnabled ? "Enabled" : "Disabled",
    queueCount: store.queue.length,
    approvalQueueCount: pendingApprovals.length,
    dryRunCount: store.dryRuns.length,
    detailsPath: WF1_WORKFLOW_ROUTE,
  };
};

const buildTimeline = (store: Wf1StoreState): Wf1TimelineStep[] => {
  const primary = store.queue[0];
  const approval = store.approvals.find((item) => item.queueId === primary?.id);

  return [
    {
      label: "Caption received",
      status: primary ? "Done" : "Not started",
      detail: primary ? "A caption entered the queue." : "Waiting for the next caption.",
    },
    {
      label: "Content reviewed",
      status: primary?.contentReviewStatus || "Not started",
      detail: primary ? `Content review is ${primary.contentReviewStatus.toLowerCase()}.` : "Waiting for review.",
    },
    {
      label: "Human approval",
      status: approval?.status === "Waiting for approval" ? "Waiting" : approval?.status === "Approved" ? "Done" : approval?.status === "Rejected" ? "Blocked" : "Not started",
      detail: approval ? `Approval is ${approval.status.toLowerCase()}.` : "Waiting for approval.",
    },
    {
      label: "Account health checked",
      status: store.bufferHealth.accountHealth === "Clean" ? "Done" : store.bufferHealth.accountHealth === "Unknown" ? "Waiting" : "Blocked",
      detail:
        store.bufferHealth.accountHealth === "Clean"
          ? "Instagram account health is clean."
          : store.bufferHealth.accountHealth === "Attention needed"
            ? "Instagram account health needs a quick review."
            : "Instagram account health is not confirmed yet.",
    },
    {
      label: "Safety check passed",
      status: primary?.safetyCheckStatus || "Not started",
      detail: primary ? `Safety check is ${primary.safetyCheckStatus.toLowerCase()}.` : "No safety check yet.",
    },
    {
      label: "Dry-run prepared",
      status: primary?.dryRunStatus === "Completed" ? "Done" : primary?.dryRunStatus === "Failed" ? "Blocked" : primary?.dryRunStatus === "Ready" ? "Waiting" : "Not started",
      detail:
        primary?.dryRunStatus === "Completed"
          ? "The safe dry-run finished successfully."
          : primary?.dryRunStatus === "Ready"
            ? "Dry-run is ready when you are."
            : primary?.dryRunStatus === "Failed"
              ? "Dry-run failed and needs attention."
              : "Dry-run has not been prepared yet.",
    },
    {
      label: "Ready for final publishing later",
      status: store.settings.livePublishingEnabled ? "Done" : "Waiting",
      detail: store.settings.livePublishingEnabled
        ? "Live publishing is allowed."
        : "Live publishing is off, so WF1 stays in safe mode.",
    },
  ];
};

const buildResponse = (store: Wf1StoreState): Wf1DetailResponse => ({
  workflow: deriveSummary(store),
  timeline: buildTimeline(store),
  queue: clone(sortByNewest(store.queue, "scheduledAt")),
  approvals: clone(sortByNewest(store.approvals, "createdAt")),
  dryRuns: clone(sortByNewest(store.dryRuns, "lastRunAt")),
  bufferHealth: clone(store.bufferHealth),
  logs: clone(sortByNewest(store.logs, "time")),
  settings: clone(store.settings),
  developerNotes: {
    webhookPaths: {
      intake: env.n8nWf1IntakePath,
      dryRun: env.n8nWf1DryRunPath,
      publishResult: env.n8nWf1PublishResultPath,
      bufferHealth: env.n8nWf1BufferHealthPath,
      approvalDecision: env.n8nG5ApprovalDecisionPath,
    },
  },
});

export const getWf1Detail = (): Wf1DetailResponse => {
  return buildResponse(getStore());
};

export const getWf1Summary = () => deriveSummary(getStore());

export const getWf1Queue = () => buildResponse(getStore()).queue;

export const getWf1Approvals = () => buildResponse(getStore()).approvals;

export const getWf1DryRuns = () => buildResponse(getStore()).dryRuns;

export const getWf1Logs = () => buildResponse(getStore()).logs;

export const getWf1BufferHealth = () => buildResponse(getStore()).bufferHealth;

export const getWf1Settings = () => buildResponse(getStore()).settings;

export const getWf1Timeline = () => buildResponse(getStore()).timeline;

export const getWf1QueueItem = (queueId: string) => getStore().queue.find((item) => item.id === queueId) || null;

export const getWf1ApprovalItem = (approvalId: string) => getStore().approvals.find((item) => item.approvalId === approvalId) || null;

export const getWf1DryRunItem = (dryRunId: string) => getStore().dryRuns.find((item) => item.dryRunId === dryRunId) || null;

export const appendWf1Log = (input: Omit<Wf1LogRecord, "logId" | "time"> & { time?: string }) => {
  const store = getStore();
  const log: Wf1LogRecord = {
    logId: createPublicId("log"),
    time: input.time || new Date().toISOString(),
    event: input.event,
    status: input.status,
    message: input.message,
    actor: input.actor,
    queueId: input.queueId ?? null,
    approvalId: input.approvalId ?? null,
    dryRunId: input.dryRunId ?? null,
    severity: input.severity,
    technical: clone(input.technical),
  };

  store.logs = trim([log, ...store.logs], 200);
  return clone(log);
};

export const replaceWf1BufferHealth = (bufferHealth: Wf1BufferHealth) => {
  const store = getStore();
  store.bufferHealth = clone(bufferHealth);
  store.settings = {
    ...store.settings,
    tokenExpiresAt: bufferHealth.tokenExpiresAt,
  };
  return clone(store.bufferHealth);
};

export const replaceWf1Settings = (settings: Wf1Settings) => {
  const store = getStore();
  store.settings = clone(settings);
  const snapshot = buildWf1BufferSnapshot({
    approvedBufferDays: store.bufferHealth.approvedBufferDays,
    evergreenFallbackCount: store.bufferHealth.evergreenFallbackCount,
    tokenExpiresAt: settings.tokenExpiresAt,
    accountHealth: store.bufferHealth.accountHealth,
    recentDryRunCompletedAt: store.bufferHealth.recentDryRunCompletedAt,
    minimumBufferDays: settings.minimumBufferDays,
    minimumFallbackPosts: settings.minimumFallbackPosts,
  });
  store.bufferHealth = {
    ...store.bufferHealth,
    tokenExpiresAt: settings.tokenExpiresAt,
    missingContentWarnings: snapshot.missingContentWarnings,
    urgentAction: snapshot.urgentAction,
    checklist: snapshot.checklist,
  };
  return clone(store.settings);
};

export const updateWf1QueueItem = (
  queueId: string,
  updater: (item: Wf1QueueItem) => void,
): Wf1QueueItem | null => {
  const store = getStore();
  const item = store.queue.find((entry) => entry.id === queueId);
  if (!item) return null;

  updater(item);
  return clone(item);
};

export const updateWf1ApprovalItem = (
  approvalId: string,
  updater: (item: Wf1ApprovalItem) => void,
): Wf1ApprovalItem | null => {
  const store = getStore();
  const item = store.approvals.find((entry) => entry.approvalId === approvalId);
  if (!item) return null;

  updater(item);
  return clone(item);
};

export const updateWf1DryRunItem = (
  dryRunId: string,
  updater: (item: Wf1DryRunRecord) => void,
): Wf1DryRunRecord | null => {
  const store = getStore();
  const item = store.dryRuns.find((entry) => entry.dryRunId === dryRunId);
  if (!item) return null;

  updater(item);
  return clone(item);
};

export const createWf1QueueItemFromIntake = (input: {
  assetId: string;
  approvalId: string;
  approvalStatus: string;
  g4ReviewId: string;
  contentText: string;
  mediaUrl: string;
  accountId: string;
  scheduledAt: string;
  actor: string;
  mediaPreviewUrl?: string | null;
}) => {
  const technical = createTechnicalDetails({
    assetId: input.assetId,
    approvalId: input.approvalId,
    g4ReviewId: input.g4ReviewId,
    accountId: input.accountId,
    webhookPath: env.n8nWf1IntakePath,
    requestId: createPublicId("wf1-request"),
  });

  const status = input.approvalStatus === "APPROVED" ? "Working" : input.approvalStatus === "REJECTED" ? "Blocked" : "Dry run ready";

  const queueItem: Wf1QueueItem = {
    id: createPublicId("wf1-queue"),
    captionPreview: input.contentText.slice(0, 80),
    fullCaption: input.contentText,
    mediaType: input.mediaUrl.match(/\.(mp4|mov|webm)$/i) ? "Reel" : input.mediaUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? "Image" : "Carousel",
    mediaUrl: input.mediaUrl,
    mediaPreviewUrl: input.mediaPreviewUrl ?? null,
    scheduledAt: input.scheduledAt,
    contentReviewStatus: input.g4ReviewId ? "Done" : "Waiting",
    approvalStatus: input.approvalStatus === "APPROVED" ? "Approved" : input.approvalStatus === "REJECTED" ? "Rejected" : input.approvalStatus === "REQUEST_CHANGES" ? "Changes requested" : "Waiting for approval",
    safetyCheckStatus: input.approvalStatus === "REJECTED" ? "Blocked" : "Done",
    dryRunStatus: "Not executed",
    status,
    bufferState: "Attention needed",
    lastActivity: new Date().toISOString(),
    lastRunAt: null,
    nextStep: "Continue through the safe workflow path.",
    humanReason: input.approvalStatus === "APPROVED" ? null : getWf1FailureReason(input.approvalStatus, "Waiting for approval."),
    fallback: false,
    reviewer: input.actor || "admin",
    riskSummary: "New intake created from the admin panel.",
    technical,
  };

  return queueItem;
};

export const upsertWf1QueueItem = (item: Wf1QueueItem) => {
  const store = getStore();
  const existingIndex = store.queue.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) {
    store.queue[existingIndex] = clone(item);
  } else {
    store.queue = [clone(item), ...store.queue];
  }

  return clone(item);
};

export const upsertWf1ApprovalItem = (item: Wf1ApprovalItem) => {
  const store = getStore();
  const existingIndex = store.approvals.findIndex((entry) => entry.approvalId === item.approvalId);
  if (existingIndex >= 0) {
    store.approvals[existingIndex] = clone(item);
  } else {
    store.approvals = [clone(item), ...store.approvals];
  }

  return clone(item);
};

export const upsertWf1DryRunItem = (item: Wf1DryRunRecord) => {
  const store = getStore();
  const existingIndex = store.dryRuns.findIndex((entry) => entry.dryRunId === item.dryRunId);
  if (existingIndex >= 0) {
    store.dryRuns[existingIndex] = clone(item);
  } else {
    store.dryRuns = [clone(item), ...store.dryRuns];
  }

  return clone(item);
};

export const markWf1QueueFallback = (queueId: string, fallback: boolean) => {
  return updateWf1QueueItem(queueId, (item) => {
    item.fallback = fallback;
    item.lastActivity = new Date().toISOString();
    item.nextStep = fallback ? "Use this evergreen post as backup content." : item.nextStep;
  });
};

export const cancelWf1QueueItem = (queueId: string, reason?: string | null) => {
  return updateWf1QueueItem(queueId, (item) => {
    item.status = "Cancelled";
    item.nextStep = "No further action is needed for this item.";
    item.humanReason = reason || "Cancelled from the admin panel.";
    item.lastActivity = new Date().toISOString();
    item.dryRunStatus = "Not executed";
  });
};

export const rescheduleWf1QueueItem = (queueId: string, scheduledAt: string) => {
  return updateWf1QueueItem(queueId, (item) => {
    item.scheduledAt = scheduledAt;
    item.lastActivity = new Date().toISOString();
    item.nextStep = "Await the new scheduled time.";
  });
};

export const recordWf1DryRunResult = (input: {
  queueId: string;
  dryRunId?: string | null;
  result: string;
  notExecuted: boolean;
  status: Wf1ActionStatus;
  responseType?: string | null;
  requestId?: string | null;
  actor: "admin" | "system" | "website";
  failureReason?: string | null;
}) => {
  const queueItem = getWf1QueueItem(input.queueId);
  if (!queueItem) return null;

  const dryRun: Wf1DryRunRecord = {
    dryRunId: input.dryRunId || createPublicId("dry-run"),
    queueId: queueItem.id,
    captionPreview: queueItem.captionPreview,
    scheduledAt: queueItem.scheduledAt,
    safetyStatus: queueItem.safetyCheckStatus,
    dryRunStatus: input.notExecuted ? "Not executed" : "Completed",
    notExecuted: input.notExecuted,
    lastRunAt: new Date().toISOString(),
    result: input.result,
    humanReason: input.failureReason ?? null,
    technical: createTechnicalDetails({
      assetId: queueItem.technical.assetId,
      approvalId: queueItem.technical.approvalId,
      g4ReviewId: queueItem.technical.g4ReviewId,
      complianceRunId: queueItem.technical.complianceRunId,
      complianceToken: queueItem.technical.complianceToken,
      accountId: queueItem.technical.accountId,
      webhookPath: env.n8nWf1DryRunPath,
      requestId: input.requestId ?? createPublicId("wf1-request"),
      n8nResponseType: input.responseType ?? null,
    }),
  };

  const store = getStore();
  store.dryRuns = [clone(dryRun), ...store.dryRuns];
  updateWf1QueueItem(queueItem.id, (item) => {
    item.dryRunStatus = input.notExecuted ? "Not executed" : "Completed";
    item.lastRunAt = dryRun.lastRunAt;
    item.lastActivity = dryRun.lastRunAt;
    item.status = input.status === "BLOCK" ? "Blocked" : input.status === "MANUAL_ONLY" ? "Manual only" : input.status === "ERROR" ? "System error" : queueItem.status;
    item.humanReason = input.failureReason ?? item.humanReason ?? null;
  });

  const record = appendWf1Log({
    event: "Dry-run prepared",
    status: input.notExecuted ? "Waiting" : "Dry run ready",
    message: input.result,
    actor: input.actor,
    queueId: queueItem.id,
    dryRunId: dryRun.dryRunId,
    severity: input.notExecuted ? "warning" : "success",
    technical: dryRun.technical,
  });

  return {
    dryRun: clone(dryRun),
    log: record,
  };
};

export const recordWf1ApprovalDecision = (input: {
  approvalId: string;
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  actor: "admin" | "system" | "website";
  requestId?: string | null;
  responseType?: string | null;
  note?: string | null;
}) => {
  const approval = getWf1ApprovalItem(input.approvalId);
  if (!approval) return null;

  const nextStatus: Wf1QueuedApprovalStatus =
    input.decision === "APPROVE" ? "Approved" : input.decision === "REJECT" ? "Rejected" : "Changes requested";

  updateWf1ApprovalItem(approval.approvalId, (item) => {
    item.status = nextStatus;
    item.humanReason = input.note ?? item.humanReason ?? null;
    item.technical = createTechnicalDetails({
      assetId: item.technical.assetId,
      approvalId: item.technical.approvalId,
      g4ReviewId: item.technical.g4ReviewId,
      complianceRunId: item.technical.complianceRunId,
      complianceToken: item.technical.complianceToken,
      accountId: item.technical.accountId,
      webhookPath: env.n8nG5ApprovalDecisionPath,
      requestId: input.requestId ?? createPublicId("wf1-request"),
      n8nResponseType: input.responseType ?? null,
    });
  });

  const queueItem = getWf1QueueItem(approval.queueId);
  if (queueItem) {
    updateWf1QueueItem(queueItem.id, (item) => {
      item.approvalStatus = nextStatus;
      item.lastActivity = new Date().toISOString();
      if (nextStatus === "Approved") {
        item.status = item.dryRunStatus === "Completed" ? "Working" : "Dry run ready";
      } else if (nextStatus === "Rejected") {
        item.status = "Blocked";
      } else {
        item.status = "Needs review";
      }
      item.humanReason = input.note ?? item.humanReason ?? null;
    });
  }

  const log = appendWf1Log({
    event: `Approval ${input.decision.toLowerCase()}`,
    status: nextStatus,
    message: input.note || `${approval.captionPreview} has been ${nextStatus.toLowerCase()}.`,
    actor: input.actor,
    queueId: approval.queueId,
    approvalId: approval.approvalId,
    severity: input.decision === "APPROVE" ? "success" : input.decision === "REJECT" ? "blocked" : "warning",
    technical: approval.technical,
  });

  const updatedApproval = getWf1ApprovalItem(approval.approvalId);

  return {
    approval: updatedApproval ? clone(updatedApproval) : null,
    log,
  };
};

export const recordWf1BufferHealth = (input: {
  approvedBufferDays?: number;
  evergreenFallbackCount?: number;
  tokenExpiresAt?: string | null;
  accountHealth?: "Clean" | "Attention needed" | "Unknown";
  missingContentWarnings?: string[];
  urgentAction?: string;
  recentDryRunCompletedAt?: string | null;
  actor: "admin" | "system" | "website";
  requestId?: string | null;
  responseType?: string | null;
}) => {
  const store = getStore();
  const approvedBufferDays = input.approvedBufferDays ?? store.bufferHealth.approvedBufferDays;
  const evergreenFallbackCount = input.evergreenFallbackCount ?? store.bufferHealth.evergreenFallbackCount;
  const tokenExpiresAt = input.tokenExpiresAt ?? store.bufferHealth.tokenExpiresAt;
  const accountHealth = input.accountHealth ?? store.bufferHealth.accountHealth;
  const recentDryRunCompletedAt = input.recentDryRunCompletedAt ?? store.bufferHealth.recentDryRunCompletedAt;
  const snapshot = buildWf1BufferSnapshot({
    approvedBufferDays,
    evergreenFallbackCount,
    tokenExpiresAt,
    accountHealth,
    recentDryRunCompletedAt,
    minimumBufferDays: store.settings.minimumBufferDays,
    minimumFallbackPosts: store.settings.minimumFallbackPosts,
  });
  if (input.tokenExpiresAt !== undefined) {
    store.settings = {
      ...store.settings,
      tokenExpiresAt,
    };
  }
  store.bufferHealth = {
    ...store.bufferHealth,
    approvedBufferDays,
    evergreenFallbackCount,
    tokenExpiresAt,
    accountHealth,
    missingContentWarnings: input.missingContentWarnings ?? snapshot.missingContentWarnings,
    urgentAction: input.urgentAction ?? snapshot.urgentAction,
    recentDryRunCompletedAt,
    checklist: snapshot.checklist,
  };

  const log = appendWf1Log({
    event: "Buffer health checked",
    status: store.bufferHealth.approvedBufferDays >= store.settings.minimumBufferDays ? "Passed" : "Needs review",
    message: store.bufferHealth.urgentAction,
    actor: input.actor,
    severity: store.bufferHealth.approvedBufferDays >= store.settings.minimumBufferDays ? "success" : "warning",
    technical: createTechnicalDetails({
      webhookPath: env.n8nWf1BufferHealthPath,
      requestId: input.requestId ?? createPublicId("wf1-request"),
      n8nResponseType: input.responseType ?? null,
    }),
  });

  return {
    bufferHealth: clone(store.bufferHealth),
    log,
  };
};

export const recordWf1PublishResult = (input: {
  queueId?: string | null;
  result: string;
  actor: "admin" | "system" | "website";
  requestId?: string | null;
  responseType?: string | null;
}) => {
  const queueItem = input.queueId ? getWf1QueueItem(input.queueId) : null;
  const technical = createTechnicalDetails({
    assetId: queueItem?.technical.assetId,
    approvalId: queueItem?.technical.approvalId,
    g4ReviewId: queueItem?.technical.g4ReviewId,
    complianceRunId: queueItem?.technical.complianceRunId,
    complianceToken: queueItem?.technical.complianceToken,
    accountId: queueItem?.technical.accountId,
    webhookPath: env.n8nWf1PublishResultPath,
    requestId: input.requestId ?? createPublicId("wf1-request"),
    n8nResponseType: input.responseType ?? null,
  });

  const log = appendWf1Log({
    event: "Publishing result logged",
    status: "Manual only",
    message: input.result,
    actor: input.actor,
    queueId: queueItem?.id ?? null,
    severity: "info",
    technical,
  });

  return {
    log,
  };
};

export const recordWf1Intake = (input: {
  contentText: string;
  assetId: string;
  approvalId: string;
  approvalStatus: string;
  g4ReviewId: string;
  mediaUrl: string;
  mediaPreviewUrl?: string | null;
  accountId: string;
  scheduledAt: string;
  actor: "admin" | "system" | "website";
  requestId?: string | null;
  responseType?: string | null;
}) => {
  const queueItem = createWf1QueueItemFromIntake(input);
  queueItem.technical.requestId = input.requestId ?? queueItem.technical.requestId;
  queueItem.technical.n8nResponseType = input.responseType ?? queueItem.technical.n8nResponseType;
  queueItem.nextStep = "Wait for review, approval, and a safe dry-run.";
  queueItem.contentReviewStatus = input.g4ReviewId ? "Done" : "Waiting";
  queueItem.approvalStatus = input.approvalStatus === "APPROVED" ? "Approved" : input.approvalStatus === "REJECTED" ? "Rejected" : "Waiting for approval";

  upsertWf1QueueItem(queueItem);

  const approval: Wf1ApprovalItem = {
    approvalId: queueItem.technical.approvalId,
    queueId: queueItem.id,
    captionPreview: queueItem.captionPreview,
    mediaPreviewUrl: queueItem.mediaPreviewUrl,
    createdAt: new Date().toISOString(),
    reviewer: "WF1 intake",
    riskSummary: "New intake received from the admin panel.",
    status: queueItem.approvalStatus,
    humanReason: queueItem.humanReason ?? null,
    queueStatus: queueItem.status,
    technical: clone(queueItem.technical),
  };

  upsertWf1ApprovalItem(approval);

  const log = appendWf1Log({
    event: "Caption intake received",
    status: queueItem.status,
    message: queueItem.captionPreview,
    actor: input.actor,
    queueId: queueItem.id,
    approvalId: approval.approvalId,
    severity: queueItem.status === "Blocked" ? "blocked" : "info",
    technical: queueItem.technical,
  });

  return {
    queueItem: clone(queueItem),
    approval: clone(approval),
    log,
  };
};
