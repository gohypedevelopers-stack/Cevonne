"use client"

import * as React from "react"
import Image from "next/image"
import { BadgePercent, Boxes, House, Layers3, Package, ShoppingCart, Users, Workflow } from "lucide-react"

import { NavMain } from "@/components/admin-dashboard/nav-main"
import { NavUser } from "@/components/admin-dashboard/nav-user"
import { useAuth } from "@/context/AuthContext"
import { API_BASE } from "@/lib/api"
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
      title: "Discounts",
      href: "/dashboard/discounts",
      icon: BadgePercent,
      exactMatch: true,
      isActive: (pathname) => pathname === "/dashboard/discounts",
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
      icon: Workflow,
      match: ["/dashboard/n8n-automations", "/admin/ai-automations"],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authFetch, isAdmin, isAuthenticated } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [orderBadge, setOrderBadge] = React.useState<number | undefined>(undefined)

  const navMain = React.useMemo(
    () =>
      data.navMain.map((item) => (item.title === "Orders" ? { ...item, badge: orderBadge } : item)),
    [orderBadge]
  )

  const loadOrderBadge = React.useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE}/${isAdmin ? "orders" : "orders/my"}`, {
        silent: true,
      })

      if (!response.ok) {
        setOrderBadge(undefined)
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | { summary?: { pending?: number } | null; items?: unknown[] | null }
        | unknown[]
        | null

      const pending =
        payload && !Array.isArray(payload) && typeof payload === "object"
          ? typeof payload.summary?.pending === "number"
            ? payload.summary.pending
            : Array.isArray(payload.items)
              ? payload.items.length
              : undefined
          : Array.isArray(payload)
            ? payload.length
            : undefined

      setOrderBadge(typeof pending === "number" && pending > 0 ? pending : undefined)
    } catch {
      setOrderBadge(undefined)
    }
  }, [authFetch, isAdmin])

  const handleNavClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return

    const target = event.target as HTMLElement | null
    if (target?.closest("a[href]")) {
      setOpenMobile(false)
    }
  }

  React.useEffect(() => {
    if (!isAuthenticated) {
      setOrderBadge(undefined)
      return
    }

    void loadOrderBadge()
  }, [isAuthenticated, loadOrderBadge])

  React.useEffect(() => {
    const handleRefresh = () => {
      void loadOrderBadge()
    }

    window.addEventListener("dashboard:data:refresh", handleRefresh)
    return () => window.removeEventListener("dashboard:data:refresh", handleRefresh)
  }, [loadOrderBadge])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3 pt-3">
        <div className="rounded-2xl px-3 py-3 transition-colors duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
          <div className="flex w-full items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl group-data-[collapsible=icon]:size-8">
              <Image
                src="/logo-icon.svg"
                alt="Cevonne"
                width={40}
                height={40}
                className="size-10 object-contain brightness-0"
                priority
              />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="space-y-0.5">
                <p className="font-serif text-[24px] font-semibold leading-none tracking-tight text-black">
                  Cevonne
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Admin Dashboard
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent
        onClickCapture={handleNavClick}
        className="px-3 pb-4 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-2"
      >
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter className="border-t border-[#f0e6df] px-3 py-2.5">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
