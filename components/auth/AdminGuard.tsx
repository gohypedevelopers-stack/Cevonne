"use client";

import { Link, Navigate, useLocation } from "@/lib/router";
import { useAuth } from "@/context/AuthContext";

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You need an admin account to manage the dashboard. Continue browsing the storefront or log in with admin
          credentials.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to site
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Admin login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminGuard({ children }) {
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
    const redirect = encodeURIComponent(location.pathname || "/dashboard");
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return children;
}
