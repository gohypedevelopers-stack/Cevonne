"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { API_BASE } from "@/lib/api";
import { STATIC_ASSETS } from "@/lib/assets";
import type { ProductCollection } from "@/types/product";

const MAX_VISIBLE_COLLECTIONS = 8;

const normalizeCollections = (payload: unknown): ProductCollection[] => {
  const items = Array.isArray(payload)
    ? payload
    : (payload as { data?: unknown } | null)?.data;

  return Array.isArray(items) ? (items as ProductCollection[]) : [];
};

const getCollectionImage = (collection: ProductCollection) => {
  const mediaImage = collection.media?.find((item) => item.kind === "IMAGE")?.url;
  const source = collection.imageUrl || mediaImage || STATIC_ASSETS.collectionFallback;

  return encodeURI(source);
};

const CollectionSection = () => {
  const [collections, setCollections] = useState<ProductCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/collections`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load collections");
        return normalizeCollections(await response.json());
      })
      .then((items) => {
        if (!cancelled) setCollections(items);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load collections");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCollections = collections.slice(0, MAX_VISIBLE_COLLECTIONS);

  return (
    <section className="w-full bg-white px-0 py-14 sm:py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <h2 className="mx-auto mb-9 max-w-none text-center font-sans text-[25px] font-normal leading-[1.2] tracking-tight text-neutral-950 sm:mb-11 sm:whitespace-nowrap sm:text-[30px] md:text-[34px]">
          Explore Cevonne&apos;s Signature Collections
        </h2>

        {loading ? (
          <p className="py-12 text-center text-sm text-neutral-500" role="status">
            Loading collections...
          </p>
        ) : visibleCollections.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-4">
            {visibleCollections.map((collection) => {
              const collectionKey = collection.slug || collection.id;
              const collectionName = collection.name || "Collection";

              return (
                <Link
                  key={collection.id}
                  to={`/search?collection=${encodeURIComponent(collectionKey)}`}
                  className="block text-center"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-[#f3f2ef]">
                    <img
                      src={getCollectionImage(collection)}
                      alt={collection.media?.find((item) => item.kind === "IMAGE")?.alt || collectionName}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p className="mt-4 text-[13px] font-normal tracking-[0.01em] text-neutral-900 sm:mt-5 sm:text-sm">
                    {collectionName}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-neutral-500">
            {error || "No collections available yet."}
          </p>
        )}
      </div>
    </section>
  );
};

export default CollectionSection;
