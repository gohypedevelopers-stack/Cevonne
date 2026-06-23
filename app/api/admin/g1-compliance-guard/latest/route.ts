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

const G1_COMPLIANCE_RUNS_TABLE = "g1_compliance_runs";
const G1_RUN_ORDER_COLUMNS = ["handled_at", "completed_at", "created_at", "updated_at", "checked_at", "time", "timestamp"] as const;

type SupabaseRow = Record<string, unknown>;

const isMissingColumnError = (error: { message?: string; code?: string } | null) => {
  if (!error) {
    return false;
  }

  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
};

const loadG1ComplianceRows = async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  for (const orderColumn of G1_RUN_ORDER_COLUMNS) {
    const { data, error } = await supabaseAdmin
      .from(G1_COMPLIANCE_RUNS_TABLE)
      .select("*")
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .limit(50);

    if (!error) {
      return Array.isArray(data) ? (data as SupabaseRow[]) : [];
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const { data, error } = await supabaseAdmin.from(G1_COMPLIANCE_RUNS_TABLE).select("*").limit(50);
  if (error) {
    throw error;
  }

  return Array.isArray(data) ? (data as SupabaseRow[]) : [];
};

const buildSnapshot = (rows: SupabaseRow[]) => {
  const decisions = normalizeG1AuditRows(rows);
  return buildG1ComplianceGuardSnapshotFromDecisionSources(decisions);
};

const recordRouteView = (auth: { id: string; email: string | null }, snapshot: G1ComplianceGuardSnapshot) => {
  recordCevonneAdminRouteView({
    workflowGroup: "G1",
    actionType: "VIEW_WORKFLOW_DETAIL",
    routeName: "/api/admin/g1-compliance-guard/latest",
    resultStatus: "PASS",
    responseType: "G1_COMPLIANCE_GUARD_READY",
    payloadSummary: JSON.stringify({
      workflow_group: "G1",
      status: snapshot.status,
      last_run_at: snapshot.lastRunAt,
      recent_checks: snapshot.recentOutcomes.length,
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
    const rows = await loadG1ComplianceRows();
    const snapshot = buildSnapshot(rows);
    const message = rows.length > 0 ? "G1 compliance guard data loaded from Supabase." : "No G1 compliance runs found yet.";

    recordRouteView({ id: auth.id, email: auth.email }, snapshot);

    return jsonResponse(
      {
        status: rows.length > 0 ? "PASS" : "EMPTY",
        response_type: "G1_COMPLIANCE_GUARD_READY",
        message,
        snapshot,
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
