"use client";

import dynamic from "next/dynamic";

const VerifyOtp = dynamic(() => import("@/components/forms/VerifyOtp"), { ssr: false });

export default function Page() {
  return <VerifyOtp />;
}
