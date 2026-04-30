import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Package, MapPin, Heart, Settings, LogOut, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProfileUser } from "@/hooks/useProfileUser";
import { useLanguage } from "@/context/LanguageContext";

export default function ProfileLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;
    const { isAuthenticated, isLoading, logout } = useAuth();
    const { profile, loading: profileLoading } = useProfileUser();
    const { t } = useLanguage();

    // Menu items with translation keys
    const MENU_ITEMS = [
        { icon: LayoutDashboard, labelKey: "sidebar.overview", path: "/profile" },
        { icon: Package, labelKey: "sidebar.orders", path: "/profile/orders" },
        { icon: MapPin, labelKey: "sidebar.addresses", path: "/profile/addresses" },
        { icon: Heart, labelKey: "sidebar.wishlist", path: "/profile/wishlist" },
        { icon: Settings, labelKey: "sidebar.settings", path: "/profile/settings" },
    ];

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated) {
            navigate("/login", { replace: true, state: { redirect: location.pathname } });
        }
    }, [isAuthenticated, isLoading, navigate, location.pathname]);

    const initials = profile?.name
        ? profile.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "U";
    const displayName = profile?.name || "Guest";
    const displayEmail = profile?.email || t("profile.notSignedIn");

    if (isLoading || profileLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
                    <p>{t("common.loadingProfile")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--card)] to-[var(--muted)] pt-20 md:pt-24 pb-12">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Sidebar */}
                    <aside className="w-full lg:w-72 shrink-0 space-y-6">
                        {/* Navigation */}
                        <nav className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-2 shadow-sm space-y-1">
                            {MENU_ITEMS.map((item) => {
                                const isActive = currentPath === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                            ? "bg-gradient-to-r from-[var(--sidebar-primary)] to-[var(--primary-700)] text-white shadow-md"
                                            : "text-[var(--muted-foreground)] hover:bg-[var(--secondary-100)] hover:text-[var(--primary)]"
                                            }`}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {t(item.labelKey)}
                                    </Link>
                                );
                            })}

                            {/* Logout Button */}
                            <div className="pt-2 mt-2 border-t border-[var(--border)]">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-all duration-200"
                                >
                                    <LogOut className="h-5 w-5" />
                                    {t("sidebar.logOut")}
                                </button>
                            </div>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-h-[500px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8 shadow-sm">
                        <Outlet />
                    </main>

                </div>
            </div>
        </div>
    );
}
