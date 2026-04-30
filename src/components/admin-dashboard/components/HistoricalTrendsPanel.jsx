import { useMemo } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function HistoricalTrendsPanel({ historicalData, range, onRangeChange }) {
  const chartData = useMemo(() => historicalData[range] ?? [], [historicalData, range]);

  return (
    <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-primary">Historical trends</CardTitle>
          <CardDescription>Compare multi-year lipstick performance and satisfaction.</CardDescription>
        </div>
        <Select value={range} onValueChange={onRangeChange}>
          <SelectTrigger className="w-32 rounded-full">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="24m">Last 24 months</SelectItem>
            <SelectItem value="36m">Three years</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="10%" stopColor="var(--primary-400)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--primary-400)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--primary-100)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--primary-200)" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--primary-500)"
              fill="url(#historicalGradient)"
              strokeWidth={3}
              name="Revenue (INR)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
