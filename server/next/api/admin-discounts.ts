import "server-only";

import type { Prisma } from "@prisma/client";

import { buildG7OfferProofPayload } from "@/lib/admin/g7-dashboard-summary";
import {
  discountFormSchema,
  discountActionSchema,
  discountProofRequestSchema,
  type AdminDiscountRecord,
  type DiscountAction,
  type DiscountAppliesToType,
  type DiscountFormValues,
  type DiscountProofStatusDetail,
  type DiscountStatus,
  type DiscountSummary,
  type DiscountType,
  normalizeDiscountAppliesToType,
  normalizeDiscountStatus,
  normalizeDiscountType,
  parseOptionalNumber,
  trimOrNull,
} from "@/lib/admin/discounts";
import { loadG7OfferSourceRecordByCode, loadG7OfferSourceRecordByDiscountId } from "@/server/next/api/g7-offer-source";
import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config";
import { getPrisma } from "@/server/db/prismaClient";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const G7_OFFER_CHANGE_EVENT_URL = "https://n8n.cevonne.com/webhook/g7-offer-change-event";
const G7_OFFER_PROOF_URL = env.n8nG7OfferProofUrl || "https://n8n.cevonne.com/webhook/g7-offer-safety-check";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

type PrismaDiscountRow = Prisma.PromiseReturnType<
  typeof getDiscountRowById
>;

const discountInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  collection: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

const toIsoString = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeStatus = (value: unknown): DiscountStatus => normalizeDiscountStatus(typeof value === "string" ? value : null);
const normalizeType = (value: unknown): DiscountType => normalizeDiscountType(typeof value === "string" ? value : null);
const normalizeAppliesToType = (value: unknown): DiscountAppliesToType =>
  normalizeDiscountAppliesToType(typeof value === "string" ? value : null);

const normalizeText = (value: unknown) => trimOrNull(typeof value === "string" ? value : String(value ?? ""));

const parseIntValue = (value: string | number | null | undefined) => {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }

  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const defaultProofDetail = (): DiscountProofStatusDetail => ({
  status: "NOT_CHECKED",
  message: "Run offer proof before using this discount in content or ads.",
  checkedAt: null,
});

const isTargetMissing = (discount: {
  appliesToType: DiscountAppliesToType;
  productId: string | null;
  sku: string | null;
  collectionId: string | null;
}) => {
  if (discount.appliesToType === "ALL_PRODUCTS") {
    return false;
  }

  if (discount.appliesToType === "SPECIFIC_PRODUCT") {
    return !discount.productId;
  }

  if (discount.appliesToType === "SPECIFIC_SKU") {
    return !discount.sku;
  }

  return !discount.collectionId;
};

const deriveDiscountProofDetail = (
  discount: AdminDiscountRecord,
  source: Awaited<ReturnType<typeof loadG7OfferSourceRecordByDiscountId>> | null,
): DiscountProofStatusDetail => {
  const checkedAt = new Date().toISOString();
  const now = Date.now();

  if (discount.status === "ARCHIVED" || discount.archivedAt) {
    return {
      status: "EXPIRED",
      message: "Discount is archived.",
      checkedAt,
    };
  }

  if (discount.status === "EXPIRED" || (discount.endsAt && new Date(discount.endsAt).getTime() < now)) {
    return {
      status: "EXPIRED",
      message: "Discount has expired.",
      checkedAt,
    };
  }

  if (discount.status === "PAUSED") {
    return {
      status: "BLOCKED",
      message: "Discount is paused.",
      checkedAt,
    };
  }

  if (discount.status === "DRAFT") {
    return defaultProofDetail();
  }

  if (discount.status === "SCHEDULED" && discount.startsAt && new Date(discount.startsAt).getTime() > now) {
    return {
      status: "NOT_CHECKED",
      message: "Discount is scheduled for a future start date.",
      checkedAt,
    };
  }

  if (isTargetMissing(discount)) {
    return {
      status: "BLOCKED",
      message:
        discount.appliesToType === "SPECIFIC_PRODUCT"
          ? "Choose a product before activating this discount."
          : discount.appliesToType === "SPECIFIC_SKU"
            ? "Enter a SKU before activating this discount."
            : "Choose a collection before activating this discount.",
      checkedAt,
    };
  }

  if (!source) {
    return {
      status: "NEEDS_EVIDENCE",
      message: "Run offer proof before using this discount in content or ads.",
      checkedAt,
    };
  }

  if (discount.notes && /today only|ends?\s+soon|limited time|last chance|hurry|expires soon|ending soon|while supplies last/i.test(discount.notes) && !discount.endsAt) {
    return {
      status: "NEEDS_EVIDENCE",
      message: "Add an end date before using urgency wording.",
      checkedAt,
    };
  }

  if (
    discount.notes &&
    /low stock|limited stock|few left|running low|almost gone|nearly sold out/i.test(discount.notes) &&
    (!source?.secondStockEvidenceUrl || !source?.secondStockCheckedAt)
  ) {
    return {
      status: "NEEDS_EVIDENCE",
      message: "Add second stock proof before using low-stock wording.",
      checkedAt,
    };
  }

  return {
    status: "VERIFIED",
    message: "Discount is active and safe to use.",
    checkedAt,
  };
};

