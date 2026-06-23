"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type WorkflowDashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export default function WorkflowDashboardShell({
  eyebrow,
  title,
  description,
  badges,
  actions,
  children,
}: WorkflowDashboardShellProps) {
  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1] text-foreground">
        <div className="pointer-events-none absolute -left-24 top-8 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-secondary/35 blur-3xl" />

        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 min-w-0 px-4 pb-8 pt-6 lg:px-8">
              <div className="flex w-full min-w-0 flex-col gap-6">
                <header className="sticky top-0 z-10 rounded-[28px] border border-border/60 bg-background/90 px-4 py-4 shadow-sm backdrop-blur-xl lg:px-6 lg:py-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 md:hidden">
                      <SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />
                      <span className="text-sm font-medium text-muted-foreground">Menu</span>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-2xl space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">{eyebrow}</p>
                        <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">{title}</h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:max-w-3xl lg:flex-1 lg:justify-end">
                        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
                        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="bg-border/70" />

                <div className="flex w-full min-w-0 flex-col gap-6">{children}</div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
