"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, Copy, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, formatRelativeTime } from "@/components/admin-dashboard/n8n-automations-common";
import { formatG4ResultLabel, formatG4StatusTone, type G4WorkflowDetail } from "@/lib/admin/g4-content-review";
import { cn } from "@/lib/utils";

type G4ContentClaimCheckPageProps = {
  detail: G4WorkflowDetail;
};

type G4Status = G4WorkflowDetail["status"];

type G4RecheckResponse = {
  status: G4Status | "ERROR";
  message: string;
};

type G4ApprovalRequestResponse = {
  status: "PASS" | "BLOCK" | "ERROR";
  message: string;
  approvalId: string | null;
  alreadyQueued: boolean;
  approvalRequest: G4WorkflowDetail["approvalRequest"];
};

type ActionConfig = {
  label: string;
  disabled: boolean;
  helper: string | null;
  action: "fix" | "view" | "approval" | "evidence" | "manual";
};

const REQUIRED_COPY_WARNING_TERMS = /(clearer skin|fix acne|guaranteed|permanent|overnight|heal|cure|transform)/i;

const getStatusAccentClass = (status: G4Status) => {
  switch (status) {
    case "PASS":
      return "bg-emerald-400";
    case "BLOCK":
      return "bg-rose-400";
    case "PENDING_APPROVAL":
      return "bg-sky-400";
    case "MANUAL_ONLY":
      return "bg-violet-400";
    case "NEEDS_EVIDENCE":
      return "bg-amber-400";
    case "ERROR":
    default:
      return "bg-slate-400";
  }
};

const getActionToneClass = (status: G4Status) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "MANUAL_ONLY":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "ERROR":
    default:
      return "border-slate-200 bg-slate-100 text-slate-950";
  }
};

const buildInitialDraft = (detail: G4WorkflowDetail) =>
  detail.cleanAiOutput?.safeRewrite ??
  detail.contentPreview.contentText ??
  detail.contentPreview.pageText ??
  detail.latestOutcome?.summary ??
  "";

const getLatestPrimaryAction = (status: G4Status): ActionConfig => {
  switch (status) {
    case "BLOCK":
      return {
        label: "Fix content",
        disabled: false,
        helper: null,
        action: "fix",
      };
    case "PENDING_APPROVAL":
      return {
        label: "Send to approval",
        disabled: false,
        helper: null,
        action: "approval",
      };
    case "PASS":
      return {
        label: "View approval status",
        disabled: false,
        helper: null,
        action: "view",
      };
    case "NEEDS_EVIDENCE":
      return {
        label: "Add evidence",
        disabled: true,
        helper: "Evidence action is not connected yet.",
        action: "evidence",
      };
    case "MANUAL_ONLY":
      return {
        label: "Manual review",
        disabled: true,
        helper: "Manual review action is not connected yet.",
        action: "manual",
      };
    case "ERROR":
    default:
      return {
        label: "View details",
        disabled: false,
        helper: null,
        action: "view",
      };
  }
};

const getActionPanelCopy = (status: G4Status) => {
  switch (status) {
    case "BLOCK":
      return {
        title: "Fix this content before it can move forward",
        body: "This content cannot move to approval or publishing until the risky claim is removed or rewritten.",
        buttonLabel: "Fix content",
        buttonAction: "fix" as const,
        disabled: false,
        helper: null,
      };
    case "PENDING_APPROVAL":
      return {
        title: "Review and approve before use",
        body: "The content check passed, but a human approval is still required before publishing or ad use.",
        buttonLabel: "Send to approval",
        buttonAction: "approval" as const,
        disabled: false,
        helper: null,
      };
    case "PASS":
      return {
        title: "Review approval status before use",
        body: "Content check passed. Confirm the approval status before next workflow use.",
        buttonLabel: "View approval status",
        buttonAction: "view" as const,
        disabled: false,
        helper: null,
      };
    case "NEEDS_EVIDENCE":
      return {
        title: "Add missing proof before this can continue",
        body: "This content needs proof before it can move forward.",
        buttonLabel: "Add evidence",
        buttonAction: "evidence" as const,
        disabled: true,
        helper: "Evidence action is not connected yet.",
      };
    case "MANUAL_ONLY":
      return {
        title: "Manual review required",
        body: "This content needs manual review before it can continue.",
        buttonLabel: "Manual review",
        buttonAction: "manual" as const,
        disabled: true,
        helper: "Manual review action is not connected yet.",
      };
    case "ERROR":
    default:
      return {
        title: "Check the data source",
        body: "Unable to load content checks right now.",
        buttonLabel: "View details",
        buttonAction: "view" as const,
        disabled: false,
        helper: null,
      };
  }
};

