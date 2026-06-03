"use client";

import dynamic from "next/dynamic";

const OrdersPage = dynamic(() => import("@/components/admin-dashboard/OrdersPage"), { ssr: false });

export default function Page() {
  return <OrdersPage />;
}
