export const ORDER_STATUSES = ["PENDING", "PAID", "FULFILLED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
