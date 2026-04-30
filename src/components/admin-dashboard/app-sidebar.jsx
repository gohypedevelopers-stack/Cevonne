"use client";

import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  LayoutDashboard,
  Layers3,
  LifeBuoy,
  Package,
  Palette,
  Truck,
  Settings,
  Sparkles,
  Users2,
  GalleryVerticalEnd,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/hooks/use-sidebar";

const primaryNav = [
  { title: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Products", icon: Package, href: "/dashboard/products" },
  { title: "Orders", icon: Truck, href: "/dashboard/orders" },
  { title: "Inventory", icon: Boxes, href: "/dashboard#inventory" },
  { title: "Collections", icon: Layers3, href: "/dashboard#collections" },
  { title: "Shades", icon: Palette, href: "/dashboard/shades" },
  { title: "Customers", icon: Users2, href: "/dashboard#customers" },
];

const secondaryNav = [
  { title: "Settings", icon: Settings, href: "/dashboard#settings" },
  { title: "Support", icon: LifeBuoy, href: "mailto:support@marvelle.com" },
];

// Resizable sidebar bounds (desktop)
const MIN_W = 240; // px
const MAX_W = 420; // px
const DEFAULT_W = 272; // px

export function AppSidebar({ className = "", style, ...props }) {
  const isMobile = useIsMobile();
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_W;
    const saved = Number(localStorage.getItem("adminSidebarWidth"));
    return Number.isFinite(saved)
      ? Math.min(MAX_W, Math.max(MIN_W, saved))
      : DEFAULT_W;
  });

  const [resizing, setResizing] = useState(false);
  const startX = useRef(0);
  const startW = useRef(width);

  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    localStorage.setItem("adminSidebarWidth", String(width));
  }, [width, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    setResizing(false);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !resizing) {
      return undefined;
    }

    const onMove = (e) => {
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      const clientX = (touch && touch.clientX) || e.clientX || 0;
      const delta = clientX - startX.current;
      const next = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(next);
    };

    const onUp = () => setResizing(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    document.body.classList.add("select-none", "cursor-ew-resize");

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      document.body.classList.remove("select-none", "cursor-ew-resize");
    };
  }, [resizing, isMobile]);

  const beginResize = (e) => {
    if (isMobile) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = (touch && touch.clientX) || e.clientX || 0;
    startX.current = clientX;
    startW.current = width;
    setResizing(true);
  };

  const collapsedWidth = 64;
  const effectiveWidth = isMobile ? undefined : sidebarState === "collapsed" ? collapsedWidth : Math.round(width);
  const wrapperStyle = isMobile ? undefined : { width: `${effectiveWidth}px`, height: "100vh" };
  const sidebarStyle = isMobile
    ? style
    : {
      ...style,
      "--sidebar-width": `${effectiveWidth}px`,
      "--sidebar-width-icon": `${collapsedWidth}px`,
    };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    // Wrapper controls the width; Sidebar fills it.
    <div
      className={`relative z-10 shrink-0 ${isMobile ? "w-full" : ""}`.trim()}
      style={{ ...wrapperStyle, height: "100vh" }}
    >
      <Sidebar
        position="sticky"
        collapsible={isMobile ? "offcanvas" : "icon"}
        className={`group/sidebar sticky left-0 top-0 flex h-screen w-full flex-col border-r border-border/60 bg-white text-slate-800 ${className}`.trim()}
        style={sidebarStyle}
        {...props}
      >
        <SidebarHeader className="flex-shrink-0 border-b border-border/60 px-4 pb-4 pt-6 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-3 group-data-[collapsible=icon]:pt-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-foreground shadow-sm transition-all duration-200 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Cevonne Admin</span>
              <span className="truncate text-xs">Enterprise</span>
            </div>
            <Badge className="ml-auto hidden rounded-full border border-border/80 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary group-data-[collapsible=icon]:hidden sm:flex">
              Live
            </Badge>
          </div>
        </SidebarHeader>

        {/* Independently scrollable body (scrollbar hidden) */}
        <SidebarContent className="scrollbar-hide flex-1 overflow-y-auto px-3 pb-6 pt-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-2">
          <SidebarGroup className="space-y-3">
            <SidebarGroupLabel className="px-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/70 group-data-[collapsible=icon]:hidden">
              Management
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1.5">
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a
                      href={item.href}
                      onClick={handleNavClick}
                      className="group/nav-item flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition group-[.group/nav-item]:hover:bg-primary/80 group-[.group/nav-item]:hover:text-primary-foreground group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="space-y-3">
            <SidebarGroupLabel className="px-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/70 group-data-[collapsible=icon]:hidden">
              Tools
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1.5">
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a
                      href={item.href}
                      onClick={handleNavClick}
                      className="group/item flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-primary/5 hover:text-primary hover:shadow-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition group-item-hover:bg-primary group-item-hover:text-primary-foreground group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="flex-shrink-0 px-3 pb-6 group-data-[collapsible=icon]:hidden">
          <div className="rounded-3xl border border-[var(--secondary-200)] bg-white/95 p-4 text-xs text-primary/80 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">Storage usage</p>
              <span className="text-[11px] text-muted-foreground">67%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-[var(--primary-100)]">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary via-primary-400 to-primary-200" />
            </div>
            <p className="mt-2 text-primary/70">6.7 GB of 10 GB</p>
            <a
              href="mailto:support@marvelle.com"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
            >
              <LifeBuoy className="h-4 w-4" />
              Contact support
            </a>
          </div>
        </SidebarFooter>

        {/* Hide the clickable rail on desktop (prevents accidental collapse while resizing) */}
        <SidebarRail className="md:hidden" />
      </Sidebar>

      {/* Drag handle (desktop only) — SINGLE hairline, overlaid to avoid double-line */}
      {!isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          aria-valuenow={Math.round(width)}
          onMouseDown={beginResize}
          onTouchStart={beginResize}
          className="absolute -right-px top-0 hidden h-full w-2 cursor-ew-resize md:block z-50"
        >
          {/* ONE guide line only (removes the “double line” look) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-black/10" />
        </div>
      )}
    </div>
  );
}
