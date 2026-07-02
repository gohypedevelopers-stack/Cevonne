export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { normalizeG1AuditRows } from "@/lib/g1-compliance-guard";
import {
  buildG1ComplianceGuardSnapshotFromDecisionSources,
  type G1ComplianceGuardSnapshot,
} from "@/server/next/api/g1-compliance-guard-ui";
import { recordCevonneAdminRouteView } from "@/server/next/api/cevonne-admin-store";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const G1_COMPLIANCE_RUNS_TABLE = "compliance_runs";
const G1_LEGACY_COMPLIANCE_RUNS_TABLE = "g1_compliance_runs";
const G1_RUN_ORDER_COLUMNS = ["created_at", "handled_at", "completed_at", "checked_at", "time", "timestamp", "updated_at"] as const;

type SupabaseRow = Record<string, unknown>;

const isMissingColumnError = (error: { message?: string; code?: string } | null) => {
  if (!error) {
    return false;
  }

  return error.code === "42703" || error.code === "42P01" || /column .* does not exist/i.test(error.message ?? "") || /relation .* does not exist/i.test(error.message ?? "");
};

const queryG1ComplianceRows = async (tableName: string) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [] as SupabaseRow[], missingTable: false };
  }

  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  for (const orderColumn of G1_RUN_ORDER_COLUMNS) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("id, created_at, workflow_group, action_type, platform, status, fail_reason, failure_reasons, policy_ids_checked, action_packet")
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .limit(50);

    if (!error) {
      return {
        rows: Array.isArray(data) ? (data as SupabaseRow[]) : [],
        missingTable: false,
      };
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select("id, created_at, workflow_group, action_type, platform, status, fail_reason, failure_reasons, policy_ids_checked, action_packet")
    .limit(50);

  if (error) {
    if (isMissingColumnError(error)) {
      return { rows: [], missingTable: true };
    }

    throw error;
  }

  return {
    rows: Array.isArray(data) ? (data as SupabaseRow[]) : [],
    missingTable: false,
  };
};

const loadG1ComplianceRows = async () => {
  const primary = await queryG1ComplianceRows(G1_COMPLIANCE_RUNS_TABLE);
  if (primary.rows.length > 0 || primary.missingTable === false) {
    if (primary.rows.length > 0) {
      return { rows: primary.rows, sourceTable: G1_COMPLIANCE_RUNS_TABLE };
    }
  }

  const legacy = await queryG1ComplianceRows(G1_LEGACY_COMPLIANCE_RUNS_TABLE);
  if (legacy.rows.length > 0) {
    return { rows: legacy.rows, sourceTable: G1_LEGACY_COMPLIANCE_RUNS_TABLE };
  }

  if (primary.missingTable) {
    return { rows: legacy.rows, sourceTable: G1_LEGACY_COMPLIANCE_RUNS_TABLE };
  }

  return { rows: primary.rows, sourceTable: G1_COMPLIANCE_RUNS_TABLE };
};

const buildSnapshot = (rows: SupabaseRow[]) => {
  const decisions = normalizeG1AuditRows(rows);
  return buildG1ComplianceGuardSnapshotFromDecisionSources(decisions);
};

const recordRouteView = (
  auth: { id: string; email: string | null },
  snapshot: G1ComplianceGuardSnapshot,
  sourceTable: string,
  rows: SupabaseRow[],
) => {
  recordCevonneAdminRouteView({
    workflowGroup: "G1",
    actionType: "VIEW_WORKFLOW_DETAIL",
    routeName: "/api/admin/g1-compliance-guard/latest",
    resultStatus: "PASS",
    responseType: "G1_COMPLIANCE_GUARD_READY",
    payloadSummary: JSON.stringify({
      workflow_group: "G1",
      source_table: sourceTable,
      status: snapshot.status,
      last_run_at: snapshot.lastRunAt,
      recent_checks: snapshot.recentOutcomes.length,
      total_rows: rows.length,
    }),
    adminUserId: auth.id,
    adminEmail: auth.email,
  });
};

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const { rows, sourceTable } = await loadG1ComplianceRows();
    const snapshot = buildSnapshot(rows);
    const message = rows.length > 0 ? "G1 compliance guard data loaded from Supabase." : "No G1 compliance runs found yet.";

    recordRouteView({ id: auth.id, email: auth.email }, snapshot, sourceTable, rows);

    return jsonResponse(
      {
        status: rows.length > 0 ? "PASS" : "EMPTY",
        response_type: "G1_COMPLIANCE_GUARD_READY",
        message,
        snapshot,
        runs: rows,
        source_table: sourceTable,
      },
      200,
    );
  } catch (error) {
    console.error("[G1 API] Supabase load failed:", error);

    return jsonResponse(
      {
        status: "ERROR",
        response_type: "G1_COMPLIANCE_GUARD_ERROR",
        message: "Unable to load G1 compliance checks from Supabase.",
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
