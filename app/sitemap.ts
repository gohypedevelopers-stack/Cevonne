import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

const publicRoutes = [
  "",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/shipping-delivery",
  "/cancellation-return",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
