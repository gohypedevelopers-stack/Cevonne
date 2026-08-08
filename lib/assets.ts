import { normalizeUploadedAssetUrl } from "@/lib/asset-url";

const ASSET_BASE = "/assets";
const IMAGE_BASE = `${ASSET_BASE}/images`;
const BACKGROUND_BASE = `${ASSET_BASE}/background`;
const VIDEO_BASE = `${ASSET_BASE}/video`;
const HERO_IMAGE_MOBILE = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2012_36_00%20PM.png";
const HERO_IMAGE_DESKTOP = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2012_38_05%20PM.png";
const HOME_BANNER_IMAGE_DESKTOP = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2002_31_12%20PM.png";
const HOME_BANNER_IMAGE_MOBILE = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2002_31_17%20PM.png";
const HOME_BANNER_2_IMAGE_DESKTOP = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2002_45_57%20PM.png";
const HOME_BANNER_2_IMAGE_MOBILE = "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%208%2C%202026%2C%2002_46_02%20PM.png";

export const assetSrc = (asset) => {
  if (!asset) return "";
  if (typeof asset === "string") return asset;
  return asset.src || asset.default || "";
};

export const STATIC_ASSETS = {
  logoNavbar: "/logo.svg?v=black",
  logoMain: "/logo.svg?v=black",
  heroImage: HERO_IMAGE_DESKTOP,
  heroImageMobile: HERO_IMAGE_MOBILE,
  heroImageDesktop: HERO_IMAGE_DESKTOP,
  homeBannerDesktop: HOME_BANNER_IMAGE_DESKTOP,
  homeBannerMobile: HOME_BANNER_IMAGE_MOBILE,
  homeBanner2Desktop: HOME_BANNER_2_IMAGE_DESKTOP,
  homeBanner2Mobile: HOME_BANNER_2_IMAGE_MOBILE,
  collectionFallback: `${IMAGE_BASE}/product1.png`,
  cardBackground: `${BACKGROUND_BASE}/card-bg.svg`,
  introVideo1: `${VIDEO_BASE}/intro1.mp4`,
  introVideo2: `${VIDEO_BASE}/intro2.mp4`,
  introVideo3: `${VIDEO_BASE}/intro3.mp4`,
};

const PRODUCT_ASSETS = {
  "product1.png": `${IMAGE_BASE}/product1.png`,
  "product2.png": `${IMAGE_BASE}/product2.png`,
  "product3.png": `${IMAGE_BASE}/product3.png`,
  "product4.png": `${IMAGE_BASE}/product4.png`,
  "product5.png": `${IMAGE_BASE}/product5.png`,
  "product6.png": `${IMAGE_BASE}/product6.png`,
  "product7.png": `${IMAGE_BASE}/product7.png`,
  "product8.png": `${IMAGE_BASE}/product8.png`,
  "product9.png": `${IMAGE_BASE}/product9.png`,
  "product10.png": `${IMAGE_BASE}/product10.png`,
  "product11.png": `${IMAGE_BASE}/product11.png`,
  "product12.png": `${IMAGE_BASE}/product12.png`,
};

const PRODUCT_ALIASES = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => {
    const key = `product${index + 1}`;
    return [key, PRODUCT_ASSETS[`${key}.png`]];
  })
);

const MEDIA_ASSETS = {
  "intro1.mp4": STATIC_ASSETS.introVideo1,
  "intro2.mp4": STATIC_ASSETS.introVideo2,
  "intro3.mp4": STATIC_ASSETS.introVideo3,
  intro1: STATIC_ASSETS.introVideo1,
  intro2: STATIC_ASSETS.introVideo2,
  intro3: STATIC_ASSETS.introVideo3,
};

const isAbsoluteAsset = (value) =>
  /^(https?:|data:|blob:|\/)/i.test(value);

const normalizeAssetName = (value = "") =>
  String(value).trim().split("?")[0].split("#")[0];

const normalizeStoredAssetUrl = (value = "") => normalizeUploadedAssetUrl(value) || normalizeAssetName(value);

export const resolveProductAsset = (value, fallback = PRODUCT_ASSETS["product1.png"]) => {
  if (!value) return fallback;

  const clean = normalizeStoredAssetUrl(value);
  if (isAbsoluteAsset(clean)) return clean;

  const basename = clean.split("/").pop();
  if (!basename) return fallback;

  return PRODUCT_ASSETS[basename] || PRODUCT_ALIASES[basename] || fallback;
};

export const resolveMediaAsset = (value, fallback = STATIC_ASSETS.introVideo1) => {
  if (!value) return fallback;

  const clean = normalizeStoredAssetUrl(value);
  if (isAbsoluteAsset(clean)) return clean;

  const basename = clean.split("/").pop();
  if (!basename) return fallback;

  return MEDIA_ASSETS[basename] || fallback;
};

export const DEFAULT_PRODUCT_IMAGE = PRODUCT_ASSETS["product1.png"];
