export const USER_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
});

export const REVIEW_STATUSES = Object.freeze({
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
});

export const ORDER_STATUSES = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  FULFILLED: "FULFILLED",
});

export const DEFAULT_LIMITS = Object.freeze({
  productSearchLimit: 50,
  inventoryLowStockThreshold: 10,
  uploadMaxBytes: 5 * 1024 * 1024,
  reviewMediaMaxItems: 6,
  passwordMinLength: 6,
});