const getRecentRowAction = (status: G4Status): ActionConfig => {
  switch (status) {
    case "BLOCK":
      return {
        label: "Fix",
        disabled: false,
        helper: null,
        action: "fix",
      };
    case "PENDING_APPROVAL":
      return {
        label: "Queue",
        disabled: false,
        helper: null,
        action: "approval",
      };
    case "PASS":
      return {
        label: "View",
        disabled: false,
        helper: null,
        action: "view",
      };
    case "NEEDS_EVIDENCE":
      return {
        label: "Add evidence",
        disabled: true,
        helper: "Evidence action is not connected yet.",
        action: "evidence",
      };
    case "MANUAL_ONLY":
      return {
        label: "Manual review",
        disabled: true,
        helper: "Manual review action is not connected yet.",
        action: "manual",
      };
    case "ERROR":
    default:
      return {
        label: "View",
        disabled: false,
        helper: null,
        action: "view",
      };
  }
};

const buildRecheckPayload = (detail: G4WorkflowDetail, draft: string) => ({
  content_text: draft,
  intended_use: "other",
  platform: detail.latestOutcome?.platform ?? "WEBSITE",
  requested_by: "admin",
  dry_run: true,
  notes: "G4 re-check from the content fix panel",
});

const isRiskyRewriteLanguage = (value: string | null) => Boolean(value && REQUIRED_COPY_WARNING_TERMS.test(value));

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

function FieldBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[22px] border border-border/60 bg-white p-4 shadow-sm", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

function CopyButton({
  label,
  text,
  className,
}: {
  label: string;
  text: string | null;
  className?: string;
}) {
  const handleCopy = async () => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium shadow-none", className)}
      onClick={() => void handleCopy()}
      disabled={!text}
    >
      <Copy className="size-3.5" />
      {label}
    </Button>
  );
}

