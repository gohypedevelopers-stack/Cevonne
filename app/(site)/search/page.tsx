"use client";

import dynamic from "next/dynamic";

const SearchPage = dynamic(() => import("@/components/pages/SearchPage"), { ssr: false });

export default function Page() {
  return <SearchPage />;
}
