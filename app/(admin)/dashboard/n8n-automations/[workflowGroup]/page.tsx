import { redirect } from "next/navigation";

import N8nAutomationsWorkflowDetail from "@/components/admin-dashboard/N8nAutomationsWorkflowDetail";
import { normalizeWorkflowGroup } from "@/components/admin-dashboard/n8n-automations-common";

export default async function Page({
  params,
}: {
  params: Promise<{ workflowGroup?: string } | { workflowGroup?: string }> | { workflowGroup?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const workflowGroup = normalizeWorkflowGroup(resolvedParams?.workflowGroup);

  if (!workflowGroup) {
    redirect("/dashboard/n8n-automations");
  }

  if (workflowGroup === "G1") {
    redirect("/admin/ai-automations/g1-compliance-guard");
  }

  return <N8nAutomationsWorkflowDetail workflowGroup={workflowGroup} />;
}