const serializeDiscount = (row: Record<string, unknown>): Omit<AdminDiscountRecord, "proofStatus" | "proofMessage" | "proofCheckedAt"> => {
  const product = (row.product as Record<string, unknown> | null | undefined) ?? null;
  const collection = (row.collection as Record<string, unknown> | null | undefined) ?? null;

  return {
    discountId: normalizeText(row.discount_id) ?? "",
    code: normalizeText(row.code) ?? "",
    discountType: normalizeType(row.discount_type),
    discountValue: toNumber(row.discount_value),
    appliesToType: normalizeAppliesToType(row.applies_to_type),
    productId: normalizeText(row.product_id),
    productName: normalizeText(product?.name),
    productSlug: normalizeText(product?.slug),
    sku: normalizeText(row.sku),
    collectionId: normalizeText(row.collection_id),
    collectionName: normalizeText(collection?.name),
    collectionSlug: normalizeText(collection?.slug),
    startsAt: toIsoString(row.starts_at),
    endsAt: toIsoString(row.ends_at),
    status: normalizeStatus(row.status),
    usageLimitTotal: toNumber(row.usage_limit_total),
    usageLimitPerCustomer: toNumber(row.usage_limit_per_customer),
    usedCount: Math.trunc(toNumber(row.used_count) ?? 0),
    minimumOrderValue: toNumber(row.minimum_order_value),
    notes: normalizeText(row.notes),
    createdBy: normalizeText(row.created_by),
    updatedBy: normalizeText(row.updated_by),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    archivedAt: toIsoString(row.archived_at),
  };
};

const hydrateDiscountRecord = async (row: Record<string, unknown>): Promise<AdminDiscountRecord> => {
  const base = serializeDiscount(row);
  const source = await loadG7OfferSourceRecordByDiscountId(base.discountId);
  const proof = deriveDiscountProofDetail(base as AdminDiscountRecord, source);

  return {
    ...base,
    proofStatus: proof.status,
    proofMessage: proof.message,
    proofCheckedAt: proof.checkedAt,
  };
};

const loadDiscountRows = async () => {
  const prisma = await getPrisma();
  const rows = await prisma.cevonne_discounts.findMany({
    orderBy: [{ created_at: "desc" }],
    include: discountInclude,
  });

  return Promise.all(rows.map((row) => hydrateDiscountRecord(row as unknown as Record<string, unknown>)));
};

async function getDiscountRowById(id: string) {
  const prisma = await getPrisma();
  const row = await prisma.cevonne_discounts.findUnique({
    where: { discount_id: id },
    include: discountInclude,
  });

  return row ? hydrateDiscountRecord(row as unknown as Record<string, unknown>) : null;
}

async function getDiscountRowByCode(code: string) {
  const prisma = await getPrisma();
  const row = await prisma.cevonne_discounts.findUnique({
    where: { code },
    include: discountInclude,
  });

  return row ? hydrateDiscountRecord(row as unknown as Record<string, unknown>) : null;
}

