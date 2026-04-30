import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function SalesChart({ data, title = "Revenue Overview" }) {
  const [period, setPeriod] = useState("12m");

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    const filtered = period === "12m" ? data : data.slice(-parseInt(period));
    
    return filtered.map((item) => ({
      ...item,
      displayRevenue: item.revenue || 0,
    }));
  }, [data, period]);

  const stats = useMemo(() => {
    if (!chartData.length) return { total: 0, avg: 0, trend: 0 };
    
    const total = chartData.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const avg = total / chartData.length;
    
    const halfLength = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, halfLength);
    const secondHalf = chartData.slice(halfLength);
    
    const firstAvg = firstHalf.reduce((sum, item) => sum + (item.revenue || 0), 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((sum, item) => sum + (item.revenue || 0), 0) / (secondHalf.length || 1);
    
    const trend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    
    return { total, avg, trend };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-border/60 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-sm font-semibold text-primary">{data.month}</p>
        <p className="text-xs text-muted-foreground">Revenue: {formatCurrency(data.revenue || 0)}</p>
        <p className="text-xs text-muted-foreground">Products: {data.products || 0}</p>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">{title}</CardTitle>
            <CardDescription>Track revenue trends and growth patterns</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1 rounded-full border border-border/60 bg-white p-1">
              {["3", "6", "12m"].map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={period === p ? "default" : "ghost"}
                  className={`h-7 rounded-full px-3 text-xs ${
                    period === p ? "bg-primary text-primary-foreground shadow-sm" : ""
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "12m" ? "12M" : `${p}M`}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Revenue</p>
            <p className="mt-1 text-xl font-bold text-primary">{formatCurrency(stats.total)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Average</p>
            <p className="mt-1 text-xl font-bold text-primary">{formatCurrency(stats.avg)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend</p>
            <div className="mt-1 flex items-center gap-2">
              {stats.trend >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <p className={`text-xl font-bold ${stats.trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {Math.abs(stats.trend).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="displayRevenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
