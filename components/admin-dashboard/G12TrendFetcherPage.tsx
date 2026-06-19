"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  G12_COMPLIANCE_NOTES,
  G12_TREND_FETCHER_BRANCHES,
  G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
  G12_TREND_FETCHER_PURPOSE,
  G12_TREND_FETCHER_QUERY_DEFAULT,
  G12_TREND_FETCHER_RESULT_CAP_DEFAULT,
  G12_TREND_FETCHER_TITLE,
  buildG12ManualPayload,
  formatG12Count,
  formatG12DateTime,
  formatG12RelativeTime,
  getG12RunStatusTone,
  getG12TrendFetcherBranchLabel,
  normalizeG12TrendFetcherRunStatus,
  type G12TrendFetcherBranchKey,
  type G12TrendFetcherPlatformSelection,
  type G12TrendFetcherRunStatus,
  type G12TrendPlatform,
} from "@/lib/g12-trend-fetcher";

type AdminFetchInit = RequestInit & { silent?: boolean };

type G12PlatformResult = {
  platform: string;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
};

type G12InsightRecord = {
  id: string;
  fetch_run_id: string | null;
  platform: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  title: string;
  summary: string;
  insight_title: string | null;
  trend_topic: string | null;
  hook_angle: string | null;
  clean_summary: string | null;
  content_recommendation: string | null;
  trend_strength: number | string | null;
  brand_fit_score: number | string | null;
  risk_score: number | string | null;
  approval_status: string | null;
  compliance_note: string | null;
  created_at: string | null;
  stored_at: string | null;
  source_label: string | null;
};

type G12MetricRecord = {
  id: string;
  fetch_run_id: string | null;
  platform: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  label: string;
  value: number | string | boolean | null;
  metric_name: string | null;
  metric_label: string | null;
  metric_value: number | string | boolean | null;
  metric_unit: string | null;
  status: string | null;
  created_at: string | null;
  stored_at: string | null;
  source_label: string | null;
};

type G12LatestRun = {
  fetch_run_id: string;
  status: string;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
  completed_at: string | null;
  created_at: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  query: string;
  platforms: G12TrendPlatform[];
  top_comments_limit: number;
  platform_results: G12PlatformResult[];
};

type G12LatestResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  message: string;
  source?: string | null;
  run: G12LatestRun | null;
  insights: G12InsightRecord[];
  metrics: G12MetricRecord[];
  rawCounts: Record<string, number>;
};

type G12RunPollResponse = {
  status: string;
  message: string;
  source?: string | null;
  run: G12LatestRun | null;
  insights: G12InsightRecord[];
  metrics: G12MetricRecord[];
  rawCounts?: Record<string, number>;
};

type G12ManualFetchResponse = {
  status: string;
  message?: string;
  fetch_run_id?: string | null;
  fetchRunId?: string | null;
};

type ManualRunState = {
  status: G12TrendFetcherRunStatus;
  fetch_run_id: string | null;
  message: string;
  requested_at: string;
  branch_key: G12TrendFetcherBranchKey;
  platforms: G12TrendPlatform[];
  query: string;
  fetch_limit: number;
  top_comments_limit: number;
};

const MANUAL_BRANCH_OPTIONS = [
  {
    value: G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
    label: "General Manual Fetch",
    helper: "Fallback route for one-off checks.",
  },
  ...G12_TREND_FETCHER_BRANCHES.map((branch) => ({
    value: branch.key,
    label: branch.name,
    helper: "requiresAccess" in branch && branch.requiresAccess ? "Needs access before use." : branch.frequency,
  })),
] as const;

const decimalFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 3,
});

const buildRequestUrl = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const formatMetricValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? formatG12Count(value) : decimalFormatter.format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
};

const getPlatformSelectionLabel = (value: G12TrendFetcherPlatformSelection) => {
  if (value === "both") {
    return "Instagram + TikTok";
  }

  return value === "instagram" ? "Instagram only" : "TikTok only";
};

const getRouteStatusTone = (status?: string | null) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "EMPTY":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ERROR":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all font-serif text-2xl leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function MetricTileSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="mt-3 h-9 w-32 rounded-2xl" />
      <Skeleton className="mt-3 h-3 w-40 rounded-full" />
    </div>
  );
}

function SectionCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">{title}</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</CardDescription>
        </div>
        {action ? <div className="flex shrink-0 items-start gap-2">{action}</div> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 break-words text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

function getInsightTitle(insight: G12InsightRecord) {
  return (
    insight.insight_title ||
    insight.trend_topic ||
    insight.hook_angle ||
    `${insight.platform || "Platform"} trend insight`
  );
}

function getInsightSummary(insight: G12InsightRecord) {
  return insight.clean_summary || insight.summary || insight.content_recommendation || "Clean trend insight stored after filtering.";
}

function getInsightBranchLabel(insight: G12InsightRecord) {
  return insight.branch_name || (insight.branch_key ? getG12TrendFetcherBranchLabel(insight.branch_key) : "General");
}

function getMetricTimestamp(metric: G12MetricRecord) {
  return metric.created_at || metric.stored_at;
}

function G12LatestSkeleton() {
  return (
    <SectionCard
      id="overview"
      title="Overview"
      description="A compact summary of the latest safe public trend fetch."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <MetricTileSkeleton key={`g12-summary-skeleton-${index}`} />
        ))}
      </div>
    </SectionCard>
  );
}

export default function G12TrendFetcherPage() {
  const { authFetch } = useAuth();

  const [dashboard, setDashboard] = useState<G12LatestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [platformSelection, setPlatformSelection] = useState<G12TrendFetcherPlatformSelection>("both");
  const [query, setQuery] = useState<string>(G12_TREND_FETCHER_QUERY_DEFAULT);
  const [fetchLimit, setFetchLimit] = useState(G12_TREND_FETCHER_RESULT_CAP_DEFAULT);
  const [topCommentsLimit, setTopCommentsLimit] = useState(0);
  const [branchKey, setBranchKey] = useState<G12TrendFetcherBranchKey>(G12_TREND_FETCHER_GENERAL_BRANCH_KEY);
  const [manualRun, setManualRun] = useState<ManualRunState | null>(null);
  const [awaitingFetchRunId, setAwaitingFetchRunId] = useState<string | null>(null);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<G12InsightRecord | null>(null);
  const hasLoadedRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);

  const request = useCallback(
    (url: string, options: AdminFetchInit = {}) => {
      const { silent, ...fetchOptions } = options;
      if (authFetch) {
        return authFetch(url, { ...fetchOptions, silent });
      }

      return fetch(url, fetchOptions);
    },
    [authFetch],
  );

  const loadLatest = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    hasLoadedRef.current = true;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setLoadError(null);

    try {
      const response = await request(buildRequestUrl("/api/admin/g12-trend-fetcher/latest"), {
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<G12LatestResponse>(response);
      if (body) {
        setDashboard(body);
        if (body.status === "ERROR") {
          setLoadError(body.message);
        }
        return body;
      }

      if (!response.ok) {
        setLoadError("Failed to load latest G12 run from Supabase.");
      } else {
        setLoadError("Latest G12 response was empty.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load latest G12 run from Supabase.";
      setLoadError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    return null;
  }, [request]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    if (!awaitingFetchRunId) {
      return;
    }

    let active = true;
    let timeoutId: number | null = null;

    const poll = async () => {
      if (!active) {
        return;
      }

      try {
        const response = await request(
          buildRequestUrl(`/api/admin/g12-trend-fetcher/runs/${encodeURIComponent(awaitingFetchRunId)}`),
          {
            cache: "no-store",
            silent: true,
          },
        );
        const body = await parseJsonResponse<G12RunPollResponse>(response);

        if (!active) {
          return;
        }

        const status = normalizeG12TrendFetcherRunStatus(body?.status ?? (response.ok ? "ACCEPTED" : "ERROR"));
        setManualRun((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            status,
            fetch_run_id: body?.run?.fetch_run_id ?? current.fetch_run_id,
            message: body?.message ?? current.message,
          };
        });

        if (status === "PASS" || status === "BLOCK" || status === "ERROR") {
          setAwaitingFetchRunId(null);
          await loadLatest();
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Polling failed.";
        setManualRun((current) =>
          current
            ? {
                ...current,
                status: "ERROR",
                message,
              }
            : current,
        );
        setAwaitingFetchRunId(null);
        toast.error(message);
        return;
      }

      if (!active) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void poll();
      }, 5000);
      pollTimeoutRef.current = timeoutId;
    };

    timeoutId = window.setTimeout(() => {
      void poll();
    }, 5000);
    pollTimeoutRef.current = timeoutId;

    return () => {
      active = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [awaitingFetchRunId, loadLatest, request]);

  const currentRun = dashboard?.run ?? null;
  const platformResults = currentRun?.platform_results ?? [];
  const rawCountEntries = Object.entries(dashboard?.rawCounts ?? {}).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });
  const totalRawCount = rawCountEntries.reduce((sum, [, count]) => sum + count, 0);

  const summaryTiles = currentRun
    ? [
        {
          label: "Status",
          value: currentRun.status,
          helper: "Workflow status returned by the latest run.",
        },
        {
          label: "Last fetch run ID",
          value: currentRun.fetch_run_id,
          helper: "The latest fetch_run_id loaded from Supabase.",
        },
        {
          label: "Raw count",
          value: formatG12Count(currentRun.raw_count),
          helper: "Total public rows captured.",
        },
        {
          label: "Clean count",
          value: formatG12Count(currentRun.clean_count),
          helper: "Rows kept after safety filtering.",
        },
        {
          label: "Stored count",
          value: formatG12Count(currentRun.stored_count),
          helper: "Insights written to the clean tables.",
        },
        {
          label: "Rejected count",
          value: formatG12Count(currentRun.rejected_count),
          helper: "Public rows kept out of reuse.",
        },
        {
          label: "Blocked count",
          value: formatG12Count(currentRun.blocked_count),
          helper: "Rows stopped by the compliance gate.",
        },
        {
          label: "Completed at",
          value: formatG12DateTime(currentRun.completed_at),
          helper: formatG12RelativeTime(currentRun.completed_at),
        },
      ]
    : [];

  const manualPlatformLabel = getPlatformSelectionLabel(platformSelection);

  const handleRefresh = useCallback(() => {
    void loadLatest();
  }, [loadLatest]);

  const handleManualFetch = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const payload = buildG12ManualPayload({
        platformSelection,
        query,
        fetchLimit,
        topCommentsLimit,
        branchKey,
      });

      setSubmittingRun(true);
      try {
        const response = await request(buildRequestUrl("/api/admin/g12-trend-fetcher/run"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        const body = await parseJsonResponse<G12ManualFetchResponse>(response);
        const status = normalizeG12TrendFetcherRunStatus(body?.status ?? (response.ok ? "ACCEPTED" : "ERROR"));
        const fetchRunId = body?.fetch_run_id ?? body?.fetchRunId ?? null;
        const message =
          body?.message?.trim() ||
          (status === "ACCEPTED"
            ? "Manual fetch accepted."
            : status === "PASS"
              ? "Manual fetch completed."
              : status === "BLOCK"
                ? "Manual fetch blocked."
                : "Manual fetch failed.");

        setManualRun({
          status,
          fetch_run_id: fetchRunId,
          message,
          requested_at: new Date().toISOString(),
          branch_key: payload.branch_key,
          platforms: payload.platforms,
          query: payload.query,
          fetch_limit: payload.fetch_limit,
          top_comments_limit: payload.top_comments_limit,
        });

        if (fetchRunId && (status === "ACCEPTED" || status === "PASS")) {
          setAwaitingFetchRunId(fetchRunId);
        } else {
          setAwaitingFetchRunId(null);
        }

        if (status === "PASS" || status === "ACCEPTED") {
          toast.success("G12 workflow request sent.");
        } else {
          toast.error(message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Manual fetch failed.";
        setManualRun({
          status: "ERROR",
          fetch_run_id: null,
          message,
          requested_at: new Date().toISOString(),
          branch_key: payload.branch_key,
          platforms: payload.platforms,
          query: payload.query,
          fetch_limit: payload.fetch_limit,
          top_comments_limit: payload.top_comments_limit,
        });
        setAwaitingFetchRunId(null);
        toast.error(message);
      } finally {
        setSubmittingRun(false);
      }
    },
    [branchKey, fetchLimit, platformSelection, query, request, topCommentsLimit],
  );

  const latestRouteStatus = dashboard?.status ?? (loadError ? "ERROR" : loading ? "LOADING" : "EMPTY");
  const latestRouteTone = getRouteStatusTone(latestRouteStatus);
  const currentRunTone = currentRun ? getG12RunStatusTone(currentRun.status as G12TrendFetcherRunStatus) : "border-slate-200 bg-slate-100 text-slate-700";
  const isEmptyState = dashboard?.status === "EMPTY";
  const isErrorState = dashboard?.status === "ERROR" || (!dashboard && Boolean(loadError));
  const hasRealData = Boolean(currentRun);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1] text-foreground">
        <div className="pointer-events-none absolute -left-24 top-8 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-secondary/35 blur-3xl" />

        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 min-w-0 px-4 pb-8 pt-6 lg:px-8">
              <div className="flex w-full min-w-0 flex-col gap-6">
                <header className="sticky top-0 z-10 rounded-[28px] border border-border/60 bg-background/90 px-4 py-4 shadow-sm backdrop-blur-xl lg:px-6 lg:py-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 md:hidden">
                      <SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />
                      <span className="text-sm font-medium text-muted-foreground">Menu</span>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild variant="outline" className="h-9 rounded-full border-border/70 bg-white px-3 text-[11px] shadow-sm">
                            <Link href="/dashboard/n8n-automations">
                              <ArrowLeft data-icon="inline-start" />
                              Back to Automations
                            </Link>
                          </Button>
                          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 text-muted-foreground">
                            G12 workflow
                          </Badge>
                          <Badge variant="outline" className={cn("rounded-full", latestRouteTone)}>
                            {loading && !dashboard ? "Loading" : latestRouteStatus}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full",
                              dashboard?.source === "SUPABASE_REAL_DATA"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-sky-200 bg-sky-50 text-sky-700",
                            )}
                          >
                            {dashboard?.source === "SUPABASE_REAL_DATA" ? "Supabase" : "Latest data"}
                          </Badge>
                          {currentRun ? (
                            <Badge variant="outline" className={cn("rounded-full", currentRunTone)}>
                              Run status: {currentRun.status}
                            </Badge>
                          ) : null}
                          {awaitingFetchRunId ? (
                            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                              Polling {awaitingFetchRunId}
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 text-muted-foreground">
                            G4/G5 approval required
                          </Badge>
                        </div>

                        <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">
                          {G12_TREND_FETCHER_TITLE}
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                          {G12_TREND_FETCHER_PURPOSE}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:max-w-3xl lg:flex-1 lg:justify-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold normal-case text-muted-foreground"
                          >
                            {refreshing ? "Refreshing..." : "Fresh data only"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold normal-case text-muted-foreground"
                          >
                            No raw media or creator identity shown
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 justify-center rounded-full border-border/70 bg-white px-3.5 text-[11px] font-medium shadow-sm"
                            onClick={handleRefresh}
                            disabled={loading || refreshing}
                          >
                            <RefreshCcw data-icon="inline-start" />
                            {refreshing ? "Refreshing..." : "Refresh"}
                          </Button>
                          <Button asChild className="h-10 justify-center rounded-full px-3.5 text-[11px] font-medium">
                            <Link href="#manual-fetch">
                              <Play data-icon="inline-start" />
                              Run
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="bg-border/70" />

                {loadError ? (
                    <Alert variant="destructive" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-900">
                      <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-rose-900">G12 data load failed</AlertTitle>
                    <AlertDescription className="text-rose-900">{loadError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-6">
                    {isEmptyState ? (
                      <SectionCard
                        id="overview"
                        title="Overview"
                        description="A compact summary of the latest safe public trend fetch."
                      >
                        <EmptyState
                          title="No real G12 trend data found yet. Run the Trend Fetcher to populate this page."
                          description="Once Supabase has a latest workflow run, the overview cards, insights, metrics, and platform counts will render here."
                        />
                      </SectionCard>
                    ) : isErrorState ? (
                      <SectionCard
                        id="overview"
                        title="Overview"
                        description="A compact summary of the latest safe public trend fetch."
                      >
                        <EmptyState
                          title="G12 data is currently unavailable."
                          description="Fix the backend issue, then refresh to load the latest Supabase snapshot."
                        />
                      </SectionCard>
                    ) : loading && !dashboard ? (
                      <G12LatestSkeleton />
                    ) : (
                      <SectionCard
                        id="overview"
                        title="Overview"
                        description="A compact summary of the latest safe public trend fetch."
                      >
                        {hasRealData ? (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {summaryTiles.map((tile) => (
                              <MetricTile key={tile.label} label={tile.label} value={tile.value} helper={tile.helper} />
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            title="Latest run unavailable"
                            description="The dashboard is waiting for a real Supabase workflow run."
                          />
                        )}
                      </SectionCard>
                    )}

                    <SectionCard
                      id="manual-fetch"
                      title="Manual Run"
                      description="Send a safe public trend fetch to the live n8n webhook and wait for Supabase to catch up."
                      action={
                        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 text-muted-foreground">
                          {manualPlatformLabel}
                        </Badge>
                      }
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <form className="space-y-5" onSubmit={handleManualFetch}>
                          <FieldGroup className="gap-5">
                            <FieldSet className="gap-3">
                              <FieldLegend className="mb-1 text-sm font-medium text-foreground">Platforms</FieldLegend>
                              <FieldDescription className="text-sm text-muted-foreground">
                                Choose Instagram, TikTok, or both. This controls the webhook payload only.
                              </FieldDescription>
                              <ToggleGroup
                                type="single"
                                value={platformSelection}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return;
                                  }

                                  setPlatformSelection(value as G12TrendFetcherPlatformSelection);
                                }}
                                className="grid w-full grid-cols-3 gap-2 rounded-none"
                              >
                                <ToggleGroupItem value="instagram" className="rounded-full px-4">
                                  Instagram
                                </ToggleGroupItem>
                                <ToggleGroupItem value="tiktok" className="rounded-full px-4">
                                  TikTok
                                </ToggleGroupItem>
                                <ToggleGroupItem value="both" className="rounded-full px-4">
                                  Both
                                </ToggleGroupItem>
                              </ToggleGroup>
                            </FieldSet>

                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="g12-query">Query</FieldLabel>
                                <Input
                                  id="g12-query"
                                  value={query}
                                  onChange={(event) => setQuery(event.target.value)}
                                  placeholder={G12_TREND_FETCHER_QUERY_DEFAULT}
                                  className="rounded-full"
                                />
                                <FieldDescription>Default: {G12_TREND_FETCHER_QUERY_DEFAULT}.</FieldDescription>
                              </FieldContent>
                            </Field>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field>
                                <FieldContent>
                                  <FieldLabel htmlFor="g12-fetch-limit">Result cap</FieldLabel>
                                  <Input
                                    id="g12-fetch-limit"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={fetchLimit}
                                    onChange={(event) => setFetchLimit(Number(event.target.value) || 0)}
                                    className="rounded-full"
                                  />
                                  <FieldDescription>Default: {G12_TREND_FETCHER_RESULT_CAP_DEFAULT}.</FieldDescription>
                                </FieldContent>
                              </Field>

                              <Field>
                                <FieldContent>
                                  <FieldLabel htmlFor="g12-top-comments-limit">Top comments limit</FieldLabel>
                                  <Input
                                    id="g12-top-comments-limit"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={topCommentsLimit}
                                    onChange={(event) => setTopCommentsLimit(Number(event.target.value) || 0)}
                                    className="rounded-full"
                                  />
                                  <FieldDescription>Default: 0.</FieldDescription>
                                </FieldContent>
                              </Field>
                            </div>

                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="g12-branch-key">Branch</FieldLabel>
                                <Select value={branchKey} onValueChange={(value) => setBranchKey(value as G12TrendFetcherBranchKey)}>
                                  <SelectTrigger id="g12-branch-key" className="h-10 w-full rounded-full">
                                    <SelectValue placeholder="Select a branch" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MANUAL_BRANCH_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                        {option.helper ? ` - ${option.helper}` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FieldDescription>General Manual Fetch is the default catch-all route.</FieldDescription>
                              </FieldContent>
                            </Field>
                          </FieldGroup>

                          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button type="submit" className="h-10 rounded-full px-5" disabled={submittingRun || loading}>
                              <Play data-icon="inline-start" />
                              {awaitingFetchRunId ? "Polling..." : submittingRun ? "Running..." : "Run"}
                            </Button>
                          </div>
                        </form>

                        <Card className="rounded-[24px] border-border/60 bg-muted/20 shadow-none">
                          <CardHeader className="space-y-2">
                            <CardTitle className="text-lg text-primary">Manual Run Result</CardTitle>
                            <CardDescription>
                              {manualRun
                                ? "The run result is shown here first, then the stored Supabase row takes over when it catches up."
                                : "Submit a manual run to see ACCEPTED, PASS, BLOCK, or ERROR here."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {manualRun ? (
                              <>
                                <Alert variant="default" className="border-border/60 bg-white">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <AlertTitle className="flex items-center justify-between gap-3">
                                    <span>Run status</span>
                                    <Badge variant="outline" className={cn("rounded-full", getG12RunStatusTone(manualRun.status))}>
                                      {manualRun.status}
                                    </Badge>
                                  </AlertTitle>
                                  <AlertDescription className="text-muted-foreground">
                                    <p>{manualRun.message}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Requested {formatG12DateTime(manualRun.requested_at)} via {manualRun.branch_key}.
                                    </p>
                                  </AlertDescription>
                                </Alert>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <MetricTile
                                    label="Fetch run ID"
                                    value={manualRun.fetch_run_id || "Pending"}
                                    helper="The webhook should return this before polling starts."
                                  />
                                  <MetricTile
                                    label="Platforms"
                                    value={getPlatformSelectionLabel(platformSelection)}
                                    helper={manualRun.query}
                                  />
                                  <MetricTile
                                    label="Fetch limit"
                                    value={formatG12Count(manualRun.fetch_limit)}
                                    helper="Requested result cap."
                                  />
                                  <MetricTile
                                    label="Top comments"
                                    value={formatG12Count(manualRun.top_comments_limit)}
                                    helper="Requested top comments cap."
                                  />
                                </div>

                                <div className="rounded-2xl border border-border/60 bg-white p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Polling status
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-foreground">
                                    {awaitingFetchRunId
                                      ? `Polling Supabase for fetch_run_id ${awaitingFetchRunId}.`
                                      : manualRun.status === "PASS" || manualRun.status === "BLOCK" || manualRun.status === "ERROR"
                                        ? "The current manual run is terminal."
                                        : "Waiting for the webhook response or the stored row to load."}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <EmptyState
                                title="No run submitted yet"
                                description="Run the webhook to populate this panel with ACCEPTED, PASS, BLOCK, or ERROR."
                              />
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </SectionCard>

                    {hasRealData ? (
                      <>
                        <SectionCard
                          id="platform-results"
                          title="Platform Results"
                          description="The latest run broken down by platform counts."
                        >
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Platform</TableHead>
                                  <TableHead>Raw</TableHead>
                                  <TableHead>Clean</TableHead>
                                  <TableHead>Stored</TableHead>
                                  <TableHead>Rejected</TableHead>
                                  <TableHead>Blocked</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {platformResults.map((result) => (
                                  <TableRow key={result.platform}>
                                    <TableCell className="font-medium text-foreground">
                                      {result.platform === "INSTAGRAM"
                                        ? "Instagram"
                                        : result.platform === "TIKTOK"
                                          ? "TikTok"
                                          : result.platform}
                                    </TableCell>
                                    <TableCell>{formatG12Count(result.raw_count)}</TableCell>
                                    <TableCell>{formatG12Count(result.clean_count)}</TableCell>
                                    <TableCell>{formatG12Count(result.stored_count)}</TableCell>
                                    <TableCell>{formatG12Count(result.rejected_count)}</TableCell>
                                    <TableCell>{formatG12Count(result.blocked_count)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </SectionCard>

                        <SectionCard
                          id="stored-insights"
                          title="Stored Insights"
                          description="Only cleaned insights are shown here. Raw captions, media, audio, and creator identity stay out of the UI."
                        >
                          {dashboard?.insights?.length ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              {dashboard.insights.map((insight) => {
                                const title = getInsightTitle(insight);
                                const summary = getInsightSummary(insight);
                                const branchLabel = getInsightBranchLabel(insight);
                                const createdAt = insight.created_at || insight.stored_at;

                                return (
                                  <Card
                                    key={insight.id}
                                    className="overflow-hidden rounded-[24px] border-border/60 bg-muted/10 shadow-none transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                  >
                                    <CardContent className="space-y-4 p-5">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                                              Final clean insight
                                            </Badge>
                                            <Badge variant="outline" className="rounded-full border-border/70 bg-white text-muted-foreground">
                                              {insight.platform || "UNKNOWN"}
                                            </Badge>
                                          </div>
                                          <h3 className="font-serif text-xl leading-tight tracking-tight text-primary">{title}</h3>
                                        </div>

                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full"
                                          onClick={() => setSelectedInsight(insight)}
                                        >
                                          Inspect
                                          <ArrowRight data-icon="inline-end" />
                                        </Button>
                                      </div>

                                      <p className="text-sm leading-6 text-foreground">{summary}</p>

                                      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                                        <div>
                                          <span className="font-medium text-foreground">Platform:</span>{" "}
                                          {insight.platform || "UNKNOWN"}
                                        </div>
                                        <div>
                                          <span className="font-medium text-foreground">Branch:</span> {branchLabel}
                                        </div>
                                        <div>
                                          <span className="font-medium text-foreground">Created:</span>{" "}
                                          {createdAt ? formatG12DateTime(createdAt) : "Unknown"}
                                        </div>
                                        <div>
                                          <span className="font-medium text-foreground">Fetch run:</span>{" "}
                                          {insight.fetch_run_id || "Unknown"}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          ) : (
                            <EmptyState
                              title="No cleaned insights yet"
                              description="The latest run did not return any stored insights."
                            />
                          )}
                        </SectionCard>

                        <SectionCard
                          id="clean-metrics"
                          title="Clean Trend Metrics"
                          description="Safe metric rows loaded from the clean metrics table."
                        >
                          {dashboard?.metrics?.length ? (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Metric</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Platform</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Updated</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {dashboard.metrics.map((metric) => (
                                    <TableRow key={metric.id}>
                                      <TableCell className="font-medium text-foreground">{metric.label}</TableCell>
                                      <TableCell>{formatMetricValue(metric.value)}</TableCell>
                                      <TableCell>{metric.platform || "ALL"}</TableCell>
                                      <TableCell>{metric.branch_name}</TableCell>
                                      <TableCell>{getMetricTimestamp(metric) ? formatG12DateTime(getMetricTimestamp(metric)) : "Unknown"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <EmptyState
                              title="No clean metrics yet"
                              description="The latest run did not return any clean metric rows."
                            />
                          )}
                        </SectionCard>

                        <SectionCard
                          id="raw-platform-counts"
                          title="Raw Platform Counts"
                          description="Counts derived from the quarantine table using only platform names."
                        >
                          {rawCountEntries.length ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <MetricTile
                                label="Total raw rows"
                                value={formatG12Count(totalRawCount)}
                                helper="All quarantined rows for the latest run."
                              />
                              {rawCountEntries.map(([platform, count]) => (
                                <MetricTile
                                  key={platform}
                                  label={platform}
                                  value={formatG12Count(count)}
                                  helper="Rows grouped by platform."
                                />
                              ))}
                            </div>
                          ) : (
                            <EmptyState
                              title="No raw platform counts"
                              description="The quarantine table did not return any platform rows for the latest run."
                            />
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    <SectionCard
                      id="compliance"
                      title="Compliance"
                      description="The guardrails that keep this workflow safe and research-only."
                    >
                      <Alert variant="default" className="border-amber-200 bg-amber-50">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="text-amber-950">
                          Content still needs G4 content check and G5 human approval before use.
                        </AlertTitle>
                        <AlertDescription className="text-amber-950">
                          <div className="mt-3 space-y-2">
                            {G12_COMPLIANCE_NOTES.map((note) => (
                              <div key={note} className="rounded-xl border border-amber-200 bg-white/75 px-3 py-2 text-sm text-amber-950">
                                {note}
                              </div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    </SectionCard>
                  </div>

                  <div className="space-y-6">
                    <SectionCard
                      id="dashboard-status"
                      title="Dashboard Status"
                      description="Clean route-level status and the currently loaded latest run."
                    >
                      <div className="space-y-3">
                        <DetailRow
                          label="Route status"
                          value={
                            <Badge variant="outline" className={cn("rounded-full", latestRouteTone)}>
                              {loading && !dashboard ? "Loading" : latestRouteStatus}
                            </Badge>
                          }
                        />
                        <DetailRow
                          label="Source"
                          value={
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                dashboard?.source === "SUPABASE_REAL_DATA"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-700",
                              )}
                            >
                              {dashboard?.source ?? (loadError ? "Error" : "Loading")}
                            </Badge>
                          }
                        />
                        <DetailRow
                          label="Latest run"
                          value={currentRun ? currentRun.fetch_run_id : "No run yet"}
                        />
                        <DetailRow
                          label="Latest status"
                          value={currentRun ? currentRun.status : "Waiting for data"}
                        />
                        <DetailRow
                          label="Last completed"
                          value={currentRun?.completed_at ? formatG12DateTime(currentRun.completed_at) : "Unknown"}
                        />
                        <DetailRow
                          label="Run query"
                          value={currentRun?.query || "Not available yet"}
                        />
                        <DetailRow
                          label="Platforms"
                          value={currentRun ? currentRun.platforms.join(", ") : "Not available yet"}
                        />
                        <DetailRow
                          label="Approval requirement"
                          value="G4 content check + G5 human approval"
                        />
                      </div>
                    </SectionCard>

                    {manualRun ? (
                      <SectionCard
                        id="manual-summary"
                        title="Latest Manual Run"
                        description="The most recent run request sent from the dashboard."
                      >
                        <div className="space-y-3">
                          <DetailRow
                            label="Status"
                            value={
                              <Badge variant="outline" className={cn("rounded-full", getG12RunStatusTone(manualRun.status))}>
                                {manualRun.status}
                              </Badge>
                            }
                          />
                          <DetailRow label="Requested at" value={formatG12DateTime(manualRun.requested_at)} />
                          <DetailRow label="Fetch run ID" value={manualRun.fetch_run_id || "Pending"} />
                          <DetailRow label="Branch" value={getG12TrendFetcherBranchLabel(manualRun.branch_key)} />
                          <DetailRow label="Platforms" value={manualRun.platforms.join(", ")} />
                          <DetailRow label="Query" value={manualRun.query} />
                          <DetailRow label="Fetch limit" value={formatG12Count(manualRun.fetch_limit)} />
                          <DetailRow label="Top comments" value={formatG12Count(manualRun.top_comments_limit)} />
                          <DetailRow label="Message" value={manualRun.message} />
                        </div>
                      </SectionCard>
                    ) : (
                      <SectionCard
                        id="manual-summary"
                        title="Latest Manual Run"
                        description="The most recent run request sent from the dashboard."
                      >
                        <EmptyState
                          title="No run submitted yet"
                          description="Submit the manual run form to track status, polling, and the returned fetch_run_id."
                        />
                      </SectionCard>
                    )}

                    <SectionCard
                      id="fetching-notes"
                      title="Fetching Notes"
                      description="What the page will and will not show."
                    >
                      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                        <p>Only clean insights, counts, summaries, platform names, branches, and approval context are rendered.</p>
                        <p>Raw captions, raw media, raw audio, and creator identity are intentionally excluded from the dashboard.</p>
                        <p>The page polls the latest run endpoint every 5 seconds until the workflow reaches PASS, BLOCK, or ERROR.</p>
                      </div>
                    </SectionCard>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>

      <Dialog
        open={Boolean(selectedInsight)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInsight(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-[28px] border-border/60 bg-white">
          {selectedInsight ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl tracking-tight text-primary">
                  {getInsightTitle(selectedInsight)}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-muted-foreground">
                  All displayed fields are cleaned dashboard values. No raw scraped content is shown.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Platform" value={selectedInsight.platform || "UNKNOWN"} />
                  <DetailRow label="Branch" value={getInsightBranchLabel(selectedInsight)} />
                  <DetailRow label="Fetch run ID" value={selectedInsight.fetch_run_id || "Unknown"} />
                  <DetailRow
                    label="Created / stored"
                    value={selectedInsight.created_at || selectedInsight.stored_at ? formatG12DateTime(selectedInsight.created_at || selectedInsight.stored_at) : "Unknown"}
                  />
                </div>

                <div className="grid gap-3">
                  <DetailRow label="Trend topic" value={selectedInsight.trend_topic || "Unknown"} />
                  <DetailRow label="Hook angle" value={selectedInsight.hook_angle || "Unknown"} />
                  <DetailRow label="Clean summary" value={selectedInsight.clean_summary || "Unknown"} />
                  <DetailRow
                    label="Content recommendation"
                    value={selectedInsight.content_recommendation || "Unknown"}
                  />
                  <DetailRow
                    label="Trend strength"
                    value={formatMetricValue(selectedInsight.trend_strength)}
                  />
                  <DetailRow
                    label="Brand fit score"
                    value={formatMetricValue(selectedInsight.brand_fit_score)}
                  />
                  <DetailRow
                    label="Risk score"
                    value={formatMetricValue(selectedInsight.risk_score)}
                  />
                  <DetailRow
                    label="Approval status"
                    value={selectedInsight.approval_status || "Unknown"}
                  />
                  <DetailRow
                    label="Compliance note"
                    value={selectedInsight.compliance_note || "Unknown"}
                  />
                  <DetailRow
                    label="Source label"
                    value={selectedInsight.source_label || "Unknown"}
                  />
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
