import { describe, expect, it } from "vitest";

import { getG5PrimaryAction, type G5PublishingSchedulerDetail } from "@/lib/admin/g5-publishing-scheduler";

const buildSelectedAsset = (): G5PublishingSchedulerDetail["selectedAsset"] => ({
  assetId: "asset-123",
  title: "Campaign Launch",
  contentPreview: "Approved copy for the launch",
  mediaReference: "media-recorded",
  storageReference: "storage-recorded",
  g4ReviewId: "g4-review-123",
  approvalId: "g5-approval-123",
  platform: "WEBSITE",
  accountId: "account-123",
  actionType: "PUBLISH_DRY_RUN",
  g4ReviewStatus: "PASS",
  g4ApprovalState: "APPROVED",
  riskSummary: "No material risks recorded.",
  claimContentResult: "Claim checks passed.",
  aiReviewSummary: "AI review passed.",
  evidenceNote: "Evidence recorded in Supabase.",
  liveExecutionEnabled: true,
  rollbackPayload: "rollback-recorded",
  finalHumanApprovalState: "APPROVED",
  accountHealthStatus: "PASS",
});

describe("G5 publishing scheduler primary action", () => {
  it("offers the dry-run action only after the real prerequisites are present", () => {
    const action = getG5PrimaryAction({
      status: "FIX_FIRST",
      readiness: {
        g4Review: "PASS",
        g5Approval: "PASS",
        g1Compliance: "PASS",
        g2AccountHealth: "PASS",
        mediaReference: "PASS",
        storageReference: "PASS",
        publishingDryRun: "NOT_RUN_YET",
        rollbackPayload: "PASS",
        finalHumanApproval: "PASS",
      },
      selectedAsset: buildSelectedAsset(),
    });

    expect(action.kind).toBe("run_dry_run");
    expect(action.disabled).toBe(false);
    expect(action.description).toContain("Validate the approved asset");
  });

  it("routes missing review evidence back to G4", () => {
    const action = getG5PrimaryAction({
      status: "NEEDS_EVIDENCE",
      readiness: {
        g4Review: "NEEDS_EVIDENCE",
        g5Approval: "PASS",
        g1Compliance: "PASS",
        g2AccountHealth: "PASS",
        mediaReference: "PASS",
        storageReference: "PASS",
        publishingDryRun: "NOT_RUN_YET",
        rollbackPayload: "PASS",
        finalHumanApproval: "PASS",
      },
      selectedAsset: {
        ...buildSelectedAsset(),
        g4ReviewId: null,
      },
    });

    expect(action.kind).toBe("open_g4");
    expect(action.href).toBe("/dashboard/n8n-automations/g4");
  });
});
