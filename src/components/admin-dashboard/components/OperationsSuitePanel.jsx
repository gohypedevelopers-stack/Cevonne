import { AlertTriangle, Bell, Shield, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function OperationsSuitePanel({ roles, alerts, returns, notificationsEnabled, onToggleNotifications }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Role-based access</CardTitle>
            <CardDescription>Assign privileges across merchandising, marketing, and ops.</CardDescription>
          </div>
          <Badge className="rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            {roles.length} roles
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{role.name}</span>
                <Badge className="rounded-full bg-white text-xs text-primary">{role.members} users</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{role.scope}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-primary">Automation alerts</CardTitle>
              <CardDescription>Notify the team whenever key signals fire.</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Bell className="h-4 w-4 text-primary" />
              <Switch checked={notificationsEnabled} onCheckedChange={onToggleNotifications} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <AlertTriangle className={`h-4 w-4 ${alert.variant === "danger" ? "text-destructive" : "text-primary"}`} />
                <div className="flex-1">
                  <p className="font-semibold text-primary">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
                <Badge className="rounded-full bg-primary/10 text-primary">{alert.channel}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-primary">Return desk</CardTitle>
              <CardDescription>Approve / decline lipstick returns with context.</CardDescription>
            </div>
            <Badge className="rounded-full bg-secondary/20 text-secondary-foreground flex items-center gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {returns.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {returns.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-primary">{entry.product}</p>
                  <span className="text-xs text-muted-foreground">{entry.days}d ago</span>
                </div>
                <p className="text-xs text-muted-foreground">Reason: {entry.reason}</p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="xs" className="rounded-full text-xs px-3">
                    Approve
                  </Button>
                  <Button variant="ghost" size="xs" className="rounded-full text-xs px-3 text-destructive">
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
