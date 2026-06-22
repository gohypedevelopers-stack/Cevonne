import { describe, expect, it } from "vitest";

import { normalizeG1AuditRows } from "../lib/g1-compliance-guard";

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
});
