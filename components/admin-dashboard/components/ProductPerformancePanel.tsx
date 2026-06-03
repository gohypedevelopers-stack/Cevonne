import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductPerformancePanel({ monthlySalesData, shadeStats, loading }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-lg font-semibold text-primary">
            Sales velocity
          </CardTitle>
          <CardDescription>Monthly revenue trend for lipstick launches.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySalesData} margin={{ top: 10, left: -20 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="var(--primary-400)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary-400)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--primary-100)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--primary-200)" />
                <YAxis tickLine={false} axisLine={false} stroke="var(--primary-200)" />
                <Tooltip labelClassName="text-xs font-medium" />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary-500)"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  name="Revenue (INR)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Shade popularity</CardTitle>
          <CardDescription>Top-performing shades by on-hand stock.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shadeStats} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="var(--secondary-200)" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="quantity" fill="var(--chart-2)" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
