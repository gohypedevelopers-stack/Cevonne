"use client";

import dynamic from "next/dynamic";

const ProductEdit = dynamic(() => import("@/components/admin-dashboard/ProductEdit"), { ssr: false });

export default function Page() {
  return <ProductEdit />;
}
