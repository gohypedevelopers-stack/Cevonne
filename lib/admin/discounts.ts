import { z } from "zod";

export const DISCOUNT_STATUS_VALUES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"] as const;
export const DISCOUNT_TYPE_VALUES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] as const;
export const DISCOUNT_APPLIES_TO_VALUES = ["ALL_PRODUCTS", "SPECIFIC_PRODUCT", "SPECIFIC_SKU", "SPECIFIC_COLLECTION"] as const;
export const DISCOUNT_PROOF_STATUS_VALUES = ["NOT_CHECKED", "VERIFIED", "NEEDS_EVIDENCE", "BLOCKED", "EXPIRED"] as const;

export type DiscountStatus = (typeof DISCOUNT_STATUS_VALUES)[number];
export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number];
export type DiscountAppliesToType = (typeof DISCOUNT_APPLIES_TO_VALUES)[number];
export type DiscountProofStatus = (typeof DISCOUNT_PROOF_STATUS_VALUES)[number];

export type DiscountSummary = {
  total: number;
  draft: number;
  scheduled: number;
  active: number;
  paused: number;
  expired: number;
  archived: number;
  needsProof: number;
};

export type AdminDiscountRecord = {
  discountId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number | null;
  appliesToType: DiscountAppliesToType;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  sku: string | null;
  collectionId: string | null;
  collectionName: string | null;
  collectionSlug: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: DiscountStatus;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  minimumOrderValue: number | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  proofStatus: DiscountProofStatus;
  proofMessage: string | null;
  proofCheckedAt: string | null;
};

export type DiscountFormValues = {
  code: string;
  discountType: DiscountType;
  discountValue: string;
  appliesToType: DiscountAppliesToType;
  productId: string;
  sku: string;
  collectionId: string;
  startsAt: string;
  endsAt: string;
  status: DiscountStatus;
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  minimumOrderValue: string;
  notes: string;
};

export type DiscountProofStatusDetail = {
  status: DiscountProofStatus;
  message: string;
  checkedAt: string | null;
};

export const DISCOUNT_URGENCY_PATTERN = /\b(today only|ends?\s+soon|limited time|last chance|hurry|offer ends|ending soon|expires soon|while supplies last)\b/i;
export const DISCOUNT_LOW_STOCK_PATTERN = /\b(low stock|limited stock|few left|running low|almost gone|nearly sold out)\b/i;

export const discountFormDefaults: DiscountFormValues = {
  code: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  appliesToType: "ALL_PRODUCTS",
  productId: "",
  sku: "",
  collectionId: "",
  startsAt: "",
  endsAt: "",
  status: "DRAFT",
  usageLimitTotal: "",
  usageLimitPerCustomer: "",
  minimumOrderValue: "",
  notes: "",
};

export const discountFormSchema = z
  .object({
    code: z.string().trim().min(1, "Discount code is required."),
    discountType: z.enum(DISCOUNT_TYPE_VALUES, {
      message: "Discount type is required.",
    }),
    discountValue: z.string().trim().optional().default(""),
    appliesToType: z.enum(DISCOUNT_APPLIES_TO_VALUES, {
      message: "Applies to is required.",
    }),
    productId: z.string().trim().optional().default(""),
    sku: z.string().trim().optional().default(""),
    collectionId: z.string().trim().optional().default(""),
    startsAt: z.string().trim().optional().default(""),
    endsAt: z.string().trim().optional().default(""),
    status: z.enum(DISCOUNT_STATUS_VALUES, {
      message: "Status is required.",
    }),
    usageLimitTotal: z.string().trim().optional().default(""),
    usageLimitPerCustomer: z.string().trim().optional().default(""),
    minimumOrderValue: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.discountType !== "FREE_SHIPPING") {
      if (!data.discountValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountValue"],
          message: "Discount value is required unless the discount is free shipping.",
        });
      } else if (!Number.isFinite(Number(data.discountValue)) || Number(data.discountValue) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountValue"],
          message: "Discount value must be greater than 0.",
        });
      }
    }

    if (data.startsAt && data.endsAt) {
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt <= startsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "End date must be after start date.",
        });
      }
    }

    const isActiveState = data.status === "ACTIVE" || data.status === "SCHEDULED";
    if (isActiveState && data.appliesToType !== "ALL_PRODUCTS") {
      const targetField =
        data.appliesToType === "SPECIFIC_PRODUCT"
          ? "productId"
          : data.appliesToType === "SPECIFIC_SKU"
            ? "sku"
            : "collectionId";
      const targetValue = data[targetField];
      if (!targetValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [targetField],
          message:
            data.appliesToType === "SPECIFIC_PRODUCT"
              ? "Choose a product before activating this discount."
              : data.appliesToType === "SPECIFIC_SKU"
                ? "Enter a SKU before activating this discount."
                : "Choose a collection before activating this discount.",
        });
      }
    }

    if (isActiveState && data.startsAt) {
      const startsAt = new Date(data.startsAt);
      if (!Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now() && data.status === "ACTIVE") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startsAt"],
          message: "Discount has not started yet. Use Scheduled until the start date.",
        });
      }
    }

    if (isActiveState && data.notes && DISCOUNT_URGENCY_PATTERN.test(data.notes) && !data.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Add an end date before using urgency wording.",
      });
    }
  });

