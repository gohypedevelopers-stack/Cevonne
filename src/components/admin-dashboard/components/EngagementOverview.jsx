import { format, parseISO } from "date-fns";
import { AlertTriangle, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { formatCurrency, toNumber } from "../utils";

export function CustomersCard({ data, loading }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-primary">Customer distribution</CardTitle>
        <CardDescription className="text-primary/70">
          Top email domains across your customer base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : data.length ? (
          data.map((item) => (
            <div
              key={item.domain}
              className="rounded-2xl border border-border/60 bg-muted/40 p-4"
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{item.domain}</span>
                <span className="text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <Progress value={item.percentage} className="mt-3 h-2" />
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            There is not enough customer data yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentProductsCard({ products, loading }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-semibold text-primary">Recent products</CardTitle>
          <CardDescription className="text-primary/70">Latest catalogue additions.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : products.length ? (
          <ScrollArea className="h-[260px] px-6">
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        product.createdAt ? parseISO(product.createdAt) : new Date(),
                        "MMM d, yyyy"
                      )}
                    </span>
                  </div>
                  <div className="text-right text-sm font-semibold text-primary">
                    {formatCurrency(toNumber(product.basePrice))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="px-6 text-sm text-muted-foreground">
            No products have been created yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LatestReviewsCard({ reviews, loading }) {
  const latest =
    Array.isArray(reviews) && reviews.length
      ? reviews.slice(0, 5)
      : [];

  const statusStyles = {
    PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-semibold text-primary">Latest reviews</CardTitle>
          <CardDescription className="text-primary/70">
            Recent customer feedback awaiting moderation.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : latest.length ? (
          <ScrollArea className="h-[260px] px-6">
            <div className="space-y-3">
              {latest.map((review) => (
                <div
                  key={review.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-primary">
                        {review.user?.name ?? review.user?.email ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {review.product?.name ?? "-"}
                      </span>
                    </div>
                    <Badge
                      className={`inline-flex items-center gap-1 border ${statusStyles[review.status] ?? "border-border/60 bg-muted text-muted-foreground"}`}
                    >
                      {review.status?.toLowerCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <Star className="h-3.5 w-3.5" />
                      {review.rating}/5
                    </Badge>
                    <span>
                      {review.createdAt
                        ? format(parseISO(review.createdAt), "MMM d, yyyy")
                        : ""}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="text-sm text-foreground line-clamp-3">{review.comment}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No comment provided.</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            There are no customer reviews yet. Encourage shoppers to share their feedback once orders ship.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LowInventoryCard({ items, loading }) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-[var(--secondary-200)] bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-[var(--secondary-200)] bg-[linear-gradient(145deg,var(--secondary-100),var(--primary-100))] px-6 py-5">
        <div>
          <CardTitle className="text-lg font-semibold text-primary">Low inventory</CardTitle>
          <CardDescription className="text-primary/70">
            Shades and products below the stock threshold.
          </CardDescription>
        </div>
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </CardHeader>
      <CardContent className="px-0 pt-4">
        {loading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length ? (
          <ScrollArea className="h-[260px] px-6">
            <div className="space-y-3">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--secondary-200)] bg-[var(--secondary-100)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {entry.product?.name ?? "Unassigned product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Shade: {entry.shade?.name ?? "All"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border border-destructive/40 bg-white px-3 py-1 text-xs font-semibold text-destructive shadow-sm"
                  >
                    {entry.quantity ?? 0} left
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="mx-6 rounded-2xl border border-dashed border-[var(--secondary-200)] px-6 py-4 text-sm text-muted-foreground">
            Inventory levels look healthy. No action required.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
