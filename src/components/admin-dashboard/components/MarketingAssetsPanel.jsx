import { ImageDown, Instagram, Link2, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MarketingAssetsPanel({ assets, marketingBreakdown }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Asset manager</CardTitle>
            <CardDescription>Centralize hero shots, banners, and influencer kits.</CardDescription>
          </div>
          <Button size="sm" className="rounded-full text-xs">
            <ImageDown className="mr-2 h-4 w-4" />
            Upload asset
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[230px] pr-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <div key={asset.id} className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-sm">
                  <img src={asset.preview} alt={asset.name} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-primary">{asset.name}</p>
                      <p className="text-muted-foreground">{asset.type}</p>
                    </div>
                    <Badge className="rounded-full bg-primary/10 text-primary">{asset.channel}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Marketing ROI</CardTitle>
          <CardDescription>Breakdown by channel with influencer boosts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {marketingBreakdown.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.icon === "video" ? (
                    <PlayCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Instagram className="h-4 w-4 text-primary" />
                  )}
                  <p className="font-semibold text-primary">{item.channel}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.roi}% ROI</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.spend}</span>
                <Button variant="link" className="p-0 text-primary text-xs" size="sm">
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  View campaign
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
