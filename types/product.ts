export interface ProductCollection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  productId?: string;
  createdAt?: Date | string;
}

export interface ProductInventory {
  id: string;
  quantity: number;
  shadeId: string;
  updatedAt?: Date | string;
}

export interface ProductShade {
  id: string;
  name: string;
  slug?: string | null;
  hexColor: string;
  hex?: string | null;
  sku?: string | null;
  price?: number | string | null;
  productId?: string | null;
  arAssetUrl?: string | null;
  arPreviewUrl?: string | null;
  arCode?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  inventory?: ProductInventory | null;
  product?: ProductRef | null;
}

export interface ProductRef {
  id: string;
  name: string;
  slug: string;
  collectionId?: string | null;
  collection?: ProductCollection | null;
}

export interface ProductReviewSummary {
  averageRating?: number | null;
  reviewCount?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  finish?: string | null;
  basePrice: number | string;
  quantity?: number | string | null;
  price?: number | string | null;
  originalValue?: number | string | null;
  currency?: string | null;
  brand?: string | null;
  productType?: string | null;
  tags?: unknown;
  badges?: unknown;
  media?: unknown;
  pricing?: unknown;
  ingredients?: unknown;
  size?: unknown;
  setContents?: unknown;
  experience?: unknown;
  collectionId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  collection?: ProductCollection | null;
  images?: ProductImage[];
  reviews?: unknown[];
  shades?: ProductShade[];
  _count?: {
    reviews?: number;
    shades?: number;
  };
}
