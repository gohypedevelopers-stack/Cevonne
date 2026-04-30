import React, { useEffect } from "react"
import { useLocation } from "react-router-dom"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useShop } from "@/context/ShopContext"
import { useNavigate } from "react-router-dom"

export default function ShopDrawer() {
  const {
    cartItems,
    wishlist,
    removeFromCart,
    removeFromWishlist,
    drawerOpen,
    drawerView,
    openDrawer,
    closeDrawer,
  } = useShop()
  const location = useLocation()
  const view = drawerView
  const open = drawerOpen
  const drawerItems = view === "wishlist" ? wishlist : cartItems
  const drawerTitle = view === "wishlist" ? "Wishlist" : "Cart"
  const drawerSubtitle =
    view === "wishlist" ? "Looks saved for later" : "Looks waiting in your cart"

  const handleClose = () => closeDrawer()

  const handleRemove = (key) => {
    if (!key) return
    if (view === "wishlist") {
      removeFromWishlist(key)
    } else {
      removeFromCart(key)
    }
  }
  const navigate = useNavigate()
  const goToCart = () => {
    skipAutoOpenPath.current = "/cart"
    closeDrawer()
    navigate("/cart")
  }
  const goToWishlist = () => {
    skipAutoOpenPath.current = "/wishlist"
    closeDrawer()
    navigate("/wishlist")
  }
  const goToCheckout = () => {
    skipAutoOpenPath.current = "/checkout"
    closeDrawer()
    navigate("/checkout")
  }

  const skipAutoOpenPath = React.useRef(null)

  useEffect(() => {
    if (skipAutoOpenPath.current === location.pathname) {
      skipAutoOpenPath.current = null
      return
    }
    if (location.pathname === "/cart") {
      openDrawer("cart")
    } else if (location.pathname === "/wishlist") {
      openDrawer("wishlist")
    } else if (open) {
      closeDrawer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <SheetContent
        side="right"
        className="max-w-sm w-full bg-background border-l border-border"
      >
        <SheetHeader className="flex flex-col gap-3 px-4 pt-6">
          <div>
            <SheetTitle className="text-lg font-semibold">My {drawerTitle}</SheetTitle>
            <SheetDescription>{drawerSubtitle}</SheetDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openDrawer("cart")}
              className={`flex-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                view === "cart"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              Cart ({cartItems.length})
            </button>
            <button
              type="button"
              onClick={() => openDrawer("wishlist")}
              className={`flex-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                view === "wishlist"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              Wishlist ({wishlist.length})
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 px-4">
          {drawerItems.length === 0 ? (
            <div className="mt-6 text-sm text-muted-foreground">
              {view === "cart"
                ? "Your cart is currently empty."
                : "No looks saved yet."}
            </div>
          ) : (
            <ul className="mt-4 space-y-3 pb-4">
              {drawerItems.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {item.thumb || item.image ? (
                      <img
                        src={item.thumb || item.image}
                        alt={item.name}
                        className="h-10 w-10 rounded-full object-cover border border-border/70"
                      />
                    ) : (
                      <span
                        className="h-10 w-10 rounded-full border border-border/70"
                        style={{ backgroundColor: item.color || "#111" }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                        {view}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.key)}
                    className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-500"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="space-y-2 px-4 pb-6 pt-2">
          {drawerItems.length > 0 && (
            <Button
              className="w-full"
              onClick={view === "cart" ? goToCart : goToWishlist}
            >
              {view === "cart" ? "View Cart" : "Review Wishlist"}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={view === "cart" ? goToCheckout : goToWishlist}
          >
            {view === "cart" ? "Checkout" : "Shop Saved Looks"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
