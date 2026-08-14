import assert from "node:assert/strict";
import test from "node:test";

import { deduplicateG8Records, deriveG8Lifecycle, type G8LifecycleInput } from "./g8-creator-proof.ts";

const baseline: G8LifecycleInput = {
  permission: "GRANTED",
  rights: "ACTIVE",
  safety: "PASS",
  disclosure: "NOT_REQUIRED",
  overall: "UNKNOWN",
  asset: "UNKNOWN",
  handoffStatus: "UNKNOWN",
  g4Status: "UNKNOWN",
  g5Status: "UNKNOWN",
  expiresAt: "2027-08-11T00:00:00.000Z",
  isAutomaticPermissionFlow: false,
  permissionRequestSent: false,
  organicSocialAllowed: true,
  isActuallySentToG4: false,
  now: Date.parse("2026-08-13T00:00:00.000Z"),
};

test("G8 shows Story mentions as automated while permission is pending", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "PENDING", rights: "MISSING", safety: "UNKNOWN", disclosure: "UNKNOWN", isAutomaticPermissionFlow: true });
  assert.equal(lifecycle.currentStatus, "Awaiting Permission");
  assert.equal(lifecycle.nextActionKind, "WAITING_FOR_CREATOR");
});

test("G8 recognizes provider-managed permission independently of content type", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "PENDING", rights: "MISSING", safety: "UNKNOWN", disclosure: "UNKNOWN", isAutomaticPermissionFlow: true });
  assert.equal(lifecycle.nextActionKind, "WAITING_FOR_CREATOR");
});

test("G8 keeps a non-provider permission request manual even when the content is a Story", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "PENDING", rights: "MISSING", safety: "UNKNOWN", disclosure: "UNKNOWN", isAutomaticPermissionFlow: false });
  assert.equal(lifecycle.currentStatus, "Permission Required");
  assert.equal(lifecycle.nextActionKind, "REQUEST_PERMISSION");
});

test("G8 progresses a granted Story mention to safety review", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, safety: "UNKNOWN", disclosure: "UNKNOWN", isAutomaticPermissionFlow: true });
  assert.equal(lifecycle.currentStatus, "Safety Review Needed");
});

test("G8 blocks a creator permission denial", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "DENIED", rights: "BLOCKED", safety: "UNKNOWN", disclosure: "UNKNOWN", isAutomaticPermissionFlow: true });
  assert.equal(lifecycle.currentStatus, "Blocked");
  assert.equal(lifecycle.terminalBlock, true);
});

test("G8 marks a Post or Reel mention for manual permission", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "PENDING", rights: "MISSING", safety: "UNKNOWN", disclosure: "UNKNOWN", permissionRequestSent: false });
  assert.equal(lifecycle.currentStatus, "Permission Required");
  assert.equal(lifecycle.nextActionKind, "REQUEST_PERMISSION");
});

test("G8 keeps manual permission as the next step even after a request is prepared", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, permission: "PENDING", rights: "MISSING", safety: "UNKNOWN", disclosure: "UNKNOWN", permissionRequestSent: true });
  assert.equal(lifecycle.nextActionKind, "REQUEST_PERMISSION");
});

test("G8 requires disclosure after a passed safety review", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, disclosure: "UNKNOWN" });
  assert.equal(lifecycle.currentStatus, "Disclosure Review Needed");
});

test("G8 blocks content that fails safety", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, safety: "BLOCK", disclosure: "UNKNOWN" });
  assert.equal(lifecycle.currentStatus, "Blocked");
  assert.equal(lifecycle.terminalBlock, true);
});

test("G8 shows all passed gates as ready for approval", () => {
  const lifecycle = deriveG8Lifecycle(baseline);
  assert.equal(lifecycle.currentStatus, "Ready for G4");
  assert.equal(lifecycle.nextActionKind, "SEND_TO_G4");
});

test("G8 keeps a generic pending approval record ready until a G4 handoff is confirmed", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, overall: "PENDING_APPROVAL", handoffStatus: "PENDING_APPROVAL" });
  assert.equal(lifecycle.currentStatus, "Ready for G4");
  assert.equal(lifecycle.nextActionKind, "SEND_TO_G4");
  assert.equal(lifecycle.isReadyForG4, true);
});

test("G8 shows sent only after a confirmed G4 handoff", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, handoffStatus: "PENDING_G5_APPROVAL", g4Status: "PASS", isActuallySentToG4: true });
  assert.equal(lifecycle.currentStatus, "Sent to Content Review");
  assert.equal(lifecycle.nextActionKind, "SENT_TO_G4");
});

test("G8 does not ready content without organic-social rights", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, organicSocialAllowed: false });
  assert.equal(lifecycle.isReadyForG4, false);
  assert.equal(lifecycle.nextActionKind, "VIEW_REASON");
});

test("G8 asks for Story media before safety when no source media exists", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, safety: "UNKNOWN", disclosure: "UNKNOWN", hasReviewMedia: false });
  assert.equal(lifecycle.nextActionKind, "ADD_STORY_MEDIA");
});

test("G8 prioritizes a block over every downstream action", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, safety: "BLOCK", handoffStatus: "PENDING_APPROVAL" });
  assert.equal(lifecycle.nextActionKind, "VIEW_REASON");
});

test("G8 blocks expired creator rights", () => {
  const lifecycle = deriveG8Lifecycle({ ...baseline, expiresAt: "2026-08-12T00:00:00.000Z" });
  assert.equal(lifecycle.currentStatus, "Blocked");
  assert.equal(lifecycle.terminalBlock, true);
});

test("G8 keeps one queue record for duplicate incoming content", () => {
  const items = deduplicateG8Records([
    { id: "newest", identity: "https://instagram.com/p/same" },
    { id: "duplicate", identity: "https://instagram.com/p/same" },
    { id: "different", identity: "https://instagram.com/p/different" },
  ], (item) => item.identity);
  assert.deepEqual(items.map((item) => item.id), ["newest", "different"]);
});
