import { Brain, Filter, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AiAndSegmentationPanel({ aiInsights, segments }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI foresight
            </CardTitle>
            <CardDescription>Predictive restocks & recommended launches.</CardDescription>
          </div>
          <Badge className="rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            beta
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiInsights.map((insight) => (
            <div key={insight.id} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-semibold text-primary">{insight.title}</p>
              <p className="text-xs text-muted-foreground">{insight.detail}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Confidence: {insight.confidence}%</span>
                <Button variant="ghost" size="xs" className="text-primary">
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Segmentation filters</CardTitle>
            <CardDescription>Target campaigns by lifecycle, spend, and preference.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="rounded-full text-xs">
            <Filter className="mr-2 h-4 w-4" />
            Save view
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {segments.map((segment) => (
            <div key={segment.id} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-primary">{segment.name}</p>
                <Badge className="rounded-full bg-primary/10 text-primary">{segment.size} shoppers</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{segment.criteria}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {segment.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
