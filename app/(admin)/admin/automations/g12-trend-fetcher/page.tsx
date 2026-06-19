"use client";

import dynamic from "next/dynamic";

const G12TrendFetcherPage = dynamic(
  () => import("@/components/admin-dashboard/G12TrendFetcherPage"),
  { ssr: false },
);

export default function Page() {
  return <G12TrendFetcherPage />;
}
