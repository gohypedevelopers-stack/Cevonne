import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, CheckCircle2, Clock3, CreditCard, MapPin, RefreshCw, Search, Truck } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/components/admin-dashboard/utils";

const API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
const statusLabels = { PENDING: "Awaiting payment", PAID: "Paid", FULFILLED: "Shipped" };
const statusColors = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PAID: "bg-sky-100 text-sky-800 border-sky-200",
  FULFILLED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function OrdersPage() {
  const { authFetch, isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, paid: 0, fulfilled: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/${isAdmin ? "orders" : "orders/my"}`);
      const data = await res.json();
      const list = Array.isArray(data?.items ?? data) ? (data.items ?? data) : [];
      const nextSummary =
        typeof data?.summary === "object" && data?.summary !== null
          ? data.summary
          : {
              total: list.length,
              pending: list.filter((o) => o.status === "PENDING").length,
              paid: list.filter((o) => o.status === "PAID").length,
              fulfilled: list.filter((o) => o.status === "FULFILLED").length,
              revenue: list.reduce((acc, o) => acc + (Number(o?.totals?.total) || 0), 0),
            };
      setOrders(list);
      setSummary(nextSummary);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) => {
      const haystack = [o.number, o.shipping?.fullName, o.shipping?.email, o.shipping?.city].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, filter]);

  const updateStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    try {
      const res = await authFetch(`${API_BASE}/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Only admins can update order status.");
          return;
        }
        const msg = await res.text().catch(() => "Failed to update order");
        throw new Error(msg || "Failed to update order");
      }
      await load();
      toast.success(`Order updated to ${statusLabels[status] || status}`);
    } catch (err) {
      console.error("Order update failed", err);
      toast.error(err?.message || "Unable to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f7f8fb]">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <main className="flex-1 space-y-6 px-4 pb-10 pt-6 md:px-8">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-2xl font-semibold text-primary">Orders</p>
                <p className="text-sm text-muted-foreground">Track payments, shipping, and fulfillment.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search orders or customers..."
                    className="w-64 rounded-full pl-9"
                  />
                </div>
                <Button variant="outline" className="rounded-full" onClick={load}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </header>

            <div className="grid gap-3 md:grid-cols-4">
              <StatCard label="Total orders" value={summary.total} helper={`${summary.pending} awaiting payment`} />
              <StatCard label="Paid" value={summary.paid} helper="Ready to ship" />
              <StatCard label="Fulfilled" value={summary.fulfilled} helper="Completed" />
              <StatCard label="Total collected" value={formatCurrency(summary.revenue)} helper="Gross revenue" />
            </div>

            <Card className="border-none bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Orders & shipping</CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "Manage payments, addresses, and fulfillment."
                      : "Viewing your own orders. Admins see all orders here."}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {filtered.length} orders
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-28 rounded-full" />
                    </div>
                  ))
                ) : filtered.length ? (
                  filtered.map((order) => {
                    const status = order.status || "PENDING";
                    const shipping = order.shipping || {};
                    const payment = order.paymentMethod || "card";
                    const total = order?.totals?.total ?? 0;
                    return (
                      <div
                        key={order.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm md:flex-row md:items-center md:gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                            {(order.number || "ORD").slice(-4)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{order.number}</p>
                              <Badge
                                variant="outline"
                                className={`rounded-full text-xs ${statusColors[status] ?? ""}`}
                              >
                                {statusLabels[status] || status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {shipping.fullName || "Customer"} • {shipping.city || shipping.address || "Address"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CreditCard className="h-3.5 w-3.5" />
                                {payment === "cod" ? "Cash on delivery" : payment.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Items: {Array.isArray(order.items) ? order.items.length : 0} • Total: {formatCurrency(total)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-end">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={updatingId === order.id || status !== "PENDING"}
                            title={status !== "PENDING" ? "Already marked paid/shipped" : ""}
                            onClick={() => updateStatus(order.id, "PAID")}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Mark paid
                          </Button>
                            <Button
                              size="sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={updatingId === order.id || (status !== "PAID" && status !== "FULFILLED")}
                            title={status === "PENDING" ? "Mark paid first" : ""}
                            onClick={() => updateStatus(order.id, "FULFILLED")}
                          >
                            {status === "FULFILLED" ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                                  Fulfilled
                                </>
                              ) : (
                                <>
                                  <Truck className="mr-2 h-4 w-4" />
                                  Mark shipped
                                </>
                              )}
                            </Button>
                          </div>
                          <Badge variant="secondary" className="flex items-center gap-1 rounded-full text-xs">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {shipping.postalCode || "PIN"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                    No orders yet. Place a checkout order to see it here.
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <Card className="border-none bg-white/90 shadow-sm">
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}
