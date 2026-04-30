import React from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './components/pages/Home'
import Footer from './components/Footer'
import ProductDetails from './components/pages/ProductDetails'
import CartPage from './components/pages/CartPage'
import CheckoutPage from './components/pages/CheckoutPage'
import WishlistPage from './components/pages/WishlistPage'
import PolicyPage from '@/components/pages/PolicyPage'
import Terms from '@/components/pages/Terms'
import Contact from '@/components/pages/Contact'
import ShopDrawer from './components/ShopDrawer'
import ScrollToTop from './components/ScrollToTop'
import SearchPage from './components/pages/SearchPage'
import LipstickAR from "./AR/LipstickAR";
import Signup from "@/components/forms/Signup"
import Login from "@/components/forms/Login"
import Dashboard from "@/components/admin-dashboard/Dashboard"
import ProductOverview from "@/components/admin-dashboard/ProductOverview"
import ProductCreate from "@/components/admin-dashboard/ProductCreate"
import ProductEdit from "@/components/admin-dashboard/ProductEdit"
import ShadesPage from "@/components/admin-dashboard/Shades"
import OrdersPage from "@/components/admin-dashboard/OrdersPage"
import ProfileLayout from "@/components/profile/ProfileLayout"
import ProfileOverview from "@/components/profile/ProfileOverview"
import Orders from "@/components/profile/Orders"
import Addresses from "@/components/profile/Addresses"
import Settings from "@/components/profile/Settings"
import MobileBottomNav from "@/components/MobileBottomNav"
import MobileTopBar from "@/components/MobileTopBar"
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";

const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
    <div className="max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        You need an admin account to manage the dashboard. Continue browsing the storefront or log in with admin
        credentials.
      </p>
      <div className="flex justify-center gap-2">
        <a
          href="/"
          className="rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Back to site
        </a>
        <a
          href="/login"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Admin login
        </a>
      </div>
    </div>
  </div>
);

const AdminRoute = ({ element }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ redirect: location.pathname }} />;
  }
  if (!isAdmin) {
    return <AccessDenied />;
  }
  return element;
};


const App = () => {
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isARRoute = location.pathname.startsWith('/ar')
  const hideLayout = isDashboardRoute || isARRoute
  const hideFooterOn = ["/cart", "/checkout"]
  const shouldHideFooter = hideLayout || hideFooterOn.includes(location.pathname)

  // Ensure AR routes keep their rounded UI (opt out of global sharp edges)
  React.useEffect(() => {
    const body = document.body
    if (isARRoute) {
      body.classList.add("ar-radius")
    } else {
      body.classList.remove("ar-radius")
    }
  }, [isARRoute])

  return (
    <main className="min-h-screen bg-background text-foreground">
      {!hideLayout && <Navbar />}
      {!hideLayout && <MobileTopBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route
          path="/ar/lipstick"
          element={<LipstickAR />}
        />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/privacy-policy" element={<PolicyPage />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/login' element={<Login />} />
        <Route path='/dashboard' element={<AdminRoute element={<Dashboard />} />} />
        <Route path='/dashboard/products' element={<AdminRoute element={<ProductOverview />} />} />
        <Route path='/dashboard/products/new' element={<AdminRoute element={<ProductCreate />} />} />
        <Route path='/dashboard/products/:id/edit' element={<AdminRoute element={<ProductEdit />} />} />
        <Route path='/dashboard/shades' element={<AdminRoute element={<ShadesPage />} />} />
        <Route path='/dashboard/orders' element={<AdminRoute element={<OrdersPage />} />} />

        {/* Profile Routes */}
        <Route path="/profile" element={<ProfileLayout />}>
          <Route index element={<ProfileOverview />} />
          <Route path="orders" element={<Orders />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="settings" element={<Settings />} />
          <Route path="wishlist" element={<WishlistPage />} />
        </Route>
      </Routes>
      <ScrollToTop />
      <ShopDrawer />
      <Toaster position="top-center" richColors closeButton />
      {!shouldHideFooter && <Footer />}
      {!hideLayout && <MobileBottomNav />}
    </main>
  )
}

export default App
