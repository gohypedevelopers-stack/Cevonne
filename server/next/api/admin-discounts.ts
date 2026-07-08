import "server-only";

import { Prisma } from "@prisma/client";

import { buildG7OfferProofPayload } from "@/lib/admin/g7-dashboard-summary";
import {
  discountFormSchema,
  discountActionSchema,
  discountProofRequestSchema,
  formatDiscountProofMessage,
  type AdminDiscountRecord,
  type DiscountAction,
  type DiscountAppliesToType,
  type DiscountFormValues,
  type DiscountProofItemRecord,
  type DiscountProofStatusDetail,
  type DiscountProofSummary,
  type DiscountProofScope,
  type DiscountProofStatus,
  type DiscountStatus,
  type DiscountSummary,
  type DiscountType,
  isDiscountProofAttentionRequired,
  isAllProductsAppliesToType,
  normalizeDiscountAppliesToType,
  normalizeDiscountStatus,
  normalizeDiscountType,
  normalizeDiscountProofStatus,
  parseOptionalNumber,
  trimOrNull,
} from "@/lib/admin/discounts";
import {
  loadG7OfferSourceRecordByCode,
  loadG7OfferSourceRecordByDiscountId,
  loadG7OfferSourceRecordsByCollectionId,
} from "@/server/next/api/g7-offer-source";
import { postN8nWebhook } from "@/lib/n8n-client";
import type { N8nWebhookResult } from "@/lib/n8n-client";
import { env } from "@/server/config";
import { getPrisma } from "@/server/db/prismaClient";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const G7_OFFER_CHANGE_EVENT_URL = env.n8nG7OfferChangeEventUrl || "https://n8n.cevonne.com/webhook/g7-offer-change-event";
const G7_OFFER_SAFETY_CHECK_URL = env.n8nG7OfferSafetyCheckUrl || "https://n8n.cevonne.com/webhook/g7-offer-safety-check";

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

const collectCatalogLabels = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return (
          (typeof record.label === "string" ? record.label : "") ||
          (typeof record.name === "string" ? record.name : "") ||
          (typeof record.title === "string" ? record.title : "") ||
          (typeof record.value === "string" ? record.value : "")
        );
      }

      return "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const isArchivedOrDraftCatalogProduct = (product: { tags?: unknown; badges?: unknown }) => {
  const tokens = [...collectCatalogLabels(product.tags), ...collectCatalogLabels(product.badges)]
    .join(" ")
    .toLowerCase();

  return tokens.includes("draft") || tokens.includes("archived");
};

const normalizeProofItems = (value: unknown): DiscountProofItemRecord[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const failureReasons = Array.isArray(record.failure_reasons)
        ? record.failure_reasons
            .map((reason) => normalizeText(reason))
            .filter((reason): reason is string => Boolean(reason))
        : [];

      const proofStatus = normalizeDiscountProofStatus(
        typeof record.proof_status === "string" ? record.proof_status : null,
      );

      const g7Result =
        record.g7_result === "PASS" || record.g7_result === "BLOCK" || record.g7_result === "NEEDS_EVIDENCE"
          ? (record.g7_result as "PASS" | "BLOCK" | "NEEDS_EVIDENCE")
          : proofStatus === "VERIFIED"
            ? "PASS"
            : proofStatus === "NEEDS_EVIDENCE"
              ? "NEEDS_EVIDENCE"
              : "BLOCK";

      return {
        product_name: normalizeText(record.product_name) ?? "",
        sku: normalizeText(record.sku) ?? "",
        variant_name: normalizeText(record.variant_name) ?? "",
        stock_available: toNumber(record.stock_available),
        product_status: normalizeText(record.product_status) ?? "ACTIVE",
        variant_status: normalizeText(record.variant_status) ?? "ACTIVE",
        discount_status: normalizeDiscountStatus(typeof record.discount_status === "string" ? record.discount_status : null),
        proof_status: proofStatus,
        g7_result: g7Result,
        reason: normalizeText(record.reason) ?? "",
        failure_reasons: failureReasons,
      } satisfies DiscountProofItemRecord;
    })
    .filter((item): item is DiscountProofItemRecord => Boolean(item && item.sku));

  return items.length ? items : null;
};

const buildSavedProofDetail = (discount: {
  g7ProofStatus: DiscountProofStatus;
  g7LastCheckedAt: string | null;
  g7LastSummary: string | null;
}): DiscountProofStatusDetail | null => {
  if (!discount.g7LastCheckedAt) {
    return null;
  }

  const status = normalizeDiscountProofStatus(discount.g7ProofStatus);
  return {
    status,
    message: discount.g7LastSummary ?? formatDiscountProofMessage(status),
    checkedAt: discount.g7LastCheckedAt,
  };
};

const buildPersistedProofScope = (
  discount: { appliesToType: DiscountAppliesToType },
  proofScope: DiscountProofScope,
) => {
  if (discount.appliesToType === "SPECIFIC_COLLECTION") {
    return proofScope === "ALL_PRODUCTS" ? "COLLECTION" : "COLLECTION_PRODUCT";
  }

  if (discount.appliesToType === "SPECIFIC_PRODUCT") {
    return proofScope === "ALL_PRODUCTS" ? "PRODUCT_GROUP" : "PRODUCT";
  }

  if (discount.appliesToType === "SPECIFIC_SKU") {
    return "SKU";
  }

  return proofScope;
};

type CollectionProofProduct = {
  product_name: string;
  sku: string;
  variant_name: string;
  stock_available: number | null;
  product_status: string;
  variant_status: string;
};

type CollectionProofItemResult = CollectionProofProduct & {
  discount_status: DiscountStatus;
  proof_status: DiscountProofStatus;
  g7_result: "PASS" | "BLOCK" | "NEEDS_EVIDENCE";
  reason: string;
  failure_reasons: string[];
};

type CollectionBlockedReason = {
  reason: string;
  count: number;
};

