"use client";

import dynamic from "next/dynamic";

const ShadesPage = dynamic(() => import("@/components/admin-dashboard/Shades"), { ssr: false });

export default function Page() {
  return <ShadesPage />;
}
