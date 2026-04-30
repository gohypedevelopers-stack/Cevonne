import React from "react"
import { Link, useLocation } from "react-router-dom"
import { Home, Search, ShoppingBag, User, Menu } from "lucide-react"
import { useShop } from "@/context/ShopContext"

const MobileBottomNav = () => {
    const { cartItems } = useShop()
    const location = useLocation()

    const isActive = (path) => location.pathname === path

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Search", path: "/search" },
        { label: "NEW", path: "/search", isText: true }, // Using /search for NEW for now
        { icon: ShoppingBag, label: "Cart", path: "/cart", showBadge: true },
        { icon: User, label: "Profile", path: "/profile" },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t border-neutral-200 bg-white px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden">
            {navItems.map((item, index) => {
                const isActiveItem = isActive(item.path)

                if (item.isText) {
                    return (
                        <Link
                            key={index}
                            to={item.path}
                            className={`flex flex-col items-center justify-center gap-1 ${isActiveItem ? "text-black font-bold" : "text-neutral-500"
                                }`}
                        >
                            <span className="text-sm font-medium tracking-wide">NEW</span>
                        </Link>
                    )
                }

                const Icon = item.icon

                return (
                    <Link
                        key={index}
                        to={item.path}
                        className={`relative flex flex-col items-center justify-center gap-1 p-2 transition-colors ${isActiveItem ? "text-black" : "text-neutral-500 hover:text-neutral-800"
                            }`}
                    >
                        <Icon className={`h-6 w-6 ${isActiveItem ? "fill-current" : ""}`} strokeWidth={1.5} />
                        {item.showBadge && cartItems.length > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white">
                                {cartItems.length}
                            </span>
                        )}
                    </Link>
                )
            })}
        </div>
    )
}

export default MobileBottomNav
