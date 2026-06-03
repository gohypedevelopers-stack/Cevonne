"use client";

import dynamic from "next/dynamic";

const ResetPassword = dynamic(() => import("@/components/forms/ResetPassword"), { ssr: false });

export default function Page() {
  return <ResetPassword />;
}