export type DiscountMutationInput = z.infer<typeof discountFormSchema>;

export const discountActionValues = ["PAUSE", "ACTIVATE", "EXPIRE", "ARCHIVE", "RESTORE"] as const;
export type DiscountAction = (typeof discountActionValues)[number];

export const discountActionSchema = z.object({
  action: z.enum(discountActionValues),
});

export const discountProofRequestSchema = z.object({
  sku: z.string().trim().optional().default(""),
  urgencyClaim: z.string().trim().optional().default(""),
});

const discountStatusLabels: Record<DiscountStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  PAUSED: "Paused",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};

const discountTypeLabels: Record<DiscountType, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
  FREE_SHIPPING: "Free shipping",
};

const discountAppliesToLabels: Record<DiscountAppliesToType, string> = {
  ALL_PRODUCTS: "All products",
  SPECIFIC_PRODUCT: "Specific product",
  SPECIFIC_SKU: "Specific SKU",
  SPECIFIC_COLLECTION: "Specific collection",
};

const discountProofStatusLabels: Record<DiscountProofStatus, string> = {
  NOT_CHECKED: "Not checked",
  VERIFIED: "Verified",
  NEEDS_EVIDENCE: "Needs evidence",
  BLOCKED: "Blocked",
  EXPIRED: "Expired",
};

const discountProofStatusToneClasses: Record<DiscountProofStatus, string> = {
  NOT_CHECKED: "border-border/70 bg-muted/30 text-muted-foreground",
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NEEDS_EVIDENCE: "border-amber-200 bg-amber-50 text-amber-700",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
};

const discountStatusToneClasses: Record<DiscountStatus, string> = {
  DRAFT: "border-border/70 bg-muted/30 text-muted-foreground",
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-700",
};

export const numberFormatter = new Intl.NumberFormat("en-IN");
export const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
export const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const getDiscountStatusLabel = (value: DiscountStatus) => discountStatusLabels[value];
export const getDiscountTypeLabel = (value: DiscountType) => discountTypeLabels[value];
export const getDiscountAppliesToLabel = (value: DiscountAppliesToType) => discountAppliesToLabels[value];
export const getDiscountProofStatusLabel = (value: DiscountProofStatus) => discountProofStatusLabels[value];
export const getDiscountStatusToneClass = (value: DiscountStatus) => discountStatusToneClasses[value];
export const getDiscountProofStatusToneClass = (value: DiscountProofStatus) => discountProofStatusToneClasses[value];

export const formatDiscountValue = (value: number | null | undefined, type: DiscountType) => {
  if (type === "FREE_SHIPPING") {
    return "Free shipping";
  }

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  if (type === "PERCENTAGE") {
    return `${numberFormatter.format(Number(value))}%`;
  }

  return currencyFormatter.format(Number(value));
};

export const formatDiscountUsage = (usedCount: number, usageLimitTotal: number | null | undefined) => {
  if (usageLimitTotal === null || usageLimitTotal === undefined) {
    return `${numberFormatter.format(usedCount)} used`;
  }

  return `${numberFormatter.format(usedCount)} / ${numberFormatter.format(usageLimitTotal)} used`;
};

export const formatDiscountDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateTimeFormatter.format(date);
};

export const formatDiscountDateTimeInputValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const formatDiscountProofMessage = (status: DiscountProofStatus) => {
  switch (status) {
    case "VERIFIED":
      return "Discount is active and safe to use.";
    case "NEEDS_EVIDENCE":
      return "Run offer proof before using this discount in content or ads.";
    case "BLOCKED":
      return "Discount cannot be used yet.";
    case "EXPIRED":
      return "Discount has expired.";
    case "NOT_CHECKED":
    default:
      return "Run offer proof before using this discount in content or ads.";
  }
};

export const buildDiscountAppliesToLabel = (discount: {
  appliesToType: DiscountAppliesToType;
  productName?: string | null;
  sku?: string | null;
  collectionName?: string | null;
}) => {
  switch (discount.appliesToType) {
    case "SPECIFIC_PRODUCT":
      return discount.productName ? `Product: ${discount.productName}` : "Specific product";
    case "SPECIFIC_SKU":
      return discount.sku ? `SKU: ${discount.sku}` : "Specific SKU";
    case "SPECIFIC_COLLECTION":
      return discount.collectionName ? `Collection: ${discount.collectionName}` : "Specific collection";
    case "ALL_PRODUCTS":
    default:
      return "All products";
  }
};

export const parseOptionalNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalized = text.replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeDiscountStatus = (value: string | null | undefined): DiscountStatus => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if ((DISCOUNT_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DiscountStatus;
  }

  return "DRAFT";
};

export const normalizeDiscountType = (value: string | null | undefined): DiscountType => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if ((DISCOUNT_TYPE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DiscountType;
  }

  return "PERCENTAGE";
};

export const normalizeDiscountAppliesToType = (value: string | null | undefined): DiscountAppliesToType => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if ((DISCOUNT_APPLIES_TO_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DiscountAppliesToType;
  }

  return "ALL_PRODUCTS";
};

export const normalizeDiscountProofStatus = (value: string | null | undefined): DiscountProofStatus => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if ((DISCOUNT_PROOF_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DiscountProofStatus;
  }

  return "NOT_CHECKED";
};

export const trimOrNull = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};
