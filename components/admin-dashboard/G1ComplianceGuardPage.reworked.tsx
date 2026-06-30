"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Eye, Search, ExternalLink, X } from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type G1RawRun = {
  id: string;
  created_at: string;
  workflow_group: string;
  action_type: string;
  platform: string;
  status: string;
  fail_reason: string;
  failure_reasons: string[];
  policy_ids_checked: string[];
  reviewer_id: string | null;
  action_packet: Record<string, unknown> | null;
};

type G1ResponseBody = {
  status: "PASS" | "EMPTY" | "ERROR";
  response_type?: string;
  message?: string;
  runs?: G1RawRun[];
};

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();
const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const normalizePlatform = (platform: string) => {
  const normalized = (platform || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (normalized.includes("INSTAGRAM") || normalized === "IG") return "INSTAGRAM";
  if (normalized.includes("META") || normalized.includes("FACEBOOK")) return "META";
  if (normalized.includes("WHATSAPP")) return "WHATSAPP";
  if (normalized.includes("GOOGLE")) return "GOOGLE";
  if (normalized.includes("WEBSITE") || normalized.includes("SEO") || normalized.includes("CRO")) return "WEBSITE";
  if (normalized.includes("INTERNAL") || !normalized) return "INTERNAL";
  return normalized;
};

const formatPlatformLabel = (platform: string) => {
  switch (platform) {
    case "INSTAGRAM": return "Instagram";
    case "META": return "Meta";
    case "WHATSAPP": return "WhatsApp";
    case "GOOGLE": return "Google";
    case "WEBSITE": return "Website";
    case "INTERNAL": return "Internal";
    default: return platform;
  }
};

const formatActionType = (action: string) => {
  const normalized = (action || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  switch (normalized) {
    case "IG_PUBLISH_POST":
    case "IG_PUBLISH": return "Instagram post publish check";
    case "META_UPDATE_ADSET_BUDGET": return "Meta budget change check";
    case "META_CREATE_AD": return "Meta ad creation check";
    case "META_UPDATE_AD": return "Meta ad update check";
    case "META_PAUSE_AD": return "Meta ad pause check";
    case "META_DUPLICATE_AD": return "Meta ad duplication check";
    case "META_UPLOAD_CUSTOM_AUDIENCE": return "Meta audience upload check";
    case "IG_SEND_DM":
    case "DIRECT_N8N_IG_DM": return "Instagram DM send check";
    case "WHATSAPP_MESSAGE": return "WhatsApp message safety check";
    case "UGC_REUSE": return "UGC reuse permission check";
    case "SEO_UPDATE_PAGE":
    case "SEO_PAGE_UPDATE": return "Website SEO update check";
    case "CRO_EXPERIMENT_LAUNCH": return "Website CRO test launch check";
    case "GOOGLE_SCRAPE": return "Google data collection check";
    default: return action ? action.replace(/_/g, " ") : "Unknown action";
  }
};

const formatWorkflowGroup = (group: string) => {
  switch (group?.toUpperCase()) {
    case "G1": return "Compliance Guard";
    case "G2": return "Policy + Account Health";
    case "G3": return "CRM + Consent + Attribution";
    case "G4": return "Content / Claim Check";
    case "G5": return "Publishing";
    case "G6": return "Messaging + Quiz + Recovery";
    case "G7": return "Inventory + Offer Safety";
    case "G8": return "UGC + Creator Proof";
    case "G9": return "Ads + Retargeting";
    case "G10": return "SEO + CRO";
    case "G11": return "Decision Engine";
    case "G12": return "Public Trend Fetcher";
    case "WF1": return "G5 Publishing / Instagram Scheduler";
    default: return group || "Unknown workflow";
  }
};

const getStatusTone = (status: string) => {
  switch (status?.toUpperCase()) {
    case "PASS": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCK": return "border-rose-200 bg-rose-50 text-rose-700";
    case "MANUAL_ONLY": return "border-amber-200 bg-amber-50 text-amber-700";
    default: return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const getPlatformBadgeTone = (code: string) => {
  switch (code) {
    case "INSTAGRAM": return "border-rose-200 bg-rose-50 text-rose-700";
    case "META": return "border-blue-200 bg-blue-50 text-blue-700";
    case "WHATSAPP": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "GOOGLE": return "border-amber-200 bg-amber-50 text-amber-700";
    default: return "border-border/70 bg-secondary/20 text-muted-foreground";
  }
};

const getActionNeeded = (status: string, failReason: string) => {
  if (status === "PASS") return "No action needed.";
  if (status === "MANUAL_ONLY") return "Human review needed before this can continue.";
  
  const reason = (failReason || "").toUpperCase();
  switch (reason) {
    case "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED": return "Human approval is needed before this action can continue.";
    case "ACCOUNT_HEALTH_UNKNOWN":
    case "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN":
    case "ACCOUNT_HEALTH_NOT_CLEAN:UNKNOWN": return "Check account health first.";
    case "CONSENT_MISSING": return "Valid customer consent is missing.";
    case "UGC_RIGHTS_MISSING": return "Creator or UGC permission proof is missing.";
    case "CLAIM_EVIDENCE_MISSING": return "Claim proof is missing.";
    case "POLICY_CHANGED_NEEDS_REVIEW": return "A policy changed and needs review first.";
    case "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER": return "Use an approved Instagram DM partner route.";
    case "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES": return "Use approved Google sources only.";
    case "HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION": return "Add consent, masking, and retention controls first.";
    case "MISSING_REQUIRED_FIELD:ACTION_TYPE": return "The workflow request is missing the action type.";
    default: return "Review required before continuing.";
  }
};

const getInsightMessage = (status: string) => {
  switch (status?.toUpperCase()) {
    case "PASS": return "G1 approved this action. The workflow can continue using a valid compliance approval.";
    case "BLOCK": return "G1 safely stopped this action. The workflow did not run.";
    case "MANUAL_ONLY": return "G1 requires human review before this action can continue.";
    default: return "G1 recorded this action.";
  }
};

const getActionButton = (status: string, failReason: string) => {
  const reason = (failReason || "").toUpperCase();
  if (status === "PASS") return { label: "View check details", action: "VIEW" };
  if (reason.includes("CONTENT") || reason === "UGC_RIGHTS_MISSING" || reason === "CLAIM_EVIDENCE_MISSING") return { label: "Open Content Review", action: "CONTENT_REVIEW" };
  if (reason.includes("ACCOUNT_HEALTH")) return { label: "Open Account Health", action: "ACCOUNT_HEALTH" };
  if (reason.includes("HUMAN_APPROVAL")) return { label: "Open Approval Queue", action: "APPROVAL_QUEUE" };
  return { label: "View check details", action: "VIEW" };
};

const getRequestedBy = (run: G1RawRun) => {
  if (run.action_packet?.requested_by_workflow) return String(run.action_packet.requested_by_workflow);
  if (run.action_packet?.workflow_id) return String(run.action_packet.workflow_id);
  if (run.workflow_group) return `G${run.workflow_group.replace(/\D/g, "")}`;
  return "Unknown Workflow";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function G1ComplianceGuardPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [runs, setRuns] = useState<G1RawRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [workflowFilter, setWorkflowFilter] = useState("ALL");

  const [selectedRun, setSelectedRun] = useState<G1RawRun | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await request(buildRouteUrl("/api/admin/g1-compliance-guard/latest"), { cache: "no-store" });
        const body = await parseJsonResponse<G1ResponseBody>(response);
        if (!active) return;
        if (!response.ok || !body) throw new Error("Unable to load G1 safety checks. Please check the Supabase connection.");
        setRuns(body.runs ?? []);
      } catch (error) {
        if (!active) return;
        setRuns([]);
        setLoadError("Could not load G1 safety checks. Please check the Supabase connection.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, [request]);

  const latestRuns = useMemo(() => {
    const seen = new Set<string>();
    const unique: G1RawRun[] = [];
    for (const r of runs) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        unique.push(r);
      }
    }
    return unique.slice(0, 6);
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      if (statusFilter !== "ALL" && run.status !== statusFilter) return false;
      const plat = normalizePlatform(run.platform);
      if (platformFilter !== "ALL" && plat !== platformFilter) return false;
      const wf = getRequestedBy(run);
      if (workflowFilter !== "ALL" && !wf.toUpperCase().includes(workflowFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!formatActionType(run.action_type).toLowerCase().includes(q) &&
            !wf.toLowerCase().includes(q) &&
            !plat.toLowerCase().includes(q) &&
            !(run.id || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [runs, search, statusFilter, platformFilter, workflowFilter]);

  const topRun = runs[0];
  const headerStatus = topRun ? topRun.status : "UNKNOWN";
  const selectedApprovalId =
    typeof selectedRun?.action_packet?.approval_id === "string" ? selectedRun.action_packet.approval_id : null;
  const selectedAssetId =
    typeof selectedRun?.action_packet?.asset_id === "string" ? selectedRun.action_packet.asset_id : null;

  return (
    <WorkflowDashboardShell
      eyebrow="COMPLIANCE GATE"
      title="G1 — Compliance Guard"
      description="Checks whether risky workflow actions are safe before they run."

      actions={
        <>
          <Button asChild className="h-10 min-w-[152px] justify-center rounded-full px-5">
            <a href="#recent-safety-checks">
              <Eye data-icon="inline-start" />
              View Safety Checks
            </a>
          </Button>
        </>
      }
    >
      {loadError ? (
        <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-rose-900">{loadError}</CardContent>
        </Card>
      ) : null}

      {loading && !runs.length ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-[28px]" />
          <Skeleton className="h-96 w-full rounded-[28px]" />
        </div>
      ) : runs.length === 0 && !loadError ? (
        <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="font-serif text-2xl tracking-tight text-primary">G1 is active, but no workflow action has been checked yet.</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">When another workflow requests a safety check, the result will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latestRuns.length > 0 && (
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight text-primary">Latest Safety Outcomes</h2>
                  <p className="text-sm leading-6 text-muted-foreground">The most recent actions checked by G1.</p>
                </div>
                <div className="flex items-center gap-2 pr-2">
                  <CarouselPrevious className="relative inset-0 translate-x-0 translate-y-0 size-8 border-border/60 bg-white shadow-sm hover:bg-muted/50" />
                  <CarouselNext className="relative inset-0 translate-x-0 translate-y-0 size-8 border-border/60 bg-white shadow-sm hover:bg-muted/50" />
                </div>
              </div>
              <CarouselContent className="-ml-4">
                {latestRuns.map(run => {
                  const platformCode = normalizePlatform(run.platform);
                  const platLabel = formatPlatformLabel(platformCode);
                  const actionName = formatActionType(run.action_type);
                  const reqBy = getRequestedBy(run);
                  const reqGroup = formatWorkflowGroup(reqBy);
                  const btn = getActionButton(run.status, run.fail_reason);
                  const actNeeded = getActionNeeded(run.status, run.fail_reason);

                  return (
                    <CarouselItem key={`latest-${run.id}`} className="pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                      <Card className="flex h-full flex-col overflow-hidden rounded-[24px] border-border/60 bg-white shadow-sm">
                        <CardHeader className="border-b border-border/40 bg-muted/5 pb-4 pt-5">
                          <div>
                            <h3 className="text-base font-semibold leading-tight text-foreground">{actionName}</h3>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getStatusTone(run.status))}>
                              {run.status || "UNKNOWN"}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                              {formatDateTime(run.created_at)}
                            </Badge>
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getPlatformBadgeTone(platformCode))}>
                              {platLabel}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-5">
                          <div className="flex max-w-md flex-col gap-5">
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Check Summary</h4>
                              <div className="space-y-2 text-sm">
                                <p><span className="font-medium text-foreground">Requested workflow:</span> <span className="text-muted-foreground">{reqGroup}</span></p>
                              </div>
                            </div>
                            <div className="space-y-4 pt-1">
                              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">What G1 Decided</h4>
                              <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-3 pt-2.5 pb-2 text-sm leading-snug text-sky-900">
                                {getInsightMessage(run.status)}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Action needed</p>
                                <p className="text-sm font-medium text-foreground mt-0.5">{actNeeded}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="mt-auto border-t border-border/40 bg-muted/5 p-4">
                          <Button variant="outline" className="w-full justify-center rounded-full bg-white shadow-sm" onClick={() => setSelectedRun(run)}>
                            {btn.label}
                          </Button>
                        </CardFooter>
                      </Card>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          )}

          <Card id="recent-safety-checks" className="rounded-[28px] border-border/60 bg-white shadow-sm mt-8">
            <CardHeader className="space-y-2 border-b border-border/40 pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">All Safety Checks</CardTitle>
                  <CardDescription className="mt-1 text-sm leading-6 text-muted-foreground">Every recent G1 compliance decision from Supabase.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search checks..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-[200px] rounded-full pl-9 text-sm" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[130px] rounded-full text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="PASS">Pass</SelectItem>
                      <SelectItem value="BLOCK">Block</SelectItem>
                      <SelectItem value="MANUAL_ONLY">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="h-9 w-[130px] rounded-full text-sm">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Platforms</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="META">Meta</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="WEBSITE">Website</SelectItem>
                      <SelectItem value="INTERNAL">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[1200px] table-fixed">
                  <colgroup>
                    <col className="w-[160px]" />
                    <col className="w-[160px]" />
                    <col className="w-[220px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[220px]" />
                    <col className="w-[180px]" />
                    <col className="w-[160px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Time</TableHead>
                      <TableHead className="px-4">Requested By</TableHead>
                      <TableHead className="px-4">What G1 Checked</TableHead>
                      <TableHead className="px-4">Platform</TableHead>
                      <TableHead className="px-4">Result</TableHead>
                      <TableHead className="px-4">Action Needed</TableHead>
                      <TableHead className="px-4">Policies Checked</TableHead>
                      <TableHead className="px-4 text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRuns.length ? (
                      filteredRuns.map((run, index) => {
                        const platCode = normalizePlatform(run.platform);
                        const platLabel = formatPlatformLabel(platCode);
                        const actNeeded = getActionNeeded(run.status, run.fail_reason);
                        const policiesCount = run.policy_ids_checked?.length || 0;
                        const policiesStr = run.policy_ids_checked?.join(", ") || "None";
                        const btn = getActionButton(run.status, run.fail_reason);

                        return (
                          <TableRow key={`table-${run.id}-${index}`}>
                            <TableCell className="align-top whitespace-nowrap px-4 font-medium text-foreground">
                              {formatDateTime(run.created_at)}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-foreground break-words">
                              {formatWorkflowGroup(getRequestedBy(run))}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-foreground break-words">
                              {formatActionType(run.action_type)}
                            </TableCell>
                            <TableCell className="align-top px-4">
                              <Badge variant="outline" className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", getPlatformBadgeTone(platCode))}>
                                {platLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top px-4">
                              <Badge variant="outline" className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", getStatusTone(run.status))}>
                                {run.status || "UNKNOWN"}
                              </Badge>
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-muted-foreground break-words">
                              {actNeeded}
                            </TableCell>
                            <TableCell className="!whitespace-normal align-top px-4 text-sm leading-6 text-muted-foreground break-words">
                              <div>
                                <p className="font-medium text-foreground">{policiesCount} policies</p>
                                <p className="text-xs mt-1">{policiesStr.slice(0, 50)}{policiesStr.length > 50 ? "..." : ""}</p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top px-4">
                               <Button variant="outline" className="h-8 w-full justify-center rounded-full px-3 text-[11px] shadow-sm" onClick={() => setSelectedRun(run)}>
                                {btn.label}
                               </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          No safety checks match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedRun && (
        <Dialog open={!!selectedRun} onOpenChange={(o) => !o && setSelectedRun(null)}>
          <DialogContent className="max-w-2xl overflow-hidden rounded-[28px] p-0 sm:rounded-[32px]">
            <div className="flex flex-col max-h-[85vh]">
              <DialogHeader className="border-b border-border/40 px-6 py-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Safety Check Details</DialogTitle>
                    <DialogDescription className="text-sm">
                      {formatActionType(selectedRun.action_type)} on {formatPlatformLabel(normalizePlatform(selectedRun.platform))}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto bg-muted/5 p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Result</p>
                      <Badge variant="outline" className={cn("mt-2 rounded-full border px-3 py-1 text-xs font-semibold", getStatusTone(selectedRun.status))}>
                        {selectedRun.status}
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checked Time</p>
                      <p className="mt-2 text-sm font-medium">{formatDateTime(selectedRun.created_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Action Needed</p>
                      <p className="mt-2 text-sm font-medium">{getActionNeeded(selectedRun.status, selectedRun.fail_reason)}</p>
                      {selectedRun.fail_reason && selectedRun.status !== "PASS" && (
                        <p className="mt-2 text-xs text-rose-700">Reason: {selectedRun.fail_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">What G1 Decided</p>
                      <p className="mt-2 text-sm font-medium text-pretty">{getInsightMessage(selectedRun.status)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Policies Checked</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        {selectedRun.policy_ids_checked?.length > 0 ? (
                          selectedRun.policy_ids_checked.map(p => <li key={p}>{p}</li>)
                        ) : <li>No specific policies listed</li>}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Context</p>
                      <div className="mt-2 space-y-1.5 text-sm">
                        <p><span className="text-muted-foreground">Requested by:</span> {formatWorkflowGroup(getRequestedBy(selectedRun))}</p>
                        {selectedApprovalId ? (
                          <p><span className="text-muted-foreground">Approval ID:</span> {selectedApprovalId}</p>
                        ) : null}
                        {selectedAssetId ? (
                          <p><span className="text-muted-foreground">Asset ID:</span> {selectedAssetId}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="border-t border-border/40 bg-white px-6 py-4">
                <Button variant="outline" className="w-full justify-center rounded-full shadow-sm" onClick={() => setSelectedRun(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </WorkflowDashboardShell>
  );
}
