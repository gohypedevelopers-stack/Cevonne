import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#7c3aed", "#c026d3", "#db2777", "#e879f9", "#fb7185"];

export function CustomerInsightsPanel({ customerBreakdown, sentiment, topProducts }) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Customer segments</CardTitle>
            <CardDescription>Top shopper domains and demographics.</CardDescription>
          </div>
          <Badge className="rounded-full bg-primary/10 text-primary">
            {customerBreakdown.length} segments
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="h-[260px] overflow-hidden">
            {customerBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerBreakdown}
                    dataKey="percentage"
                    nameKey="domain"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {customerBreakdown.map((entry, index) => (
                      <Cell key={entry.domain} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, props) => [`${value}%`, props.payload.domain]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No customer data yet.</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {customerBreakdown.map((item, idx) => (
              <div key={item.domain} className="flex items-center gap-3 rounded-2xl border border-border/60 px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <div className="flex-1">
                  <p className="font-semibold text-primary">{item.domain}</p>
                  <p className="text-xs text-muted-foreground">{item.count} shoppers ({item.percentage}%)</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Feedback pulse</CardTitle>
          <CardDescription>Blend of reviews, NPS and quick polls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net sentiment</p>
            <p className="text-3xl font-semibold text-primary">{sentiment.score}%</p>
            <p className="text-xs text-muted-foreground">{sentiment.delta >= 0 ? "+" : ""}{sentiment.delta}% vs last cycle</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Positive</p>
              <p className="text-2xl font-semibold text-emerald-800">{sentiment.positive}%</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-rose-700">Negative</p>
              <p className="text-2xl font-semibold text-rose-800">{sentiment.negative}%</p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Most loved shades</p>
            <div className="mt-2 grid gap-2">
              {topProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: product.swatch }} />
                    <span className="font-medium text-primary">{product.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{product.share}% share</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
