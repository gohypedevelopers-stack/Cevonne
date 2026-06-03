"use client";

import dynamic from "next/dynamic";

const ProductCreate = dynamic(() => import("@/components/admin-dashboard/ProductCreate"), { ssr: false });

export default function Page() {
  return <ProductCreate />;
}
