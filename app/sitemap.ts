import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { getPrisma } from "@/server/db/prisma";

export const revalidate = 3600;

const publicRoutes = [
  "",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/shipping-delivery",
  "/cancellation-return",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticPages: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));

  try {
    const prisma = await getPrisma();
    const products = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    const productPages: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt,
    }));

    return [...staticPages, ...productPages];
  } catch {
    // Keep the sitemap available if the database is temporarily unavailable.
    return staticPages;
  }
}
