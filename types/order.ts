export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const normalizeOrderStatus = (status?: string | null): OrderStatus => {
  const normalized = String(status ?? "PENDING")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return (ORDER_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as OrderStatus)
    : "PENDING";
};

export const getNextOrderStatus = (status?: string | null): OrderStatus => {
  const current = normalizeOrderStatus(status);
  const currentIndex = ORDER_STATUSES.indexOf(current);
  return ORDER_STATUSES[Math.min(currentIndex + 1, ORDER_STATUSES.length - 1)];
};

export interface OrderTotals {
  subtotal: number;
  shippingFee: number;
  total: number;
  [key: string]: number;
}

export interface OrderShipping {
  fullName: string;
  email: string;
  phone?: string;
  address: string;
  city?: string;
  postalCode?: string;
}

export interface OrderItem {
  id?: string;
  sku?: string;
  name: string;
  price: number;
  currency?: string;
  quantity: number;
}

export interface Order {
  id: string;
  number: string;
  userId?: string | null;
  status: OrderStatus;
  paymentMethod?: string | null;
  totals: OrderTotals;
  shipping: OrderShipping;
  items: OrderItem[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
