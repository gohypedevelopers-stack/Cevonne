import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Package,
  Palette,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import { formatCurrency, toNumber } from "../utils";

export function StatsGrid({ stats, products, monthlySalesData, loading }) {
  const catalogValue =
    products?.reduce((acc, product) => acc + toNumber(product.basePrice ?? 0), 0) || 0;
  const averagePrice = products?.length ? catalogValue / products.length : 0;

  const currentMonthIndex = new Date().getMonth();
  const currentMonth =
    monthlySalesData?.[currentMonthIndex] ?? { products: 0, revenue: 0 };
  const previousMonth =
    monthlySalesData?.[(currentMonthIndex + 11) % 12] ?? { products: 0, revenue: 0 };

  const productDelta = currentMonth.products - previousMonth.products;

  const formattedCatalogValue = formatCurrency(catalogValue);
  const formattedAveragePrice = formatCurrency(averagePrice);
  const monthlyRevenueLabel =
    currentMonth.revenue > 0
      ? `+${formatCurrency(currentMonth.revenue)} this month`
      : "No new revenue this month";
  const productDeltaLabel =
    productDelta === 0
      ? "No change vs last month"
      : `${productDelta > 0 ? "+" : ""}${productDelta} vs last month`;

  const averageInventory =
    stats.productCount > 0
      ? Math.round(stats.totalInventory / Math.max(stats.productCount, 1))
      : 0;
  const averageInventoryLabel =
    stats.productCount > 0
      ? `~ ${averageInventory} units per product`
      : "Awaiting stock data";
  const averageRating =
    typeof stats.averageRating === "number" && !Number.isNaN(stats.averageRating)
      ? stats.averageRating
      : 0;
  const pendingReviewCount =
    typeof stats.pendingReviewCount === "number" ? stats.pendingReviewCount : 0;
  const reviewAverageLabel =
    averageRating > 0
      ? `${averageRating.toFixed(1)}/5 average rating`
      : "Awaiting first review";
  const pendingReviewLabel =
    pendingReviewCount > 0
      ? `${pendingReviewCount} pending moderation`
      : "All reviews published";

  const toneClasses = {
    primary: "text-primary-foreground shadow-xl",
    secondary: "text-primary shadow-lg",
    neutral: "bg-white text-foreground border border-[var(--border)] shadow-sm",
    accent: "text-primary border border-[var(--secondary-200)] shadow-sm",
  };

  const toneStyles = {
    primary: {
      background: "linear-gradient(135deg, var(--primary-300) 0%, var(--primary) 100%)",
    },
    secondary: {
      background: "linear-gradient(135deg, var(--secondary-100) 0%, var(--secondary) 100%)",
    },
    neutral: {
      background: "linear-gradient(135deg, #ffffff 0%, var(--accent) 100%)",
    },
    accent: {
      background: "linear-gradient(135deg, var(--secondary-100) 0%, var(--primary-100) 100%)",
    },
  };

  const iconToneClasses = {
    primary: "bg-white/20 text-primary-foreground",
    secondary: "bg-white/40 text-primary",
    neutral: "bg-primary/10 text-primary",
    accent: "bg-secondary/30 text-primary",
  };

  const detailToneClasses = (tone, emphasis = "muted") => {
    if (emphasis === "positive") {
      if (tone === "primary") return "text-white/85";
      if (tone === "secondary") return "text-primary/70";
      return "text-primary";
    }
    if (emphasis === "negative") {
      if (tone === "primary") return "text-white/75";
      if (tone === "secondary") return "text-destructive/80";
      return "text-destructive";
    }
    if (tone === "primary") return "text-white/75";
    if (tone === "secondary") return "text-primary/70";
    if (tone === "accent") return "text-primary/80";
    return "text-muted-foreground";
  };

  const cards = [
    {
      id: "catalog-value",
      label: "Catalog value",
      value: formattedCatalogValue,
      details: [
        { text: `${stats.productCount} active products` },
        {
          text: monthlyRevenueLabel,
          tone: currentMonth.revenue > 0 ? "positive" : "muted",
          icon: currentMonth.revenue > 0 ? TrendingUp : undefined,
        },
      ],
      icon: CircleDollarSign,
      tone: "primary",
      colSpan: "lg:col-span-2 xl:col-span-2",
    },
    {
      id: "new-launches",
      label: "New launches",
      value: `${currentMonth.products}`,
      details: [
        {
          text: productDeltaLabel,
          tone: productDelta > 0 ? "positive" : productDelta < 0 ? "negative" : "muted",
          icon:
            productDelta > 0 ? TrendingUp : productDelta < 0 ? TrendingDown : undefined,
        },
        { text: `${stats.shadeCount} total shades` },
      ],
      icon: Package,
      tone: "secondary",
    },
    {
      id: "customers",
      label: "Customers",
      value: `${stats.userCount}`,
      details: [
        { text: `${stats.collectionCount} collections live` },
        { text: `Avg price ${formattedAveragePrice}` },
      ],
      icon: Users,
      tone: "neutral",
    },
    {
      id: "inventory",
      label: "Inventory status",
      value: `${stats.totalInventory}`,
      details: [
        {
          text:
            stats.lowStockCount > 0
              ? `${stats.lowStockCount} low stock alerts`
              : "All stock healthy",
          tone: stats.lowStockCount > 0 ? "negative" : "positive",
          icon: stats.lowStockCount > 0 ? AlertTriangle : TrendingUp,
        },
        { text: averageInventoryLabel },
      ],
      icon: Palette,
      tone: "accent",
    },
    {
      id: "reviews",
      label: "Reviews",
      value: `${stats.reviewCount ?? 0}`,
      details: [
        {
          text: reviewAverageLabel,
          tone: averageRating > 0 ? "positive" : "muted",
          icon: Star,
        },
        {
          text: pendingReviewLabel,
          tone: pendingReviewCount > 0 ? "negative" : "positive",
          icon: pendingReviewCount > 0 ? Clock : CheckCircle2,
        },
      ],
      icon: Star,
      tone: "accent",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const styles = toneStyles[card.tone];
        return (
          <div
            key={card.id}
            style={styles}
            className={`relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${toneClasses[card.tone]} ${card.colSpan ?? ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-75">
                  {card.label}
                </p>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-9 w-28 rounded-full bg-white/30" />
                    <Skeleton className="h-3 w-32 rounded-full bg-white/20" />
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-semibold tracking-tight">
                      {card.value}
                    </div>
                    <div className="space-y-1 text-xs font-medium leading-snug">
                      {card.details?.map((detail, index) => {
                        const DetailIcon = detail.icon;
                        return (
                          <div
                            key={`${card.id}-detail-${index}`}
                            className={`flex items-center gap-1.5 ${detailToneClasses(
                              card.tone,
                              detail.tone
                            )}`}
                          >
                            {DetailIcon ? (
                              <DetailIcon className="h-3.5 w-3.5" />
                            ) : null}
                            <span>{detail.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div
                className={`rounded-full p-2.5 ${iconToneClasses[card.tone]} ${
                  loading ? "opacity-60" : ""
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyGoalCard({ stats, loading }) {
  const target = Math.max(20, stats.productCount * 2);
  const progress =
    target === 0 ? 0 : Math.min(100, Math.round((stats.productCount / target) * 100));
  const remaining = Math.max(target - stats.productCount, 0);

  return (
    <Card className="rounded-3xl border border-[var(--secondary-200)] bg-[linear-gradient(145deg,var(--secondary-100),var(--primary-100))] text-primary shadow-lg">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-semibold text-primary">Launch goal</CardTitle>
        <CardDescription className="text-primary/70">
          Keep momentum by planning steady product drops each month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-2">
        {loading ? (
          <Skeleton className="h-28 w-full bg-white/50" />
        ) : (
          <>
            <div>
              <div className="text-5xl font-semibold leading-none text-primary">{progress}%</div>
              <p className="text-sm font-medium text-primary/70">
                {remaining === 0
                  ? "Target met - great work!"
                  : `${remaining} more launches to hit your goal.`}
              </p>
            </div>
            <Progress value={progress} className="h-2 bg-white/50" />
            <dl className="grid grid-cols-2 gap-3 text-xs font-medium text-primary/70">
              <div className="rounded-2xl bg-white/70 p-3">
                <dt className="uppercase tracking-wide text-[11px] text-primary/60">
                  Target
                </dt>
                <dd className="text-lg font-semibold text-primary">{target}</dd>
                <span className="text-[11px] uppercase tracking-wide text-primary/60">
                  products
                </span>
              </div>
              <div className="rounded-2xl bg-white/70 p-3">
                <dt className="uppercase tracking-wide text-[11px] text-primary/60">
                  Currently live
                </dt>
                <dd className="text-lg font-semibold text-primary">{stats.productCount}</dd>
                <span className="text-[11px] uppercase tracking-wide text-primary/60">
                  products
                </span>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
