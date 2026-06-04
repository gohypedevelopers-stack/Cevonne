"use client";

import React, { useState } from "react";
import { Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserOrders } from "@/hooks/useUserOrders";
import { normalizeOrderStatus, type OrderStatus } from "@/types/order";

const STATUS_FLOW: Array<{ status: OrderStatus; label: string }> = [
  { status: "PENDING", label: "Pending" },
  { status: "PAID", label: "Paid" },
  { status: "PROCESSING", label: "Processing" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

const badgeForStatus = (status = "") => {
  const normalized = normalizeOrderStatus(status);
  switch (normalized) {
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-700";
    case "OUT_FOR_DELIVERY":
      return "bg-indigo-100 text-indigo-700";
    case "SHIPPED":
      return "bg-blue-100 text-blue-700";
    case "PROCESSING":
      return "bg-violet-100 text-violet-700";
    case "PAID":
      return "bg-sky-100 text-sky-700";
    case "PENDING":
    default:
      return "bg-amber-100 text-amber-700";
  }
};

export default function Orders() {
  const { orders = [], loading: ordersLoading } = useUserOrders();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--primary)]">Order History</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Shipping and status updates are handled by the dashboard team. Orders shown here are read-only.
      </p>
      <div className="space-y-4">
        {ordersLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)]">
            Loading your order history...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)]">
            No orders yet. Orders you place will appear here.
          </div>
        ) : (
          orders.map((order) => {
            const orderId = order.id || order.number;
            const status = normalizeOrderStatus(order.status);
            const activeIdx = STATUS_FLOW.findIndex((s) => s.status === status);
            const statusLabel = STATUS_FLOW.find((s) => s.status === status)?.label ?? status;

            return (
              <div
                key={orderId}
                className="p-4 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-[var(--secondary-100)] text-[var(--primary)]">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--primary)]">{orderId}</h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {new Date(order.createdAt || Date.now()).toLocaleDateString()} ·{" "}
                        {order.items?.length || 0} items
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeForStatus(
                            status
                          )}`}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-sm font-medium text-[var(--primary)]">
                          {order.totals?.total != null ? `₹${order.totals.total}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                      onClick={() =>
                        setExpandedId((id) => (id === orderId ? null : orderId))
                      }
                    >
                      Track <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expandedId === orderId && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-6 text-xs text-[var(--muted-foreground)]">
                          {STATUS_FLOW.map((step, idx) => {
                            const isActive = idx === activeIdx;
                            const isDone = activeIdx >= idx;
                            return (
                              <div
                                key={step.status}
                                className={`rounded-xl border px-3 py-2 text-center ${
                                  isActive
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : isDone
                              ? "border-slate-200 bg-slate-50"
                              : "border-dashed border-slate-200"
                          }`}
                                >
                          {step.label}
                                </div>
                              );
                            })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
