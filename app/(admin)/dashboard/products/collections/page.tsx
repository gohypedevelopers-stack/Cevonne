"use client";

import dynamic from "next/dynamic";

const CollectionsPage = dynamic(() => import("@/components/admin-dashboard/CollectionsPage"), {
  ssr: false,
});

export default function Page() {
  return <CollectionsPage />;
}
