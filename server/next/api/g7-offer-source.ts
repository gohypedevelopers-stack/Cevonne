import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db/prismaClient";

export type G7OfferSourceRecord = {
  discountId: string;
  discountCode: string;
  discountType: string;
  discountValue: number | null;
  discountPercent: number | null;
  appliesToType: string;
  productId: string | null;
  sku: string | null;
  collectionId: string | null;
  discountStatus: string;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  archivedAt: string | null;
  productRefId: string | null;
  productName: string | null;
  productSlug: string | null;
  productStatus: string | null;
  variantId: string | null;
  variantStatus: string | null;
  stockAvailable: number | null;
  stockSource: string | null;
  stockCheckedAt: string | null;
  secondStockAvailable: number | null;
  secondStockSource: string | null;
  secondStockEvidenceUrl: string | null;
  secondStockCheckedAt: string | null;
  productUrl: string | null;
  offerUrl: string | null;
  fetchedAt: string | null;
};

const toIsoString = (value: unknown) => {
  if (!value) {
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

const toText = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

const normalizeRow = (row: Record<string, unknown>): G7OfferSourceRecord => ({
  discountId: toText(row.discount_id) ?? "",
  discountCode: toText(row.discount_code) ?? "",
  discountType: toText(row.discount_type) ?? "",
  discountValue: toNumber(row.discount_value),
  discountPercent: toNumber(row.discount_percent),
  appliesToType: toText(row.applies_to_type) ?? "",
  productId: toText(row.product_id),
  sku: toText(row.sku),
  collectionId: toText(row.collection_id),
  discountStatus: toText(row.discount_status) ?? "",
  discountStartsAt: toIsoString(row.discount_starts_at),
  discountEndsAt: toIsoString(row.discount_ends_at),
  archivedAt: toIsoString(row.archived_at),
  productRefId: toText(row.product_ref_id),
  productName: toText(row.product_name),
  productSlug: toText(row.product_slug),
  productStatus: toText(row.product_status),
  variantId: toText(row.variant_id),
  variantStatus: toText(row.variant_status),
  stockAvailable: toNumber(row.stock_available),
  stockSource: toText(row.stock_source),
  stockCheckedAt: toIsoString(row.stock_checked_at),
  secondStockAvailable: toNumber(row.second_stock_available),
  secondStockSource: toText(row.second_stock_source),
  secondStockEvidenceUrl: toText(row.second_stock_evidence_url),
  secondStockCheckedAt: toIsoString(row.second_stock_checked_at),
  productUrl: toText(row.product_url),
  offerUrl: toText(row.offer_url),
  fetchedAt: toIsoString(row.fetched_at),
});

const isMissingViewError = (error: unknown) => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return (
    code === "42P01" || 
    code === "42703" || 
    /relation .*g7_offer_source_view.* does not exist/i.test(message) ||
    /column "discount_id" does not exist/i.test(message)
  );
};

const loadSourceRecord = async (query: Prisma.Sql): Promise<G7OfferSourceRecord | null> => {
  const prisma = await getPrisma();

  try {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>(query);
    const row = Array.isArray(rows) ? rows[0] : null;
    return row ? normalizeRow(row) : null;
  } catch (error) {
    if (isMissingViewError(error)) {
      return null;
    }

    throw error;
  }
};

export const loadG7OfferSourceRecordByCode = async (discountCode: string) => {
  const code = discountCode.trim();
  if (!code) {
    return null;
  }

  return loadSourceRecord(Prisma.sql`
    SELECT *
    FROM public.g7_offer_source_view
    WHERE discount_code = ${code}
    LIMIT 1
  `);
};

export const loadG7OfferSourceRecordByDiscountId = async (discountId: string) => {
  const id = discountId.trim();
  if (!id) {
    return null;
  }

  return loadSourceRecord(Prisma.sql`
    SELECT *
    FROM public.g7_offer_source_view
    WHERE discount_id = ${id}
    LIMIT 1
  `);
};

