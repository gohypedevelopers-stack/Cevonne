import { Bell, Plus, Search, Settings, UserCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader({ onCreateProduct }) {
  const [searchQuery, setSearchQuery] = useState("");
  const notificationCount = 3; // This would come from your data

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-border/60 bg-white/95 px-6 py-5 shadow-md backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="rounded-full border border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 p-2.5 text-primary shadow-sm transition-all hover:scale-110 hover:shadow-md lg:hidden" />
        <div className="space-y-1">
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text font-serif text-3xl font-bold leading-tight text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Monitor catalog health and operational insights at a glance
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, collections, shades..."
            className="h-11 rounded-full border-2 border-border/70 bg-white/95 pl-11 pr-4 text-sm font-medium text-foreground shadow-sm transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            type="search"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateProduct}
            className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg lg:flex"
          >
            <Plus className="h-4 w-4" />
            New Product
          </Button>

          <Button
            onClick={onCreateProduct}
            size="icon"
            className="flex h-11 w-11 rounded-full bg-gradient-to-br from-primary/90 to-secondary/90 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg lg:hidden"
            title="Create product"
          >
            <Plus className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="hidden h-11 w-11 rounded-full border-2 border-border/60 bg-white text-primary shadow-sm transition-all hover:scale-110 hover:border-primary/30 hover:shadow-md sm:flex"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="relative hidden h-11 w-11 rounded-full border-2 border-border/60 bg-white text-primary shadow-sm transition-all hover:scale-110 hover:border-primary/30 hover:shadow-md sm:flex"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-0 text-[10px] font-bold text-white">
                {notificationCount}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-2.5 rounded-full border-2 border-border/60 bg-gradient-to-br from-white to-gray-50 px-3 py-2 shadow-sm transition-all hover:shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-sm">
              CA
            </div>
            <div className="hidden text-left text-xs font-medium leading-tight sm:block">
              <span className="block text-sm font-bold text-primary">Cevonne Admin</span>
              <span className="text-xs text-muted-foreground">Operations</span>
            </div>
            <UserCircle className="h-5 w-5 text-primary sm:hidden" />
          </div>
        </div>
      </div>
    </header>
  );
}