const buildSummary = (items: AdminDiscountRecord[]): DiscountSummary => {
  const now = Date.now();
  return {
    total: items.length,
    draft: items.filter((item) => item.status === "DRAFT").length,
    scheduled: items.filter((item) => item.status === "SCHEDULED").length,
    active: items.filter((item) => item.status === "ACTIVE").length,
    paused: items.filter((item) => item.status === "PAUSED").length,
    expired: items.filter((item) => item.status === "EXPIRED" || (item.endsAt ? new Date(item.endsAt).getTime() < now : false)).length,
    archived: items.filter((item) => item.status === "ARCHIVED").length,
    needsProof: items.filter(
      (item) =>
        item.status !== "ARCHIVED" &&
        item.status !== "EXPIRED" &&
        (item.proofStatus === "NOT_CHECKED" || item.proofStatus === "NEEDS_EVIDENCE" || item.proofStatus === "BLOCKED"),
    ).length,
  };
};

const buildListResponse = async () => {
  const items = await loadDiscountRows();
  return {
    items,
    summary: buildSummary(items),
  };
};

const buildDiscountChangePayload = (
  discount: AdminDiscountRecord,
  changeType:
    | "DISCOUNT_CREATED"
    | "DISCOUNT_UPDATED"
    | "DISCOUNT_PAUSED"
    | "DISCOUNT_ACTIVATED"
    | "DISCOUNT_EXPIRED"
    | "DISCOUNT_ARCHIVED"
    | "DISCOUNT_RESTORED",
  reason: string,
) => ({
  change_type: changeType,
  sku: discount.sku,
  discount_code: discount.code,
  reason,
  actor: "website_admin",
});

const fireDiscountChangeEvent = async (
  discount: AdminDiscountRecord,
  changeType:
    | "DISCOUNT_CREATED"
    | "DISCOUNT_UPDATED"
    | "DISCOUNT_PAUSED"
    | "DISCOUNT_ACTIVATED"
    | "DISCOUNT_EXPIRED"
    | "DISCOUNT_ARCHIVED"
    | "DISCOUNT_RESTORED",
  reason: string,
) => {
  try {
    await postN8nWebhook({
      url: G7_OFFER_CHANGE_EVENT_URL,
      payload: buildDiscountChangePayload(discount, changeType, reason),
      source: "discounts",
    });
  } catch (error) {
    console.warn("[discounts] failed to fire offer change event", error);
  }
};

const parseMutation = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) {
    return invalidJsonResponse();
  }

  const parsed = discountFormSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonResponse(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid discount payload.",
      },
      400,
    );
  }

  return parsed.data;
};

const parseAction = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  const parsed = discountActionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message ?? "Invalid discount action." }, 400);
  }

  return parsed.data;
};

const parseProofRequest = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) {
    return invalidJsonResponse();
  }

  const parsed = discountProofRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message ?? "Invalid proof request." }, 400);
  }

  return parsed.data;
};

const normalizeDiscountInput = (input: DiscountFormValues, existing?: AdminDiscountRecord | null) => {
  const code = input.code.trim().toUpperCase();
  const discountType = normalizeType(input.discountType);
  const appliesToType = normalizeAppliesToType(input.appliesToType);
  const status = normalizeStatus(input.status);
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  const discountValue = discountType === "FREE_SHIPPING" ? null : parseOptionalNumber(input.discountValue);
  const usageLimitTotal = parseIntValue(input.usageLimitTotal);
  const usageLimitPerCustomer = parseIntValue(input.usageLimitPerCustomer);
  const minimumOrderValue = parseOptionalNumber(input.minimumOrderValue);
  const productId = trimOrNull(input.productId);
  const sku = trimOrNull(input.sku)?.toUpperCase() ?? null;
  const collectionId = trimOrNull(input.collectionId);
  const notes = trimOrNull(input.notes);

  return {
    code,
    discount_type: discountType,
    discount_value: discountValue,
    applies_to_type: appliesToType,
    product_id: productId,
    sku,
    collection_id: collectionId,
    starts_at: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
    ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
    status,
    usage_limit_total: usageLimitTotal,
    usage_limit_per_customer: usageLimitPerCustomer,
    minimum_order_value: minimumOrderValue,
    notes,
    created_by: existing?.createdBy ?? null,
    updated_by: null as string | null,
  };
};

