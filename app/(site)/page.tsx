"use client";

import dynamic from "next/dynamic";

const Home = dynamic(() => import("@/components/pages/Home"), { ssr: false });

export default function Page() {
  return <Home />;
}
