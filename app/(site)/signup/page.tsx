"use client";

import dynamic from "next/dynamic";

const Signup = dynamic(() => import("@/components/forms/Signup"), { ssr: false });

export default function Page() {
  return <Signup />;
}
