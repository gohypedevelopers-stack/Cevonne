"use client";

import dynamic from "next/dynamic";

const AiAutomation = dynamic(() => import("@/components/admin-dashboard/AiAutomation"), { ssr: false });

export default function Page() {
  return <AiAutomation />;
}
