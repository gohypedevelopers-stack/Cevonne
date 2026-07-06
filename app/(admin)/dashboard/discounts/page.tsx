"use client";

import dynamic from "next/dynamic";

const DiscountsPage = dynamic(() => import("@/components/admin-dashboard/DiscountsPage"), { ssr: false });

export default function Page() {
  return <DiscountsPage />;
}
