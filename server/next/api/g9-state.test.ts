import assert from "node:assert/strict";
import test from "node:test";

import {
  buildG9ApprovalPayload,
  buildG9DryRunPayload,
  canG9ReviewAndDecide,
  canG9RunDryRun,
  deriveG9UiState,
  isG9DryRunComplete,
} from "./g9-state.ts";

const executable = { raw_payload: { recommended_action: "META_UPDATE_ADSET_BUDGET" }, compliance_status: "PASS" };
const completedDryRun = {
  status: "SUCCESS",
  request_payload: { dry_run: true },
  api_response: {
    response_type: "G9_DRY_RUN_COMPLETED",
    status: "PASS",
    execution_mode: "DRY_RUN",
    dry_run: true,
    not_executed: true,
    external_action_attempted: false,
  },
};

test("G9 derives state from the latest approval/execution, not stale recommendation fields", () => {
  assert.equal(deriveG9UiState({ ...executable, approval_status: "APPROVED" }).status, "NEEDS_REVIEW");
  assert.equal(deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "PENDING" }).status, "PENDING_APPROVAL");
  assert.equal(deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "APPROVED" }).status, "APPROVED_FOR_DRY_RUN");
  assert.equal(deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "REJECTED" }).status, "REJECTED");
  assert.equal(deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "APPROVED" }, completedDryRun).status, "DRY_RUN_COMPLETE");
});

test("G9 recognizes the confirmed execution audit format and rejects an unsuccessful technical execution", () => {
  assert.equal(isG9DryRunComplete(completedDryRun), true);
  assert.equal(isG9DryRunComplete({
    status: "PASS",
    api_response: { response_type: "G9_EXECUTION_LOGGED", execution_mode: "DRY_RUN", dry_run: true, not_executed: true, external_action_attempted: false },
  }), true);
  assert.equal(isG9DryRunComplete({
    status: "BLOCKED",
    request_payload: { dry_run: true },
    api_response: { response_type: "G9_OFFICIAL_API_DRY_RUN", status: "DRY_RUN_SUCCESS", not_executed: true },
  }), false);
  assert.equal(isG9DryRunComplete({
    ...completedDryRun,
    api_response: { ...completedDryRun.api_response, external_action_attempted: true },
  }), false);
});

test("G9 completed dry runs override approval state, are not open, and expose no repeat action", () => {
  const approved = deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "APPROVED" });
  const completed = deriveG9UiState(executable, { approval_id: "approval-1", approval_status: "APPROVED" }, completedDryRun);
  const openStatuses = new Set(["READY", "PENDING_APPROVAL", "APPROVED_FOR_DRY_RUN", "NEEDS_REVIEW", "CHANGES_REQUESTED"]);

  assert.equal(approved.status, "APPROVED_FOR_DRY_RUN");
  assert.equal(canG9RunDryRun(approved, { approval_id: "approval-1", approval_status: "APPROVED" }), true);
  assert.equal(completed.status, "DRY_RUN_COMPLETE");
  assert.equal(canG9RunDryRun(completed, { approval_id: "approval-1", approval_status: "APPROVED" }), false);
  assert.equal(openStatuses.has(completed.status), false);
  assert.equal([approved, completed].filter((item) => item.status === "DRY_RUN_COMPLETE").length, 1);
});

test("G9 safety and non-executable recommendations cannot expose approval actions", () => {
  const blocked = deriveG9UiState({ ...executable, compliance_status: "BLOCK" }, { approval_id: "approval-1", approval_status: "PENDING" });
  const reviewOnly = deriveG9UiState({ recommendation_type: "REVIEW_ONLY", action_type: "ADS_REVIEW", compliance_status: "PASS" }, { approval_id: "approval-1", approval_status: "APPROVED" });

  assert.equal(blocked.status, "BLOCKED");
  assert.equal(canG9ReviewAndDecide(blocked, { approval_id: "approval-1", approval_status: "PENDING" }), false);
  assert.equal(reviewOnly.status, "NO_ACTION");
  assert.equal(canG9RunDryRun(reviewOnly, { approval_id: "approval-1", approval_status: "APPROVED" }), false);
});

test("G9 approval and dry-run payloads match the n8n contract exactly", () => {
  assert.deepEqual(buildG9ApprovalPayload({
    recommendationId: "rec-1",
    approvalId: "approval-1",
    decision: "APPROVE",
    reviewerId: "admin@example.test",
    note: "Ready for simulation",
  }), {
    recommendation_id: "rec-1",
    approval_id: "approval-1",
    decision: "APPROVED",
    reviewer_id: "admin@example.test",
    reviewer_note: "Ready for simulation",
    rejection_reason: null,
    actor: "admin@example.test",
  });
  assert.deepEqual(buildG9DryRunPayload({
    recommendationId: "rec-1",
    approvalId: "approval-1",
    actionType: "META_UPDATE_ADSET_BUDGET",
    actor: "admin@example.test",
  }), {
    platform: "META",
    action_type: "META_UPDATE_ADSET_BUDGET",
    recommendation_id: "rec-1",
    approval_id: "approval-1",
    actor: "admin@example.test",
  });
});
