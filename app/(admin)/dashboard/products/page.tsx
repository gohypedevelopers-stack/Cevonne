"use client";

import dynamic from "next/dynamic";

const ProductOverview = dynamic(() => import("@/components/admin-dashboard/ProductOverview"), { ssr: false });

export default function Page() {
  return <ProductOverview />;
}
