import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const loadEnvFile = (fileName, override = false) => {
  const envPath = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override });
  }
};

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const G12_TABLE = "g12_public_trend_insights";
const G4_TABLE = "g4_content_reviews";
const PAGE_SIZE = 500;

const toText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return false;
};

const normalizeStatus = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
};

const isNegativeG12Status = (status) =>
  ["REJECTED", "BLOCK", "DENIED", "DECLINED", "FAILED", "FAIL", "ERROR"].includes(status);

const isBlockingG4Status = (status) => ["BLOCK", "MANUAL ONLY", "NEEDS EVIDENCE", "ERROR"].includes(status);

const fetchAllRows = async (table, select, orderColumn = "created_at") => {
  const rows = [];
  let start = 0;

  while (true) {
    const end = start + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .range(start, end);

    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return rows;
};

const normalizeG12Row = (row) => ({
  row_key: getG12RowKey({
    trend_id: toText(row.trend_id),
    raw_id: toText(row.raw_id),
    metric_id: toText(row.metric_id),
    approval_id: toText(row.approval_id),
    g4_review_id: toText(row.g4_review_id),
  }),
  trend_id: toText(row.trend_id),
  raw_id: toText(row.raw_id),
  metric_id: toText(row.metric_id),
  fetch_run_id: toText(row.fetch_run_id),
  approval_status: toText(row.approval_status),
  approval_id: toText(row.approval_id),
  g4_review_id: toText(row.g4_review_id),
  g5_approval_id: toText(row.g5_approval_id),
  selected_for_review: toBoolean(row.selected_for_review),
  wf1_handoff_ready: toBoolean(row.wf1_handoff_ready),
  workflow_group: toText(row.workflow_group),
  workflow_id: toText(row.workflow_id),
  source_type: toText(row.source_type),
});

const getG12RowKey = (row) => row.trend_id || row.raw_id || row.metric_id || row.approval_id || row.g4_review_id;

const getG12RowUpdateTarget = (row) => {
  const candidates = [
    ["trend_id", row.trend_id],
    ["raw_id", row.raw_id],
    ["metric_id", row.metric_id],
    ["approval_id", row.approval_id],
    ["g4_review_id", row.g4_review_id],
  ];

  for (const [column, value] of candidates) {
    if (value) {
      return { column, value };
    }
  }

  return null;
};

const normalizeG4Row = (row) => ({
  id: toText(row.id),
  review_id: toText(row.review_id),
  content_review_id: toText(row.content_review_id),
  asset_id: toText(row.asset_id),
  status: normalizeStatus(row.status),
  approval_state: normalizeStatus(row.approval_state),
  requires_human_approval: toBoolean(row.requires_human_approval),
  created_at: toText(row.created_at),
  reviewed_at: toText(row.reviewed_at),
});

const buildG4LookupMaps = (rows) => {
  const byKey = new Map();
  const byAssetId = new Map();

  for (const row of rows) {
    const review = normalizeG4Row(row);
    if (!review.id) {
      continue;
    }

    for (const key of [review.id, review.review_id, review.content_review_id]) {
      if (key && !byKey.has(key)) {
        byKey.set(key, review);
      }
    }

    if (review.asset_id && !byAssetId.has(review.asset_id)) {
      byAssetId.set(review.asset_id, review);
    }
  }

  return { byKey, byAssetId };
};

const findMatchingG4Review = (row, lookups) => {
  const directKeys = [row.approval_id, row.g4_review_id, row.trend_id, row.raw_id, row.metric_id];

  for (const key of directKeys) {
    if (!key) {
      continue;
    }

    const byKey = lookups.byKey.get(key);
    if (byKey) {
      return { review: byKey, matchedBy: key };
    }

    const byAssetId = lookups.byAssetId.get(key);
    if (byAssetId) {
      return { review: byAssetId, matchedBy: key };
    }
  }

  return null;
};

const needsG12Repair = (row, g4Review) => {
  if (row.g5_approval_id) {
    return false;
  }

  const currentStatus = normalizeStatus(row.approval_status);
  if (isNegativeG12Status(currentStatus)) {
    return false;
  }

  if (!g4Review) {
    return false;
  }

  const alreadyAligned =
    currentStatus === "SENT TO CONTENT DRAFT" &&
    row.approval_id === g4Review.id &&
    row.g4_review_id === g4Review.id &&
    row.selected_for_review &&
    row.wf1_handoff_ready;

  return !alreadyAligned;
};

const needsG4Repair = (g4Review) => {
  if (!g4Review) {
    return false;
  }

  if (isBlockingG4Status(g4Review.status)) {
    return false;
  }

  return g4Review.approval_state !== "APPROVED" || g4Review.status !== "PASS" || g4Review.requires_human_approval !== false;
};

const updateG4ReviewApproval = async (g4Review) => {
  const update = {
    status: "PASS",
    approval_state: "APPROVED",
    requires_human_approval: false,
    reviewed_at: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.info("[g12-backfill] dry run approval update", {
      review_id: g4Review.id || g4Review.review_id || g4Review.content_review_id,
      asset_id: g4Review.asset_id || null,
    });

    return {
      ...g4Review,
      status: "PASS",
      approval_state: "APPROVED",
      requires_human_approval: false,
      reviewed_at: update.reviewed_at,
    };
  }

  const candidates = [g4Review.id, g4Review.review_id, g4Review.content_review_id, g4Review.asset_id].filter(Boolean);
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from(G4_TABLE)
      .update(update)
      .eq(candidate === g4Review.id ? "id" : candidate === g4Review.review_id ? "review_id" : candidate === g4Review.content_review_id ? "content_review_id" : "asset_id", candidate)
      .select("id, review_id, content_review_id, asset_id, status, approval_state, requires_human_approval, created_at, reviewed_at")
      .maybeSingle();

    if (!error && data) {
      const updated = normalizeG4Row(data);
      console.info("[g12-backfill] approval update response", {
        review_id: updated.id,
        asset_id: updated.asset_id || null,
        approval_state: updated.approval_state || null,
        requires_human_approval: updated.requires_human_approval,
        status: updated.status || null,
        reviewed_at: updated.reviewed_at || null,
      });
      return updated;
    }
  }

  throw new Error(`Failed to update G4 review approval for ${g4Review.id || g4Review.review_id || g4Review.content_review_id}`);
};

