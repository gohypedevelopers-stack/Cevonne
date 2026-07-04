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

const G4_TABLE = "g4_content_reviews";
const BACKFILL_APPROVAL_STATE = "PENDING_HUMAN_APPROVAL";
const SENT_LIKE_APPROVAL_STATES = new Set(["APPROVED", "PENDING_APPROVAL", "READY_FOR_APPROVAL", "REVIEW_REQUESTED", "IN_REVIEW"]);

const toText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeStatus = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
};

const normalizeRow = (row) => ({
  id: toText(row.id),
  review_id: toText(row.review_id),
  content_review_id: toText(row.content_review_id),
  asset_id: toText(row.asset_id),
  status: normalizeStatus(row.status),
  approval_state: normalizeStatus(row.approval_state),
  requires_human_approval: row.requires_human_approval === true,
  reviewed_at: toText(row.reviewed_at),
  created_at: toText(row.created_at),
  source_event: toText(row.source_event),
  source_platform: toText(row.source_platform),
});

const fetchAllRows = async () => {
  const { data, error } = await supabase
    .from(G4_TABLE)
    .select("id, review_id, content_review_id, asset_id, status, approval_state, requires_human_approval, reviewed_at, created_at, source_event, source_platform")
    .eq("workflow_group", "G4")
    .order("created_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load ${G4_TABLE}: ${error.message}`);
  }

  return Array.isArray(data) ? data.map((row) => normalizeRow(row)) : [];
};

const needsBackfill = (row) =>
  row.status === "PASS" &&
  SENT_LIKE_APPROVAL_STATES.has(row.approval_state) &&
  (row.approval_state !== BACKFILL_APPROVAL_STATE || row.requires_human_approval !== true);

const updateRow = async (row) => {
  const update = {
    status: "PASS",
    approval_state: BACKFILL_APPROVAL_STATE,
    requires_human_approval: true,
    reviewed_at: row.reviewed_at || row.created_at || new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.info("[g4-backfill] dry run update", {
      id: row.id,
      review_id: row.review_id || row.content_review_id || null,
      asset_id: row.asset_id || null,
      from: {
        status: row.status || null,
        approval_state: row.approval_state || null,
        requires_human_approval: row.requires_human_approval,
        reviewed_at: row.reviewed_at || null,
      },
      to: update,
    });
    return { ...row, ...update };
  }

  const { data, error } = await supabase
    .from(G4_TABLE)
    .update(update)
    .eq("id", row.id)
    .select("id, review_id, content_review_id, asset_id, status, approval_state, requires_human_approval, reviewed_at, created_at, source_event, source_platform")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to update G4 review ${row.id}: ${error?.message ?? "unknown error"}`);
  }

  const updated = normalizeRow(data);
  console.info("[g4-backfill] updated row", {
    id: updated.id,
    review_id: updated.review_id || updated.content_review_id || null,
    asset_id: updated.asset_id || null,
    approval_state: updated.approval_state || null,
    requires_human_approval: updated.requires_human_approval,
    reviewed_at: updated.reviewed_at || null,
  });

  return updated;
};

const main = async () => {
  console.info(`[g4-backfill] starting ${DRY_RUN ? "dry run" : "repair"}...`);

  const rows = await fetchAllRows();
  const candidates = rows.filter(needsBackfill);

  console.info("[g4-backfill] scan complete", {
    scanned: rows.length,
    candidates: candidates.length,
    dry_run: DRY_RUN,
  });

  let updatedCount = 0;
  for (const row of candidates) {
    await updateRow(row);
    updatedCount += 1;
  }

  console.info("[g4-backfill] completed", {
    scanned: rows.length,
    updated: updatedCount,
    skipped: rows.length - updatedCount,
    dry_run: DRY_RUN,
    target_approval_state: BACKFILL_APPROVAL_STATE,
  });
};

main().catch((error) => {
  console.error("[g4-backfill] failed", error);
  process.exitCode = 1;
});