const loadCollectionProofProducts = async (collectionId: string) => {
  const prisma = await getPrisma();
  const [rows, sourceRows] = await Promise.all([
    prisma.product.findMany({
      where: { collectionId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        shades: {
          orderBy: [{ name: "asc" }],
          select: {
            name: true,
            sku: true,
          },
        },
      },
    }),
    loadG7OfferSourceRecordsByCollectionId(collectionId),
  ]);

  const sourceBySku = new Map(
    sourceRows
      .map((row) => {
        const sku = normalizeText(row.sku)?.toLowerCase() ?? "";
        if (!sku) {
          return null;
        }

        return [
          sku,
          {
            stock_available: row.stockAvailable ?? null,
            product_status: row.productStatus ?? "ACTIVE",
            variant_status: row.variantStatus ?? "ACTIVE",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [string, { stock_available: number | null; product_status: string; variant_status: string }] => Boolean(entry)),
  );

  const seen = new Set<string>();
  const items: CollectionProofProduct[] = [];
  let missingSkuProducts = 0;

  for (const product of rows) {
    const productName = normalizeText(product.name) ?? "Product";
    const shades = Array.isArray(product.shades) ? product.shades : [];

    if (shades.length > 0) {
      for (const shade of shades) {
        const sku = normalizeText(shade.sku) || normalizeText(product.slug) || "";
        if (!sku) {
          missingSkuProducts += 1;
          continue;
        }

        const normalizedSku = sku.toLowerCase();
        if (seen.has(normalizedSku)) {
          continue;
        }

        const source = sourceBySku.get(normalizedSku) ?? null;
        const stock = source?.stock_available ?? null;

        seen.add(normalizedSku);
        items.push({
          product_name: productName,
          sku,
          variant_name: normalizeText(shade.name) ?? "Variant",
          stock_available: stock,
          product_status: source?.product_status ?? "ACTIVE",
          variant_status: source?.variant_status ?? "ACTIVE",
        });
      }
      continue;
    }

    const fallbackSku = normalizeText(product.slug) ?? "";
    if (fallbackSku) {
      const normalizedSku = fallbackSku.toLowerCase();
      if (!seen.has(normalizedSku)) {
        const source = sourceBySku.get(normalizedSku) ?? null;
        seen.add(normalizedSku);
        items.push({
          product_name: productName,
          sku: fallbackSku,
          variant_name: "",
          stock_available: source?.stock_available ?? null,
          product_status: source?.product_status ?? "ACTIVE",
          variant_status: source?.variant_status ?? "ACTIVE",
        });
      }
      continue;
    }

    missingSkuProducts += 1;
  }

  if (missingSkuProducts > 0) {
    console.log("Products missing SKU:", missingSkuProducts);
  }

  return items.sort((left, right) => {
    const byProduct = left.product_name.localeCompare(right.product_name);
    if (byProduct !== 0) {
      return byProduct;
    }

    return left.variant_name.localeCompare(right.variant_name);
  });
};

const loadAllProductsProofProducts = async () => {
  const prisma = await getPrisma();
  const rows = await prisma.product.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      name: true,
      slug: true,
      tags: true,
      badges: true,
      shades: {
        orderBy: [{ name: "asc" }],
        select: {
          name: true,
          sku: true,
          inventory: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: CollectionProofProduct[] = [];
  let missingSkuProducts = 0;

  for (const product of rows) {
    if (isArchivedOrDraftCatalogProduct(product)) {
      continue;
    }

    const productName = normalizeText(product.name) ?? "Product";
    const shades = Array.isArray(product.shades) ? product.shades : [];

    if (shades.length > 0) {
      for (const shade of shades) {
        const sku = normalizeText(shade.sku) || normalizeText(product.slug) || "";
        if (!sku) {
          missingSkuProducts += 1;
          continue;
        }

        const normalizedSku = sku.toLowerCase();
        if (seen.has(normalizedSku)) {
          continue;
        }

        seen.add(normalizedSku);
        items.push({
          product_name: productName,
          sku,
          variant_name: normalizeText(shade.name) ?? "Variant",
          stock_available: shade.inventory?.quantity ?? null,
          product_status: "ACTIVE",
          variant_status: "ACTIVE",
        });
      }
      continue;
    }

    const fallbackSku = normalizeText(product.slug) ?? "";
    if (fallbackSku) {
      const normalizedSku = fallbackSku.toLowerCase();
      if (!seen.has(normalizedSku)) {
        seen.add(normalizedSku);
        items.push({
          product_name: productName,
          sku: fallbackSku,
          variant_name: "",
          stock_available: null,
          product_status: "ACTIVE",
          variant_status: "ACTIVE",
        });
      }
      continue;
    }

    missingSkuProducts += 1;
  }

  if (missingSkuProducts > 0) {
    console.log("Products missing SKU:", missingSkuProducts);
  }

  return items.sort((left, right) => {
    const byProduct = left.product_name.localeCompare(right.product_name);
    if (byProduct !== 0) {
      return byProduct;
    }

    return left.sku.localeCompare(right.sku);
  });
};

const loadSpecificProductProofProducts = async (productId: string) => {
  const id = productId.trim();
  if (!id) {
    return [];
  }

  const prisma = await getPrisma();
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      name: true,
      slug: true,
      tags: true,
      badges: true,
      shades: {
        orderBy: [{ name: "asc" }],
        select: {
          name: true,
          sku: true,
          inventory: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  });

  if (!product || isArchivedOrDraftCatalogProduct(product)) {
    return [];
  }

  const seen = new Set<string>();
  const items: CollectionProofProduct[] = [];

  for (const shade of Array.isArray(product.shades) ? product.shades : []) {
    const sku = normalizeText(shade.sku) || "";
    if (!sku) {
      continue;
    }

    const normalizedSku = sku.toLowerCase();
    if (seen.has(normalizedSku)) {
      continue;
    }

    seen.add(normalizedSku);
    items.push({
      product_name: normalizeText(product.name) ?? "Product",
      sku,
      variant_name: normalizeText(shade.name) ?? "Variant",
      stock_available: shade.inventory?.quantity ?? null,
      product_status: "ACTIVE",
      variant_status: "ACTIVE",
    });
  }

  if (!items.length) {
    const fallbackSku = normalizeText(product.slug) ?? "";
    if (fallbackSku) {
      items.push({
        product_name: normalizeText(product.name) ?? "Product",
        sku: fallbackSku,
        variant_name: normalizeText(product.name) ?? "Variant",
        stock_available: null,
        product_status: "ACTIVE",
        variant_status: "ACTIVE",
      });
    }
  }

  return items.sort((left, right) => {
    const byProduct = left.product_name.localeCompare(right.product_name);
    if (byProduct !== 0) {
      return byProduct;
    }

    return left.sku.localeCompare(right.sku);
  });
};

const loadSpecificSkuProofProducts = async (sku: string) => {
  const targetSku = sku.trim();
  if (!targetSku) {
    return [];
  }

  const prisma = await getPrisma();
  const shade = await prisma.shade.findFirst({
    where: {
      sku: {
        equals: targetSku,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      sku: true,
      inventory: {
        select: {
          quantity: true,
        },
      },
      product: {
        select: {
          name: true,
          slug: true,
          tags: true,
          badges: true,
        },
      },
    },
  });

  if (!shade?.product || isArchivedOrDraftCatalogProduct(shade.product)) {
    return [];
  }

  const resolvedSku = normalizeText(shade.sku) ?? targetSku;
  if (!resolvedSku) {
    return [];
  }

  return [
    {
      product_name: normalizeText(shade.product.name) ?? "Product",
      sku: resolvedSku,
      variant_name: normalizeText(shade.name) ?? "Variant",
      stock_available: shade.inventory?.quantity ?? null,
      product_status: "ACTIVE",
      variant_status: "ACTIVE",
    },
  ];
};

const loadDiscountProofProducts = async (discount: AdminDiscountRecord) => {
  if (isAllProductsAppliesToType(discount.appliesToType)) {
    return loadAllProductsProofProducts();
  }

  if (discount.appliesToType === "SPECIFIC_PRODUCT" && discount.productId) {
    return loadSpecificProductProofProducts(discount.productId);
  }

  if (discount.appliesToType === "SPECIFIC_SKU" && discount.sku) {
    return loadSpecificSkuProofProducts(discount.sku);
  }

  if (discount.appliesToType === "SPECIFIC_COLLECTION" && discount.collectionId) {
    return loadCollectionProofProducts(discount.collectionId);
  }

  return [];
};

const COLLECTION_REASON_PATTERNS: Array<[RegExp, string]> = [
  [/out of stock|stock unavailable|stock mismatch|inventory unavailable/i, "Product is out of stock."],
  [/discount has expired|discount expired|offer expired|expired/i, "Discount has expired."],
  [/discount is paused|paused discount|status paused|discount paused/i, "Discount is paused."],
  [/not active yet|has not started yet|scheduled for a future start date|not started yet/i, "Discount is not active yet."],
  [
    /discount code not found in neon|product or variant not found in neon|discount not linked|offer url mismatch/i,
    "Discount is not linked to this product/SKU.",
  ],
  [/second stock proof|low stock wording|stock proof/i, "Add second stock proof before using low-stock wording."],
];

const normalizeCollectionReason = (value: string | null | undefined) => {
  const text = trimOrNull(value)?.replace(/\s+/g, " ") ?? "";
  if (!text) {
    return null;
  }

  for (const [pattern, message] of COLLECTION_REASON_PATTERNS) {
    if (pattern.test(text)) {
      return message;
    }
  }

  return text;
};

const collectWebhookReasons = (response: N8nWebhookResult) => {
  const rawReasons = [response.fail_reason, ...(response.failure_reasons ?? [])]
    .map((reason) => normalizeCollectionReason(reason))
    .filter((reason): reason is string => Boolean(reason));

  return [...new Set(rawReasons)];
};

const summarizeCollectionBlockedReasons = (items: CollectionProofItemResult[]): CollectionBlockedReason[] => {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (item.proof_status !== "BLOCKED") {
      continue;
    }

    counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
};

const buildCollectionProofItem = (input: {
  product: CollectionProofProduct;
  discount: AdminDiscountRecord;
  response?: N8nWebhookResult | null;
  forcedReason?: string | null;
  forcedStatus?: "BLOCKED" | "NEEDS_EVIDENCE" | "VERIFIED" | null;
}): CollectionProofItemResult => {
  const { product, discount, response, forcedReason, forcedStatus } = input;
  const webhookStatus = response?.status ?? "ERROR";
  const webhookReasons = response ? collectWebhookReasons(response) : [];
  const rawReason = webhookReasons[0] ??
    normalizeCollectionReason(response?.message ?? null) ??
    (webhookStatus === "PASS"
      ? "Verified for this product."
      : webhookStatus === "NEEDS_EVIDENCE"
        ? "Proof evidence is required for this product."
        : "Discount is not linked to this product/SKU.");

  if (rawReason === "PRODUCT_OR_VARIANT_NOT_FOUND_IN_NEON") {
    console.log(`[proof-products] Blocked reason for developer: PRODUCT_OR_VARIANT_NOT_FOUND_IN_NEON for sku="${product.sku}"`);
  }

  const mappedReason =
    forcedReason ??
    (product.stock_available !== null && product.stock_available <= 0
      ? "Product is out of stock."
      : rawReason === "PRODUCT_OR_VARIANT_NOT_FOUND_IN_NEON"
        ? "G7 could not find this product in the offer source data."
        : rawReason);

  const proofStatus =
    forcedStatus ??
    (product.stock_available !== null && product.stock_available <= 0
      ? "BLOCKED"
      : webhookStatus === "PASS"
        ? "VERIFIED"
        : webhookStatus === "NEEDS_EVIDENCE"
          ? "NEEDS_EVIDENCE"
          : "BLOCKED");

  return {
    ...product,
    discount_status: discount.status,
    proof_status: proofStatus,
    g7_result: proofStatus === "VERIFIED" ? "PASS" : proofStatus === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCK",
    reason: mappedReason,
    failure_reasons: webhookReasons,
  };
};

const parseIntValue = (value: string | number | null | undefined) => {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }

  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const defaultProofDetail = (): DiscountProofStatusDetail => ({
  status: "NOT_CHECKED",
  message: "Check Proof before using this discount in content or ads.",
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
): DiscountProofStatusDetail => {
  const now = Date.now();

  if (discount.status === "ARCHIVED" || discount.archivedAt) {
    return {
      status: "EXPIRED",
      message: "Discount is archived.",
      checkedAt: null,
    };
  }

  if (discount.status === "EXPIRED" || (discount.endsAt && new Date(discount.endsAt).getTime() < now)) {
    return {
      status: "EXPIRED",
      message: "Discount has expired.",
      checkedAt: null,
    };
  }

  if (discount.status === "PAUSED") {
    return {
      status: "BLOCKED",
      message: "Discount is paused.",
      checkedAt: null,
    };
  }

  if (discount.status === "DRAFT") {
    return defaultProofDetail();
  }

  if (discount.status === "SCHEDULED" && discount.startsAt && new Date(discount.startsAt).getTime() > now) {
    return defaultProofDetail();
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
      checkedAt: null,
    };
  }

  return defaultProofDetail();
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
    g7ProofStatus: normalizeDiscountProofStatus(typeof row.g7_proof_status === "string" ? row.g7_proof_status : null),
    g7ProofScope: normalizeText(row.g7_proof_scope),
    g7VerifiedCount: Math.trunc(toNumber(row.g7_verified_count) ?? 0),
    g7NeedsEvidenceCount: Math.trunc(toNumber(row.g7_needs_evidence_count) ?? 0),
    g7BlockedCount: Math.trunc(toNumber(row.g7_blocked_count) ?? 0),
    g7LastCheckedAt: toIsoString(row.g7_last_checked_at),
    g7LastSummary: normalizeText(row.g7_last_summary),
    g7LastItems: normalizeProofItems(row.g7_last_items),
  };
};

const hydrateDiscountRecord = async (row: Record<string, unknown>): Promise<AdminDiscountRecord> => {
  const base = serializeDiscount(row);
  const currentProofStatus = normalizeDiscountProofStatus(base.g7ProofStatus);
  const savedProof = buildSavedProofDetail(base);
  if (savedProof) {
    return {
      ...base,
      proofStatus: savedProof.status,
      proofMessage: savedProof.message,
      proofCheckedAt: savedProof.checkedAt,
    };
  }

  if (currentProofStatus === "VERIFIED") {
    const proof = defaultProofDetail();
    return {
      ...base,
      proofStatus: proof.status,
      proofMessage: proof.message,
      proofCheckedAt: proof.checkedAt,
    };
  }

  if (currentProofStatus !== "NOT_CHECKED") {
    return {
      ...base,
      proofStatus: currentProofStatus,
      proofMessage: base.g7LastSummary ?? formatDiscountProofMessage(currentProofStatus),
      proofCheckedAt: null,
    };
  }

  const proof = deriveDiscountProofDetail(base as AdminDiscountRecord);

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
        isDiscountProofAttentionRequired(item.proofStatus),
    ).length,
  };
};

const persistDiscountProofResult = async (
  discount: AdminDiscountRecord,
  input: {
    proofScope: DiscountProofScope;
    status: DiscountProofStatus;
    message: string;
    summary: DiscountProofSummary;
    items: DiscountProofItemRecord[];
  },
) => {
  const prisma = await getPrisma();
  const row = await prisma.cevonne_discounts.update({
    where: { discount_id: discount.discountId },
    data: {
      g7_proof_status: input.status,
      g7_proof_scope: buildPersistedProofScope(discount, input.proofScope),
      g7_verified_count: input.summary.verified,
      g7_needs_evidence_count: input.summary.needsEvidence,
      g7_blocked_count: input.summary.blocked,
      g7_last_checked_at: new Date(),
      g7_last_summary: input.message,
      g7_last_items: input.items as Prisma.InputJsonValue,
    },
    include: discountInclude,
  });

  return hydrateDiscountRecord(row as unknown as Record<string, unknown>);
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

const proofResetData = () => ({
  g7_proof_status: "NOT_CHECKED" as const,
  g7_proof_scope: null,
  g7_verified_count: 0,
  g7_needs_evidence_count: 0,
  g7_blocked_count: 0,
  g7_last_checked_at: null,
  g7_last_summary: null,
  g7_last_items: Prisma.DbNull,
});

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

const hasProofImpactingChange = (
  existing: AdminDiscountRecord | null,
  normalized: ReturnType<typeof normalizeDiscountInput>,
) => {
  if (!existing) {
    return false;
  }

  return (
    existing.code !== normalized.code ||
    existing.discountType !== normalized.discount_type ||
    (existing.discountValue ?? null) !== (normalized.discount_value ?? null) ||
    existing.appliesToType !== normalized.applies_to_type ||
    (existing.productId ?? null) !== (normalized.product_id ?? null) ||
    (existing.collectionId ?? null) !== (normalized.collection_id ?? null) ||
    (existing.sku ?? null) !== (normalized.sku ?? null) ||
    toIsoString(existing.startsAt) !== toIsoString(normalized.starts_at) ||
    toIsoString(existing.endsAt) !== toIsoString(normalized.ends_at) ||
    existing.status !== normalized.status
  );
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
  const shouldResetProof = hasProofImpactingChange(existing, normalized);
  const proofReset = shouldResetProof ? proofResetData() : {};
  const createData = {
    code: normalized.code,
    discount_type: normalized.discount_type,
    discount_value: normalized.discount_value,
    applies_to_type: normalized.applies_to_type,
    product_id: normalized.applies_to_type === "SPECIFIC_PRODUCT" ? normalized.product_id : null,
    sku: normalized.applies_to_type === "SPECIFIC_SKU" ? normalized.sku : null,
    collection_id: normalized.applies_to_type === "SPECIFIC_COLLECTION" ? normalized.collection_id : null,
    starts_at: normalized.starts_at,
    ends_at: normalized.ends_at,
    status: normalized.status,
    usage_limit_total: normalized.usage_limit_total,
    usage_limit_per_customer: normalized.usage_limit_per_customer,
    minimum_order_value: normalized.minimum_order_value,
    notes: normalized.notes,
    ...proofReset,
    updated_by: auditActor,
    created_by: existing?.createdBy ?? auditActor,
  } satisfies Prisma.cevonne_discountsUncheckedCreateInput;

  const updateData: Prisma.cevonne_discountsUncheckedUpdateInput = {
    code: normalized.code,
    discount_type: normalized.discount_type,
    discount_value: normalized.discount_value,
    applies_to_type: normalized.applies_to_type,
    product_id: normalized.applies_to_type === "SPECIFIC_PRODUCT" ? normalized.product_id : null,
    sku: normalized.applies_to_type === "SPECIFIC_SKU" ? normalized.sku : null,
    collection_id: normalized.applies_to_type === "SPECIFIC_COLLECTION" ? normalized.collection_id : null,
    starts_at: normalized.starts_at,
    ends_at: normalized.ends_at,
    status: normalized.status,
    usage_limit_total: normalized.usage_limit_total,
    usage_limit_per_customer: normalized.usage_limit_per_customer,
    minimum_order_value: normalized.minimum_order_value,
    notes: normalized.notes,
    updated_by: auditActor,
    ...(shouldResetProof ? proofReset : {}),
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
    ...proofResetData(),
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
    return message || "Check Proof before using this discount in content or ads.";
  }

  return message || "Check Proof before using this discount in content or ads.";
};

const PROOF_SAVE_FAILURE_MESSAGE = "Proof check could not be saved. Please try again.";

const isProofSaveFailureText = (value: string | null | undefined) => {
  const text = trimOrNull(value)?.toLowerCase() ?? "";
  if (!text) {
    return false;
  }

  return (
    text.includes("violates check constraint") ||
    text.includes("g7_offer_safety_checks_status_check") ||
    text.includes('new row for relation "g7_offer_safety_checks"') ||
    text.includes("proof check could not be saved") ||
    text.includes("g7_offer_safety_checks")
  );
};

const getProofSaveFailureMessage = (response: N8nWebhookResult) => {
  const combined = [
    response.message,
    response.response_text,
    response.fail_reason,
    ...(response.failure_reasons ?? []),
  ]
    .map((value) => trimOrNull(value))
    .filter((value): value is string => Boolean(value))
    .join(" ");

  if (response.status === "ERROR" || isProofSaveFailureText(combined)) {
    return PROOF_SAVE_FAILURE_MESSAGE;
  }

  return null;
};

const toProofSaveFailureWebhookResult = (response: N8nWebhookResult): N8nWebhookResult => ({
  ...response,
  status: "ERROR",
  message: PROOF_SAVE_FAILURE_MESSAGE,
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pickResponseText = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const candidates = [record, asRecord(record?.payload), asRecord(record?.body), asRecord(record?.data)];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        const text = trimOrNull(String(value));
        if (text) {
          return text;
        }
      }
    }
  }

  return null;
};

const normalizeComparableText = (value: string | null | undefined) => trimOrNull(value)?.toLowerCase() ?? "";

const isStaleG7ProofResponse = (
  response: N8nWebhookResult,
  expected: { sku: string; discountCode: string },
) => {
  const raw = asRecord(response.raw);
  if (!raw) {
    return false;
  }

  const responseSku = pickResponseText(raw, ["sku"]);
  const responseDiscountCode = pickResponseText(raw, ["discount_code", "discountCode"]);
  const expectedSku = normalizeComparableText(expected.sku);
  const expectedDiscountCode = normalizeComparableText(expected.discountCode);
  const actualSku = normalizeComparableText(responseSku);
  const actualDiscountCode = normalizeComparableText(responseDiscountCode);

  return (actualSku && actualSku !== expectedSku) || (actualDiscountCode && actualDiscountCode !== expectedDiscountCode);
};

const buildProofSaveFailureResponse = (proofScope: DiscountProofScope) =>
  jsonResponse(
    {
      status: "NEEDS_EVIDENCE",
      message: PROOF_SAVE_FAILURE_MESSAGE,
      handledAt: new Date().toISOString(),
      proofScope,
    },
  200,
  );

const buildG7DiscountProofPayload = (input: {
  sku: string;
  discountCode: string;
  urgencyClaim: string;
}) =>
  buildG7OfferProofPayload({
    sku: input.sku,
    discount_code: input.discountCode,
    urgency_claim: input.urgencyClaim,
    requested_by_workflow: "WEBSITE_ADMIN",
    actor: "website_admin",
    intended_use: "ORGANIC_POST",
  });

const summarizeProofResults = (results: Array<{ status?: string; proof_status?: string }>): DiscountProofSummary => {
  return results.reduce<DiscountProofSummary>(
    (summary, result) => {
      const status = result.proof_status ?? result.status ?? "";

      if (status === "PASS" || status === "VERIFIED") {
        summary.verified += 1;
      } else if (status === "NEEDS_EVIDENCE") {
        summary.needsEvidence += 1;
      } else {
        summary.blocked += 1;
      }

      summary.total += 1;
      return summary;
    },
    {
      verified: 0,
      needsEvidence: 0,
      blocked: 0,
      total: 0,
    },
  );
};

const resolveCollectionProofStatus = (summary: DiscountProofSummary): "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "PARTIALLY_VERIFIED" => {
  if (summary.total === 0) {
    return "NEEDS_EVIDENCE";
  }

  if (summary.verified === summary.total) {
    return "PASS";
  }

  if (summary.verified > 0) {
    return "PARTIALLY_VERIFIED";
  }

  if (summary.blocked > 0) {
    return "BLOCK";
  }

  return "NEEDS_EVIDENCE";
};

const buildCollectionProofMessage = (
  summary: DiscountProofSummary,
  collectionName: string | null,
  status: "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "PARTIALLY_VERIFIED",
  proofScope: DiscountProofScope,
  blockedReasons: CollectionBlockedReason[] = [],
) => {
  const collectionLabel = collectionName ? `the ${collectionName} collection` : "this collection";

  if (summary.total === 0) {
    return "No active products are available in the catalog.";
  }

  if (status === "PASS") {
    if (proofScope === "ONE_PRODUCT") {
      return "Discount is active and safe to use.";
    }

    return `This discount is verified for all products in ${collectionLabel}.`;
  }

  if (status === "PARTIALLY_VERIFIED") {
    return `Some products need attention before this discount can be used across ${collectionLabel}.`;
  }

  if (status === "BLOCK") {
    if (summary.total > 0 && blockedReasons.length === 1 && blockedReasons[0].count === summary.total) {
      const reason = blockedReasons[0].reason;
      if (/product is out of stock/i.test(reason)) {
        return "All products in this collection are currently out of stock.";
      }

      if (/discount is not linked to this product\/sku/i.test(reason)) {
        return "Discount is not linked to these products in Neon.";
      }

      if (/discount is paused/i.test(reason)) {
        return "This discount is paused.";
      }

      if (/discount has expired/i.test(reason)) {
        return "This discount has expired.";
      }

      if (/discount is not active yet/i.test(reason)) {
        return "This discount is not active yet.";
      }
    }

    return `This discount is blocked for ${collectionLabel}.`;
  }

  return `This discount needs evidence before it can be used across ${collectionLabel}.`;
};

const resolveAllProductsProofStatus = (
  summary: DiscountProofSummary,
  proofScope: DiscountProofScope,
): "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "PARTIALLY_VERIFIED" => {
  if (summary.total === 0) {
    return "NEEDS_EVIDENCE";
  }

  if (proofScope === "ONE_PRODUCT") {
    if (summary.verified > 0) {
      return "PARTIALLY_VERIFIED";
    }

    if (summary.blocked > 0) {
      return "BLOCK";
    }

    return "NEEDS_EVIDENCE";
  }

  if (summary.verified === summary.total) {
    return "PASS";
  }

  if (summary.verified > 0) {
    return "PARTIALLY_VERIFIED";
  }

  if (summary.blocked > 0) {
    return "BLOCK";
  }

  return "NEEDS_EVIDENCE";
};

