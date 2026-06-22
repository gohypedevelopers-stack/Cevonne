"use client";

import dynamic from "next/dynamic";

const G2PolicyAccountHealthPage = dynamic(
  () => import("@/components/admin-dashboard/G2PolicyAccountHealthPage"),
  { ssr: false },
);

export default function G2PolicyAccountHealthClient() {
  return <G2PolicyAccountHealthPage />;
}
