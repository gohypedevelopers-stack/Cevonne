"use client";

import dynamic from "next/dynamic";

const UsersPage = dynamic(() => import("@/components/admin-dashboard/UsersPage"), { ssr: false });

export default function Page() {
  return <UsersPage />;
}
