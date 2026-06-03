"use client";

import dynamic from "next/dynamic";

const ProfileOverview = dynamic(() => import("@/components/profile/ProfileOverview"), { ssr: false });

export default function Page() {
  return <ProfileOverview />;
}
