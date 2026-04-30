import { Moon, SunMedium, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function CustomizationFeedbackPanel({ darkMode, onToggleDarkMode, feedbackItems }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Appearance</CardTitle>
            <CardDescription>Switch between light and dark themes for marathon workdays.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-primary">
            {darkMode ? <Moon className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
            <Switch checked={darkMode} onCheckedChange={onToggleDarkMode} />
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {darkMode
            ? "Dark mode reduces glare and keeps the focus on insights during late-night launches."
            : "Light mode mirrors in-store collateral and gives a clean overview of catalogue pipelines."}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Admin feedback</CardTitle>
            <CardDescription>Capture what the ops team needs next.</CardDescription>
          </div>
          <ThumbsUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Share a quick idea…" className="min-h-[90px] rounded-2xl border-border/60" />
          <div className="flex flex-wrap gap-2">
            {feedbackItems.map((item) => (
              <span key={item.id} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary">
                {item.label}
              </span>
            ))}
          </div>
          <Button className="w-full rounded-full text-sm">Submit suggestion</Button>
        </CardContent>
      </Card>
    </section>
  );
}
