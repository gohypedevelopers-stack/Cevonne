"use client";

import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import MobileTopBar from "@/components/MobileTopBar";
import Navbar from "@/components/Navbar";
import ShopDrawer from "@/components/ShopDrawer";
import { useLocation } from "@/lib/router";

const HIDE_FOOTER_PATHS = new Set(["/cart", "/checkout"]);

export default function SiteShell({ children }) {
  const location = useLocation();
  const shouldHideFooter = HIDE_FOOTER_PATHS.has(location.pathname);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <MobileTopBar />
      {children}
      <ShopDrawer />
      {!shouldHideFooter && <Footer />}
      <MobileBottomNav />
    </main>
  );
}
