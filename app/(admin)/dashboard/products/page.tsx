"use client";

import dynamic from "next/dynamic";

const ProductsPage = dynamic(() => import("@/components/admin-dashboard/ProductsPage"), { ssr: false });

export default function Page() {
  return <ProductsPage />;
}