const updateG12Insight = async (row, g4Review) => {
  const handledAt = new Date().toISOString();
  const updateTarget = getG12RowUpdateTarget(row);
  if (!updateTarget) {
    throw new Error(`Could not determine an update key for G12 insight ${getG12RowKey(row) || "<unknown>"}`);
  }

  const update = {
    approval_status: "SENT_TO_CONTENT_DRAFT",
    approval_id: g4Review.id,
    g4_review_id: g4Review.id,
    selected_for_review: true,
    wf1_handoff_ready: true,
    updated_at: handledAt,
  };

  if (DRY_RUN) {
    console.info("[g12-backfill] dry run update", {
      insight_id: row.row_key,
      trend_id: row.trend_id || null,
      approval_id: g4Review.id,
    });
    return { handledAt, updated: null };
  }

  const { data, error } = await supabase
    .from(G12_TABLE)
    .update(update)
    .eq(updateTarget.column, updateTarget.value)
    .select("trend_id, raw_id, metric_id, approval_status, approval_id, g4_review_id, selected_for_review, wf1_handoff_ready, updated_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to update G12 insight ${row.row_key || "<unknown>"}: ${error?.message ?? "unknown error"}`);
  }

  const updated = normalizeG12Row(data);
  console.info("[g12-backfill] insight updated", {
    insight_id: getG12RowKey(updated),
    trend_id: updated.trend_id || null,
    approval_status: updated.approval_status || null,
    approval_id: updated.approval_id || null,
    g4_review_id: updated.g4_review_id || null,
    selected_for_review: updated.selected_for_review,
    wf1_handoff_ready: updated.wf1_handoff_ready,
  });

  return { handledAt, updated };
};

const main = async () => {
  console.info(`[g12-backfill] starting ${DRY_RUN ? "dry run" : "repair"}...`);

  const [g12Rows, g4Rows] = await Promise.all([
    fetchAllRows(
      G12_TABLE,
      "trend_id, raw_id, metric_id, fetch_run_id, approval_status, approval_id, g4_review_id, g5_approval_id, selected_for_review, wf1_handoff_ready, workflow_group, workflow_id, source_type, created_at, updated_at",
    ),
    fetchAllRows(
      G4_TABLE,
      "id, review_id, content_review_id, asset_id, status, approval_state, requires_human_approval, created_at, reviewed_at",
    ),
  ]);

  const g12Insights = g12Rows.map(normalizeG12Row);
  const g4Lookups = buildG4LookupMaps(g4Rows);

  let scanned = 0;
  let matched = 0;
  let repaired = 0;
  let skippedNegative = 0;
  let skippedNoMatch = 0;
  let skippedAlreadyAligned = 0;
  let g4Repairs = 0;

  for (const row of g12Insights) {
    scanned += 1;

    const match = findMatchingG4Review(row, g4Lookups);
    if (!match) {
      skippedNoMatch += 1;
      continue;
    }

    matched += 1;

    if (isNegativeG12Status(normalizeStatus(row.approval_status))) {
      skippedNegative += 1;
      continue;
    }

    if (!needsG12Repair(row, match.review) && !needsG4Repair(match.review)) {
      skippedAlreadyAligned += 1;
      continue;
    }

    let g4Review = match.review;
    if (needsG4Repair(g4Review)) {
      g4Review = await updateG4ReviewApproval(g4Review);
      g4Repairs += 1;
    }

    if (needsG12Repair(row, g4Review)) {
      await updateG12Insight(row, g4Review);
      repaired += 1;
    } else if (needsG4Repair(match.review)) {
      // The G4 row needed a repair but the G12 row was already aligned.
      console.info("[g12-backfill] G12 row already aligned; G4 review repaired only", {
        insight_id: row.row_key,
        approval_id: g4Review.id,
      });
    }
  }

  console.info("[g12-backfill] completed", {
    scanned,
    matched,
    repaired,
    g4_repairs: g4Repairs,
    skipped_negative: skippedNegative,
    skipped_no_match: skippedNoMatch,
    skipped_already_aligned: skippedAlreadyAligned,
    dry_run: DRY_RUN,
  });
};

main().catch((error) => {
  console.error("[g12-backfill] failed", error);
  process.exitCode = 1;
});
