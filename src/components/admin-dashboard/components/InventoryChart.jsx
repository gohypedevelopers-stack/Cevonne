import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const COLORS = {
    healthy: "#10b981",
    low: "#f59e0b",
    critical: "#ef4444",
    outOfStock: "#6b7280",
};

export function InventoryChart({ inventory, lowStockItems }) {
    const chartData = useMemo(() => {
        if (!inventory || !Array.isArray(inventory)) return [];

        const stats = inventory.reduce(
            (acc, item) => {
                const qty = parseInt(item.quantity) || 0;
                const threshold = parseInt(item.lowStockThreshold) || 10;

                if (qty === 0) {
                    acc.outOfStock++;
                } else if (qty <= threshold) {
                    acc.critical++;
                } else if (qty <= threshold * 2) {
                    acc.low++;
                } else {
                    acc.healthy++;
                }

                return acc;
            },
            { healthy: 0, low: 0, critical: 0, outOfStock: 0 }
        );

        return [
            { name: "Healthy Stock", value: stats.healthy, color: COLORS.healthy },
            { name: "Low Stock", value: stats.low, color: COLORS.low },
            { name: "Critical", value: stats.critical, color: COLORS.critical },
            { name: "Out of Stock", value: stats.outOfStock, color: COLORS.outOfStock },
        ].filter((item) => item.value > 0);
    }, [inventory]);

    const totalItems = chartData.reduce((sum, item) => sum + item.value, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.[0]) return null;

        const data = payload[0];
        const percentage = totalItems > 0 ? ((data.value / totalItems) * 100).toFixed(1) : 0;

        return (
            <div className="rounded-xl border border-border/60 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
                <p className="text-sm font-semibold text-primary">{data.name}</p>
                <p className="text-xs text-muted-foreground">Items: {data.value}</p>
                <p className="text-xs text-muted-foreground">Percentage: {percentage}%</p>
            </div>
        );
    };

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? "start" : "end"}
                dominantBaseline="central"
                className="text-xs font-semibold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-lg">
            <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="text-lg font-semibold text-primary">Inventory Health</CardTitle>
                <CardDescription>Stock level distribution across all products</CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="flex items-center justify-center">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={renderCustomLabel}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        animationDuration={1000}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                                No inventory data available
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {chartData.map((item, index) => {
                            const percentage = totalItems > 0 ? ((item.value / totalItems) * 100).toFixed(1) : 0;
                            const Icon =
                                item.name === "Healthy Stock"
                                    ? CheckCircle
                                    : item.name === "Out of Stock"
                                        ? XCircle
                                        : AlertTriangle;

                            return (
                                <div
                                    key={index}
                                    className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 px-4 py-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-4 w-4 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-primary">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.value} items</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className="flex items-center gap-1 rounded-full"
                                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                                    >
                                        <Icon className="h-3 w-3" />
                                        {percentage}%
                                    </Badge>
                                </div>
                            );
                        })}

                        {lowStockItems && lowStockItems.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <p className="text-sm font-semibold text-orange-900">
                                        {lowStockItems.length} items need restocking
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
