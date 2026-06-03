"use client";

import dynamic from "next/dynamic";

const ProductDetails = dynamic(() => import("@/components/pages/ProductDetails"), { ssr: false });

export default function Page() {
  return <ProductDetails />;
}