const validateLifecycleState = (
  input: ReturnType<typeof normalizeDiscountInput>,
  existing: AdminDiscountRecord | null,
) => {
  const now = Date.now();
  const isActiveLifecycle = input.status === "ACTIVE" || input.status === "SCHEDULED";

  if (input.status === "ARCHIVED") {
    return { status: 400, message: "Use the Archive action instead of saving archived status directly." };
  }

  if (existing?.status === "ARCHIVED" && input.status !== "DRAFT") {
    return { status: 400, message: "Archived discounts can only be restored." };
  }

  if (input.status === "ACTIVE" && input.starts_at && input.starts_at.getTime() > now) {
    return { status: 400, message: "Discount has not started yet. Use Scheduled until the start date." };
  }

  if (isActiveLifecycle && input.ends_at && input.ends_at.getTime() < now) {
    return { status: 400, message: "Discount has expired." };
  }

  if (isActiveLifecycle && input.applies_to_type !== "ALL_PRODUCTS") {
    const targetField =
      input.applies_to_type === "SPECIFIC_PRODUCT"
        ? input.product_id
        : input.applies_to_type === "SPECIFIC_SKU"
          ? input.sku
          : input.collection_id;

    if (!targetField) {
      return {
        status: 400,
        message:
          input.applies_to_type === "SPECIFIC_PRODUCT"
            ? "Choose a product before activating this discount."
            : input.applies_to_type === "SPECIFIC_SKU"
              ? "Enter a SKU before activating this discount."
              : "Choose a collection before activating this discount.",
      };
    }
  }

  if (isActiveLifecycle && input.notes && /today only|ends?\s+soon|limited time|last chance|hurry|expires soon|ending soon|while supplies last/i.test(input.notes) && !input.ends_at) {
    return { status: 400, message: "Add an end date before using urgency wording." };
  }

  return null;
};

const validateUniqueCode = async (code: string, currentId?: string | null) => {
  const existing = await getDiscountRowByCode(code);
  if (!existing) {
    return null;
  }

  if (currentId && existing.discountId === currentId) {
    return null;
  }

  return { status: 409, message: "Discount code must be unique." };
};

const saveDiscount = async (
  input: DiscountFormValues,
  auth: { id: string; email: string | null },
  existing: AdminDiscountRecord | null = null,
) => {
  const prisma = await getPrisma();
  const normalized = normalizeDiscountInput(input, existing);
  const lifecycleError = validateLifecycleState(normalized, existing);
  if (lifecycleError) {
    return jsonResponse({ message: lifecycleError.message }, lifecycleError.status);
  }

  const uniqueError = await validateUniqueCode(normalized.code, existing?.discountId ?? null);
  if (uniqueError) {
    return jsonResponse({ message: uniqueError.message }, uniqueError.status);
  }

  const auditActor = auth.email ?? auth.id;
  const createData = {
    code: normalized.code,
    discount_type: normalized.discount_type,
    discount_value: normalized.discount_value,
    applies_to_type: normalized.applies_to_type,
    product_id: normalized.product_id,
    sku: normalized.sku,
    collection_id: normalized.collection_id,
    starts_at: normalized.starts_at,
    ends_at: normalized.ends_at,
    status: normalized.status,
    usage_limit_total: normalized.usage_limit_total,
    usage_limit_per_customer: normalized.usage_limit_per_customer,
    minimum_order_value: normalized.minimum_order_value,
    notes: normalized.notes,
    updated_by: auditActor,
    created_by: existing?.createdBy ?? auditActor,
  } satisfies Prisma.cevonne_discountsUncheckedCreateInput;

  const updateData: Prisma.cevonne_discountsUncheckedUpdateInput = {
    code: normalized.code,
    discount_type: normalized.discount_type,
    discount_value: normalized.discount_value,
    applies_to_type: normalized.applies_to_type,
    product_id: normalized.product_id,
    sku: normalized.sku,
    collection_id: normalized.collection_id,
    starts_at: normalized.starts_at,
    ends_at: normalized.ends_at,
    status: normalized.status,
    usage_limit_total: normalized.usage_limit_total,
    usage_limit_per_customer: normalized.usage_limit_per_customer,
    minimum_order_value: normalized.minimum_order_value,
    notes: normalized.notes,
    updated_by: auditActor,
  };

  const row = existing
    ? await prisma.cevonne_discounts.update({
        where: { discount_id: existing.discountId },
        data: updateData,
        include: discountInclude,
      })
    : await prisma.cevonne_discounts.create({
        data: {
          ...createData,
          used_count: 0,
        },
        include: discountInclude,
      });

  const saved = await hydrateDiscountRecord(row as unknown as Record<string, unknown>);
  const changeType = existing ? "DISCOUNT_UPDATED" : "DISCOUNT_CREATED";
  await fireDiscountChangeEvent(saved, changeType, existing ? "Discount updated from admin panel" : "Discount created from admin panel");

  return jsonResponse(
    {
      item: saved,
      message: existing ? "Discount updated." : "Discount created.",
    },
    existing ? 200 : 201,
  );
};

