import React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useShop } from "@/context/ShopContext"

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useShop()

  return (
    <div className="w-full bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Saved Looks</h1>
            <p className="text-sm text-neutral-500">
              {wishlist.length
                ? `You have ${wishlist.length} saved look${wishlist.length === 1 ? "" : "s"}.`
                : "No looks saved yet. Tap SAVE on a shade to keep it here."}
            </p>
          </div>
          <Badge variant="outline" className="uppercase tracking-[0.3em] border-neutral-200 text-neutral-600">
            {wishlist.length} saved
          </Badge>
        </div>

        {wishlist.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center text-neutral-500">
            Your wishlist is empty.{" "}
            <Link to="/" className="font-semibold text-neutral-900 underline">
              Start browsing shades
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-4">
            {wishlist.map((item) => (
              <li
                key={item.key}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-12 w-12 rounded-full border border-neutral-200 shadow-inner"
                      style={{
                        backgroundColor: item.color || "#000",
                      }}
                    />
                    <div>
                      <p className="text-lg font-semibold text-neutral-900">{item.name}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                        Wishlist
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => removeFromWishlist(item.key)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link to="/">
            <Button>Keep Exploring</Button>
          </Link>
          <Button variant="outline">View Cart</Button>
        </div>
      </div>
    </div>
  )
}
