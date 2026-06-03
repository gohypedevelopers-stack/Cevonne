"use client";

import dynamic from "next/dynamic";

const Addresses = dynamic(() => import("@/components/profile/Addresses"), { ssr: false });

export default function Page() {
  return <Addresses />;
}
