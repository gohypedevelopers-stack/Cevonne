import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function MarketingInsightsPanel({ campaigns, influencerHighlights }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Campaign performance</CardTitle>
            <CardDescription>Measure promo ROI across channels.</CardDescription>
          </div>
          <Badge className="rounded-full bg-primary/10 text-primary">
            {campaigns.length} live
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-border/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">{campaign.channel}</p>
                </div>
                <span className="text-sm font-semibold text-primary">{campaign.roi}% ROI</span>
              </div>
              <Progress value={campaign.progress} className="mt-3 h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{campaign.goal}</span>
                <span>{campaign.conversions} conversions</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Influencer desk</CardTitle>
          <CardDescription>Quick read on collaborations and shoutouts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {influencerHighlights.map((highlight) => (
            <div key={highlight.id} className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">{highlight.name}</span>
                <span className="text-xs text-muted-foreground">{highlight.platform}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{highlight.summary}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Reach: {highlight.reach}</span>
                <span>Engagement: {highlight.engagement}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
