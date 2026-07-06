CREATE TABLE IF NOT EXISTS public.cevonne_discounts (
  discount_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL,
  discount_value numeric(10, 2),
  applies_to_type text NOT NULL,
  product_id text,
  sku text,
  collection_id text,
  starts_at timestamptz(6),
  ends_at timestamptz(6),
  status text NOT NULL DEFAULT 'DRAFT',
  usage_limit_total integer,
  usage_limit_per_customer integer,
  used_count integer NOT NULL DEFAULT 0,
  minimum_order_value numeric(10, 2),
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  archived_at timestamptz(6)
);

CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_applies_to_type ON public.cevonne_discounts (applies_to_type);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_collection ON public.cevonne_discounts (collection_id);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_code ON public.cevonne_discounts (code);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_ends_at ON public.cevonne_discounts (ends_at);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_product ON public.cevonne_discounts (product_id);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_sku ON public.cevonne_discounts (sku);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_starts_at ON public.cevonne_discounts (starts_at);
CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_status ON public.cevonne_discounts (status);

CREATE OR REPLACE VIEW public.g7_offer_source_view AS
WITH representative_variant AS (
  SELECT
    d.discount_id,
    d.code AS discount_code,
    d.discount_type,
    d.discount_value,
    CASE
      WHEN upper(d.discount_type) = 'PERCENTAGE' THEN d.discount_value
      ELSE NULL
    END AS discount_percent,
    d.applies_to_type,
    d.product_id,
    d.sku,
    d.collection_id,
    d.status AS discount_status,
    d.starts_at AS discount_starts_at,
    d.ends_at AS discount_ends_at,
    d.archived_at,
    d.updated_at,
    d.created_at,
    p.id AS product_ref_id,
    p.name AS product_name,
    p.slug AS product_slug,
    CASE WHEN p.id IS NOT NULL THEN 'ACTIVE' ELSE 'MISSING' END AS product_status,
    v.id AS variant_id,
    CASE WHEN v.id IS NOT NULL THEN 'ACTIVE' ELSE 'MISSING' END AS variant_status,
    snap.quantity AS stock_available,
    COALESCE(snap.source_name, snap.source_type) AS stock_source,
    snap.captured_at AS stock_checked_at,
    second_snap.quantity AS second_stock_available,
    COALESCE(second_snap.source_name, second_snap.source_type) AS second_stock_source,
    second_snap.evidence_url AS second_stock_evidence_url,
    second_snap.captured_at AS second_stock_checked_at,
    CASE
      WHEN p.slug IS NOT NULL THEN CONCAT('/products/', p.slug)
      ELSE NULL
    END AS product_url,
    CASE
      WHEN p.slug IS NOT NULL THEN CONCAT('/products/', p.slug)
      WHEN c.slug IS NOT NULL THEN CONCAT('/collections/', c.slug)
      ELSE NULL
    END AS offer_url,
    now() AS fetched_at
  FROM public.cevonne_discounts d
  LEFT JOIN LATERAL (
    SELECT s.*
    FROM "Shade" s
    WHERE (
      d.sku IS NOT NULL
      AND s.sku = d.sku
    )
      OR (
        d.product_id IS NOT NULL
        AND s."productId" = d.product_id
      )
      OR (
        d.collection_id IS NOT NULL
        AND s."productId" IN (
          SELECT p2.id
          FROM "Product" p2
          WHERE p2."collectionId" = d.collection_id
        )
      )
    ORDER BY
      CASE
        WHEN d.sku IS NOT NULL AND s.sku = d.sku THEN 0
        WHEN d.product_id IS NOT NULL AND s."productId" = d.product_id THEN 1
        ELSE 2
      END,
      s."createdAt" DESC
    LIMIT 1
  ) v ON TRUE
  LEFT JOIN "Product" p
    ON p.id = COALESCE(d.product_id, v."productId")
  LEFT JOIN "Collection" c
    ON c.id = d.collection_id
  LEFT JOIN LATERAL (
    SELECT g.quantity, g.source_type, g.source_name, g.evidence_url, g.captured_at
    FROM public.g7_inventory_snapshots g
    WHERE g.sku = COALESCE(d.sku, v.sku)
    ORDER BY g.captured_at DESC
    LIMIT 1
  ) snap ON TRUE
  LEFT JOIN LATERAL (
    SELECT g.quantity, g.source_type, g.source_name, g.evidence_url, g.captured_at
    FROM public.g7_inventory_snapshots g
    WHERE g.sku = COALESCE(d.sku, v.sku)
    ORDER BY g.captured_at DESC
    OFFSET 1
    LIMIT 1
  ) second_snap ON TRUE
)
SELECT
  discount_id,
  discount_code,
  discount_type,
  discount_value,
  discount_percent,
  applies_to_type,
  product_id,
  sku,
  collection_id,
  discount_status,
  discount_starts_at,
  discount_ends_at,
  archived_at,
  product_ref_id,
  product_name,
  product_slug,
  product_status,
  variant_id,
  variant_status,
  stock_available,
  stock_source,
  stock_checked_at,
  second_stock_available,
  second_stock_source,
  second_stock_evidence_url,
  second_stock_checked_at,
  product_url,
  offer_url,
  fetched_at
FROM representative_variant;
