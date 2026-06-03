"use client";

import dynamic from "next/dynamic";

const Settings = dynamic(() => import("@/components/profile/Settings"), { ssr: false });

export default function Page() {
  return <Settings />;
}
