"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/admin-dashboard/Dashboard"), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
