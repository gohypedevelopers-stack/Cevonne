import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Package, Heart, Layers, ShoppingCart, Sparkles } from "lucide-react";

export function ExecutiveSummary({ summary, onCreateProduct }) {
  const cards = [
    {
      label: "Monthly revenue",
      icon: ShoppingCart,
      value: summary.formattedMonthlyRevenue,
      detail: `${summary.monthlyGrowth >= 0 ? "+" : ""}${summary.monthlyGrowth.toFixed(1)}% vs last month`,
      trend: summary.monthlyGrowth,
      bgGradient: "from-green-50 to-emerald-50",
      iconColor: "text-green-600",
    },
    {
      label: "Orders processed",
      icon: Package,
      value: summary.monthlyOrders,
      detail: `${summary.weeklyOrders} this week / ${summary.dailyOrders} today`,
      bgGradient: "from-blue-50 to-sky-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Catalog ready",
      icon: Layers,
      value: summary.catalogProducts,
      detail: `${summary.catalogCollections} collections live`,
      bgGradient: "from-purple-50 to-violet-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Customer sentiment",
      icon: Heart,
      value: `${summary.sentimentScore}%`,
      detail: `${summary.sentimentPositive}% positive / ${summary.sentimentNegative}% negative`,
      bgGradient: "from-pink-50 to-rose-50",
      iconColor: "text-pink-600",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trend >= 0 ? TrendingUp : TrendingDown;

        return (
          <Card
            key={card.label}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-white shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-0 transition-opacity group-hover:opacity-100`} />

            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </CardDescription>
                <div className={`rounded-full bg-gradient-to-br ${card.bgGradient} p-2`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <CardTitle className="mt-4 text-3xl font-bold text-primary">
                {card.value}
              </CardTitle>
            </CardHeader>

            <CardContent className="relative">
              <div className="flex items-center gap-2">
                {card.trend !== undefined && (
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${card.trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                    <TrendIcon className="h-3 w-3" />
                    <span className="text-xs font-semibold">
                      {Math.abs(card.trend).toFixed(1)}%
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{card.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="group relative overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-white to-secondary/5 shadow-sm transition-all hover:scale-[1.02] hover:border-primary/50 hover:shadow-lg">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary/10 blur-2xl transition-all group-hover:bg-primary/20" />

        <CardHeader className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold text-primary">
              Quick Create
            </CardTitle>
          </div>
          <CardDescription className="mt-2">
            Launch a new lipstick product with full catalog metadata in seconds
          </CardDescription>
        </CardHeader>

        <CardContent className="relative">
          <Button
            onClick={onCreateProduct}
            className="w-full rounded-full bg-gradient-to-r from-primary to-secondary font-semibold shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            <Package className="mr-2 h-4 w-4" />
            Create Product
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
