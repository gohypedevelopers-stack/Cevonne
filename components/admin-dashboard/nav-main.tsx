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
}

function pathMatches(pathname: string, candidate: string, exactMatch = false) {
  const cleanCandidate = candidate.split("#")[0]
  return exactMatch
    ? pathname === cleanCandidate
    : pathname === cleanCandidate || pathname.startsWith(`${cleanCandidate}/`)
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
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
  }, [items, pathname])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length)
          const isActive = item.match?.some((candidate) =>
            pathMatches(pathname, candidate, item.exactMatch)
          )
          const isOpen = hasChildren ? openSections[item.title] ?? Boolean(isActive) : false

          const buttonContent = (
            <>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.badge ? (
                <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm">
                  {item.badge}
                </span>
              ) : null}
              {hasChildren ? (
                <ChevronRight
                  className={[
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    isOpen ? "rotate-90" : "",
                    item.badge ? "ml-2" : "ml-auto",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ) : null}
            </>
          )

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={Boolean(isActive)} tooltip={item.title}>
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
                  <SidebarMenuButton asChild isActive={Boolean(isActive)} tooltip={item.title}>
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
