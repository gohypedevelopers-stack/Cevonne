"use client";

import { useEffect } from "react";

export default function ArRouteShell({ children }) {
  useEffect(() => {
    document.body.classList.add("ar-radius");
    return () => document.body.classList.remove("ar-radius");
  }, []);

  return <main className="min-h-screen bg-background text-foreground">{children}</main>;
}
