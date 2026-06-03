import { useState } from "react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { MonthlyGoalCard } from "./StatsOverview";

export function PerformanceSection({
  monthlySalesData,
  yearlySalesData,
  inventoryTrendData,
  stats,
  loading,
}) {
  const [performanceRange, setPerformanceRange] = useState("month");

  return (
    <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <div className="grid gap-6">
        <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
          <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-primary">
                Performance overview
              </CardTitle>
              <CardDescription>
                Track new product launches and catalog value trends.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted p-1">
              <Button
                size="sm"
                variant={performanceRange === "month" ? "default" : "ghost"}
                className="rounded-full px-4 text-sm"
                onClick={() => setPerformanceRange("month")}
              >
                Month
              </Button>
              <Button
                size="sm"
                variant={performanceRange === "year" ? "default" : "ghost"}
                className="rounded-full px-4 text-sm"
                onClick={() => setPerformanceRange("year")}
              >
                Year
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pb-0">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : performanceRange === "year" ? (
              yearlySalesData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearlySalesData}>
                    <defs>
                      <linearGradient id="revenueYearGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary-300)" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="var(--primary-300)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--primary-100)" />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} stroke="var(--primary-200)" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--primary-400)"
                      fill="url(#revenueYearGradient)"
                      strokeWidth={3}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <p>No yearly trend yet.</p>
                  <p>Add products with creation dates across different years to unlock this view.</p>
                </div>
              )
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--primary-100)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--primary-200)" />
                  <Tooltip />
                  <Bar dataKey="products" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-primary">
                Inventory outlook
              </CardTitle>
              <CardDescription>Stock trend based on recent adjustments.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[220px] pb-0">
            {loading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryTrendData}>
                  <defs>
                    <linearGradient id="inventoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="10%" stopColor="var(--secondary-300)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--secondary-300)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--secondary-200)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} hide />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="quantity"
                    stroke="var(--secondary-400)"
                    fill="url(#inventoryGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <MonthlyGoalCard stats={stats} loading={loading} />
      </div>
    </section>
  );
}
