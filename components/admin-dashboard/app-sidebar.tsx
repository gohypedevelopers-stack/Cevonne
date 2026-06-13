"use client"

import * as React from "react"
import Image from "next/image"
import { Boxes, House, Layers3, Package, ShoppingCart, Users, Wand2 } from "lucide-react"

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
    avatar: "/logo-icon.svg",
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
      title: "Users",
      href: "/dashboard/users",
      icon: Users,
      exactMatch: true,
      isActive: (pathname) => pathname === "/dashboard/users",
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
      <SidebarHeader className="px-3 pt-3">
        <div className="rounded-2xl px-3 py-3 transition-colors duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
          <div className="flex w-full items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl group-data-[collapsible=icon]:size-8">
              <Image
                src="/logo-icon.svg"
                alt="Cevonne"
                width={32}
                height={32}
                className="size-8 object-contain brightness-0"
                priority
              />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate font-serif text-[18px] font-semibold leading-none tracking-tight text-black">
                Cevonne Admin
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent
        onClickCapture={handleNavClick}
        className="px-3 pb-4 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-2"
      >
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="border-t border-[#f0e6df] px-3 pb-3 pt-3">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
