"use client";

import dynamic from "next/dynamic";

const CartPage = dynamic(() => import("@/components/pages/CartPage"), { ssr: false });

export default function Page() {
  return <CartPage />;
}
