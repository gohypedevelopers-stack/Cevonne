import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { formatCurrency, toNumber } from "./utils";

export function RecentProducts({ products, loading }) {
  if (loading) {
    return (
      <Card className="border-none bg-muted/40">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-muted/40">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent products</CardTitle>
        <CardDescription>
          Latest additions with assigned collection and inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[260px] px-4">
          <div className="space-y-4">
            {products.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {product.collection?.name ?? "Unassigned collection"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">
                    {formatCurrency(toNumber(product.basePrice))}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {product.shades?.length ?? 0} shade(s)
                  </p>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No products yet. Create your first product to see it here.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
