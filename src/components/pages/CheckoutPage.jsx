import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";
import { readAddresses } from "@/lib/addressStorage";

const shippingFields = [
  { label: "Full name", name: "fullName", placeholder: "Priya Kapoor" },
  { label: "Email address", name: "email", placeholder: "hello@marvelle.com", type: "email" },
  { label: "Phone number", name: "phone", placeholder: "+91 98765 43210", type: "tel" },
  {
    label: "Shipping address",
    name: "address",
    placeholder: "Level 3, Cevonne House, 12m Avenue",
    colSpan: 2,
  },
  { label: "City / Town", name: "city", placeholder: "Mumbai" },
  { label: "Postal code", name: "postalCode", placeholder: "400001" },
];

const paymentOptions = [
  {
    label: "Credit or Debit Card",
    description: "Visa, Mastercard, and RuPay accepted immediately.",
    value: "card",
  },
  {
    label: "Net banking & UPI",
    description: "Pay through UPI or your preferred bank.",
    value: "upi",
  },
  {
    label: "Cash on delivery",
    description: "Pay when we handover your parcel at the door.",
    value: "cod",
  },
];

const formatMoney = (value) => (Number.isFinite(value) ? value.toLocaleString("en-IN") : "0");
const API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");

export default function CheckoutPage() {
  const { cartItems, clearCart } = useShop();
  const { isAuthenticated, user, isLoading: authLoading, authFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [shippingData, setShippingData] = useState(
    shippingFields.reduce((acc, field) => ({ ...acc, [field.name]: "" }), {})
  );
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].value);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState(null);

  const shippingStorageKey = useMemo(
    () => (user?.id ? `marvella:shipping:${user.id}` : "marvella:shipping:guest"),
    [user?.id]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(shippingStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const base = {
        fullName: user?.name || "",
        email: user?.email || "",
      };

      if (parsed && typeof parsed === "object") {
        setShippingData((prev) => ({
          ...prev,
          ...base,
          ...parsed,
          fullName: parsed.fullName || base.fullName || prev.fullName,
          email: parsed.email || base.email || prev.email,
        }));
        return;
      }

      const storedAddresses = readAddresses();
      const primaryAddress =
        storedAddresses.find((addr) => addr.default) || storedAddresses[0];

      setShippingData((prev) => ({
        ...prev,
        ...base,
        ...(primaryAddress
          ? {
              fullName: primaryAddress.name || base.fullName || prev.fullName,
              phone: primaryAddress.phone || prev.phone,
              address: primaryAddress.address || prev.address,
              city: primaryAddress.city || prev.city,
              postalCode: primaryAddress.zip || prev.postalCode,
            }
          : {}),
      }));
    } catch (err) {
      console.warn("Could not load saved shipping", err);
    }
  }, [shippingStorageKey, user?.name, user?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(shippingStorageKey, JSON.stringify(shippingData));
    } catch (err) {
      console.warn("Could not persist shipping", err);
    }
  }, [shippingData, shippingStorageKey]);

  const currencySymbol = cartItems[0]?.currency || "₹";
  const subtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        const value = Number(item.price);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [cartItems]
  );
  const shippingFee = cartItems.length ? 149 : 0;
  const total = subtotal + shippingFee;

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setShippingData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please login to complete checkout.");
      navigate("/login", { state: { redirect: location.pathname } });
      return;
    }
    if (placing) return;
    if (!cartItems.length) {
      toast.error("Add at least one item to place an order.");
      return;
    }
    const missing = shippingFields.filter((field) => !shippingData[field.name]?.trim());
    if (missing.length) {
      toast.error(`Please fill ${missing[0].label.toLowerCase()}.`);
      return;
    }

    setPlacing(true);
    try {
      const payload = {
        paymentMethod,
        totals: { subtotal, shippingFee, total },
        shipping: shippingData,
        items: cartItems.map((item) => ({
          id: item.productId || item.id || item.key,
          sku: item.sku || item.key,
          name: item.productName || item.name,
          price: Number(item.price) || 0,
          currency: item.currency || currencySymbol,
          quantity: item.quantity || 1,
        })),
      };
      const response = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Unable to place the order");
      }
      const data = await response.json();
      const savedNumber = data?.number || data?.id;
      setOrderId(savedNumber);
      clearCart();
      toast.success(`Order ${savedNumber || ""} saved for dashboard review.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Unable to save the order. Please retry.");
    } finally {
      setPlacing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--accent)] text-[var(--muted-foreground)]">
        Loading checkout...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--accent)] text-[var(--primary)]">
        <div className="mx-auto w-full max-w-3xl px-4 pt-24 pb-12 lg:pt-32 space-y-6 text-center">
          <Badge
            variant="outline"
            className="border-[var(--secondary-300)] text-[var(--secondary-foreground)] uppercase tracking-widest"
          >
            Sign in required
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--primary)]">Login to complete checkout</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Please sign in or create an account to place your order and save your shipping details for next time.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              state={{ redirect: location.pathname }}
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow hover:bg-[var(--primary-700)] transition-colors"
            >
              Login to continue
            </Link>
            <Link
              to="/signup"
              state={{ redirect: location.pathname }}
              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
            >
              Create account
            </Link>
            <Link
              to="/cart"
              className="inline-flex items-center justify-center rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--primary)]"
            >
              Back to cart
            </Link>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-left shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-[var(--primary)]">Order summary</h3>
            <ul className="space-y-2 border-b border-[var(--border)] pb-3 text-sm">
              {cartItems.length ? (
                cartItems.map((item) => {
                  const itemPrice = Number(item.price);
                  const priceLabel = Number.isFinite(itemPrice) ? formatMoney(itemPrice) : "0";
                  return (
                    <li key={item.key} className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">{item.name}</span>
                      <span className="text-[var(--primary)]">
                        {item.currency || currencySymbol}
                        {priceLabel}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="text-[var(--muted-foreground)] italic">Your cart is empty.</li>
              )}
            </ul>
            <div className="mt-3 space-y-1 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>
                  {currencySymbol}
                  {formatMoney(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span>
                  {currencySymbol}
                  {formatMoney(shippingFee)}
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold text-[var(--primary)]">
                <span>Total</span>
                <span>
                  {currencySymbol}
                  {formatMoney(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--accent)] text-[var(--primary)]">
      <div className="w-full px-4 pt-24 pb-10 lg:pt-32 lg:pb-16">
        <header className="mb-8 space-y-2">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-[var(--secondary-300)] text-[var(--secondary-foreground)] uppercase tracking-widest"
            >
              Secure Checkout
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--primary)]">Complete your order</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Fill in the shipping details and choose your preferred payment method.
          </p>
        </header>

        <form className="grid gap-8 lg:grid-cols-[1fr_380px]" onSubmit={handlePlaceOrder}>
          <section className="space-y-8">
            {/* Shipping Details */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-[var(--primary)]">Shipping Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {shippingFields.map((field) => (
                  <div
                    key={field.name}
                    className={field.colSpan === 2 ? "md:col-span-2" : "md:col-span-1"}
                  >
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                      {field.label}
                    </label>
                    <input
                      type={field.type || "text"}
                      name={field.name}
                      placeholder={field.placeholder}
                      value={shippingData[field.name] || ""}
                      onChange={handleFieldChange}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--accent)] px-4 py-2.5 text-sm text-[var(--primary)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:bg-[var(--card)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-[var(--primary)]">Payment Method</h2>
              <div className="space-y-3">
                {paymentOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-4 rounded-xl border border-[var(--border)] p-4 transition-all hover:border-[var(--secondary-300)] hover:bg-[var(--accent)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]"
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={() => setPaymentMethod(option.value)}
                      className="mt-1 h-4 w-4 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <div className="space-y-1">
                      <p className="font-medium text-[var(--primary)]">{option.label}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Order Summary */}
          <section className="h-fit space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--primary)]">Order Summary</h2>

            <ul className="space-y-3 border-b border-[var(--border)] pb-4">
              {cartItems.length ? (
                cartItems.map((item) => {
                  const itemPrice = Number(item.price);
                  const priceLabel = Number.isFinite(itemPrice) ? formatMoney(itemPrice) : "0";
                  return (
                    <li key={item.key} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--muted-foreground)]">{item.name}</span>
                      <span className="text-[var(--primary)]">
                        {item.currency || currencySymbol}
                        {priceLabel}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="text-sm text-[var(--muted-foreground)] italic">Your cart is empty.</li>
              )}
            </ul>

            <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>
                  {currencySymbol}
                  {formatMoney(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span>
                  {currencySymbol}
                  {formatMoney(shippingFee)}
                </span>
              </div>
              <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between text-base font-bold text-[var(--primary)]">
                <span>Total</span>
                <span>
                  {currencySymbol}
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {orderId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-800">
                  Order <strong>{orderId}</strong> saved. View it in the dashboard orders panel.
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={placing}
                className="w-full rounded-full bg-[var(--primary)] py-6 text-sm font-bold uppercase tracking-widest text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20 hover:bg-[var(--primary-700)] hover:shadow-xl transition-all disabled:opacity-70"
              >
                {placing ? "Saving..." : "Place Order"}
              </Button>
              <Link
                to="/cart"
                className="block text-center text-xs font-medium uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:underline"
              >
                Back to cart
              </Link>
            </div>

            <p className="text-center text-[10px] text-[var(--muted-foreground)]">
              By placing an order, you agree to our terms & conditions.
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}
