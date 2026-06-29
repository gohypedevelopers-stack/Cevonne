export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import G4ContentClaimCheckPage from "@/components/admin-dashboard/G4ContentClaimCheckPage";
import G5PublishingSchedulerPage from "@/components/admin-dashboard/G5PublishingSchedulerPage";
import WorkflowDashboardDetail from "@/components/admin-dashboard/WorkflowDashboardDetail";
import { getWorkflowCatalogEntry, normalizeWorkflowId } from "@/lib/admin/workflows";
import { getG4WorkflowDetail } from "@/server/next/api/g4-content-check-adapter";

export default async function Page({
  params,
}: {
  params: Promise<{ workflowGroup?: string }> | { workflowGroup?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const workflowId = normalizeWorkflowId(resolvedParams?.workflowGroup);

  if (!workflowId) {
    redirect("/dashboard/n8n-automations");
  }

  const catalogEntry = getWorkflowCatalogEntry(workflowId);
  if (!catalogEntry) {
    redirect("/dashboard/n8n-automations");
  }

  const expectedSlug = catalogEntry.detailHref.split("/").pop();
  if (expectedSlug && resolvedParams?.workflowGroup?.toLowerCase() !== expectedSlug.toLowerCase()) {
    redirect(catalogEntry.detailHref);
  }

  if (workflowId === "G1" || workflowId === "G12" || workflowId === "WF1") {
    redirect(catalogEntry.detailHref);
  }

  if (workflowId === "G4") {
    const detail = await getG4WorkflowDetail();
    return <G4ContentClaimCheckPage detail={detail} />;
  }

  if (workflowId === "G5") {
    return <G5PublishingSchedulerPage />;
  }

  return <WorkflowDashboardDetail workflowId={workflowId} />;
}
