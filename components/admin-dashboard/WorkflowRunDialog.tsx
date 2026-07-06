"use client";

import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getWorkflowCatalogEntry,
  getG11RecommendationTypeConfig,
  getG11ReviewAreaConfig,
  type AdminWorkflowId,
  type WorkflowDetailView,
  type WorkflowPrimaryActionConfig,
  type WorkflowRunField,
  type WorkflowRunValues,
} from "@/lib/admin/workflows";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WorkflowDashboardRunResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "PENDING_APPROVAL" | "DRY_RUN" | "RECOMMENDATION_ONLY" | "DO_NOT_SCALE" | "FIX_FIRST" | "NEEDS_EVIDENCE" | "NOT_RUN_YET" | "ERROR";
  message: string;
  response_type: string | null;
  handled_at: string;
  outcome: {
    time: string | null;
    result:
      | "PASS"
      | "BLOCK"
      | "MANUAL_ONLY"
      | "PENDING_APPROVAL"
      | "DRY_RUN"
      | "RECOMMENDATION_ONLY"
      | "DO_NOT_SCALE"
      | "FIX_FIRST"
      | "NEEDS_EVIDENCE"
      | "NOT_RUN_YET"
      | "ERROR";
    whatWasChecked: string;
    whatHappened: string;
    actionNeeded: string;
    whyItBlocked: string | null;
    sourceLabel: string | null;
  };
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

type WorkflowRunDialogProps = {
  workflow: WorkflowDetailView;
  primaryAction: WorkflowPrimaryActionConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => Promise<WorkflowDashboardRunResponse>;
  onSuccess: (response: WorkflowDashboardRunResponse) => void;
};

type FieldState = Record<string, string | boolean>;

const buildDefaultFieldValues = (fields: WorkflowRunField[]): FieldState =>
  fields.reduce<FieldState>((accumulator, field) => {
    if (field.defaultValue !== undefined) {
      accumulator[field.key] = field.defaultValue;
      return accumulator;
    }

    if (field.type === "switch") {
      accumulator[field.key] = false;
      return accumulator;
    }

    if (field.type === "select" && field.options?.length) {
      accumulator[field.key] = field.options[0]?.value ?? "";
      return accumulator;
    }

    accumulator[field.key] = "";
    return accumulator;
  }, {});

const toWorkflowValues = (values: FieldState, fields: WorkflowRunField[]) =>
  fields.reduce<WorkflowRunValues>((accumulator, field) => {
    const value = values[field.key];

    if (typeof value === "boolean") {
      accumulator[field.key] = value;
      return accumulator;
    }

    const text = String(value ?? "").trim();
    if (text || field.required) {
      accumulator[field.key] = text;
    }

    return accumulator;
  }, {});

const buildG11SubmissionPayload = (values: FieldState) => {
  const reviewArea = getG11ReviewAreaConfig(typeof values.focus_area === "string" ? values.focus_area : null);
  const recommendationType = getG11RecommendationTypeConfig(typeof values.recommendation_type === "string" ? values.recommendation_type : null);
  const note = typeof values.note === "string" && values.note.trim() ? values.note.trim() : null;

  if (recommendationType?.usesWeeklyDigest) {
    return {
      actor: "website_admin",
      target_workflow_group: "ALL",
      platform: "ALL",
      input_summary: { note },
    };
  }

  return {
    actor: "website_admin",
    target_workflow_group: reviewArea?.targetWorkflowGroup ?? "ALL",
    platform: reviewArea?.platform ?? "ALL",
    requested_decision: recommendationType?.requestedDecision ?? "INVESTIGATE",
    focus_area: reviewArea?.label ?? "Overall business summary",
    input_summary: { note },
  };
};

const visibleFields = (fields: WorkflowRunField[], values: FieldState) =>
  fields.filter((field) => !field.visibleWhen || field.visibleWhen(values as WorkflowRunValues));

