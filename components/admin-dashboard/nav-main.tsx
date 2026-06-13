"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavSubItem = {
  title: string
  href: string
}

type NavItem = {
  title: string
  href: string
  icon?: LucideIcon
  badge?: number
  match?: string[]
  exactMatch?: boolean
  items?: NavSubItem[]
  isActive?: (pathname: string, hash: string) => boolean
}

function pathMatches(pathname: string, candidate: string, exactMatch = false) {
  const cleanCandidate = candidate.split("#")[0]
  return exactMatch
    ? pathname === cleanCandidate
    : pathname === cleanCandidate || pathname.startsWith(`${cleanCandidate}/`)
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const [hash, setHash] = React.useState("")
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const updateHash = () => setHash(window.location.hash.slice(1))
    updateHash()
    window.addEventListener("hashchange", updateHash)

    setOpenSections((current) => {
      const next = { ...current }

      items.forEach((item) => {
        if (!item.items?.length) return

        const isActive = item.match?.some((candidate) =>
          pathMatches(pathname, candidate, item.exactMatch)
        )

        if (isActive) {
          next[item.title] = true
        }
      })

      return next
    })

    return () => window.removeEventListener("hashchange", updateHash)
  }, [items, pathname])

  const resolveIsActive = React.useCallback(
    (item: NavItem) =>
      item.isActive?.(pathname, hash) ??
      item.match?.some((candidate) => pathMatches(pathname, candidate, item.exactMatch)),
    [hash, pathname]
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#4b0d4b]/45">
        Platform
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1.5">
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length)
          const isActive = resolveIsActive(item)
          const isOpen = hasChildren ? openSections[item.title] ?? Boolean(isActive) : false

          const buttonContent = (
            <>
              {item.icon && <item.icon />}
              <span className="truncate group-data-[collapsible=icon]:hidden">
                {item.title}
              </span>
              {item.badge ? (
                <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm group-data-[collapsible=icon]:hidden">
                  {item.badge}
                </span>
              ) : null}
              {hasChildren ? (
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                    isOpen && "rotate-90",
                    item.badge ? "ml-2" : "ml-auto"
                  )}
                />
              ) : null}
            </>
          )

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={Boolean(isActive)}
                  tooltip={item.title}
                  className="group h-11 rounded-xl border border-transparent px-3 text-sm font-medium text-[#4b0d4b]/75 transition-all duration-200 hover:border-[#eadfd8] hover:bg-[#fbf7f4] hover:text-[#4b0d4b] data-[active=true]:border-[#eadfd8] data-[active=true]:bg-[#fbf7f4] data-[active=true]:text-[#4b0d4b] data-[active=true]:shadow-sm data-[state=open]:border-[#eadfd8] data-[state=open]:bg-[#fbf7f4] data-[state=open]:text-[#4b0d4b] data-[state=open]:shadow-sm group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2"
                >
                  <Link href={item.href}>{buttonContent}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              open={isOpen}
              onOpenChange={(open) =>
                setOpenSections((current) => ({
                  ...current,
                  [item.title]: open,
                }))
              }
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    isActive={Boolean(isActive)}
                    tooltip={item.title}
                    className="group h-11 rounded-xl border border-transparent px-3 text-sm font-medium text-[#4b0d4b]/75 transition-all duration-200 hover:border-[#eadfd8] hover:bg-[#fbf7f4] hover:text-[#4b0d4b] data-[active=true]:border-[#eadfd8] data-[active=true]:bg-[#fbf7f4] data-[active=true]:text-[#4b0d4b] data-[active=true]:shadow-sm data-[state=open]:border-[#eadfd8] data-[state=open]:bg-[#fbf7f4] data-[state=open]:text-[#4b0d4b] data-[state=open]:shadow-sm group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2"
                  >
                    <Link href={item.href}>{buttonContent}</Link>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <Link href={subItem.href}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