function SuggestionsList({
  title,
  items,
  emptyText,
  copyLabel,
  showCopyButton,
}: {
  title: string;
  items: string[];
  emptyText: string;
  copyLabel: string;
  showCopyButton: boolean;
}) {
  return (
    <div className="space-y-3 rounded-[22px] border border-border/60 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        {showCopyButton ? <CopyButton label={copyLabel} text={items[0] ?? null} /> : null}
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-2 text-sm leading-6 text-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export default function G4ContentClaimCheckPage({ detail }: G4ContentClaimCheckPageProps) {
  const router = useRouter();
  const { authFetch } = useAuth();
  const latestOutcome = detail.latestOutcome;
  const status = latestOutcome?.result ?? detail.status;
  const statusLabel = formatG4ResultLabel(status);
  const statusTone = formatG4StatusTone(status);
  const statusAccentClass = getStatusAccentClass(status);
  const latestPrimaryAction = getLatestPrimaryAction(status);
  const actionPanelCopy = getActionPanelCopy(status);
  const recentRowAction = getRecentRowAction(status);
  const request = authFetch ?? fetch;
  const checkedAt = latestOutcome?.handledAt ?? detail.lastRunAt;
  const riskyRewriteWarning = isRiskyRewriteLanguage(detail.cleanAiOutput?.safeRewrite ?? null);
  const latestResultCopy = latestOutcome?.summary ?? "No content check has been recorded yet.";
  const initialDraft = buildInitialDraft(detail);

  const [fixPanelOpen, setFixPanelOpen] = useState(false);
  const [recheckDraft, setRecheckDraft] = useState(initialDraft);
  const [rechecking, setRechecking] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(detail.approvalRequest);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  useEffect(() => {
    setRecheckDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    setApprovalRequest(detail.approvalRequest);
  }, [detail.approvalRequest]);

  const approvalRecorded = Boolean(approvalRequest);
  const approvalQueued = approvalRequest?.status === "PENDING";
  const approvalActionDisabled = approvalSubmitting || approvalRecorded;
  const approvalButtonLabel = approvalQueued ? "Approval queued" : approvalRecorded ? "Approval recorded" : "Send to approval";
  const approvalHelperText = approvalRequest
    ? approvalRequest.status === "PENDING"
      ? `Approval queued as ${approvalRequest.approvalId}.`
      : `Approval record ${approvalRequest.status.toLowerCase().replace(/_/g, " ")} as ${approvalRequest.approvalId}.`
    : "Queue this content for human approval.";

  const handleApprovalRequest = async () => {
    if (approvalActionDisabled) {
      return;
    }

    setApprovalSubmitting(true);
    try {
      const response = await request("/api/admin/workflow-dashboard/g4/send-approval", {
        method: "POST",
        cache: "no-store",
      });

      const body = await parseJsonResponse<G4ApprovalRequestResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to queue approval (${response.status}).`);
      }

      if (body.approvalRequest) {
        setApprovalRequest(body.approvalRequest);
      }

      toast.success(body.message || "Approval request queued.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to queue approval.";
      toast.error(message);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (latestPrimaryAction.disabled) {
      return;
    }

    if (latestPrimaryAction.action === "fix") {
      setFixPanelOpen(true);
      return;
    }

    if (latestPrimaryAction.action === "approval") {
      void handleApprovalRequest();
      return;
    }

    if (latestPrimaryAction.action === "view") {
      document.getElementById("recent-checks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePanelAction = () => {
    if (actionPanelCopy.disabled) {
      return;
    }

    if (actionPanelCopy.buttonAction === "fix") {
      setFixPanelOpen(true);
      return;
    }

    if (actionPanelCopy.buttonAction === "approval") {
      void handleApprovalRequest();
      return;
    }

    if (actionPanelCopy.buttonAction === "view") {
      document.getElementById("recent-checks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRowAction = (action: ActionConfig["action"]) => {
    if (action === "fix") {
      setFixPanelOpen(true);
      return;
    }

    if (action === "approval") {
      void handleApprovalRequest();
      return;
    }

    if (action === "view") {
      document.getElementById("latest-content-check")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRecheck = async () => {
    const draft = recheckDraft.trim();
    if (!draft) {
      toast.error("Add content before re-checking.");
      return;
    }

    setRechecking(true);
    try {
      const response = await request("/api/admin/workflow-dashboard/g4/recheck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRecheckPayload(detail, draft)),
        cache: "no-store",
      });

      const body = await parseJsonResponse<G4RecheckResponse>(response);
      if (!response.ok || !body) {
        throw new Error(body?.message ?? `Unable to re-check content (${response.status}).`);
      }

      toast.success(body.message || "Content sent for re-check.");
      setFixPanelOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to re-check content.";
      toast.error(message);
    } finally {
      setRechecking(false);
    }
  };

  const headerBadges = (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTone)}>
        {statusLabel}
      </Badge>
      {latestOutcome?.assetId ? (
        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          Asset · {latestOutcome.assetId}
        </Badge>
      ) : null}
      {checkedAt ? (
        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          Checked · {formatRelativeTime(checkedAt)}
        </Badge>
      ) : null}
    </>
  );

  return (
    <>
      <WorkflowDashboardShell eyebrow="Workflow" title={detail.title} description={detail.purpose} badges={headerBadges}>
        {detail.status === "ERROR" ? (
          <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
            <CardContent className="p-5 text-sm leading-6 text-rose-900">{detail.actionNeeded}</CardContent>
          </Card>
        ) : null}

        <Card id="latest-content-check" className="overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm">
          <CardHeader className="space-y-3">
            <div className={cn("h-1.5 w-full rounded-full", statusAccentClass)} />
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary">Latest Content Check</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  The latest content review result and the exact asset it checked.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTone)}>
                  {statusLabel}
                </Badge>
                {latestOutcome?.reviewId ? (
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Review · {latestOutcome.reviewId}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestOutcome ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <FieldBlock
                    label="Status"
                    value={
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", statusTone)}>
                        {statusLabel}
                      </Badge>
                    }
                  />
                  <FieldBlock label="Asset ID" value={<span className="font-mono text-sm">{latestOutcome.assetId ?? "Not available"}</span>} />
                  <FieldBlock label="Platform" value={latestOutcome.platform ?? "Not available"} />
                  <FieldBlock
                    label="Checked time"
                    value={
                      checkedAt ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{formatDateTime(checkedAt)}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(checkedAt)}</p>
                        </div>
                      ) : (
                        "Not available"
                      )
                    }
                  />
                  <FieldBlock label="Review ID" value={<span className="font-mono text-sm">{latestOutcome.reviewId ?? "Not available"}</span>} />
                </div>

                <div className="rounded-[24px] border border-border/60 bg-muted/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">One-line result</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{latestResultCopy}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {latestPrimaryAction.action === "approval" ? (
                    <Button
                      type="button"
                      className="h-10 rounded-full px-5"
                      variant={approvalRecorded ? "outline" : "default"}
                      disabled={approvalActionDisabled}
                      onClick={() => void handleApprovalRequest()}
                    >
                      {approvalSubmitting ? "Queueing approval..." : approvalButtonLabel}
                    </Button>
                  ) : latestPrimaryAction.disabled ? (
                    <Button
                      type="button"
                      className="h-10 rounded-full px-5"
                      variant={status === "PENDING_APPROVAL" ? "default" : "outline"}
                      disabled
                    >
                      {latestPrimaryAction.label}
                    </Button>
                  ) : latestPrimaryAction.action === "fix" ? (
                    <Button type="button" className="h-10 rounded-full px-5" onClick={() => setFixPanelOpen(true)}>
                      {latestPrimaryAction.label}
                    </Button>
                  ) : latestPrimaryAction.action === "view" ? (
                    <Button type="button" variant="outline" className="h-10 rounded-full border-border/70 px-5" onClick={handlePrimaryAction}>
                      {latestPrimaryAction.label}
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button type="button" className="h-10 rounded-full px-5" disabled>
                      {latestPrimaryAction.label}
                    </Button>
                  )}

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" className="group h-10 rounded-full border-border/70 bg-white px-5">
                        View AI notes
                        <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="rounded-[24px] border border-border/60 bg-muted/15 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">AI is advisory only</p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          Human approval is still required before publishing or ad use.
                        </p>
                      </div>

                      {detail.cleanAiOutput ? (
                        <>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-3 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Risk summary</p>
                                <p className="text-sm leading-6 text-foreground">{detail.cleanAiOutput.riskSummary ?? "No risk summary provided."}</p>
                              </div>
                              <Separator className="bg-border/70" />
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safe rewrite</p>
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                                  {detail.cleanAiOutput.safeRewrite ?? "No safe rewrite provided."}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human review recommendation</p>
                                <p className="text-sm leading-6 text-foreground">
                                  {detail.cleanAiOutput.humanReviewRecommendation ?? "No human review recommendation provided."}
                                </p>
                              </div>
                              <Separator className="bg-border/70" />
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claim notes</p>
                                {detail.cleanAiOutput.claimNotes.length ? (
                                  <ul className="space-y-2">
                                    {detail.cleanAiOutput.claimNotes.map((note, index) => (
                                      <li key={`${note}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-2 text-sm leading-6 text-foreground">
                                        {note}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm leading-6 text-muted-foreground">No claim notes provided.</p>
                                )}
                              </div>
                            </div>
                          </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <SuggestionsList
                            title="Caption suggestions"
                            items={detail.cleanAiOutput.captionSuggestions}
                            emptyText="No caption suggestions provided."
                            copyLabel="Copy caption suggestion"
                            showCopyButton={detail.cleanAiOutput.captionSuggestions.length > 0}
                          />
                          <SuggestionsList
                            title="Hook suggestions"
                            items={detail.cleanAiOutput.hookSuggestions}
                            emptyText="No hook suggestions provided."
                            copyLabel="Copy hook"
                            showCopyButton={detail.cleanAiOutput.hookSuggestions.length > 0}
                          />
                        </div>
                        </>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">
                          No AI notes are available for this check.
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                {latestPrimaryAction.action === "approval" ? (
                  <p className="text-xs leading-5 text-muted-foreground">{approvalHelperText}</p>
                ) : latestPrimaryAction.helper ? (
                  <p className="text-xs leading-5 text-muted-foreground">{latestPrimaryAction.helper}</p>
                ) : null}
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/10 p-5">
                <p className="text-sm font-semibold text-foreground">No content checks yet.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Check content to see the latest result.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm">
          <CardHeader className="space-y-2">
            <div className={cn("h-1.5 w-full rounded-full", statusAccentClass)} />
            <CardTitle className="font-serif text-2xl tracking-tight text-primary">Content Being Reviewed</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              The exact content and landing-page text that G4 checked.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FieldBlock label="Headline" value={detail.contentPreview.headline ?? "Not available"} />
            <FieldBlock label="Caption / Content" value={detail.contentPreview.contentText ?? "Not available"} className="md:col-span-2" />
            <FieldBlock label="CTA" value={detail.contentPreview.ctaText ?? "Not available"} />
            <FieldBlock label="Product" value={detail.contentPreview.productName ?? "Not available"} />
            <FieldBlock
              label="Landing page"
              value={
                detail.contentPreview.landingPageUrl ? (
                  <a
                    href={detail.contentPreview.landingPageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary underline decoration-primary/40 underline-offset-4"
                  >
                    {detail.contentPreview.landingPageUrl}
                  </a>
                ) : (
                  "Not available"
                )
              }
              className="md:col-span-2"
            />
            <FieldBlock label="Landing page text checked" value={detail.contentPreview.pageText ?? "Not available"} className="md:col-span-2" />
          </CardContent>
        </Card>

        <Card className={cn("overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm", getActionToneClass(status))}>
          <CardHeader className="space-y-2">
            <div className={cn("h-1.5 w-full rounded-full", statusAccentClass)} />
            <CardTitle className="font-serif text-2xl tracking-tight">What Needs to Happen</CardTitle>
            <CardDescription className="text-sm leading-6">
              {actionPanelCopy.body}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">Next step</p>
              <p className="text-sm leading-6">{actionPanelCopy.title}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {actionPanelCopy.buttonAction === "approval" ? (
                <>
                  <Button
                    type="button"
                    className="h-10 rounded-full px-5"
                    variant={approvalRecorded ? "outline" : "default"}
                    disabled={approvalActionDisabled}
                    onClick={() => void handleApprovalRequest()}
                  >
                    {approvalSubmitting ? "Queueing approval..." : approvalButtonLabel}
                  </Button>
                  <p className="text-xs leading-5 text-muted-foreground">{approvalHelperText}</p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="h-10 rounded-full px-5"
                    variant={actionPanelCopy.disabled ? "outline" : "default"}
                    disabled={actionPanelCopy.disabled}
                    onClick={handlePanelAction}
                  >
                    {actionPanelCopy.buttonLabel}
                    {!actionPanelCopy.disabled && actionPanelCopy.buttonAction === "view" ? <ArrowRight className="size-4" /> : null}
                  </Button>
                  {actionPanelCopy.helper ? <p className="text-xs leading-5 text-muted-foreground">{actionPanelCopy.helper}</p> : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card id="recent-checks" className="overflow-hidden rounded-[28px] border-border/60 bg-white/95 shadow-sm">
          <CardHeader className="space-y-2">
            <div className={cn("h-1.5 w-full rounded-full", statusAccentClass)} />
            <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent Checks</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Compact history of the latest G4 checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Time</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asset</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Content summary</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentOutcomes.length ? (
                    detail.recentOutcomes.map((row) => {
                      const isLatestRow = row.reviewId === latestOutcome?.reviewId || (!row.reviewId && row.assetId === latestOutcome?.assetId);
                      const rowAction =
                        row.result === "PENDING_APPROVAL" && !isLatestRow
                          ? { label: "View", disabled: false, helper: null, action: "view" as const }
                          : getRecentRowAction(row.result);
                      const rowApprovalQueued = approvalQueued && isLatestRow;

                      return (
                        <tr key={`${row.time}-${row.reviewId ?? row.assetId ?? row.platform ?? "g4"}`} className="border-b border-border/50 last:border-b-0">
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{formatDateTime(row.time)}</p>
                              <p className="text-xs text-muted-foreground">{formatRelativeTime(row.time)}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1">
                              <p className="font-mono text-sm text-foreground">{row.assetId ?? "Not available"}</p>
                              <p className="text-xs text-muted-foreground">{row.reviewId ? `Review ${row.reviewId}` : "Review ID not available"}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", formatG4StatusTone(row.result))}>
                              {formatG4ResultLabel(row.result)}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="max-w-[28rem] text-sm leading-6 text-foreground">{row.whatHappened}</p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-2">
                              <p className="text-sm leading-6 text-foreground">{row.actionNeeded}</p>
                              {rowAction.action === "approval" ? (
                                <div className="space-y-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 rounded-full px-3 text-[11px] font-medium"
                                    variant={rowApprovalQueued ? "outline" : "default"}
                                    disabled={rowApprovalQueued || approvalActionDisabled}
                                    onClick={() => void handleApprovalRequest()}
                                  >
                                    {approvalSubmitting && isLatestRow ? "Queueing..." : rowApprovalQueued ? "Queued" : rowAction.label}
                                  </Button>
                                  <p className="text-xs leading-5 text-muted-foreground">
                                    {rowApprovalQueued ? approvalHelperText : "Queue this content for human approval."}
                                  </p>
                                </div>
                              ) : rowAction.disabled ? (
                                <div className="space-y-1">
                                  <Button type="button" size="sm" className="h-8 rounded-full px-3 text-[11px] font-medium" disabled>
                                    {rowAction.label}
                                  </Button>
                                  <p className="text-xs leading-5 text-muted-foreground">{rowAction.helper}</p>
                                </div>
                              ) : rowAction.action === "fix" ? (
                                <Button type="button" size="sm" className="h-8 rounded-full px-3 text-[11px] font-medium" onClick={() => setFixPanelOpen(true)}>
                                  {rowAction.label}
                                </Button>
                              ) : (
                                <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-border/70 px-3 text-[11px] font-medium" onClick={() => handleRowAction(rowAction.action)}>
                                  {rowAction.label}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm leading-6 text-muted-foreground">
                        No recent checks yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </WorkflowDashboardShell>

      <Sheet open={fixPanelOpen} onOpenChange={setFixPanelOpen}>
        <SheetContent side="right" className="w-full max-w-none p-0 sm:max-w-[min(96vw,80rem)]">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/60 bg-muted/20 px-5 py-5">
              <SheetTitle className="font-serif text-2xl tracking-tight text-primary">Fix content</SheetTitle>
              <SheetDescription className="text-sm leading-6 text-muted-foreground">
                Review the original content on the left, then edit the safer version and re-check it through G4 only.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <CardTitle className="font-serif text-xl tracking-tight text-primary">Original content</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      This is the content that was checked by G4.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <FieldBlock label="Headline" value={detail.contentPreview.headline ?? "Not available"} />
                    <FieldBlock label="Caption / Content" value={detail.contentPreview.contentText ?? "Not available"} />
                    <FieldBlock label="CTA" value={detail.contentPreview.ctaText ?? "Not available"} />
                    <FieldBlock label="Landing page text" value={detail.contentPreview.pageText ?? "Not available"} />
                    <FieldBlock label="Product" value={detail.contentPreview.productName ?? "Not available"} />
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="font-serif text-xl tracking-tight text-primary">Suggested safer version</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">
                          Use this as the starting point for a safer rewrite.
                        </CardDescription>
                      </div>
                      <CopyButton label="Copy rewrite" text={detail.cleanAiOutput?.safeRewrite ?? null} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-[24px] border border-border/60 bg-muted/15 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Safe rewrite</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                        {detail.cleanAiOutput?.safeRewrite ?? "No safe rewrite provided."}
                      </p>
                    </div>

                    {riskyRewriteWarning ? (
                      <div className="flex gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                        <p className="text-sm leading-6 text-amber-950">
                          This rewrite may still contain result-style language. Review carefully before using.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-2 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Edit before re-check</p>
                      <Textarea
                        value={recheckDraft}
                        onChange={(event) => setRecheckDraft(event.target.value)}
                        rows={8}
                        className="mt-2 min-h-[220px] rounded-[20px] border-border/70 bg-muted/10 text-sm leading-6"
                        placeholder="Edit the safer content here"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SuggestionsList
                        title="Caption suggestions"
                        items={detail.cleanAiOutput?.captionSuggestions ?? []}
                        emptyText="No caption suggestions provided."
                        copyLabel="Copy caption suggestion"
                        showCopyButton={Boolean(detail.cleanAiOutput?.captionSuggestions.length)}
                      />
                      <SuggestionsList
                        title="Hook suggestions"
                        items={detail.cleanAiOutput?.hookSuggestions ?? []}
                        emptyText="No hook suggestions provided."
                        copyLabel="Copy hook"
                        showCopyButton={Boolean(detail.cleanAiOutput?.hookSuggestions.length)}
                      />
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claim notes</p>
                        <CopyButton
                          label="Copy claim note"
                          text={detail.cleanAiOutput?.claimNotes.length ? detail.cleanAiOutput.claimNotes.join("\n") : null}
                        />
                      </div>
                      {detail.cleanAiOutput?.claimNotes.length ? (
                        <ul className="space-y-2">
                          {detail.cleanAiOutput.claimNotes.map((note, index) => (
                            <li key={`${note}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-2 text-sm leading-6 text-foreground">
                              {note}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">No claim notes provided.</p>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-border/60 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human review recommendation</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {detail.cleanAiOutput?.humanReviewRecommendation ?? "No human review recommendation provided."}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        AI suggestions are advisory only. Re-checked content still needs rules and human approval.
                      </p>
                      <Button
                        type="button"
                        className="h-10 rounded-full px-5"
                        onClick={() => void handleRecheck()}
                        disabled={rechecking || !recheckDraft.trim()}
                      >
                        <RefreshCcw className={cn("size-4", rechecking && "animate-spin")} />
                        Re-check content
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}





