"use client"

import * as React from "react"
import Image from "next/image"
import { Boxes, House, Layers3, Package, ShoppingCart, Wand2 } from "lucide-react"

import { NavMain } from "@/components/admin-dashboard/nav-main"
import { NavUser } from "@/components/admin-dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSidebar } from "@/hooks/use-sidebar"

const data = {
  user: {
    name: "Cevonne Admin",
    email: "admin@cevonne.com",
    avatar: "/logo.svg",
  },
  navMain: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: House,
      match: ["/dashboard"],
      exactMatch: true,
    },
    {
      title: "Orders",
      href: "/dashboard/orders",
      icon: ShoppingCart,
      badge: 2,
      exactMatch: true,
      match: ["/dashboard/orders"],
    },
    {
      title: "Products",
      href: "/dashboard/products",
      icon: Package,
      isActive: (pathname, hash) =>
        (pathname === "/dashboard/products" ||
          pathname === "/dashboard/products/new" ||
          /^\/dashboard\/products\/[^/]+\/edit$/.test(pathname)) &&
        hash !== "inventory",
    },
    {
      title: "Collections",
      href: "/dashboard/products/collections",
      icon: Layers3,
      exactMatch: true,
      isActive: (pathname) => pathname === "/dashboard/products/collections",
    },
    {
      title: "Inventory",
      href: "/dashboard/inventory",
      icon: Boxes,
      exactMatch: true,
      isActive: (pathname) => pathname === "/dashboard/inventory",
    },
    {
      title: "N8N Automations",
      href: "/dashboard/n8n-automations",
      icon: Wand2,
      match: ["/dashboard/n8n-automations"],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return

    const target = event.target as HTMLElement | null
    if (target?.closest("a[href]")) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-2 pt-3">
        <div className="rounded-[24px] border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-3 shadow-sm transition-colors group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-sidebar-border/60 bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Image src="/logo.svg" alt="Cevonne" width={28} height={28} className="size-7 object-contain" priority />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">Cevonne Admin</p>
              <p className="truncate text-xs text-sidebar-foreground/70">Enterprise</p>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent
        onClickCapture={handleNavClick}
        className="px-3 pb-6 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-2"
      >
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 px-2 pb-3 pt-3">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
