"use client"

import * as React from "react"
import {
  AudioWaveform,
  BadgePercent,
  BarChart3,
  Command,
  FileText,
  GalleryVerticalEnd,
  Globe,
  House,
  Megaphone,
  Package,
  ShoppingCart,
  Wand2,
  Users2,
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
      match: ["/dashboard/orders"],
      items: [
        {
          title: "Drafts",
          href: "/dashboard/orders#drafts",
        },
        {
          title: "Abandoned checkouts",
          href: "/dashboard/orders#abandoned-checkouts",
        },
      ],
    },
    {
      title: "Products",
      href: "/dashboard/products",
      icon: Package,
      match: ["/dashboard/products"],
      items: [
        {
          title: "Collections",
          href: "/dashboard/products#collections",
        },
        {
          title: "Inventory",
          href: "/dashboard/products#inventory",
        },
        {
          title: "Purchase orders",
          href: "/dashboard/products#purchase-orders",
        },
        {
          title: "Transfers",
          href: "/dashboard/products#transfers",
        },
        {
          title: "Gift cards",
          href: "/dashboard/products#gift-cards",
        },
      ],
    },
    {
      title: "N8N Automations",
      href: "/dashboard/n8n-automations",
      icon: Wand2,
      match: ["/dashboard/n8n-automations"],
    },
    {
      title: "Customers",
      href: "/dashboard#customers",
      icon: Users2,
    },
    {
      title: "Marketing",
      href: "/dashboard#marketing",
      icon: Megaphone,
    },
    {
      title: "Discounts",
      href: "/dashboard#discounts",
      icon: BadgePercent,
    },
    {
      title: "Content",
      href: "/dashboard#content",
      icon: FileText,
    },
    {
      title: "Markets",
      href: "/dashboard#markets",
      icon: Globe,
    },
    {
      title: "Analytics",
      href: "/dashboard#analytics",
      icon: BarChart3,
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

