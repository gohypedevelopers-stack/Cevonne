import React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useShop } from "@/context/ShopContext"

export default function CartPage() {
  const { cartItems, removeFromCart } = useShop()
  const subtotal = cartItems.reduce((sum, item) => {
    const value = Number(item.price)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
  const currencySymbol = cartItems[0]?.currency || "₹"
  const hasItems = cartItems.length > 0

  return (
    <div className="min-h-screen bg-[var(--accent)] text-[var(--primary)]">
      <div className="mx-auto max-w-5xl px-4 pt-24 pb-10 lg:pt-32 lg:pb-16">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--primary)]">Shopping Cart</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {hasItems
              ? `You have ${cartItems.length} item${cartItems.length === 1 ? "" : "s"} in your cart`
              : "Your cart is currently empty"}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            {hasItems ? (
              <ul className="space-y-4">
                {cartItems.map((item) => {
                  const itemPrice = Number(item.price)
                  const priceLabel = Number.isFinite(itemPrice)
                    ? `${item.currency || currencySymbol}${itemPrice.toLocaleString()}`
                    : `${item.currency || currencySymbol}${item.price ?? ""}`
                  return (
                    <li
                      key={item.key}
                      className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary-100)] text-xs font-bold uppercase tracking-widest text-[var(--secondary-400)]">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover rounded-lg" />
                        ) : (
                          item.name?.slice(0, 2) || "ML"
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-[var(--primary)]">{item.name}</h3>
                            <span className="font-medium text-[var(--primary)]">{priceLabel}</span>
                          </div>
                          {item.color && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                              <span
                                className="h-3 w-3 rounded-full border border-[var(--border)]"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.shadeName || "Selected Shade"}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => removeFromCart(item.key)}
                            className="text-xs font-medium text-[var(--destructive)] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
                <div className="mb-4 rounded-full bg-[var(--secondary-100)] p-4">
                  <svg className="h-8 w-8 text-[var(--secondary-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[var(--primary)]">Your cart is empty</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Looks like you haven't added anything yet.</p>
                <Link to="/" className="mt-6">
                  <Button className="rounded-full px-6 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-700)]">
                    Start Shopping
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {hasItems && (
            <div className="h-fit space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[var(--primary)]">Order Summary</h2>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-[var(--muted-foreground)]">
                  <span>Subtotal</span>
                  <span>{currencySymbol}{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--muted-foreground)]">
                  <span>Shipping</span>
                  <span className="text-emerald-600">Free</span>
                </div>
                <div className="border-t border-[var(--border)] pt-4 flex justify-between text-base font-bold text-[var(--primary)]">
                  <span>Total</span>
                  <span>{currencySymbol}{subtotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <Link to="/checkout" className="block">
                  <Button className="w-full rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-700)]">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link to="/" className="block">
                  <Button variant="outline" className="w-full rounded-full border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--primary)]">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                Secure checkout powered by Stripe
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
