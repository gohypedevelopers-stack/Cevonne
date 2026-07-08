import type { WorkflowDetailView, WorkflowUiStatus } from "@/lib/admin/workflows";

export const G7_WORKFLOW_TITLE = "G7 - Inventory + Offer Safety";
export const G7_WORKFLOW_PURPOSE = "Verifies inventory, discount expiry, offer URLs, and urgency claims.";
export const G7_EMPTY_STATE_COPY =
  "No proof checks have been run yet. Click Check Proof to verify a stock, discount, or urgency claim.";

export type G7StockStatus = "In stock" | "Low stock" | "Out of stock" | "Needs proof" | "Unknown";
export type G7DiscountStatus = "Active" | "Expired" | "Scheduled" | "Inactive" | "Needs proof" | "Unknown";

export type G7OfferProofSubmission = {
  product_or_sku: string;
  offer_code: string;
  offer_url: string;
  urgency_claim_text: string;
  actor: string;
  requested_by?: string | null;
};

export type G7OfferProofRecord = {
  time: string | null;
  result: WorkflowUiStatus;
  productId: string | null;
  sku: string | null;
  productOrSku: string;
  stockStatus: G7StockStatus;
  discountCode: string | null;
  discountStatus: G7DiscountStatus;
  expiryDate: string | null;
  offerUrl: string | null;
  urgencyClaimText: string | null;
  whatWasChecked: string;
  whatHappened: string;
  actionNeeded: string;
  whyItBlocked: string | null;
  actor: string | null;
  sourceLabel: string | null;
  checkedAt: string | null;
};

export type G7WorkflowDetail = {
  workflowGroup: "G7";
  title: string;
  purpose: string;
  status: WorkflowUiStatus | "EMPTY";
  lastRunAt: string | null;
  latestProof: G7OfferProofRecord | null;
  recentChecks: G7OfferProofRecord[];
  emptyStateCopy: string;
  mainActionNeeded: string;
  message: string;
  workflow: WorkflowDetailView;
};

export const getG7StockStatusToneClass = (status: G7StockStatus) => {
  switch (status) {
    case "In stock":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "Low stock":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "Out of stock":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "Needs proof":
      return "border-sky-200 bg-sky-100 text-sky-800";
    case "Unknown":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

export const getG7DiscountStatusToneClass = (status: G7DiscountStatus) => {
  switch (status) {
    case "Active":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "Expired":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "Scheduled":
      return "border-sky-200 bg-sky-100 text-sky-800";
    case "Inactive":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "Needs proof":
      return "border-violet-200 bg-violet-100 text-violet-800";
    case "Unknown":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};