const updateDiscountAction = async (
  id: string,
  action: DiscountAction,
  auth: { id: string; email: string | null },
) => {
  const prisma = await getPrisma();
  const current = await getDiscountRowById(id);
  if (!current) {
    return jsonResponse({ message: "Discount not found." }, 404);
  }

  const existing = serializeDiscount(current as unknown as Record<string, unknown>);
  if (existing.status === "ARCHIVED" && action !== "RESTORE") {
    return jsonResponse({ message: "Archived discounts can only be restored." }, 400);
  }

  const now = new Date();
  const data: Prisma.cevonne_discountsUncheckedUpdateInput = {
    updated_by: auth.email ?? auth.id,
  };

  let changeType: "DISCOUNT_PAUSED" | "DISCOUNT_ACTIVATED" | "DISCOUNT_EXPIRED" | "DISCOUNT_ARCHIVED" | "DISCOUNT_RESTORED" =
    "DISCOUNT_PAUSED";

  switch (action) {
    case "PAUSE":
      data.status = "PAUSED";
      changeType = "DISCOUNT_PAUSED";
      break;
    case "ACTIVATE":
      if (existing.endsAt && new Date(existing.endsAt).getTime() < now.getTime()) {
        return jsonResponse({ message: "Discount has expired." }, 400);
      }

      if (existing.startsAt && new Date(existing.startsAt).getTime() > now.getTime()) {
        return jsonResponse({ message: "Discount has not started yet." }, 400);
      }

      if (existing.appliesToType !== "ALL_PRODUCTS" && !existing.productId && !existing.sku && !existing.collectionId) {
        return jsonResponse({ message: "Choose a linked product, SKU, or collection before activating this discount." }, 400);
      }

      data.status = "ACTIVE";
      changeType = "DISCOUNT_ACTIVATED";
      break;
    case "EXPIRE":
      data.status = "EXPIRED";
      data.ends_at = current.endsAt ? new Date(current.endsAt) : now;
      changeType = "DISCOUNT_EXPIRED";
      break;
    case "ARCHIVE":
      data.status = "ARCHIVED";
      data.archived_at = now;
      changeType = "DISCOUNT_ARCHIVED";
      break;
    case "RESTORE":
      data.status = "DRAFT";
      data.archived_at = null;
      changeType = "DISCOUNT_RESTORED";
      break;
    default:
      break;
  }

  const row = await prisma.cevonne_discounts.update({
    where: { discount_id: id },
    data,
    include: discountInclude,
  });

  const saved = await hydrateDiscountRecord(row as unknown as Record<string, unknown>);
  await fireDiscountChangeEvent(saved, changeType, `Discount ${action.toLowerCase()} from admin panel`);

  return jsonResponse(
    {
      item: saved,
      message:
        action === "PAUSE"
          ? "Discount paused."
          : action === "ACTIVATE"
            ? "Discount activated."
            : action === "EXPIRE"
              ? "Discount expired."
              : action === "ARCHIVE"
                ? "Discount archived."
                : "Discount restored.",
    },
    200,
  );
};

const loadDiscountForEdit = async (id: string) => {
  const row = await getDiscountRowById(id);
  return row ?? null;
};