const buildAllProductsProofMessage = (
  summary: DiscountProofSummary,
  status: "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "PARTIALLY_VERIFIED",
  proofScope: DiscountProofScope,
  blockedReasons: CollectionBlockedReason[] = [],
) => {
  if (summary.total === 0) {
    return "No active products are linked to this discount yet. Add products before checking proof.";
  }

  if (status === "PASS") {
    return proofScope === "ONE_PRODUCT"
      ? "Single product checked. This discount still needs proof for the rest of the products."
      : "This discount is verified for all active products.";
  }

  if (status === "PARTIALLY_VERIFIED") {
    return "Some products need attention before this discount can be used across all active products.";
  }

  if (status === "BLOCK") {
    if (summary.total > 0 && blockedReasons.length === 1 && blockedReasons[0].count === summary.total) {
      const reason = blockedReasons[0].reason;
      if (/product is out of stock/i.test(reason)) {
        return "All products in this discount are currently out of stock.";
      }

      if (/discount is not linked to this product\/sku/i.test(reason)) {
        return "Discount is not linked to these products in Neon.";
      }

      if (/discount is paused/i.test(reason)) {
        return "This discount is paused.";
      }

      if (/discount has expired/i.test(reason)) {
        return "This discount has expired.";
      }

      if (/discount is not active yet/i.test(reason)) {
        return "This discount is not active yet.";
      }
    }

    return "This discount is blocked for all active products.";
  }

  return "This discount needs evidence before it can be used across all active products.";
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

  if (second === "proof-products" && request.method === "GET") {
    const discount = await loadDiscountForEdit(first);
    if (!discount) {
      return jsonResponse({ message: "Discount not found." }, 404);
    }

    console.log("Discount proof-products route hit");
    console.log("Discount:", discount);
    console.log("Discount code:", discount.code);
    console.log("applies_to_type:", discount.appliesToType);
    console.log("collection_id:", discount.collectionId);
    console.log("collection_name:", discount.collectionName);
    console.log("collection_slug:", discount.collectionSlug);

    const prisma = await getPrisma();

    if (discount.appliesToType === "SPECIFIC_COLLECTION" && discount.collectionId) {
      const collection = await prisma.collection.findUnique({
        where: { id: discount.collectionId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
      console.log("Collection record found in Neon:", collection);
    }

    const items = await loadDiscountProofProducts(discount);
    console.log("Products found:", items.length);
    console.log("Products:", items.map((item) => ({ name: item.product_name, sku: item.sku })));
    return jsonResponse(items, 200);
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
    proofScope?: DiscountProofScope | null;
  },
) => {
  const current = await loadDiscountForEdit(discountId);
  if (!current) {
    return jsonResponse({ message: "Discount not found." }, 404);
  }

  const source = await loadG7OfferSourceRecordByDiscountId(discountId);
  const proofScope = input.proofScope === "ALL_PRODUCTS" ? "ALL_PRODUCTS" : "ONE_PRODUCT";
  const urgencyClaim = trimOrNull(input.urgencyClaim) ?? "";
  const requestedTarget = trimOrNull(input.sku) ?? "";
  const isAllProductsDiscount = isAllProductsAppliesToType(current.appliesToType);

  if (current.appliesToType === "SPECIFIC_COLLECTION" && proofScope === "ALL_PRODUCTS") {
    if (!current.collectionId) {
      return jsonResponse(
        {
          status: "NEEDS_EVIDENCE",
          message: "Choose a collection before checking proof.",
          handledAt: new Date().toISOString(),
          proofScope,
          summary: {
            verified: 0,
            needsEvidence: 0,
            blocked: 0,
            total: 0,
          },
        },
        200,
      );
    }

    const proofProducts = await loadCollectionProofProducts(current.collectionId);
    if (!proofProducts.length) {
      const summary: DiscountProofSummary = {
        verified: 0,
        needsEvidence: 0,
        blocked: 0,
        total: 0,
      };
      const message = buildCollectionProofMessage(summary, current.collectionName, "NEEDS_EVIDENCE", proofScope);
      let persisted;
      try {
        persisted = await persistDiscountProofResult(current, {
          proofScope,
          status: "NEEDS_EVIDENCE",
          message,
          summary,
          items: [],
        });
      } catch (error) {
        console.error("[discounts] failed to persist collection proof result", error);
        return buildProofSaveFailureResponse(proofScope);
      }

      return jsonResponse(
        {
          item: persisted,
          status: "NEEDS_EVIDENCE",
          message,
          handledAt: new Date().toISOString(),
          proofScope,
          summary,
          items: [],
          blockedReasons: [],
        },
        200,
      );
    }

    console.log("RUNNING G7 COLLECTION PROOF");
    console.log("Discount code:", current.code);
    console.log("Collection ID:", current.collectionId);
    console.log("Proof SKUs:", proofProducts.map((product) => product.sku));

    const localIssue = await runProofCheck(current, source, "", urgencyClaim);
    if (localIssue) {
      const forcedStatus = localIssue.status === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCKED";
      const items = proofProducts.map((product) =>
        buildCollectionProofItem({
          product,
          discount: current,
          forcedReason: normalizeCollectionReason(localIssue.message) ?? localIssue.message,
          forcedStatus,
        }),
      );
      const summary = summarizeProofResults(items);
      const blockedReasons = summarizeCollectionBlockedReasons(items);
      const status = localIssue.status;
      const message = buildCollectionProofMessage(summary, current.collectionName, status === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCK", proofScope, blockedReasons);
      let persisted;
      try {
        persisted = await persistDiscountProofResult(current, {
          proofScope,
          status: forcedStatus,
          message,
          summary,
          items,
        });
      } catch (error) {
        console.error("[discounts] failed to persist collection proof result", error);
        return buildProofSaveFailureResponse(proofScope);
      }
      return jsonResponse(
        {
          item: persisted,
          status,
          message,
          handledAt: new Date().toISOString(),
          proofScope,
          summary,
          items,
          blockedReasons,
        },
        200,
      );
    }

    const results = await Promise.allSettled(
      proofProducts.map(async (product) => {
        const payload = buildG7DiscountProofPayload({
          sku: product.sku,
          discountCode: current.code,
          urgencyClaim: urgencyClaim || "",
        });
        console.log("G7 proof endpoint:", G7_OFFER_SAFETY_CHECK_URL);
        console.log("Calling G7 with payload:", payload);

        const data = await postN8nWebhook({
          url: G7_OFFER_SAFETY_CHECK_URL,
          payload,
          source: "discounts",
        });

        if (isStaleG7ProofResponse(data, { sku: payload.sku, discountCode: current.code })) {
          console.error("[discounts] G7 collection proof response payload mismatch", {
            expectedSku: payload.sku,
            expectedDiscountCode: current.code,
            responseSku: pickResponseText(asRecord(data.raw), ["sku"]),
            responseDiscountCode: pickResponseText(asRecord(data.raw), ["discount_code", "discountCode"]),
          });
          return toProofSaveFailureWebhookResult(data);
        }

        console.log("G7 response for SKU:", product.sku, data);
        return data;
      }),
    );

    const rejectedResponse = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejectedResponse) {
      console.error("[discounts] G7 collection proof request failed", rejectedResponse.reason);
      return buildProofSaveFailureResponse(proofScope);
    }

    const saveFailureResponse = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .find((response) => response && getProofSaveFailureMessage(response));
    if (saveFailureResponse) {
      console.error("[discounts] G7 collection proof save failed", saveFailureResponse);
      return buildProofSaveFailureResponse(proofScope);
    }

    const items = proofProducts.map((product, index) => {
      const result = results[index];
      const response = result?.status === "fulfilled" ? result.value : null;
      return buildCollectionProofItem({
        product,
        discount: current,
        response,
      });
    });

    const summary = summarizeProofResults(items);
    const status = resolveCollectionProofStatus(summary);
    const blockedReasons = summarizeCollectionBlockedReasons(items);
    const persistedStatus = status === "PASS" ? "VERIFIED" : status === "BLOCK" ? "BLOCKED" : status;
    const message = buildCollectionProofMessage(summary, current.collectionName, status, proofScope, blockedReasons);
    let persisted;
    try {
      persisted = await persistDiscountProofResult(current, {
        proofScope,
        status: persistedStatus,
        message,
        summary,
        items,
      });
    } catch (error) {
      console.error("[discounts] failed to persist collection proof result", error);
      return buildProofSaveFailureResponse(proofScope);
    }

    return jsonResponse(
      {
        item: persisted,
        status,
        message,
        handledAt: new Date().toISOString(),
        proofScope,
        summary,
        items,
        blockedReasons,
      },
      200,
    );
  }

  const singleTarget = requestedTarget || (current.appliesToType === "SPECIFIC_SKU" ? current.sku ?? source?.sku ?? "" : "");

  if (isAllProductsDiscount) {
    const proofProducts = await loadDiscountProofProducts(current);
    if (!proofProducts.length) {
      const summary: DiscountProofSummary = {
        verified: 0,
        needsEvidence: 0,
        blocked: 0,
        total: 0,
      };
      const message = buildAllProductsProofMessage(summary, "NEEDS_EVIDENCE", proofScope);
      let persisted;
      try {
        persisted = await persistDiscountProofResult(current, {
          proofScope,
          status: "NEEDS_EVIDENCE",
          message,
          summary,
          items: [],
        });
      } catch (error) {
        console.error("[discounts] failed to persist all-products proof result", error);
        return buildProofSaveFailureResponse(proofScope);
      }

      return jsonResponse(
        {
          item: persisted,
          status: "NEEDS_EVIDENCE",
          message,
          handledAt: new Date().toISOString(),
          proofScope,
          summary,
          items: [],
          blockedReasons: [],
        },
        200,
      );
    }

    if (proofScope === "ONE_PRODUCT" && !requestedTarget) {
      return jsonResponse(
        {
          status: "NEEDS_EVIDENCE",
          message: "Select a product from this discount before checking proof.",
          handledAt: new Date().toISOString(),
          proofScope,
          summary: {
            verified: 0,
            needsEvidence: 0,
            blocked: 0,
            total: 0,
          },
        },
        200,
      );
    }

    const targetSku = proofScope === "ONE_PRODUCT" ? requestedTarget : "";
    const selectedProduct =
      proofScope === "ONE_PRODUCT"
        ? proofProducts.find((product) => product.sku.trim().toLowerCase() === targetSku.trim().toLowerCase()) ?? null
        : null;

    const localIssue = await runProofCheck(current, source, targetSku, urgencyClaim);
    if (localIssue) {
      const forcedStatus = localIssue.status === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCKED";
      const items =
        proofScope === "ONE_PRODUCT"
          ? selectedProduct
            ? [
                buildCollectionProofItem({
                  product: selectedProduct,
                  discount: current,
                  forcedReason: normalizeCollectionReason(localIssue.message) ?? localIssue.message,
                  forcedStatus,
                }),
              ]
            : []
          : proofProducts.map((product) =>
              buildCollectionProofItem({
                product,
                discount: current,
                forcedReason: normalizeCollectionReason(localIssue.message) ?? localIssue.message,
                forcedStatus,
              }),
            );
      const summary = summarizeProofResults(items);
      const blockedReasons = summarizeCollectionBlockedReasons(items);
      const status = localIssue.status;
      const message = buildAllProductsProofMessage(summary, status, proofScope, blockedReasons);
      let persisted;
      try {
        persisted = await persistDiscountProofResult(current, {
          proofScope,
          status: forcedStatus,
          message,
          summary,
          items,
        });
      } catch (error) {
        console.error("[discounts] failed to persist all-products proof result", error);
        return buildProofSaveFailureResponse(proofScope);
      }

      return jsonResponse(
        {
          item: persisted,
          status,
          message,
          handledAt: new Date().toISOString(),
          proofScope,
          summary,
          items,
          blockedReasons,
        },
        200,
      );
    }

    if (proofScope === "ONE_PRODUCT") {
      const payload = buildG7DiscountProofPayload({
        sku: targetSku,
        discountCode: current.code,
        urgencyClaim: urgencyClaim || "",
      });
      console.log("RUNNING G7 ALL PRODUCTS SINGLE SKU PROOF");
      console.log("G7 proof endpoint:", G7_OFFER_SAFETY_CHECK_URL);
      console.log("Calling G7 with payload:", payload);

      const response = await postN8nWebhook({
        url: G7_OFFER_SAFETY_CHECK_URL,
        payload,
        source: "discounts",
      });

      console.log("G7 response for SKU:", payload.sku, response);

      if (isStaleG7ProofResponse(response, { sku: payload.sku, discountCode: current.code })) {
        console.error("[discounts] G7 all-products proof response payload mismatch", {
          discountId,
          expectedSku: payload.sku,
          expectedDiscountCode: current.code,
          responseSku: pickResponseText(asRecord(response.raw), ["sku"]),
          responseDiscountCode: pickResponseText(asRecord(response.raw), ["discount_code", "discountCode"]),
        });
        return buildProofSaveFailureResponse(proofScope);
      }

      const saveFailureMessage = getProofSaveFailureMessage(response);
      if (saveFailureMessage) {
        console.error("[discounts] G7 all-products proof save failed", {
          discountId,
          sku: targetSku,
          response,
        });
        return buildProofSaveFailureResponse(proofScope);
      }

      if (response.status === "PASS" || response.status === "BLOCK" || response.status === "NEEDS_EVIDENCE") {
        const summary = {
          verified: response.status === "PASS" ? 1 : 0,
          needsEvidence: response.status === "NEEDS_EVIDENCE" ? 1 : 0,
          blocked: response.status === "BLOCK" ? 1 : 0,
          total: 1,
        };
        const supabaseStatus = response.status === "PASS" ? "PASS" : response.status === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCK";
        const neonProofStatus = supabaseStatus === "PASS" ? "PARTIALLY_VERIFIED" : supabaseStatus === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCKED";
        let persisted;
        try {
          persisted = await persistDiscountProofResult(current, {
            proofScope,
            status: neonProofStatus,
            message:
              response.status === "PASS"
                ? "Single product checked. This discount still needs proof for the rest of the products."
                : buildProofStatusMessage(supabaseStatus, response.message),
            summary,
            items: [],
          });
        } catch (error) {
          console.error("[discounts] failed to persist all-products proof result", error);
          return buildProofSaveFailureResponse(proofScope);
        }

        return jsonResponse(
          {
            item: persisted,
            status: neonProofStatus,
            message:
              neonProofStatus === "PARTIALLY_VERIFIED"
                ? "Single product checked. This discount still needs proof for the rest of the products."
                : buildProofStatusMessage(supabaseStatus, response.message),
            handledAt: response.handled_at ?? new Date().toISOString(),
            proofScope,
            summary,
          },
          200,
        );
      }

      return jsonResponse(
        {
          status: "BLOCK",
          message: "Check Proof before using this discount in content or ads.",
          handledAt: new Date().toISOString(),
          proofScope,
        },
        200,
      );
    }

    console.log("RUNNING G7 ALL PRODUCTS PROOF");
    console.log("Discount code:", current.code);
    console.log("Proof SKUs:", proofProducts.map((product) => product.sku));

    const results = await Promise.allSettled(
      proofProducts.map(async (product) => {
        const payload = buildG7DiscountProofPayload({
          sku: product.sku,
          discountCode: current.code,
          urgencyClaim: urgencyClaim || "",
        });
        console.log("G7 proof endpoint:", G7_OFFER_SAFETY_CHECK_URL);
        console.log("Calling G7 with payload:", payload);

        const data = await postN8nWebhook({
          url: G7_OFFER_SAFETY_CHECK_URL,
          payload,
          source: "discounts",
        });

        if (isStaleG7ProofResponse(data, { sku: payload.sku, discountCode: current.code })) {
          console.error("[discounts] G7 all-products proof response payload mismatch", {
            expectedSku: payload.sku,
            expectedDiscountCode: current.code,
            responseSku: pickResponseText(asRecord(data.raw), ["sku"]),
            responseDiscountCode: pickResponseText(asRecord(data.raw), ["discount_code", "discountCode"]),
          });
          return toProofSaveFailureWebhookResult(data);
        }

        console.log("G7 response for SKU:", product.sku, data);
        return data;
      }),
    );

    const rejectedResponse = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejectedResponse) {
      console.error("[discounts] G7 all-products proof request failed", rejectedResponse.reason);
      return buildProofSaveFailureResponse(proofScope);
    }

    const saveFailureResponse = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .find((response) => response && getProofSaveFailureMessage(response));
    if (saveFailureResponse) {
      console.error("[discounts] G7 all-products proof save failed", saveFailureResponse);
      return buildProofSaveFailureResponse(proofScope);
    }

    const items = proofProducts.map((product, index) => {
      const result = results[index];
      const response = result?.status === "fulfilled" ? result.value : null;
      return buildCollectionProofItem({
        product,
        discount: current,
        response,
      });
    });

    const summary = summarizeProofResults(items);
    const status = resolveAllProductsProofStatus(summary, proofScope);
    const blockedReasons = summarizeCollectionBlockedReasons(items);
    const persistedStatus = status === "PASS" ? "VERIFIED" : status === "BLOCK" ? "BLOCKED" : status;
    const message = buildAllProductsProofMessage(summary, status, proofScope, blockedReasons);
    let persisted;
    try {
      persisted = await persistDiscountProofResult(current, {
        proofScope,
        status: persistedStatus,
        message,
        summary,
        items,
      });
    } catch (error) {
      console.error("[discounts] failed to persist all-products proof result", error);
      return buildProofSaveFailureResponse(proofScope);
    }

    return jsonResponse(
      {
        item: persisted,
        status,
        message,
        handledAt: new Date().toISOString(),
        proofScope,
        summary,
        items,
        blockedReasons,
      },
      200,
    );
  }

  if (!singleTarget) {
    return jsonResponse(
      {
        status: "NEEDS_EVIDENCE",
        message: "Select a product or SKU before running proof check.",
        handledAt: new Date().toISOString(),
        proofScope,
      },
      200,
    );
  }

  const localIssue = await runProofCheck(current, source, singleTarget, urgencyClaim);
  if (localIssue) {
    const status = localIssue.status;
    return jsonResponse(
      {
        status,
        message: buildProofStatusMessage(status, localIssue.message),
        handledAt: new Date().toISOString(),
        proofScope,
      },
      200,
    );
  }

  const payload = buildG7DiscountProofPayload({
    sku: singleTarget || source?.sku || current.sku || "",
    discountCode: current.code,
    urgencyClaim: urgencyClaim || "",
  });
  console.log("RUNNING G7 SINGLE SKU PROOF");
  console.log("G7 proof endpoint:", G7_OFFER_SAFETY_CHECK_URL);
  console.log("Calling G7 with payload:", payload);

  const response = await postN8nWebhook({
    url: G7_OFFER_SAFETY_CHECK_URL,
    payload,
    source: "discounts",
  });

  console.log("G7 response for SKU:", payload.sku, response);

  if (isStaleG7ProofResponse(response, { sku: payload.sku, discountCode: current.code })) {
    console.error("[discounts] G7 proof response payload mismatch", {
      discountId,
      expectedSku: payload.sku,
      expectedDiscountCode: current.code,
      responseSku: pickResponseText(asRecord(response.raw), ["sku"]),
      responseDiscountCode: pickResponseText(asRecord(response.raw), ["discount_code", "discountCode"]),
    });
    return buildProofSaveFailureResponse(proofScope);
  }

  const saveFailureMessage = getProofSaveFailureMessage(response);
  if (saveFailureMessage) {
      console.error("[discounts] G7 proof save failed", {
      discountId: discountId,
      sku: singleTarget,
      response,
    });
    return buildProofSaveFailureResponse(proofScope);
  }

  if (response.status === "PASS" || response.status === "BLOCK" || response.status === "NEEDS_EVIDENCE") {
    const summary = {
      verified: response.status === "PASS" ? 1 : 0,
      needsEvidence: response.status === "NEEDS_EVIDENCE" ? 1 : 0,
      blocked: response.status === "BLOCK" ? 1 : 0,
      total: 1,
    };
    const supabaseStatus = response.status === "PASS" ? "PASS" : response.status === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCK";
    const neonProofStatus = supabaseStatus === "PASS" ? "VERIFIED" : supabaseStatus === "NEEDS_EVIDENCE" ? "NEEDS_EVIDENCE" : "BLOCKED";
    let persisted;
    try {
      persisted = await persistDiscountProofResult(current, {
        proofScope,
        status: neonProofStatus,
        message:
          response.status === "PASS"
            ? "Discount is active and safe to use."
            : buildProofStatusMessage(supabaseStatus, response.message),
        summary,
        items: [],
      });
    } catch (error) {
      console.error("[discounts] failed to persist proof result", error);
      return buildProofSaveFailureResponse(proofScope);
    }

    return jsonResponse(
      {
        item: persisted,
        status: supabaseStatus,
        message:
          supabaseStatus === "PASS" ? "Discount is active and safe to use." : buildProofStatusMessage(supabaseStatus, response.message),
        handledAt: response.handled_at ?? new Date().toISOString(),
        proofScope,
        summary,
      },
      200,
    );
  }

  return jsonResponse(
    {
      status: "BLOCK",
      message: "Check Proof before using this discount in content or ads.",
      handledAt: new Date().toISOString(),
      proofScope,
    },
    200,
  );
};
