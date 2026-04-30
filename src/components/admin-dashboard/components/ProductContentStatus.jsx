import { AlertTriangle, Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export function ProductContentStatus({ readiness, onCreateProduct }) {
  const score = readiness?.score ?? 0;
  const readyCount = readiness?.readyCount ?? 0;
  const missingCount = readiness?.missingCount ?? 0;
  const total = readiness?.total ?? 0;
  const flagged = readiness?.flagged ?? [];

  return (
    <Card className="flex h-full flex-col border-none bg-white/80 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Sparkles className="h-5 w-5 text-secondary" />
              Product content readiness
            </CardTitle>
            <CardDescription>
              Tracks how complete each product page is before you publish.
            </CardDescription>
          </div>
          {onCreateProduct ? (
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={onCreateProduct}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add story
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-primary/5 p-4 shadow-inner">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-muted-foreground">Avg. completeness</span>
            <span className="text-primary">{score}%</span>
          </div>
          <Progress value={score} className="mt-2 h-2" />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full border-primary/50 bg-white">
              Ready {readyCount}/{total}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Needs content {missingCount}
            </Badge>
          </div>
        </div>

        <Separator />

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create your first product to start the content checklist.
          </p>
        ) : flagged.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 p-3 text-emerald-700">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-semibold">All product pages look complete.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Top gaps to fix
            </div>
            <div className="space-y-3">
              {flagged.map((item) => (
                <div
                  key={item.id ?? item.name}
                  className="rounded-xl border border-border/60 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(item.score * 100)}% ready • Missing:
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {item.missing.length} items
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.missing.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="rounded-full bg-amber-50 text-amber-700"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
