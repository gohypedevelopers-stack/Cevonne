"use client"

import * as React from "react"
import {
  AudioWaveform,
  Boxes,
  Command,
  GalleryVerticalEnd,
  House,
  Layers3,
  Package,
  ShoppingCart,
  Wand2,
} from "lucide-react"

import { NavMain } from "@/components/admin-dashboard/nav-main"
import { NavUser } from "@/components/admin-dashboard/nav-user"
import { TeamSwitcher } from "@/components/admin-dashboard/team-switcher"
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
  teams: [
    {
      name: "Cevonne Admin",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Merchandising",
      logo: AudioWaveform,
      plan: "Catalog",
    },
    {
      name: "Automation",
      logo: Command,
      plan: "AI workflows",
    },
  ],
  navMain: [
    {
      title: "Home",
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
      href: "/dashboard/products#inventory",
      icon: Boxes,
      exactMatch: true,
      isActive: (pathname, hash) => pathname === "/dashboard/products" && hash === "inventory",
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
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent
        onClickCapture={handleNavClick}
        className="px-3 pb-6 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-2"
      >
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

