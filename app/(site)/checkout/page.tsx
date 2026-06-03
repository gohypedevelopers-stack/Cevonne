"use client";

import dynamic from "next/dynamic";

const CheckoutPage = dynamic(() => import("@/components/pages/CheckoutPage"), { ssr: false });

export default function Page() {
  return <CheckoutPage />;
}
