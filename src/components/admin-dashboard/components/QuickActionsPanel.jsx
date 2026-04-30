import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus,
    Package,
    Layers,
    Palette,
    FileText,
    TrendingUp,
    Users,
    Download,
    RefreshCw,
} from "lucide-react";

export function QuickActionsPanel({ onCreateProduct, onRefresh, stats }) {
    const quickActions = [
        {
            icon: Plus,
            label: "New Product",
            description: "Add a new lipstick product",
            onClick: onCreateProduct,
            variant: "default",
        },
        {
            icon: Layers,
            label: "Collections",
            description: "Manage product collections",
            onClick: () => {
                document.getElementById("management")?.scrollIntoView({ behavior: "smooth" });
                // Trigger collections tab
                setTimeout(() => {
                    const collectionsTab = document.querySelector('[value="collections"]');
                    collectionsTab?.click();
                }, 300);
            },
            variant: "secondary",
        },
        {
            icon: Palette,
            label: "Shades",
            description: "Add or edit shades",
            onClick: () => {
                document.getElementById("management")?.scrollIntoView({ behavior: "smooth" });
                setTimeout(() => {
                    const shadesTab = document.querySelector('[value="shades"]');
                    shadesTab?.click();
                }, 300);
            },
            variant: "secondary",
        },
        {
            icon: Package,
            label: "Inventory",
            description: "Update stock levels",
            onClick: () => {
                document.getElementById("management")?.scrollIntoView({ behavior: "smooth" });
                setTimeout(() => {
                    const inventoryTab = document.querySelector('[value="inventory"]');
                    inventoryTab?.click();
                }, 300);
            },
            variant: "outline",
        },
        {
            icon: RefreshCw,
            label: "Refresh Data",
            description: "Sync latest information",
            onClick: onRefresh,
            variant: "outline",
        },
    ];

    const recentActivity = [
        {
            icon: Package,
            action: "Product created",
            detail: "New lipstick shade added to catalog",
            time: "2 hours ago",
            color: "text-green-600",
        },
        {
            icon: TrendingUp,
            action: "Sales milestone",
            detail: "Reached 1000 units sold this month",
            time: "5 hours ago",
            color: "text-blue-600",
        },
        {
            icon: Users,
            action: "Customer review",
            detail: "5-star review received",
            time: "1 day ago",
            color: "text-purple-600",
        },
    ];

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
                <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5">
                    <CardTitle className="text-lg font-semibold text-primary">Quick Actions</CardTitle>
                    <CardDescription>Frequently used shortcuts for faster workflow</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {quickActions.map((action, index) => {
                            const Icon = action.icon;
                            return (
                                <Button
                                    key={index}
                                    variant={action.variant}
                                    className="flex h-auto flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all hover:scale-105 hover:shadow-md"
                                    onClick={action.onClick}
                                >
                                    <div className="flex w-full items-center gap-2">
                                        <Icon className="h-5 w-5" />
                                        <span className="font-semibold">{action.label}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{action.description}</span>
                                </Button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
                <CardHeader className="border-b border-border/40 bg-gradient-to-r from-secondary/5 to-primary/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-semibold text-primary">Quick Stats</CardTitle>
                            <CardDescription>Key metrics at a glance</CardDescription>
                        </div>
                        <Button size="sm" variant="ghost" className="rounded-full" onClick={onRefresh}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
                            </div>
                            <p className="mt-1 text-2xl font-bold text-primary">{stats?.productCount || 0}</p>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-secondary/10 to-secondary/5 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-secondary" />
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Collections</p>
                            </div>
                            <p className="mt-1 text-2xl font-bold text-primary">{stats?.collectionCount || 0}</p>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-purple-100 to-purple-50 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-purple-600" />
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Shades</p>
                            </div>
                            <p className="mt-1 text-2xl font-bold text-primary">{stats?.shadeCount || 0}</p>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-orange-100 to-orange-50 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-orange-600" />
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Inventory</p>
                            </div>
                            <p className="mt-1 text-2xl font-bold text-primary">{stats?.totalInventory || 0}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
