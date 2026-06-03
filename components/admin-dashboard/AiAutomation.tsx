"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, RefreshCw, Sparkles, Wand2 } from "lucide-react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { AiAndSegmentationPanel } from "@/components/admin-dashboard/components/AiAndSegmentationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";

const defaultRequest = (url, options) => fetch(url, options);

export default function AiAutomation() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();

  const {
    products,
    lowInventory,
    users,
    stats,
    loading,
    refresh,
  } = useDashboardData(true, request, isAdmin);

  const productCount = stats?.productCount ?? 0;
  const pendingReviewCount = stats?.pendingReviewCount ?? 0;
  const reviewCount = stats?.reviewCount ?? 0;
  const userCount = Array.isArray(users) ? users.length : 0;

  const topCollection = useMemo(() => {
    if (!Array.isArray(products) || !products.length) return "core catalog";

    const counts = products.reduce((acc, product) => {
      const name = product?.collection?.name || "Unassigned";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "core catalog";
  }, [products]);

  const aiInsights = useMemo(
    () => [
      {
        id: "restock",
        title: "Restock alerts",
        detail: lowInventory.length
          ? `${lowInventory.length} inventory entries are under the alert threshold and can trigger a reorder flow.`
          : "Inventory is healthy, so no reorder flow needs to fire right now.",
        confidence: lowInventory.length ? 94 : 72,
      },
      {
        id: "launch",
        title: "Launch recommendation",
        detail: `Focus your next promotion on ${topCollection}. It is the strongest collection signal in the current catalog.`,
        confidence: 88,
      },
      {
        id: "reviews",
        title: "Review workflow",
        detail: `${pendingReviewCount} reviews are waiting for moderation and can be routed into an approval queue.`,
        confidence: 81,
      },
    ],
    [lowInventory.length, pendingReviewCount, topCollection]
  );

  const segments = useMemo(
    () => [
      {
        id: "vip",
        name: "High-value shoppers",
        size: Math.max(1, Math.round(userCount * 0.2)),
        criteria: "Customers with repeated purchases and higher engagement signals.",
        tags: ["Retention", "Upsell", "VIP"],
      },
      {
        id: "low-stock",
        name: "Low-stock watchers",
        size: lowInventory.length,
        criteria: "Shoppers likely to respond to stock alerts and urgency campaigns.",
        tags: ["Reorder", "Alerts", "Automation"],
      },
      {
        id: "advocates",
        name: "Review advocates",
        size: reviewCount,
        criteria: "Customers who already left feedback and can be re-engaged for social proof.",
        tags: ["UGC", "Follow-up", "Reviews"],
      },
    ],
    [lowInventory.length, reviewCount, userCount]
  );

  const summaryCards = [
    {
      label: "Products analysed",
      value: productCount,
      helper: `${topCollection} leading collection`,
      icon: <Sparkles className="h-5 w-5 text-primary" />,
    },
    {
      label: "Segments ready",
      value: segments.length,
      helper: "Reusable audience groups",
      icon: <Brain className="h-5 w-5 text-primary" />,
    },
    {
      label: "Low stock alerts",
      value: lowInventory.length,
      helper: `${pendingReviewCount} pending reviews`,
      icon: <Wand2 className="h-5 w-5 text-amber-500" />,
    },
  ];

  const automationRules = [
    {
      title: "Low stock notifications",
      detail: "Alert the team as soon as a shade crosses the stock threshold.",
      state: lowInventory.length ? "Active" : "Idle",
    },
    {
      title: "Review moderation queue",
      detail: `${pendingReviewCount} reviews are ready for manual approval or rejection.`,
      state: pendingReviewCount ? "Queued" : "Idle",
    },
    {
      title: "Collection promotion sync",
      detail: `Push campaigns around ${topCollection} when the catalog changes.`,
      state: "Active",
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#f7f8fb]">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <header className="border-b border-border/60 bg-white px-4 py-4 shadow-sm md:px-8">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold text-primary">AI Automation</p>
                    <Badge className="rounded-full bg-primary/10 text-primary">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Beta
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Predictive cues, audience segments, and workflow suggestions for the catalog.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => refresh?.()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button className="rounded-full bg-primary px-4 text-primary-foreground" onClick={() => navigate("/dashboard/products")}>
                    View products
                  </Button>
                </div>
              </div>
            </header>

            <main className="flex-1 space-y-6 px-4 pb-10 pt-6 md:px-8">
              <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="border-none bg-white/90 shadow-sm">
                          <CardContent className="space-y-3 p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-3 w-28" />
                          </CardContent>
                        </Card>
                      ))
                    : summaryCards.map((card) => (
                        <Card key={card.label} className="border-none bg-white/90 shadow-sm">
                          <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                                <p className="text-3xl font-semibold text-foreground">{card.value}</p>
                                <p className="text-xs text-muted-foreground">{card.helper}</p>
                              </div>
                              <div className="rounded-full bg-primary/10 p-3">{card.icon}</div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
                          </CardContent>
                        </Card>
                      ))}
                </div>

                {loading ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Card key={index} className="rounded-3xl border border-border/60 bg-white shadow-lg">
                        <CardHeader>
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {Array.from({ length: 3 }).map((__, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <AiAndSegmentationPanel aiInsights={aiInsights} segments={segments} />
                )}

                <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-primary">Automation queue</CardTitle>
                    <CardDescription className="text-primary/70">
                      Rules that can be connected to your workflows later.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {automationRules.map((rule) => (
                      <div
                        key={rule.title}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-primary">{rule.title}</p>
                          <p className="text-sm text-muted-foreground">{rule.detail}</p>
                        </div>
                        <Badge className="rounded-full bg-primary/10 text-primary">{rule.state}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
