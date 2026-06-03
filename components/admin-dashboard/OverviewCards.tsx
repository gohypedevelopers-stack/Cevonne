import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({ label, value, helper }) {
  return (
    <Card className="border-none bg-muted/40">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 pt-0 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <span>{helper}</span>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-none bg-muted/40">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Active Products"
        value={stats.productCount}
        helper="Catalogue items available"
      />
      <MetricCard label="Shades" value={stats.shadeCount} helper="Unique shade variants" />
      <MetricCard
        label="Collections"
        value={stats.collectionCount}
        helper="Curated seasonal edits"
      />
      <MetricCard
        label="Total Units"
        value={stats.totalInventory}
        helper={`${stats.lowStockCount} items below threshold`}
      />
    </div>
  );
}
