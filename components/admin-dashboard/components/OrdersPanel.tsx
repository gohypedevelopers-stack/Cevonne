import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, CreditCard, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/components/admin-dashboard/utils";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api";
import { getNextOrderStatus, normalizeOrderStatus, type Order, type OrderStatus } from "@/types/order";

const statusStyles: Record<OrderStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-sky-200 bg-sky-50 text-sky-700",
  PROCESSING: "border-violet-200 bg-violet-50 text-violet-700",
  SHIPPED: "border-blue-200 bg-blue-50 text-blue-700",
  OUT_FOR_DELIVERY: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

const actionLabels: Record<OrderStatus, string> = {
  PENDING: "Mark paid",
  PAID: "Start processing",
  PROCESSING: "Mark shipped",
  SHIPPED: "Out for delivery",
  OUT_FOR_DELIVERY: "Mark delivered",
  DELIVERED: "Completed",
};

type OrdersPanelProps = {
  orders?: Order[];
  loading?: boolean;
  refresh?: () => void;
};

const normalizeStatus = (status?: string | null) => normalizeOrderStatus(status);

export function OrdersPanel({ orders = [], loading = false, refresh }: OrdersPanelProps) {
  const { authFetch, isAdmin } = useAuth();
  const sorted = Array.isArray(orders)
    ? [...orders].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
    : [];
  const visible = sorted.slice(0, 5);

  const summary = {
    total: sorted.length,
    pending: sorted.filter((o) => normalizeStatus(o.status) === "PENDING").length,
    inTransit: sorted.filter((o) => {
      const status = normalizeStatus(o.status);
      return status !== "PENDING" && status !== "DELIVERED";
    }).length,
    revenue: sorted.reduce((acc, order) => acc + (Number(order?.totals?.total) || 0), 0),
  };

  const handleAdvance = async (order: Order) => {
    const current = normalizeStatus(order?.status);
    const next = getNextOrderStatus(current);
    try {
      const response = await authFetch(`${API_BASE}/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Only admins can update order status.");
          return;
        }
        const message = await response.text().catch(() => "");
        throw new Error(message || "Failed to update order status");
      }
      toast.success(`Order ${order?.number || order?.id} marked ${statusLabels[next] ?? next}`);
      refresh?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      }
    } catch (err) {
      console.error("Order update failed", err);
      toast.error(err?.message || "Unable to update order");
    }
  };

  return (
    <Card id="orders" className="border-none bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Orders & shipping</CardTitle>
          <CardDescription>Live orders from the storefront with shipping details.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {summary.total} orders
          </Badge>
          <Badge className="rounded-full bg-amber-100 text-amber-800 border-amber-200">
            {summary.pending} awaiting payment
          </Badge>
          <Badge className="rounded-full bg-emerald-100 text-emerald-800 border-emerald-200">
            {summary.inTransit} packing/shipping
          </Badge>
        </div>
      </CardHeader>
      <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3"
            >
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          ))
        ) : visible.length ? (
          visible.map((order) => {
            const status = normalizeStatus(order.status);
            const shipping = order.shipping || {};
            const payment = order.paymentMethod || "card";
            const total = order?.totals?.total ?? 0;
            return (
              <div
                key={order.id ?? order.number}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-3 shadow-sm md:flex-row md:items-center md:gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {(order.number || order.id || "ORD").slice(-4)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{order.number || order.id}</p>
                      <Badge
                        variant="outline"
                        className={`rounded-full text-xs ${statusStyles[status] ?? ""}`}
                      >
                        {statusLabels[status] ?? status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Placed{" "}
                      {order.createdAt
                        ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })
                        : "recently"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {shipping.city || shipping.address || "Ship to be added"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        {payment === "cod" ? "Cash on delivery" : payment.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-start gap-2 md:flex-row md:items-center md:justify-end">
                  <div className="flex flex-col text-right text-sm font-semibold text-foreground">
                    <span>{formatCurrency(total)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {Array.isArray(order.items) ? `${order.items.length} items` : "No items"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleAdvance(order)}
                      disabled={status === "DELIVERED"}
                    >
                      {status === "DELIVERED" ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                          Completed
                        </>
                      ) : (
                        <>
                          <Truck className="mr-2 h-4 w-4" />
                          {actionLabels[status] ?? "Advance status"}
                        </>
                      )}
                    </Button>
                    <Badge variant="secondary" className="flex items-center gap-1 rounded-full text-xs">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {shipping.fullName || "Guest"} • {shipping.city || "City"}{" "}
                      {shipping.postalCode ? `(${shipping.postalCode})` : ""}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
            No test orders yet. Place one in checkout to see shipping details here.
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-full">
            Total collected: {formatCurrency(summary.revenue)}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Demo orders are stored locally until you wire the real gateway.
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