export default function WorkflowRunDialog({
  workflow,
  primaryAction,
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
}: WorkflowRunDialogProps) {
  const catalogEntry = getWorkflowCatalogEntry(workflow.workflowId);
  const g11ErrorToastId = "g11-generate-error";
  const g11ModalSessionRef = useRef(0);
  const hiddenFieldKeySignature = primaryAction.hiddenFieldKeys.join("|");
  const runFields = useMemo(
    () => {
      const hiddenFieldKeys = hiddenFieldKeySignature ? hiddenFieldKeySignature.split("|") : [];
      return (catalogEntry?.runFields ?? []).filter((field) => !hiddenFieldKeys.includes(field.key));
    },
    [catalogEntry, hiddenFieldKeySignature],
  );

  const [values, setValues] = useState<FieldState>(() => buildDefaultFieldValues(runFields));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isG11RecommendationFlow = workflow.workflowId === "G11" && primaryAction.kind === "generate_recommendation";

  const clearG11ErrorFeedback = () => {
    setError(null);
    toast.dismiss(g11ErrorToastId);
  };

  const resetG11GenerateStateOnOpen = () => {
    g11ModalSessionRef.current += 1;
    clearG11ErrorFeedback();
    setHasSubmitted(false);
    setSubmitting(false);
  };

  const resetG11GenerateStateOnClose = () => {
    g11ModalSessionRef.current += 1;
    setError(null);
    setHasSubmitted(false);
    setSubmitting(false);
    clearG11ErrorFeedback();
  };

  useLayoutEffect(() => {
    if (!open) {
      resetG11GenerateStateOnClose();
      return;
    }

    setValues(buildDefaultFieldValues(runFields));
    resetG11GenerateStateOnOpen();
  }, [open, runFields, workflow.workflowId]);

  const currentFields = visibleFields(runFields, values);
  const submittingLabel = isG11RecommendationFlow ? "Generating recommendation..." : "Working...";
  const dialogClassName = isG11RecommendationFlow
    ? "flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-w-2xl"
    : "flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-w-xl";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetG11GenerateStateOnClose();
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitSession = g11ModalSessionRef.current;
    console.log("G11 GENERATE BUTTON CLICKED");

    if (primaryAction.kind === "none" || primaryAction.kind === "open_checks" || primaryAction.kind === "refresh_status") {
      setError("This action does not accept submissions.");
      return;
    }

    const requiredField = currentFields.find((field) => {
      if (!field.required) {
        return false;
      }

      const value = values[field.key];
      if (typeof value === "boolean") {
        return false;
      }

      return !String(value ?? "").trim();
    });

    if (requiredField) {
      setHasSubmitted(true);
      setError(`${requiredField.label} is required.`);
      return;
    }

    setHasSubmitted(true);
    setSubmitting(true);
    clearG11ErrorFeedback();

    try {
      const payload = isG11RecommendationFlow ? buildG11SubmissionPayload(values) : toWorkflowValues(values, currentFields);

      if (isG11RecommendationFlow && process.env.NODE_ENV !== "production") {
        console.log("G11 FINAL PAYLOAD:", payload);
      }

      const response = await onSubmit(payload);
      if (g11ModalSessionRef.current !== submitSession) {
        return;
      }
      clearG11ErrorFeedback();
      setHasSubmitted(false);

      try {
        onSuccess(response);
      } catch (successError) {
        if (workflow.workflowId === "G11") {
          if (process.env.NODE_ENV !== "production") {
            console.error("G11 success handler failed:", successError);
          }

          clearG11ErrorFeedback();
          return;
        }

        throw successError;
      }
    } catch (submitError) {
      if (workflow.workflowId === "G11") {
        if (g11ModalSessionRef.current !== submitSession) {
          return;
        }

        const message = "G11 could not create a recommendation. Please try again.";
        setError(message);
        toast.error(message, { id: g11ErrorToastId });
      } else {
        const message = submitError instanceof Error ? submitError.message : "Unable to submit workflow action.";
        setError(message);
      }
    } finally {
      if (g11ModalSessionRef.current === submitSession) {
        setSubmitting(false);
      }
    }
  };

  const updateValue = (key: string, value: string | boolean) => {
    if (isG11RecommendationFlow) {
      clearG11ErrorFeedback();
      setHasSubmitted(false);
    }

    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className={dialogClassName}
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="border-b border-border/60 bg-muted/20 px-6 py-5">
            <DialogHeader className="items-start text-left">
              <DialogTitle className="font-serif text-2xl tracking-tight text-primary">
                {primaryAction.dialogTitle ?? `Run ${workflow.title}`}
              </DialogTitle>
              <DialogDescription className="max-w-prose text-sm leading-6 text-muted-foreground">
                {primaryAction.dialogDescription ??
                  "Use the smallest safe set of fields. The workflow keeps dry run on unless a live run is intentionally selected."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldSet className="gap-4">
              {currentFields.map((field) => {
                const id = `${workflow.workflowId}-${field.key}`;
                const value = values[field.key];
                if (field.type === "switch") {
                  return (
                    <FieldGroup key={field.key} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <FieldLabel htmlFor={id} className="text-sm font-semibold text-foreground">
                            {field.label}
                            {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                          </FieldLabel>
                          {field.helper ? <FieldDescription className="text-xs leading-5">{field.helper}</FieldDescription> : null}
                        </div>
                        <Switch
                          id={id}
                          checked={Boolean(value)}
                          onCheckedChange={(checked) => updateValue(field.key, checked)}
                        />
                      </div>
                    </FieldGroup>
                  );
                }

                if (field.type === "select") {
                  return (
                    <FieldGroup key={field.key} className="space-y-2 rounded-2xl border border-border/60 bg-white p-4">
                      <FieldLabel htmlFor={id} className="text-sm font-semibold text-foreground">
                        {field.label}
                        {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                      </FieldLabel>
                      <Select
                        value={String(value ?? "")}
                        onValueChange={(nextValue) => updateValue(field.key, nextValue)}
                      >
                        <SelectTrigger id={id} className="w-full rounded-xl border-border/60 bg-muted/20">
                          <SelectValue placeholder={field.placeholder || "Select an option"} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.helper ? <FieldDescription className="text-xs leading-5">{field.helper}</FieldDescription> : null}
                    </FieldGroup>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <FieldGroup key={field.key} className="space-y-2 rounded-2xl border border-border/60 bg-white p-4">
                      <FieldLabel htmlFor={id} className="text-sm font-semibold text-foreground">
                        {field.label}
                        {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                      </FieldLabel>
                      <Textarea
                        id={id}
                        rows={field.rows ?? 4}
                        placeholder={field.placeholder}
                        value={String(value ?? "")}
                        onChange={(event) => updateValue(field.key, event.target.value)}
                        className="min-h-[110px] rounded-xl border-border/60 bg-muted/20"
                      />
                      {field.helper ? <FieldDescription className="text-xs leading-5">{field.helper}</FieldDescription> : null}
                    </FieldGroup>
                  );
                }

                return (
                  <FieldGroup key={field.key} className="space-y-2 rounded-2xl border border-border/60 bg-white p-4">
                    <FieldLabel htmlFor={id} className="text-sm font-semibold text-foreground">
                      {field.label}
                      {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                    </FieldLabel>
                    <Input
                      id={id}
                      type={field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : "text"}
                      inputMode={field.inputMode}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      value={String(value ?? "")}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      className={cn("rounded-xl border-border/60 bg-muted/20", field.type === "number" && "tabular-nums")}
                    />
                    {field.helper ? <FieldDescription className="text-xs leading-5">{field.helper}</FieldDescription> : null}
                  </FieldGroup>
                );
              })}
            </FieldSet>

            {hasSubmitted && error ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-900">
                {error}
              </p>
            ) : null}

            {isG11RecommendationFlow && submitting ? (
              <p className="mt-4 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                This can take up to 1–2 minutes because G11 reviews data and uses AI.
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
            <Button type="button" variant="outline" className="rounded-full border-border/70" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={submitting || primaryAction.kind === "none" || primaryAction.kind === "open_checks" || primaryAction.kind === "refresh_status"}
            >
              {submitting ? submittingLabel : primaryAction.submitLabel ?? workflow.runLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
