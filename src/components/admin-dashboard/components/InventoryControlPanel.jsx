import { AlertTriangle, TruckIcon, Package, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

export function InventoryControlPanel({ inventoryStats, lowStockItems }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold text-primary">
              Inventory Command Center
            </CardTitle>
          </div>
          <CardDescription>Real-time stock monitoring across all SKUs</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {inventoryStats.map((stat, index) => {
            const isLowStock = stat.label === "Low stock";
            const percentage = stat.label === "Catalog units" && inventoryStats[0]
              ? Math.min((stat.value / (inventoryStats[0].value * 100)) * 100, 100)
              : 75;

            return (
              <div
                key={stat.label}
                className={`group relative overflow-hidden rounded-2xl border-2 ${isLowStock ? "border-orange-200 bg-orange-50" : "border-border/60 bg-gradient-to-br from-muted/30 to-white"
                  } px-5 py-4 transition-all hover:scale-105 hover:shadow-md`}
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                  {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />}
                </p>
                <p className={`mt-2 text-3xl font-bold ${isLowStock ? "text-orange-600" : "text-primary"}`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>

                {!isLowStock && (
                  <Progress
                    value={percentage}
                    className="mt-3 h-1.5"
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="border-b border-border/40 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-lg font-semibold text-primary">Reorder Queue</CardTitle>
                <CardDescription>Items requiring immediate attention</CardDescription>
              </div>
            </div>
            <Badge className="flex items-center gap-1 rounded-full border-orange-300 bg-orange-100 text-orange-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowStockItems.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-4">
          {lowStockItems.length ? (
            <ScrollArea className="h-[280px] px-4">
              <div className="space-y-2.5">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between rounded-2xl border-2 border-orange-100 bg-gradient-to-r from-orange-50/50 to-white px-4 py-3 transition-all hover:scale-[1.02] hover:border-orange-200 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-primary">{item.name}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.collection ?? "Unassigned"}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                          {item.quantity} units
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">SKU: {item.sku ?? "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
              <div className="rounded-full bg-green-100 p-4">
                <TruckIcon className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-primary">All Stock Levels Healthy</p>
                <p className="text-sm text-muted-foreground">No items need restocking</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
