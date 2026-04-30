"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers3, Palette, RefreshCw } from "lucide-react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AR_STATIC_SHADES } from "@/data/arShades";

import { ArShadesPanel } from "./components/ArShadesPanel";

const defaultRequest = (url, options) => fetch(url, options);

export default function ShadesPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();
  const { shades, products, stats, loading, refresh } = useDashboardData(true, request);

  const arReady = stats?.arShadeCount ?? 0;
  const totalShades = stats?.shadeCount ?? 0;
  const productsWithShades = useMemo(() => {
    if (!Array.isArray(products)) return 0;
    return products.filter((p) => Array.isArray(p.shades) && p.shades.length).length;
  }, [products]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f7f8fb]">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <header className="border-b border-border/60 bg-white px-4 py-4 shadow-sm md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-2xl font-semibold text-primary">Shades</p>
                <p className="text-sm text-muted-foreground">
                  Manage catalog shades, AR assets, and static AR palette.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => refresh?.()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button className="rounded-full bg-primary text-primary-foreground" onClick={() => navigate("/dashboard/products/new")}>
                  <Layers3 className="mr-2 h-4 w-4" />
                  Add product
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-6 px-4 pb-10 pt-6 md:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-none bg-white/90 shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Total shades</p>
                    <p className="text-3xl font-semibold text-foreground">{totalShades}</p>
                    <p className="text-xs text-muted-foreground">Across all products</p>
                  </div>
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Palette className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none bg-white/90 shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">AR-ready</p>
                    <p className="text-3xl font-semibold text-foreground">{arReady}</p>
                    <p className="text-xs text-muted-foreground">Shades with AR assets</p>
                  </div>
                  <div className="rounded-full bg-secondary/10 p-3 text-secondary-foreground">
                    <Palette className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none bg-white/90 shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Products with shades</p>
                    <p className="text-3xl font-semibold text-foreground">{productsWithShades}</p>
                    <p className="text-xs text-muted-foreground">Linked to catalog</p>
                  </div>
                  <div className="rounded-full bg-muted p-3 text-muted-foreground">
                    <Layers3 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <ArShadesPanel
              shades={shades}
              products={products}
              loading={loading}
              request={request}
              refresh={refresh}
            />

            <Card className="border-none bg-white/95 shadow-sm">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>AR static palette</CardTitle>
                  <CardDescription>Reference shades from the AR experience file.</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {AR_STATIC_SHADES.length} shades
                </Badge>
              </CardHeader>
              <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {AR_STATIC_SHADES.map((shade) => (
                  <div
                    key={shade.id}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-2 shadow-sm"
                  >
                    <span
                      className="h-10 w-10 rounded-full border border-border/70 shadow-sm flex items-center justify-center text-[11px] font-semibold"
                      style={{ backgroundColor: shade.color === "transparent" ? "#f7f7f7" : shade.color }}
                    >
                      {shade.color === "transparent" ? "Ø" : ""}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{shade.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shade.code ? `Code ${shade.code}` : "No code"}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
