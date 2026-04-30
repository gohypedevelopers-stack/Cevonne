import React, { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Menu, Search, Heart, User, Phone, ShoppingCart } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { useShop } from "@/context/ShopContext"
import { useLanguage } from "@/context/LanguageContext"
import logo from "@/assets/logos/cevonne_main_logo.png"

const NAV_H_MOBILE = "h-16"     // 64px
const NAV_H_DESKTOP = "md:h-20" // 80px

const Navbar = () => {
  const [solid, setSolid] = useState(false)
  const ticking = useRef(false)
  const THRESHOLD = 24
  const location = useLocation()
  const isProductPage = location.pathname.startsWith("/product")

  const { cartItems, wishlist, openDrawer } = useShop()
  const { t } = useLanguage()

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        setSolid(isProductPage || window.scrollY > THRESHOLD)
        ticking.current = false
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isProductPage])

  const textClass = "text-[var(--foreground)]"

  return (
    <>
      <header
        className={`hidden md:block fixed inset-x-0 top-0 z-50 w-full transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300
        ${solid
            ? "bg-[var(--background)]/95 border-transparent backdrop-blur supports-[backdrop-filter]:bg-[var(--background)] shadow-none"
            : "bg-transparent border-transparent shadow-none"
          }`}
        style={{
          backgroundColor: solid ? "rgba(255,255,255,0.95)" : "transparent",
          boxShadow: "none",
          borderBottom: "none",
        }}
      >
        <div
          className={`mx-auto flex max-w-screen-2xl items-center justify-between px-3 md:px-6 ${NAV_H_MOBILE} ${NAV_H_DESKTOP}`}
        >
          {/* Left: Menu + Search */}
          <div className="flex items-center gap-4 md:gap-6">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className={`group flex items-center gap-2 text-sm hover:opacity-80 transition-colors duration-300 ${textClass}`}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                  <span className="hidden sm:inline">{t("nav.menu")}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-[var(--background)]">
                <div className="flex h-full flex-col">
                  <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="mb-6 text-3xl font-serif font-bold tracking-wide text-[var(--foreground)]">{t("nav.menu")}</h3>
                    <nav className="space-y-6 text-base text-[var(--foreground)]">
                      <Link className="block hover:underline hover:text-[var(--primary)]" to="/search">{t("nav.shopAll")}</Link>
                      <Link className="block hover:underline hover:text-[var(--primary)]" to="/search">{t("nav.lips")}</Link>
                      <Link className="block hover:underline hover:text-[var(--primary)]" to="/search">{t("nav.face")}</Link>
                      <Link className="block hover:underline hover:text-[var(--primary)]" to="/search">{t("nav.eyes")}</Link>
                      <Link className="block hover:underline hover:text-[var(--primary)]" to="/ar/lipstick">{t("nav.virtualTryOn")}</Link>
                      <a className="block hover:underline hover:text-[var(--primary)]" href="#">{t("nav.aboutUs")}</a>
                    </nav>
                  </div>
                  <div
                    className="md:hidden border-t border-[var(--border)] px-4 pt-3 pb-4"
                    style={{
                      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
                    }}
                  >
                    <a
                      href="#"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--secondary-100)] text-[var(--foreground)]"
                      aria-label="Call Us"
                    >
                      <Phone className="h-4 w-4" />
                      {t("nav.callUs")}
                    </a>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link
              to="/search"
              className={`group flex items-center gap-2 text-sm hover:opacity-80 transition-colors duration-300 ${textClass}`}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
              <span className="hidden sm:inline">{t("nav.search")}</span>
            </Link>
          </div>

          {/* Center brand */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <Link to="/">
              <img
                src={logo}
                alt="Brand"
                className="h-8 w-auto lg:h-12 transition-[filter] duration-300"
              />
            </Link>
          </div>

          {/* Right: Call + icons */}
          <div className="flex items-center gap-4 md:gap-6">
            <a
              href="#"
              className={`hidden md:inline text-sm hover:opacity-80 transition-colors duration-300 ${textClass}`}
              aria-label="Call Us"
            >
              {t("nav.callUs")}
            </a>

            <Separator
              orientation="vertical"
              className={`hidden md:block h-4 bg-[var(--border)] transition-opacity duration-300 ${solid ? "opacity-100" : "opacity-0"
                }`}
            />

            <button
              type="button"
              onClick={() => openDrawer("wishlist")}
              className={`relative inline-flex items-center justify-center hover:opacity-80 transition-colors duration-300 ${textClass}`}
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold uppercase leading-none text-white">
                  {wishlist.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => openDrawer("cart")}
              className={`relative inline-flex items-center justify-center hover:opacity-80 transition-colors duration-300 ${textClass}`}
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItems.length > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-semibold uppercase leading-none text-white">
                  {cartItems.length}
                </span>
              )}
            </button>
            <Link
              to="/profile"
              className={`inline-flex items-center justify-center hover:opacity-80 transition-colors duration-300 ${textClass}`}
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

    </>
  )
}

export default Navbar
