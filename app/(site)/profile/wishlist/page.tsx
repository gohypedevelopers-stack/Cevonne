"use client";

import dynamic from "next/dynamic";

const WishlistPage = dynamic(() => import("@/components/pages/WishlistPage"), { ssr: false });

export default function Page() {
  return <WishlistPage />;
}
