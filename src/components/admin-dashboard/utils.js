export const API_BASE =
  import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:5000/api";

export const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short" });

export const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-");

export const toNumber = (value) => Number(value ?? 0);

export const formatCurrency = (value = 0) =>
  Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const getProductStock = (product) =>
  Array.isArray(product?.shades)
    ? product.shades.reduce(
        (acc, shade) => acc + (shade.inventory?.quantity ?? 0),
        0
      )
    : 0;
