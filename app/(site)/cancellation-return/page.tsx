"use client";

import dynamic from "next/dynamic";

const CancellationReturn = dynamic(() => import("@/components/pages/CancellationReturn"), { ssr: false });

export default function Page() {
  return <CancellationReturn />;
}
