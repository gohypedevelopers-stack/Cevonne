"use client";

import dynamic from "next/dynamic";

const PolicyPage = dynamic(() => import("@/components/pages/PolicyPage"), { ssr: false });

export default function Page() {
  return <PolicyPage />;
}
