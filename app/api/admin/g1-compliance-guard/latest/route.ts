export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAuthUser, jsonResponse } from "@/server/next/route-utils";
import {
  buildG1ComplianceGuardSnapshotFromDecisionSources,
  buildEmptyG1ComplianceGuardSnapshot,
  normalizeG1AuditRows,
} from "@/lib/g1-compliance-guard";
import {
  getCevonneAdminWorkflowDetail,
  recordCevonneAdminRouteView,
} from "@/server/next/api/cevonne-admin-store";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const detail = getCevonneAdminWorkflowDetail("G1");
  let snapshot = detail?.workflow
    ? buildG1ComplianceGuardSnapshotFromDecisionSources({
        workflow: detail.workflow,
        decisionSources: [],
        rawRecords: {
          workflow: detail.workflow,
          latest_executions: detail.latest_executions ?? [],
          approvals: detail.approvals ?? [],
          audit_logs: detail.audit_logs ?? [],
          related_g1_compliance_runs: detail.related_g1_compliance_runs ?? [],
        },
        developerEnabled: true,
      })
    : buildEmptyG1ComplianceGuardSnapshot();

  const candidateTables = Array.from(
    new Set([
    "compliance_runs",
    process.env.CEVONNE_G1_COMPLIANCE_RUNS_TABLE?.trim(),
    process.env.CEVONNE_COMPLIANCE_RUNS_TABLE?.trim(),
    process.env.CEVONNE_G1_COMPLIANCE_LOG_TABLE?.trim(),
    process.env.CEVONNE_G1_AUDIT_LOG_TABLE?.trim(),
  ].filter((table): table is string => Boolean(table))),
  );

  const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (candidateTables.length > 0 && hasSupabaseConfig) {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      const tableReads = await Promise.all(
        candidateTables.map(async (table) => {
          const { data, error } = await supabaseAdmin.from(table).select("*").order("created_at", { ascending: false }).limit(50);
          if (error) {
            console.error("[G1 API] Supabase load failed:", {
              table,
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            });
          }
          return { table, data, error };
        }),
      );

      for (const tableRead of tableReads) {
        if (tableRead.error || !Array.isArray(tableRead.data) || tableRead.data.length === 0) {
          continue;
        }

        const normalizedRows = normalizeG1AuditRows(tableRead.data as Array<Record<string, unknown>>);
        if (normalizedRows.length > 0 && detail?.workflow) {
          snapshot = buildG1ComplianceGuardSnapshotFromDecisionSources({
            workflow: detail.workflow,
            decisionSources: normalizedRows,
            rawRecords: {
              workflow: detail.workflow,
              latest_executions: detail.latest_executions ?? [],
              approvals: detail.approvals ?? [],
              audit_logs: detail.audit_logs ?? [],
              related_g1_compliance_runs: detail.related_g1_compliance_runs ?? [],
              supabase_rows: tableRead.data as Array<Record<string, unknown>>,
            },
            developerEnabled: true,
          });
          break;
        }
      }
    } catch (error) {
      console.error("[G1 API] Supabase load failed:", error);
      // Fall back to the empty client-safe snapshot when Supabase is unavailable.
    }
  }

  recordCevonneAdminRouteView({
    workflowGroup: "G1",
    actionType: "VIEW_WORKFLOW_DETAIL",
    routeName: "/api/admin/g1-compliance-guard/latest",
    resultStatus: "PASS",
    responseType: "G1_COMPLIANCE_GUARD_READY",
    payloadSummary: JSON.stringify({
      workflow_group: "G1",
      workflow_name: snapshot.workflow_name,
      current_status: snapshot.current_status,
    }),
    adminUserId: auth.id,
    adminEmail: auth.email,
  });

  return jsonResponse(
    {
      status: snapshot.latest_decisions.length > 0 ? "PASS" : "EMPTY",
      response_type: "G1_COMPLIANCE_GUARD_READY",
      message:
        snapshot.latest_decisions.length > 0
          ? "G1 compliance guard data loaded."
          : "G1 is active, but no workflow action has been checked yet.",
      ...snapshot,
    },
    200,
  );
}
