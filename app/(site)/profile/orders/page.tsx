"use client";

import dynamic from "next/dynamic";

const Orders = dynamic(() => import("@/components/profile/Orders"), { ssr: false });

export default function Page() {
  return <Orders />;
}
