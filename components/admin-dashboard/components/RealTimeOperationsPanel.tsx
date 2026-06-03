import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RealTimeOperationsPanel({ events, autoRefresh, onToggleRefresh }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-primary">Operations feed</CardTitle>
          <CardDescription>Live snapshots from sales, inventory, and reviews.</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          Auto refresh
          <Switch checked={autoRefresh} onCheckedChange={onToggleRefresh} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-primary">{event.title}</p>
              <p className="text-xs text-muted-foreground">{event.description}</p>
            </div>
            <span className="text-xs text-muted-foreground">{event.time}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
