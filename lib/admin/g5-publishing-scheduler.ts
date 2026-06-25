import { type G4WorkflowDetail } from "@/lib/admin/g4-content-review";
import { type WorkflowUiStatus } from "@/lib/admin/workflows";

export type G5PublishingSchedulerStatus = WorkflowUiStatus;

export type G5ReadinessValue = G5PublishingSchedulerStatus;

export type G5PublishingSchedulerReadiness = {
  g4Review: G5ReadinessValue;
  g5Approval: G5ReadinessValue;
  g1Compliance: G5ReadinessValue;
  g2AccountHealth: G5ReadinessValue;
  mediaReference: G5ReadinessValue;
  storageReference: G5ReadinessValue;
  publishingDryRun: G5ReadinessValue;
  rollbackPayload: G5ReadinessValue;
  finalHumanApproval: G5ReadinessValue;
};

export type G5PublishingSelectedAsset = {
  assetId: string | null;
  title: string | null;
  contentPreview: string | null;
  mediaReference: string | null;
  storageReference: string | null;
  g4ReviewId: string | null;
  approvalId: string | null;
  platform: string | null;
  accountId: string | null;
  actionType: string | null;
  g4ReviewStatus: G5ReadinessValue | null;
  g4ApprovalState: string | null;
  riskSummary: string | null;
  claimContentResult: string | null;
  aiReviewSummary: string | null;
  evidenceNote: string | null;
  liveExecutionEnabled: boolean | null;
  rollbackPayload: string | null;
  finalHumanApprovalState: string | null;
  accountHealthStatus: string | null;
};

export type G5PublishingOutcome = {
  time: string | null;
  stage: string;
  status: G5PublishingSchedulerStatus;
  whatHappened: string;
  actionNeeded: string;
  details: string | null;
  handledAt: string | null;
  result: G5PublishingSchedulerStatus;
  sourceLabel: string | null;
};

export type G5PublishingLatestOutcome = {
  result: G5PublishingSchedulerStatus;
  summary: string;
  actionNeeded: string;
  handledAt: string | null;
  stage: string | null;
  details: string | null;
};

export type G5PublishingSchedulerDetail = {
  workflowGroup: "G5";
  title: "Publishing Scheduler";
  purpose: string;
  status: G5PublishingSchedulerStatus;
  lastRunAt: string | null;
  latestOutcome: G5PublishingLatestOutcome;
  readiness: G5PublishingSchedulerReadiness;
  selectedAsset: G5PublishingSelectedAsset;
  recentOutcomes: G5PublishingOutcome[];
  g4Detail?: G4WorkflowDetail | null;
};

export type G5PrimaryAction = {
  kind: "run_dry_run" | "open_g4" | "attach_media" | "open_approval" | "view_account_health" | "view_safety_checks" | "refresh";
  label: string;
  description: string;
  href: string | null;
  tone: "default" | "outline";
  disabled: boolean;
};

export const G5_PUBLISHING_TITLE = "Publishing Scheduler" as const;
export const G5_PUBLISHING_PURPOSE =
  "Schedules approved assets only after review, dry-run, and live safety checks are complete." as const;

export const getG5StatusTone = (status: G5PublishingSchedulerStatus) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "DRY_RUN":
      return "border-cyan-200 bg-cyan-100 text-cyan-800";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-100 text-sky-800";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "BLOCK":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "MANUAL_ONLY":
      return "border-violet-200 bg-violet-100 text-violet-800";
    case "RECOMMENDATION_ONLY":
      return "border-violet-200 bg-violet-100 text-violet-800";
    case "DO_NOT_SCALE":
      return "border-orange-200 bg-orange-100 text-orange-800";
    case "FIX_FIRST":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "NOT_RUN_YET":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "ERROR":
    default:
      return "border-rose-200 bg-rose-100 text-rose-800";
  }
};

export const getG5StatusLabel = (status: G5PublishingSchedulerStatus) => {
  switch (status) {
    case "PASS":
      return "Pass";
    case "DRY_RUN":
      return "Dry run";
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "BLOCK":
      return "Blocked";
    case "MANUAL_ONLY":
      return "Manual only";
    case "RECOMMENDATION_ONLY":
      return "Recommendation only";
    case "DO_NOT_SCALE":
      return "Do not scale";
    case "FIX_FIRST":
      return "Fix first";
    case "NOT_RUN_YET":
      return "Not run yet";
    case "ERROR":
    default:
      return "Error";
  }
};

export const getG5StatusMessage = (status: G5PublishingSchedulerStatus) => {
  switch (status) {
    case "PASS":
      return "A live publish or schedule completed successfully.";
    case "DRY_RUN":
      return "Publishing dry-run completed safely. No live post was scheduled.";
    case "PENDING_APPROVAL":
      return "Publishing is blocked safely until the asset is approved.";
    case "NEEDS_EVIDENCE":
      return "Publishing is not ready because required evidence is missing.";
    case "BLOCK":
      return "Publishing was safely stopped.";
    case "MANUAL_ONLY":
      return "Live publishing is manual-only for this asset.";
    case "RECOMMENDATION_ONLY":
      return "The workflow created a recommendation only. Nothing was executed.";
    case "DO_NOT_SCALE":
      return "This should not be scaled right now.";
    case "FIX_FIRST":
      return "Approved asset found, but publishing dry-run has not been completed.";
    case "NOT_RUN_YET":
      return "No real G5 outcomes have been recorded yet.";
    case "ERROR":
    default:
      return "The publishing scheduler could not be loaded or completed.";
  }
};

