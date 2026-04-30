import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package } from "lucide-react";

const formatCurrency = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#6366f1",
    "#f97316",
    "#84cc16",
];

export function ProductPerformanceChart({ products }) {
    const chartData = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];

        // Calculate revenue for each product (basePrice * quantity)
        const productsWithRevenue = products
            .filter((p) => p.name && (p.basePrice || p.quantity))
            .map((product) => ({
                name: product.name,
                revenue: (parseFloat(product.basePrice) || 0) * (parseInt(product.quantity) || 1),
                quantity: parseInt(product.quantity) || 0,
                collection: product.collection?.name || "Uncategorized",
                basePrice: parseFloat(product.basePrice) || 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return productsWithRevenue;
    }, [products]);

    const stats = useMemo(() => {
        const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
        const totalQuantity = chartData.reduce((sum, item) => sum + item.quantity, 0);

        return { totalRevenue, totalQuantity, topProduct: chartData[0] };
    }, [chartData]);

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.[0]) return null;

        const data = payload[0].payload;
        return (
            <div className="rounded-xl border border-border/60 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
                <p className="text-sm font-semibold text-primary">{data.name}</p>
                <p className="text-xs text-muted-foreground">Collection: {data.collection}</p>
                <p className="text-xs font-semibold text-foreground">Revenue: {formatCurrency(data.revenue)}</p>
                <p className="text-xs text-muted-foreground">Quantity: {data.quantity} units</p>
                <p className="text-xs text-muted-foreground">Price: {formatCurrency(data.basePrice)}</p>
            </div>
        );
    };

    return (
        <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-lg">
            <CardHeader className="border-b border-border/40 bg-gradient-to-r from-secondary/5 to-primary/5 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold text-primary">
                            Top Performing Products
                        </CardTitle>
                        <CardDescription>Products ranked by total revenue</CardDescription>
                    </div>
                    <Badge className="flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-primary">
                        <Package className="h-3.5 w-3.5" />
                        {chartData.length} Products
                    </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Product</p>
                        <p className="mt-1 truncate text-sm font-bold text-primary">
                            {stats.topProduct?.name || "N/A"}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Revenue</p>
                        <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(stats.totalRevenue)}</p>
                    </div>
                    <div className="col-span-2 rounded-2xl bg-white/80 px-4 py-3 md:col-span-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Units Sold</p>
                        <div className="mt-1 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <p className="text-lg font-bold text-primary">{stats.totalQuantity}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis
                                dataKey="name"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="revenue" radius={[8, 8, 0, 0]} animationDuration={1000}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                        <div className="text-center">
                            <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
                            <p className="mt-2">No product data available</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
