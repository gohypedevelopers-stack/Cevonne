"use client";

import dynamic from "next/dynamic";

const InventoryPage = dynamic(() => import("@/components/admin-dashboard/InventoryPage"), { ssr: false });

export default function Page() {
  return <InventoryPage />;
}
