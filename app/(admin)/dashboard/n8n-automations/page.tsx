"use client";

import dynamic from "next/dynamic";

const N8nAutomationsOverview = dynamic(
  () => import("@/components/admin-dashboard/N8nAutomationsOverview"),
  { ssr: false },
);

export default function Page() {
  return <N8nAutomationsOverview />;
}