const ensureDiscountMatch = async (
  discount: AdminDiscountRecord,
  source: Awaited<ReturnType<typeof loadG7OfferSourceRecordByDiscountId>>,
  requestedTarget: string,
) => {
  const normalizedRequest = requestedTarget.trim().toLowerCase();
  if (!normalizedRequest) {
    return null;
  }

  const sourceSku = source?.sku?.trim().toLowerCase() ?? "";
  const sourceProductName = source?.productName?.trim().toLowerCase() ?? "";
  const sourceProductSlug = source?.productSlug?.trim().toLowerCase() ?? "";
  const sourceCollectionName = discount.collectionName?.trim().toLowerCase() ?? "";
  const sourceCollectionSlug = discount.collectionSlug?.trim().toLowerCase() ?? "";

  if (discount.appliesToType === "ALL_PRODUCTS") {
    return null;
  }

  if (discount.appliesToType === "SPECIFIC_SKU") {
    const knownMatches = [discount.sku, sourceSku].filter(Boolean).map((value) => String(value).toLowerCase());
    if (knownMatches.includes(normalizedRequest)) {
      return null;
    }

    return { status: "BLOCK" as const, message: "Discount does not match this product." };
  }

  if (discount.appliesToType === "SPECIFIC_PRODUCT") {
    const productMatches = [discount.productName, discount.productSlug, sourceProductName, sourceProductSlug]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    const skuMatches = [discount.sku, sourceSku].filter(Boolean).map((value) => String(value).toLowerCase());

    if (productMatches.includes(normalizedRequest) || skuMatches.includes(normalizedRequest)) {
      return null;
    }

    return { status: "BLOCK" as const, message: "Discount does not match this product." };
  }

  const collectionMatches = [discount.collectionName, discount.collectionSlug, sourceCollectionName, sourceCollectionSlug]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  if (collectionMatches.includes(normalizedRequest)) {
    return null;
  }

  return { status: "BLOCK" as const, message: "Discount does not match this product." };
};

const loadCollectionProductCandidates = async (collectionId: string) => {
  const prisma = await getPrisma();
  const products = await prisma.product.findMany({
    where: { collectionId },
    select: {
      id: true,
      name: true,
      slug: true,
      shades: {
        select: {
          sku: true,
        },
      },
    },
  });

  return products;
};

const findCollectionCandidateMatch = async (collectionId: string, requestedTarget: string) => {
  const normalizedRequest = requestedTarget.trim().toLowerCase();
  if (!normalizedRequest) {
    return null;
  }

  const products = await loadCollectionProductCandidates(collectionId);
  const matches = products.some((product) => {
    const values = [
      product.name,
      product.slug,
      ...(Array.isArray(product.shades) ? product.shades.map((shade) => shade.sku).filter(Boolean) : []),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return values.includes(normalizedRequest);
  });

  return matches ? null : { status: "BLOCK" as const, message: "Discount does not match this product." };
};

const buildProofStatusMessage = (
  status: "PASS" | "BLOCK" | "NEEDS_EVIDENCE",
  message: string,
) => {
  if (status === "PASS") {
    return "Discount is active and safe to use.";
  }

  if (status === "NEEDS_EVIDENCE") {
    return message || "Run offer proof before using this discount in content or ads.";
  }

  return message || "Run offer proof before using this discount in content or ads.";
};

const runProofCheck = async (
  discount: AdminDiscountRecord,
  source: Awaited<ReturnType<typeof loadG7OfferSourceRecordByDiscountId>>,
  requestedTarget: string,
  urgencyClaim: string,
) => {
  const now = Date.now();
  if (discount.status === "ARCHIVED") {
    return { status: "BLOCK" as const, message: "Discount is archived." };
  }

  if (discount.status === "EXPIRED" || (discount.endsAt && new Date(discount.endsAt).getTime() < now)) {
    return { status: "BLOCK" as const, message: "Discount has expired." };
  }

  if (discount.status === "PAUSED") {
    return { status: "BLOCK" as const, message: "Discount is paused." };
  }

  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) {
    return { status: "BLOCK" as const, message: "Discount has not started yet." };
  }

  if (discount.appliesToType !== "ALL_PRODUCTS") {
    if (discount.appliesToType === "SPECIFIC_COLLECTION" && discount.collectionId) {
      const collectionMismatch = await findCollectionCandidateMatch(discount.collectionId, requestedTarget);
      if (collectionMismatch) {
        return collectionMismatch;
      }
    } else {
      const targetMismatch = await ensureDiscountMatch(discount, source, requestedTarget);
      if (targetMismatch) {
        return targetMismatch;
      }
    }
  }

  if (urgencyClaim && /today only|ends?\s+soon|limited time|last chance|hurry|expires soon|ending soon|while supplies last/i.test(urgencyClaim) && !discount.endsAt) {
    return { status: "NEEDS_EVIDENCE" as const, message: "Add an end date before using urgency wording." };
  }

  if (urgencyClaim && /low stock|limited stock|few left|running low|almost gone|nearly sold out/i.test(urgencyClaim)) {
    if (!source?.secondStockEvidenceUrl || !source?.secondStockCheckedAt) {
      return { status: "NEEDS_EVIDENCE" as const, message: "Add second stock proof before using low-stock wording." };
    }
  }

  return null;
};

