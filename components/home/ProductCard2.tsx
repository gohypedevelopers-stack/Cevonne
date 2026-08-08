"use client";

import React, { useMemo, useState } from "react";
import { Heart, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/lib/router";

import { useProductsCatalog } from "@/hooks/useProductsCatalog";
import { DEFAULT_PRODUCT_IMAGE, STATIC_ASSETS, resolveProductAsset } from "@/lib/assets";

const resolveAsset = (pth = "") => {
  if (!pth) return DEFAULT_PRODUCT_IMAGE;
  return resolveProductAsset(pth, DEFAULT_PRODUCT_IMAGE);
};

type ProductCardItem = {
  id: string;
  image: string;
  name: string;
};

const mapProduct = (product): ProductCardItem | null => {
  if (!product) return null;
  const galleryItems = Array.isArray(product.media?.gallery) ? product.media.gallery : [];
  const hero =
    product.media?.heroImage ||
    galleryItems.find((g) => g.role === "hero")?.url ||
    galleryItems.find((g) => g.role === "hero")?.id ||
    galleryItems[0]?.url ||
    galleryItems[0]?.id ||
    product.images?.[0]?.url ||
    "";
  return {
    id: product.slug || product.id,
    image: resolveAsset(hero),
    name: product.name,
  };
};

const INITIAL_VISIBLE = 4;

const ProductCard2 = () => {
  const [expanded, setExpanded] = useState(false);
  const { products: list, loading } = useProductsCatalog();

  const products = useMemo<ProductCardItem[]>(
    () =>
      Array.isArray(list)
        ? list.map(mapProduct).filter((product): product is ProductCardItem => Boolean(product))
        : [],
    [list]
  );

  const visible = expanded ? products : products.slice(0, INITIAL_VISIBLE);

  return (
    <section className="w-full bg-white px-0 py-10">
      <div className="mx-auto mb-8 max-w-2xl px-4 text-center sm:mb-10">
        <h2 className="font-sans text-[26px] font-normal leading-tight tracking-tight text-neutral-950 sm:text-[32px]">
          Explore Cevonne&apos;s Beauty Essentials
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-normal leading-relaxed text-neutral-500 sm:text-[15px]">
          Discover effortless color and care, crafted to become part of your everyday ritual.
        </p>
      </div>

      {/* Product grid */}
      <div className="flex w-full snap-x snap-mandatory gap-0 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:pb-0 lg:grid-cols-4 no-scrollbar">
        {visible.map((product) => (
          <div
            key={product.id}
            className="relative flex min-w-[85vw] flex-col justify-between overflow-hidden bg-white text-center min-h-[420px] snap-center sm:min-w-0"
          >
            {/* Background behind everything */}
            <img
              src={STATIC_ASSETS.cardBackground}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Card content (wrapped with Link to details) */}
            <Link
              to={`/product/${product.id}`}
              className="relative z-10 flex h-full flex-col"
            >
              {/* Top row */}
              <div className="absolute left-2 top-2 flex items-center gap-2 text-xs font-medium text-black">
                <span className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-full">
                  <Video className="h-4 w-4" />
                  Virtual Try On
                </span>
              </div>

              {/* Wishlist (kept as a separate button, not inside Link for a11y) */}
              <button
                type="button"
                aria-label="Add to wishlist"
                className="absolute right-2 top-2 z-20 p-1 rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: handle wishlist here
                }}
              >
                <Heart className="h-4 w-4" />
              </button>

              {/* Image area */}
              <div className="relative flex flex-1 items-center justify-center px-4 pt-12 pb-2">
                <div className="relative flex items-center justify-center w-full">
                  {/* Left arrow */}
                  <button
                    type="button"
                    className="absolute left-0 z-10 flex items-center justify-center p-1 rounded-full"
                    onClick={(e) => e.preventDefault()}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <img
                    src={product.image}
                    alt={product.name}
                    className="max-h-[500px] w-full object-contain"
                  />

                  {/* Right arrow */}
                  <button
                    type="button"
                    className="absolute right-0 z-10 flex items-center justify-center p-1 rounded-full"
                    onClick={(e) => e.preventDefault()}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="mt-2 px-4 pb-6 text-sm text-left">
                <p className="text-[12px] leading-none text-neutral-500">New · Refillable</p>
                <div className="mt-1 flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-neutral-800">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#AD0F23]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#BF4A57]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8E0F1E]" />
                    <span className="ml-2 text-[12px] leading-none text-neutral-600">+ 24</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* View more / less */}
      {products.length > INITIAL_VISIBLE && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="rounded-full border border-neutral-400 px-8 py-2 text-sm font-medium hover:bg-neutral-100"
            aria-expanded={expanded}
          >
            {expanded ? "View Less" : "View More"}
          </button>
        </div>
      )}
      {!products.length && !loading && (
        <div className="mt-6 text-center text-sm text-neutral-500">
          No products available.
        </div>
      )}
    </section>
  );
};

export default ProductCard2;
