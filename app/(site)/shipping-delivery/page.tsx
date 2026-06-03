"use client";

import dynamic from "next/dynamic";

const ShippingDelivery = dynamic(() => import("@/components/pages/ShippingDelivery"), { ssr: false });

export default function Page() {
  return <ShippingDelivery />;
}
