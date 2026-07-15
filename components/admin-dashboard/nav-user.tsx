import {
  ChevronsUpDown,
  LogOut,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const { logout } = useAuth()
  const initials = user?.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AD"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="group h-auto min-h-[4.2rem] items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left text-[#4b0d4b] transition-colors duration-200 hover:text-[#4b0d4b] data-[state=open]:text-[#4b0d4b] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:self-center">
              <Avatar className="size-10 rounded-xl bg-transparent group-data-[collapsible=icon]:size-8">
                <AvatarImage src={user.avatar} alt="Cevonne" className="rounded-xl object-contain p-1.5 brightness-0" />
                <AvatarFallback className="rounded-xl bg-transparent text-[10px] font-semibold text-[#4b0d4b]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-serif text-[18px] font-semibold leading-none tracking-tight text-[#4b0d4b]">
                  {user.name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-[#4b0d4b]/45 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-2xl border border-[#eadfd8] bg-white p-2 shadow-[0_24px_60px_rgba(75,13,75,0.12)]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={10}>
            <DropdownMenuItem
              onSelect={logout}
              className="cursor-pointer rounded-xl px-3 py-2.5 text-sm text-[#8b1630] transition-colors hover:bg-rose-50 focus:bg-rose-50 data-[highlighted]:bg-rose-50 data-[highlighted]:text-[#8b1630]"
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
