export const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ReviewMedia {
  id: string;
  url: string;
  reviewId: string;
  createdAt?: Date | string;
}

export interface ReviewUserRef {
  id: string;
  name: string | null;
  email: string;
}

export interface ReviewProductRef {
  id: string;
  name: string;
  slug: string;
}

export interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  status: ReviewStatus;
  productId: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  media?: ReviewMedia[];
  user?: ReviewUserRef;
  product?: ReviewProductRef;
}
