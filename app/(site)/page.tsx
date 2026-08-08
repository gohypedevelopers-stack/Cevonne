"use client";

import dynamic from "next/dynamic";

const Home = dynamic(() => import("@/components/pages/Home"), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-[calc(100svh-5rem)] w-full bg-white"
      aria-busy="true"
      aria-label="Loading Cevonne home page"
    />
  ),
});

export default function Page() {
  return <Home />;
}
