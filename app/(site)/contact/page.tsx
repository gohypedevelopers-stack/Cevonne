"use client";

import dynamic from "next/dynamic";

const Contact = dynamic(() => import("@/components/pages/Contact"), { ssr: false });

export default function Page() {
  return <Contact />;
}
