import { describe, expect, it } from "vitest";

import { normalizeG1AuditRows } from "../lib/g1-compliance-guard";
import { buildG1ComplianceGuardSnapshotFromRows, describeG1Outcome, getG1RemediationAction } from "../server/next/api/g1-compliance-guard-ui";

describe("G1 compliance guard normalization", () => {
  it("translates Supabase compliance_runs rows into client-safe workflow labels", () => {
    const rows = normalizeG1AuditRows([
      {
        created_at: "2026-06-12T06:39:08.739885+00:00",
        workflow_group: "WF1",
        workflow_id: "WF1",
        action_type: "IG_PUBLISH_POST",
        platform: "INSTAGRAM",
        status: "PASS",
        fail_reason: null,
        action_packet: {
          requested_by_workflow: "WF1",
          workflow_group: "WF1",
          workflow_id: "WF1",
          action_type: "IG_PUBLISH_POST",
          platform: "INSTAGRAM",
          metadata: {
            g5_approval_id: "71bb2e2d-2732-4806-8f68-df0855a864a8",
          },
        },
      },
      {
        created_at: "2026-06-02T09:40:32.679491+00:00",
        workflow_group: "G9",
        workflow_id: "G9",
        action_type: "META_UPDATE_ADSET_BUDGET",
        platform: "META",
        status: "BLOCK",
        fail_reason: "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
        action_packet: {
          requested_by_workflow: "G9",
          workflow_group: "G9",
          workflow_id: "G9",
          action_type: "META_UPDATE_ADSET_BUDGET",
          platform: "META",
          g1_failure_reasons: ["HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED"],
        },
      },
      {
        created_at: "2026-06-20T07:00:00.000Z",
        workflow_group: "G1",
        workflow_id: "G1",
        action_type: "COMPLIANCE_CHECK",
        platform: "INTERNAL",
        status: "PASS",
        fail_reason: null,
        action_packet: {
          requested_by_workflow: "G1",
          workflow_group: "G1",
          workflow_id: "G1",
          action_type: "COMPLIANCE_CHECK",
          platform: "INTERNAL",
        },
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      requestedByWorkflow: "G5 Publishing",
      requestedByWorkflowGroup: "G5",
      actionTypeLabel: "Instagram post publish",
      platform: "Instagram",
    });
    expect(rows[1]).toMatchObject({
      requestedByWorkflow: "G9 Ads",
      requestedByWorkflowGroup: "G9",
      actionTypeLabel: "Meta budget change",
      platform: "Meta",
      technicalReason: "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
      failureReason: "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
    });
  });

  it("maps client-friendly safety outcome text", () => {
    expect(
      describeG1Outcome({
        time: "2026-06-23T10:30:00.000Z",
        requestedBy: "G10 SEO + CRO",
        requestedByWorkflow: "G10 SEO + CRO",
        requestedByWorkflowGroup: "G10",
        workflowId: "G10",
        action: "Google data collection",
        actionType: "GOOGLE_SCRAPE",
        actionTypeLabel: "Google data collection",
        platform: "Google",
        decision: "BLOCK",
        technicalReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
        failureReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
      }),
    ).toMatchObject({
      result: "BLOCK",
      checked: "G10 SEO + CRO · Google data collection · Google Search",
      requestedByWorkflow: "G10 SEO + CRO",
      actionTypeLabel: "Google data collection",
      platformLabel: "Google Search",
      workflowDetailHref: "/dashboard/n8n-automations/g10",
      technicalReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
      whatHappened: "Workflow safely stopped the action.",
      actionNeeded: "Use approved Google sources only.",
      whyItBlocked: "Google scraping is not allowed for this workflow.",
      insight: "Use Search Console, GA4, or approved exports instead of scraping.",
    });

    expect(
      describeG1Outcome({
        time: "2026-06-23T10:00:00.000Z",
        requestedBy: "G4 Content Review",
        requestedByWorkflow: "G4 Content Review",
        requestedByWorkflowGroup: "G4",
        workflowId: "G4",
        action: "Workflow action check",
        actionType: "WORKFLOW_ACTION",
        actionTypeLabel: "Workflow action check",
        platform: "Internal system",
        decision: "NEEDS_EVIDENCE",
        technicalReason: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
        failureReason: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
      }),
    ).toMatchObject({
      result: "NEEDS_EVIDENCE",
      requestedByWorkflow: "G4 Content Review",
      actionTypeLabel: "Workflow action check",
      platformLabel: "Internal system",
      workflowDetailHref: "/dashboard/n8n-automations/g4",
      whatHappened: "Human review is needed before this can continue.",
      actionNeeded: "Open content review.",
      whyItBlocked: "This item needs a valid G4 content review.",
    });

    expect(
      describeG1Outcome({
        time: "2026-06-23T09:45:00.000Z",
        requestedBy: "G5 Publishing",
        requestedByWorkflow: "G5 Publishing",
        requestedByWorkflowGroup: "G5",
        workflowId: "G5",
        action: "Instagram post publish",
        actionType: "IG_PUBLISH_POST",
        actionTypeLabel: "Instagram post publish",
        platform: "Instagram",
        decision: "BLOCK",
        technicalReason: "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
        failureReason: "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
      }),
    ).toMatchObject({
      result: "BLOCK",
      actionNeeded: "Add a rollback plan before publishing.",
      whyItBlocked: "G1 needs a rollback plan before a live change can run.",
      insight: "Prepare a rollback plan so this change can be reversed safely.",
    });

    expect(
      describeG1Outcome({
        time: "2026-06-23T09:30:00.000Z",
        requestedBy: "G5 Publishing",
        requestedByWorkflow: "G5 Publishing",
        requestedByWorkflowGroup: "G5",
        workflowId: "G5",
        action: "Instagram post publish",
        actionType: "IG_PUBLISH_POST",
        actionTypeLabel: "Instagram post publish",
        platform: "Instagram",
        decision: "PENDING_APPROVAL",
        technicalReason: "MISSING_OR_INVALID_G5_APPROVAL",
        failureReason: "MISSING_OR_INVALID_G5_APPROVAL",
      }),
    ).toMatchObject({
      result: "PENDING_APPROVAL",
      requestedByWorkflow: "G5 Publishing",
      actionTypeLabel: "Instagram post publish",
      platformLabel: "Instagram",
      workflowDetailHref: "/dashboard/n8n-automations/g5",
      whatHappened: "This is waiting for approval.",
      actionNeeded: "Open approval queue.",
      whyItBlocked: "This item needs G5 approval before continuing.",
    });
  });

  it("maps G1 outcomes to specific remediation actions", () => {
    expect(
      getG1RemediationAction(
        describeG1Outcome({
          time: "2026-06-23T09:45:00.000Z",
          requestedBy: "G5 Publishing",
          requestedByWorkflow: "G5 Publishing",
          requestedByWorkflowGroup: "G5",
          workflowId: "G5",
          action: "Instagram post publish",
          actionType: "IG_PUBLISH_POST",
          actionTypeLabel: "Instagram post publish",
          platform: "Instagram",
          decision: "BLOCK",
          technicalReason: "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
          failureReason: "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
        }),
      ),
    ).toMatchObject({
      label: "Add Rollback Plan",
      helperText: "Add a rollback plan before publishing.",
      href: "/dashboard/n8n-automations/g5",
      disabled: false,
    });

    expect(
      getG1RemediationAction(
        describeG1Outcome({
          time: "2026-06-23T10:30:00.000Z",
          requestedBy: "G10 SEO + CRO",
          requestedByWorkflow: "G10 SEO + CRO",
          requestedByWorkflowGroup: "G10",
          workflowId: "G10",
          action: "Google data collection",
          actionType: "GOOGLE_SCRAPE",
          actionTypeLabel: "Google data collection",
          platform: "Google",
          decision: "BLOCK",
          technicalReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
          failureReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
        }),
      ),
    ).toMatchObject({
      label: "Use Approved Google Source",
      helperText: "Use Search Console, GA4, or approved exports instead of scraping.",
      href: "/dashboard/n8n-automations/g10",
      disabled: false,
    });

    expect(
      getG1RemediationAction(
        describeG1Outcome({
          time: "2026-06-23T10:00:00.000Z",
          requestedBy: "G4 Content Review",
          requestedByWorkflow: "G4 Content Review",
          requestedByWorkflowGroup: "G4",
          workflowId: "G4",
          action: "Workflow action check",
          actionType: "WORKFLOW_ACTION",
          actionTypeLabel: "Workflow action check",
          platform: "Internal system",
          decision: "NEEDS_EVIDENCE",
          technicalReason: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
          failureReason: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
        }),
      ),
    ).toMatchObject({
      label: "Open Content Review",
      helperText: "Complete the content review before publishing.",
      href: "/dashboard/n8n-automations/g4",
      disabled: false,
    });

    expect(
      getG1RemediationAction(
        describeG1Outcome({
          time: "2026-06-23T09:30:00.000Z",
          requestedBy: "G5 Publishing",
          requestedByWorkflow: "G5 Publishing",
          requestedByWorkflowGroup: "G5",
          workflowId: "G5",
          action: "Instagram post publish",
          actionType: "IG_PUBLISH_POST",
          actionTypeLabel: "Instagram post publish",
          platform: "Instagram",
          decision: "PENDING_APPROVAL",
          technicalReason: "MISSING_OR_INVALID_G5_APPROVAL",
          failureReason: "MISSING_OR_INVALID_G5_APPROVAL",
        }),
      ),
    ).toMatchObject({
      label: "Open Approval Queue",
      helperText: "Approve the publishing action before continuing.",
      href: "/dashboard/n8n-automations/g5",
      disabled: false,
    });

    expect(
      getG1RemediationAction(
        describeG1Outcome({
          time: "2026-06-23T08:30:00.000Z",
          requestedBy: "G2 Policy Health",
          requestedByWorkflow: "G2 Policy Health",
          requestedByWorkflowGroup: "G2",
          workflowId: "G2",
          action: "Account health refresh",
          actionType: "ACCOUNT_HEALTH",
          actionTypeLabel: "Account health refresh",
          platform: "Meta",
          decision: "BLOCK",
          technicalReason: "ACCOUNT_HEALTH_NOT_CLEAN",
          failureReason: "ACCOUNT_HEALTH_NOT_CLEAN",
        }),
      ),
    ).toMatchObject({
      label: "Update Account Health",
      helperText: "Confirm the account is healthy before continuing.",
      href: "/dashboard/n8n-automations/g2",
      disabled: false,
    });
  });

  it("builds a clean G1 snapshot from Supabase rows", () => {
    const snapshot = buildG1ComplianceGuardSnapshotFromRows([
      {
        created_at: "2026-06-23T10:30:00.000Z",
        requested_by_workflow: "G10 SEO + CRO",
        workflow_group: "G10",
        workflow_id: "G10",
        action_type: "GOOGLE_SCRAPE",
        platform: "GOOGLE",
        status: "BLOCK",
        fail_reason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
      },
      {
        created_at: "2026-06-23T10:00:00.000Z",
        requested_by_workflow: "G5 Publishing",
        workflow_group: "G5",
        workflow_id: "G5",
        action_type: "WORKFLOW_ACTION",
        platform: "INSTAGRAM",
        status: "PASS",
        fail_reason: null,
      },
      {
        created_at: "2026-06-23T09:00:00.000Z",
        requested_by_workflow: "G4 Content Review",
        workflow_group: "G4",
        workflow_id: "G4",
        action_type: "WORKFLOW_ACTION",
        platform: "WEBSITE",
        status: "NEEDS_EVIDENCE",
        fail_reason: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
      },
      {
        created_at: "2026-06-23T08:00:00.000Z",
        requested_by_workflow: "G5 Publishing",
        workflow_group: "G5",
        workflow_id: "G5",
        action_type: "IG_PUBLISH_POST",
        platform: "INSTAGRAM",
        status: "PENDING",
        fail_reason: "MISSING_OR_INVALID_G5_APPROVAL",
      },
    ]);

    expect(snapshot).toMatchObject({
      workflowGroup: "G1",
      title: "G1 — Compliance Guard",
      purpose: "Checks whether risky workflow actions are safe before they run.",
      status: "BLOCK",
      lastRunAt: "2026-06-23T10:30:00.000Z",
      latestOutcome: {
        result: "BLOCK",
        checked: "G10 SEO + CRO · Google data collection · Google Search",
        requestedByWorkflow: "G10 SEO + CRO",
        actionTypeLabel: "Google data collection",
        platformLabel: "Google Search",
        workflowDetailHref: "/dashboard/n8n-automations/g10",
        whatHappened: "Workflow safely stopped the action.",
        actionNeeded: "Use approved Google sources only.",
      },
    });

    expect(snapshot.recentOutcomes.map((outcome) => outcome.result)).toEqual([
      "BLOCK",
      "PASS",
      "NEEDS_EVIDENCE",
      "PENDING_APPROVAL",
    ]);
    expect(snapshot.recentOutcomes[1]).toMatchObject({
      checked: "G5 Publishing · Workflow action check · Instagram",
      requestedByWorkflow: "G5 Publishing",
      actionTypeLabel: "Workflow action check",
      platformLabel: "Instagram",
      workflowDetailHref: "/dashboard/n8n-automations/g5",
      whatHappened: "Workflow ran successfully.",
      actionNeeded: "No action needed.",
    });
    expect(snapshot.recentOutcomes[2]).toMatchObject({
      result: "NEEDS_EVIDENCE",
      insight: "Complete the content review before continuing.",
    });
    expect(snapshot.recentOutcomes[3]).toMatchObject({
      result: "PENDING_APPROVAL",
      insight: "Approve the publishing action before continuing.",
    });
  });
});
