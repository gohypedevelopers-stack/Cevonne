"use client";

import dynamic from "next/dynamic";

const LipstickAR = dynamic(() => import("@/components/ar/LipstickAR"), { ssr: false });

export default function Page() {
  return <LipstickAR />;
}