export async function dispatchAdminDiscountsRoute(request: Request, segments: string[] = []) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const [first, second] = segments;

  if (!first) {
    if (request.method === "GET") {
      const payload = await buildListResponse();
      return jsonResponse(payload, 200);
    }

    if (request.method === "POST") {
      const parsed = await parseMutation(request);
      if (parsed instanceof Response) {
        return parsed;
      }

      return saveDiscount(parsed, auth);
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (second === "check-proof" && request.method === "POST") {
    return jsonResponse({ message: "Use the dedicated proof route." }, 404);
  }

  if (request.method === "GET") {
    const discount = await loadDiscountForEdit(first);
    if (!discount) {
      return jsonResponse({ message: "Discount not found." }, 404);
    }

    return jsonResponse({ item: discount }, 200);
  }

  if (request.method === "PUT") {
    const parsed = await parseMutation(request);
    if (parsed instanceof Response) {
      return parsed;
    }

    const current = await loadDiscountForEdit(first);
    if (!current) {
      return jsonResponse({ message: "Discount not found." }, 404);
    }

    return saveDiscount(parsed, auth, current);
  }

  if (request.method === "PATCH") {
    const parsed = await parseAction(request);
    if (parsed instanceof Response) {
      return parsed;
    }

    return updateDiscountAction(first, parsed.action, auth);
  }

  return jsonResponse({ message: "Not Found" }, 404);
}

export const loadAdminDiscountRecordById = async (discountId: string) => loadDiscountForEdit(discountId);

export const loadAdminDiscountRecordByCode = async (code: string) => {
  const row = await getDiscountRowByCode(code.trim().toUpperCase());
  return row ?? null;
};

export const getAdminDiscountList = async () => buildListResponse();

export const runAdminDiscountProofCheck = async (
  discountId: string,
  input: {
    sku?: string | null;
    urgencyClaim?: string | null;
    secondStockSource?: string | null;
    secondStockQuantity?: string | null;
    secondStockEvidenceUrl?: string | null;
    secondStockCheckedAt?: string | null;
  },
) => {
  const current = await loadDiscountForEdit(discountId);
  if (!current) {
    return jsonResponse({ message: "Discount not found." }, 404);
  }

  const source = await loadG7OfferSourceRecordByDiscountId(discountId);
  const requestedTarget = trimOrNull(input.sku) ?? current.sku ?? source?.sku ?? "";
  const urgencyClaim = trimOrNull(input.urgencyClaim) ?? "";

  if (!requestedTarget) {
    return jsonResponse(
      {
        status: "NEEDS_EVIDENCE",
        message: "Add a SKU or linked target before checking offer proof.",
        handledAt: new Date().toISOString(),
      },
      200,
    );
  }

  const localIssue = await runProofCheck(current, source, requestedTarget, urgencyClaim);
  if (localIssue) {
    const status = localIssue.status;
    return jsonResponse(
      {
        status,
        message: buildProofStatusMessage(status, localIssue.message),
        handledAt: new Date().toISOString(),
      },
      200,
    );
  }

  const response = await postN8nWebhook({
    url: G7_OFFER_PROOF_URL,
    payload: buildG7OfferProofPayload({
      sku: requestedTarget || source?.sku || current.sku || "",
      urgency_claim: urgencyClaim || null,
      discount_code: current.code,
      second_stock_source: input.secondStockSource || null,
      second_stock_available: input.secondStockQuantity || null,
      second_stock_evidence_url: input.secondStockEvidenceUrl || null,
      second_stock_checked_at: input.secondStockCheckedAt || null,
    }),
    source: "discounts",
  });

  if (response.status === "PASS" || response.status === "BLOCK" || response.status === "NEEDS_EVIDENCE") {
    return jsonResponse(
      {
        status: response.status,
        message:
          response.status === "PASS"
            ? "Discount is active and safe to use."
            : buildProofStatusMessage(response.status, response.message),
        handledAt: response.handled_at ?? new Date().toISOString(),
      },
      200,
    );
  }

  return jsonResponse(
    {
      status: "BLOCK",
      message: "Run offer proof before using this discount in content or ads.",
      handledAt: new Date().toISOString(),
    },
    200,
  );
};
