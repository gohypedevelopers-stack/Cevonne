"use client";

import dynamic from "next/dynamic";

const Login = dynamic(() => import("@/components/forms/Login"), { ssr: false });

export default function Page() {
  return <Login />;
}