export const getG5ActionNeeded = (status: G5PublishingSchedulerStatus) => {
  switch (status) {
    case "PASS":
      return "No action needed.";
    case "DRY_RUN":
      return "Review the dry-run result before enabling live scheduling.";
    case "PENDING_APPROVAL":
      return "Open approval and record the missing decision.";
    case "NEEDS_EVIDENCE":
      return "Attach the missing evidence before trying again.";
    case "BLOCK":
      return "Review the blocker and stop unsafe publishing.";
    case "MANUAL_ONLY":
      return "Keep publishing manual-only until the remaining checks are complete.";
    case "RECOMMENDATION_ONLY":
      return "Review the recommendation before proceeding.";
    case "DO_NOT_SCALE":
      return "Do not scale this right now.";
    case "FIX_FIRST":
      return "Run the publishing dry-run before moving forward.";
    case "NOT_RUN_YET":
      return "Review the asset and complete the required checks.";
    case "ERROR":
    default:
      return "Ask admin or developer to check the workflow state.";
  }
};

export const isG5DryRunOutcome = (outcome: Pick<G5PublishingOutcome, "stage" | "status">) => {
  const stage = outcome.stage.toLowerCase();
  return stage.includes("dry run") || stage.includes("dry-run") || outcome.status === "DRY_RUN";
};

export const isG5PublishOutcome = (outcome: Pick<G5PublishingOutcome, "stage" | "status">) => {
  const stage = outcome.stage.toLowerCase();
  return stage.includes("publish") || stage.includes("schedule") || outcome.status === "PASS";
};

export const isG5BlockingOutcome = (outcome: Pick<G5PublishingOutcome, "status">) =>
  outcome.status === "BLOCK" || outcome.status === "ERROR" || outcome.status === "NEEDS_EVIDENCE" || outcome.status === "FIX_FIRST";

export const getG5PrimaryAction = (detail: Pick<G5PublishingSchedulerDetail, "status" | "readiness" | "selectedAsset"> | null): G5PrimaryAction => {
  if (!detail) {
    return {
      kind: "refresh",
      label: "Refresh Status",
      description: "Load the latest publishing scheduler state.",
      href: null,
      tone: "outline",
      disabled: false,
    };
  }

  const { readiness, selectedAsset, status } = detail;

  if (!selectedAsset.g4ReviewId || readiness.g4Review === "NEEDS_EVIDENCE") {
    return {
      kind: "open_g4",
      label: "Open G4 Content Check",
      description: "Publishing is blocked safely because the asset has not passed G4 content review.",
      href: "/dashboard/n8n-automations/g4",
      tone: "default",
      disabled: false,
    };
  }

  if (!selectedAsset.approvalId || readiness.g5Approval === "PENDING_APPROVAL") {
    return {
      kind: "open_approval",
      label: "Open Approval",
      description: "Publishing needs the G5 approval record before it can continue.",
      href: "/dashboard/n8n-automations/g5",
      tone: "default",
      disabled: false,
    };
  }

  if (readiness.mediaReference === "NEEDS_EVIDENCE" || readiness.storageReference === "NEEDS_EVIDENCE") {
    return {
      kind: "attach_media",
      label: "Attach Media",
      description: "Publishing is not ready because no approved media file is attached.",
      href: null,
      tone: "default",
      disabled: false,
    };
  }

  if (readiness.g2AccountHealth === "NEEDS_EVIDENCE" || readiness.g2AccountHealth === "BLOCK") {
    return {
      kind: "view_account_health",
      label: "View Account Health",
      description: "Check account health before running the publishing dry-run.",
      href: "/dashboard/n8n-automations/g2",
      tone: "outline",
      disabled: false,
    };
  }

  if (readiness.g1Compliance === "NEEDS_EVIDENCE" || readiness.g1Compliance === "BLOCK") {
    return {
      kind: "view_safety_checks",
      label: "View Safety Checks",
      description: "Publishing dry-run was stopped because safety checks did not pass.",
      href: "/dashboard/n8n-automations/g1",
      tone: "outline",
      disabled: false,
    };
  }

  if (status === "FIX_FIRST" || readiness.publishingDryRun === "NOT_RUN_YET") {
    return {
      kind: "run_dry_run",
      label: "Run Publishing Dry Run",
      description: "Validate the approved asset before scheduling.",
      href: null,
      tone: "default",
      disabled: false,
    };
  }

  return {
    kind: "refresh",
    label: "Refresh Status",
    description: getG5StatusMessage(status),
    href: null,
    tone: "outline",
    disabled: false,
  };
};
