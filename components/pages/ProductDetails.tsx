"use client";

// src/components/pages/ProductDetails.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "@/lib/router";
import {
  Star, StarHalf, Truck, ShieldCheck, Recycle, Sparkles, X,
  ShoppingCart, Heart, Share2, BadgeCheck, ChevronLeft, ChevronRight,
  ThumbsUp, MessageSquare, CheckCircle2, Video,
} from "lucide-react";
import { toast } from "sonner";
import VideoHero from "@/components/media/VideoHero";
import { DEFAULT_PRODUCT_IMAGE, STATIC_ASSETS, resolveMediaAsset, resolveProductAsset } from "@/lib/assets";
import cevonneProducts, { productById as cevonneProductIndex } from "@/data/cevonneProducts";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";
import { useProductsCatalog } from "@/hooks/useProductsCatalog";
import { API_BASE, HAS_API_BASE } from "@/lib/api";
import sampleProduct from "@/data/sampleProduct.json";

const BASE_PRODUCT = cevonneProducts?.[0] || {};
const SAMPLE_CONTENT = sampleProduct || {};
const BASE_GALLERY = Array.isArray(BASE_PRODUCT?.media?.gallery)
  ? BASE_PRODUCT.media.gallery.map((g) => g.url || g.id).filter(Boolean)
  : [];
const findSampleProduct = (slug = "") => {
  if (!slug) return null;
  const raw = String(slug).trim();
  const key = raw.toLowerCase();
  return (
    cevonneProductIndex?.[raw] ||
    cevonneProductIndex?.[key] ||
    cevonneProducts.find(
      (item) =>
        item.id?.toLowerCase() === key ||
        item.slug?.toLowerCase() === key
    ) ||
    null
  );
};

const EMPTY_PRODUCT_VIEW = {
  id: "",
  slug: "",
  title: "",
  name: "",
  subtitle: "",
  longDescription: "",
  hero: {},
  theme: {},
  gallery: [],
  badges: [],
  benefits: [],
  ingredients_highlight: [],
  ingredients_supporting: [],
  ingredientsNote: "",
  how_to_use: [],
  claims: [],
  faqs: [],
  tags: [],
  brand: "",
  type: "",
  productType: "",
  shipping: "",
  returns: "",
  reviews: 0,
  rating: 0,
  mrp: null,
  price: 0,
  currency: "INR",
  reviewsList: [],
  finish: "",
  coverage: "",
  fragrance: "",
  videoTitle: "",
  videoDescription: "",
  ingredientsTitle: "",
  videoUrl: "",
  shades: [],
};

function resolveAsset(pth = "") {
  if (!pth) return "";
  return resolveProductAsset(pth, DEFAULT_PRODUCT_IMAGE);
}

function resolveMedia(pth = "") {
  if (!pth) return "";
  return resolveMediaAsset(pth, STATIC_ASSETS.introVideo1);
}

/* ---------- UI bits ---------- */
const RatingStars = ({ value = 0 }) => {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Rating ${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < full ? <Star key={i} className="h-4 w-4 fill-current" /> :
        i === full && half ? <StarHalf key={i} className="h-4 w-4 fill-current" /> :
          <Star key={i} className="h-4 w-4" />
      )}
    </div>
  );
};



/* Ultra-smooth crossfade (images ignore pointer events so clicks reach the chip) */
const fadeMs = 160;
function SmoothImage({ src, alt, className = "" }) {
  const [current, setCurrent] = useState(src || "");
  const [incoming, setIncoming] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!src || src === current) return;
    const img = new Image();
    img.onload = () => setIncoming(src);
    img.src = src;
  }, [src, current]);

  useEffect(() => {
    if (!incoming) return;
    setIsTransitioning(true);
    const t = setTimeout(() => {
      setCurrent(incoming);
      setIncoming("");
      setIsTransitioning(false);
    }, fadeMs);
    return () => clearTimeout(t);
  }, [incoming]);

  const transitionStyle = {
    transition: `opacity ${fadeMs}ms ease`,
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {current && (
        <img
          src={current}
          alt={alt}
          className="pointer-events-none block h-full w-full object-cover will-change-transform"
          style={{
            ...transitionStyle,
            opacity: isTransitioning ? 0 : 1,
          }}
          draggable={false}
        />
      )}
      {incoming && (
        <img
          src={incoming}
          alt={alt}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            ...transitionStyle,
            opacity: isTransitioning ? 1 : 0,
          }}
          draggable={false}
        />
      )}
    </div>
  );
}

/* Background cross-fader */
function BackgroundFader({ background, duration = 1100, easing = "cubic-bezier(0.16,1,0.3,1)" }) {
  const [base, setBase] = useState(background);
  const [overlay, setOverlay] = useState(background);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (background === base) return;
    setOverlay(background);
    const raf = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => {
      setBase(background);
      setShow(false);
    }, duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [background, base, duration]);

  return (
    <>
      <div className="fixed inset-0 -z-20" style={{ background: base }} aria-hidden />
      <div
        className="fixed inset-0 -z-10 transition-opacity"
        style={{
          background: overlay,
          opacity: show ? 1 : 0,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: easing,
        }}
        aria-hidden
      />
    </>
  );
}

const cleanList = <T = string>(value: T[] | string | null | undefined, fallback: T[] = [] as T[]) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const list = value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return (list.length ? list : fallback) as T[];
  }
  return fallback;
};

type NormalizedShade = {
  key: string;
  name: string;
  hex: string;
  thumb?: string;
  desc?: string;
};

type ShadeSource = {
  key?: string;
  id?: string;
  sku?: string;
  name?: string;
  hex?: string;
  hexColor?: string;
  thumb?: string;
  image?: string;
  url?: string;
  desc?: string;
  description?: string;
};

type ProductDetailsSource = {
  type?: string;
  slug?: string;
  id?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  cardHero?: string;
  images?: Array<{ url?: string; id?: string; src?: string }>;
  gallery?: Array<string | undefined>;
  theme?: Record<string, unknown>;
  hero?: { image?: string };
  badges?: Array<{ label?: string } | string>;
  benefits?: string[];
  ingredients_highlight?: unknown[];
  ingredients_supporting?: unknown[];
  ingredientsNote?: string;
  ingredientsTitle?: string;
  how_to_use?: string[];
  howToUse?: string[];
  claims?: string[];
  faqs?: unknown[];
  tags?: string[];
  brand?: string;
  productType?: string;
  shipping?: string;
  returns?: string;
  averageRating?: number;
  rating?: number;
  mrp?: number | null;
  compareAtPrice?: number | null;
  price?: number;
  basePrice?: number;
  currency?: string;
  finish?: string;
  coverage?: string;
  fragrance?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoUrl?: string;
  reviewsList?: unknown[];
  reviews?: number | unknown[];
  reviewCount?: number;
  categoryPath?: Array<string | Record<string, unknown>>;
  longDescription?: string;
  description?: string | ProductDetailsDescription;
  experience?: ProductDetailsExperience;
  pricing?: ProductDetailsPricing;
  media?: ProductDetailsMedia;
  ingredients?: ProductDetailsIngredients;
  shades?: ShadeSource[];
};

type ProductDetailsDescription = {
  body?: string;
  headline?: string;
};

type ProductDetailsExperience = {
  benefits?: string[];
  gallery?: Array<string | undefined>;
  theme?: Record<string, unknown>;
  hero?: { image?: string };
  title?: string;
  name?: string;
  subtitle?: string;
  longDescription?: string;
  categoryPath?: Array<string | Record<string, unknown>>;
  shipping?: string;
  returns?: string;
  rating?: number;
  reviewCount?: number;
  videoTitle?: string;
  videoDescription?: string;
  videoUrl?: string;
  ingredientsNote?: string;
  ingredientsTitle?: string;
  ingredientsHighlight?: unknown[];
  howToUse?: string[];
  how_to_use?: string[];
  claims?: string[];
  faqs?: unknown[];
  badges?: Array<{ label?: string } | string>;
  ingredients_highlight?: unknown[];
  ingredients_supporting?: unknown[];
  finish?: string;
  coverage?: string;
  fragrance?: string;
  reviewsList?: unknown[];
  reviews?: number | unknown[];
  productType?: string;
  type?: string;
  source?: Record<string, unknown>;
  shades?: ShadeSource[];
};

type ProductDetailsPricing = {
  price?: number;
  originalValue?: number | null;
  currency?: string;
};

type ProductDetailsMedia = {
  heroImage?: string;
  gallery?: Array<{ url?: string; id?: string }>;
};

type ProductDetailsIngredients = {
  keyActives?: Array<{ name?: string; description?: string }>;
  supportingIngredients?: unknown[];
  note?: string;
};

const normalizeShades = (
  sourceShades: ShadeSource[] = [],
  experienceShades: ShadeSource[] = [],
  gallery: Array<string | undefined> = [],
  source: ProductDetailsSource = {},
  { allowFallbackSingle = true }: { allowFallbackSingle?: boolean } = {}
) => {
  const preferred = Array.isArray(experienceShades)
    ? experienceShades.map((shade, index) => ({
        key: shade.key ?? shade.id ?? shade.sku ?? `experience-shade-${index + 1}`,
        name: shade.name ?? `Shade ${index + 1}`,
        hex: shade.hex ?? shade.hexColor ?? "#a21caf",
        thumb: shade.thumb ?? shade.image ?? shade.url ?? gallery[index],
        desc: shade.desc ?? shade.description ?? "",
      }))
    : [];
  if (preferred.length) return preferred;

  const sourceDescription =
    source.description && typeof source.description === "object" ? source.description : undefined;

  let mapped: NormalizedShade[] = [];
  if (Array.isArray(sourceShades) && sourceShades.length > 0) {
    mapped = sourceShades.map((shade, index) => ({
      key: shade.key ?? shade.id ?? shade.sku ?? `shade-${index + 1}`,
      name: shade.name ?? `Shade ${index + 1}`,
      hex: shade.hex ?? shade.hexColor ?? "#a21caf",
      thumb: shade.thumb ?? shade.image ?? shade.url ?? gallery[index],
      desc: shade.desc ?? shade.description ?? "",
    }));
  } else if (allowFallbackSingle && (source.type === 'single' || !sourceShades?.length)) {
    mapped = [{
      key: source.slug ?? source.id ?? 'default',
      name: source.name ?? 'Standard',
      hex: '#000000',
      thumb: source.media?.heroImage ?? gallery[0],
      desc: sourceDescription?.body ?? "",
    }];
  }
  return mapped;
};

const buildProductView = (
  source: ProductDetailsSource = {},
  { useFallbackContent = true }: { useFallbackContent?: boolean } = {}
) => {
  const experience: ProductDetailsExperience = source.experience ?? {};
  const pricing: ProductDetailsPricing = source.pricing || {};
  const media: ProductDetailsMedia = source.media || {};
  const desc: ProductDetailsDescription = source.description && typeof source.description === "object" ? source.description : {};
  const descriptionText = typeof source.description === "string" ? source.description : undefined;
  const fallbackProduct: ProductDetailsSource = useFallbackContent ? BASE_PRODUCT : {};
  const fallbackContent: ProductDetailsSource = useFallbackContent ? SAMPLE_CONTENT : {};
  const fallbackGallery = useFallbackContent ? BASE_GALLERY : [];
  const fallbackProductDescription =
    typeof fallbackProduct.description === "object" ? fallbackProduct.description : undefined;
  const fallbackContentDescription =
    typeof fallbackContent.description === "object" ? fallbackContent.description : undefined;

  const ingredientsData: ProductDetailsIngredients = source.ingredients || {};
  const basePricing = fallbackProduct.pricing || {};
  
  const fallbackBenefits = cleanList(fallbackProduct.benefits, cleanList(fallbackContent.benefits, []));
  const fallbackClaims = cleanList(fallbackProduct.claims, cleanList(fallbackContent.claims, []));
  const fallbackFaqs = Array.isArray(fallbackProduct.faqs) && fallbackProduct.faqs.length
    ? fallbackProduct.faqs
    : Array.isArray(fallbackContent.faqs)
      ? fallbackContent.faqs
      : [];
  const fallbackHowToUse = cleanList(fallbackProduct.how_to_use, cleanList(fallbackContent.how_to_use, []));
  const fallbackIngredientsHighlight = fallbackContent.ingredients_highlight ?? [];
  const fallbackSupportingIngredients = Array.isArray(fallbackContent.ingredients_supporting)
    ? fallbackContent.ingredients_supporting
    : Array.isArray(fallbackContent.ingredients?.supportingIngredients)
      ? fallbackContent.ingredients.supportingIngredients
      : [];

  // Extract all possible image sources from the database object
  const galleryFromImages = Array.isArray(source.images)
    ? source.images.map((img) => img.url || img.id || img.src).filter(Boolean)
    : source.image
      ? [source.image]
      : source.cardHero
        ? [source.cardHero]
        : [];

  const pickGallery = (candidate) =>
    Array.isArray(candidate) && candidate.length ? candidate : null;

  const gallery =
    pickGallery(Array.isArray(media.gallery) ? media.gallery.map(g => g.url || g.id).filter(Boolean) : null) ??
    pickGallery(experience.gallery) ??
    pickGallery(source.gallery) ??
    pickGallery(galleryFromImages) ??
    (useFallbackContent ? pickGallery(fallbackContent.gallery) : null) ??
    fallbackGallery;

  const theme = {
    ...(useFallbackContent ? fallbackContent.theme || {} : {}),
    ...(useFallbackContent ? fallbackProduct.theme || {} : {}),
    ...(source.theme || {}),
    ...(experience.theme || {}),
  };
  
  const hero = {
    ...(useFallbackContent ? fallbackContent.hero || {} : {}),
    ...(useFallbackContent ? fallbackProduct.hero || {} : {}),
    ...(source.hero || {}),
    ...(experience.hero || {}),
    image:
      media.heroImage ??
      source.hero?.image ??
      experience.hero?.image ??
      (useFallbackContent ? fallbackProduct.media?.heroImage : undefined) ??
      (useFallbackContent ? fallbackContent.hero?.image : undefined) ??
      galleryFromImages[0] ??
      source.image ??
      source.cardHero ??
      ""
  };

  const sourceBadges = Array.isArray(source.badges)
    ? source.badges.map((b) => (typeof b === "string" ? b : b.label ?? ""))
    : source.badges;
    
  const badges = cleanList(
    sourceBadges ?? experience.badges,
    useFallbackContent ? cleanList(fallbackProduct.badges, cleanList(fallbackContent.badges, [])) : []
  );
  
  const benefits = cleanList(
    experience.benefits ?? source.benefits,
    useFallbackContent ? fallbackBenefits : []
  );

  const ingredients =
    ingredientsData.keyActives
      ? ingredientsData.keyActives.map(k => ({ name: k.name, why: k.description }))
      : (
        experience.ingredientsHighlight ??
        experience.ingredients_highlight ??
        source.ingredients_highlight ??
        (useFallbackContent ? fallbackProduct.ingredients_highlight : undefined) ??
        (useFallbackContent ? fallbackIngredientsHighlight : [])
      );

  const supportingIngredients =
    Array.isArray(ingredientsData.supportingIngredients)
      ? ingredientsData.supportingIngredients
      : Array.isArray(source.ingredients_supporting)
        ? source.ingredients_supporting
        : Array.isArray(experience.ingredients_supporting)
          ? experience.ingredients_supporting
          : (useFallbackContent ? fallbackSupportingIngredients : []);

  const ingredientsNote = ingredientsData.note ?? source.ingredientsNote ?? experience.ingredientsNote ?? (useFallbackContent ? fallbackContent.ingredientsNote : "") ?? "";

  const howToUse = cleanList(
    experience.howToUse ?? experience.how_to_use ?? source.how_to_use ?? source.howToUse,
    useFallbackContent ? fallbackHowToUse : []
  );
  
  const claims = cleanList(experience.claims ?? source.claims, useFallbackContent ? fallbackClaims : []);
  
  const faqs = Array.isArray(experience.faqs ?? source.faqs)
    ? experience.faqs ?? source.faqs
    : (useFallbackContent ? fallbackFaqs : []);
    
  const tags = Array.isArray(source.tags) ? source.tags : (useFallbackContent ? Array.isArray(fallbackContent.tags) ? fallbackContent.tags : [] : []);
  const brand = source.brand ?? (useFallbackContent ? fallbackProduct.brand ?? fallbackContent.brand : "") ?? "";
  const productType = source.productType ?? source.type ?? (useFallbackContent ? fallbackProduct.productType ?? fallbackContent.productType : "") ?? "";

  const reviewsList = Array.isArray(source?.reviewsList)
    ? source.reviewsList
    : Array.isArray(source?.reviews)
      ? source.reviews
      : useFallbackContent && Array.isArray(fallbackContent.reviewsList)
        ? fallbackContent.reviewsList
        : [];

  const toCount = (value: unknown) => (Array.isArray(value) ? value.length : Number(value) || 0);

  const reviewCount =
    source.reviewCount ??
    (useFallbackContent
      ? experience.reviewCount ?? toCount(source.reviews) ?? toCount(fallbackProduct.reviews) ?? toCount(fallbackContent.reviews)
      : toCount(source.reviews));

  return {
    ...(useFallbackContent ? BASE_PRODUCT : {}),
    ...source,
    ...experience,
    title: source.name ?? experience.title ?? source.title ?? (useFallbackContent ? fallbackProduct.title ?? fallbackProduct.name : ""),
    name: source.name ?? experience.name ?? (useFallbackContent ? fallbackProduct.title ?? fallbackProduct.name : ""),
    subtitle:
      desc.headline ??
      experience.subtitle ??
      source.subtitle ??
      (useFallbackContent
        ? fallbackProduct.subtitle ??
          fallbackProductDescription?.headline ??
          fallbackContent.subtitle ??
          fallbackContentDescription?.headline
        : ""),
    categoryPath: experience.categoryPath ?? source.categoryPath ?? (useFallbackContent ? fallbackProduct.categoryPath ?? fallbackContent.categoryPath : []),
    longDescription:
      desc.body ??
      experience.longDescription ??
      source.longDescription ??
      descriptionText ??
      (useFallbackContent
        ? fallbackProduct.longDescription ??
          fallbackProductDescription?.body ??
          fallbackContent.longDescription ??
          fallbackContentDescription?.body
        : ""),
    hero,
    theme,
    gallery,
    badges,
    benefits,
    ingredients_highlight: ingredients,
    ingredients_supporting: supportingIngredients,
    ingredientsNote,
    how_to_use: howToUse,
    claims,
    faqs,
    tags,
    brand,
    type: productType,
    productType,
    shipping: experience.shipping ?? source.shipping ?? (useFallbackContent ? fallbackProduct.shipping ?? fallbackContent.shipping ?? "Free shipping on prepaid orders" : ""),
    returns: experience.returns ?? source.returns ?? (useFallbackContent ? fallbackProduct.returns ?? fallbackContent.returns ?? "Easy 7-day returns on unopened items." : ""),
    reviews: Number.isFinite(reviewCount) ? reviewCount : Number(reviewCount) || reviewsList.length || 0,
    rating:
      Number.isFinite(source.averageRating) ? source.averageRating
        : Number.isFinite(experience.rating) && useFallbackContent ? experience.rating
          : Number.isFinite(source.rating) ? source.rating
            : Number(useFallbackContent ? (fallbackProduct.rating ?? fallbackProduct.averageRating ?? fallbackContent.rating ?? fallbackContent.averageRating ?? 0) : 0) || 0,
    mrp: pricing.originalValue ?? source.mrp ?? source.compareAtPrice ?? (useFallbackContent ? basePricing.originalValue ?? fallbackProduct.mrp ?? fallbackProduct.price ?? fallbackContent.mrp ?? fallbackContent.price : null),
    price: pricing.price ?? source.price ?? source.basePrice ?? (useFallbackContent ? basePricing.price ?? fallbackProduct.price ?? fallbackContent.price : 0),
    currency: pricing.currency ?? source.currency ?? (useFallbackContent ? basePricing.currency ?? fallbackProduct.currency ?? fallbackContent.currency : "INR"),
    reviewsList,
    finish: source?.finish ?? experience.finish ?? (useFallbackContent ? fallbackProduct.finish ?? fallbackContent.finish : ""),
    coverage: source?.coverage ?? experience.coverage ?? (useFallbackContent ? fallbackProduct.coverage ?? fallbackContent.coverage : ""),
    fragrance: source?.fragrance ?? experience.fragrance ?? (useFallbackContent ? fallbackProduct.fragrance ?? fallbackContent.fragrance : ""),
    videoTitle: experience.videoTitle ?? source.videoTitle ?? (useFallbackContent ? fallbackProduct.experience?.videoTitle ?? fallbackContent.videoTitle : source.name ?? "Cevonne"),
    videoDescription: experience.videoDescription ?? source.videoDescription ?? (useFallbackContent ? fallbackProduct.experience?.videoDescription ?? fallbackContent.videoDescription : ""),
    ingredientsTitle: experience.ingredientsTitle ?? (useFallbackContent ? fallbackProduct.experience?.ingredientsTitle ?? fallbackContent.ingredientsTitle : "Ingredients"),
    videoUrl: experience.videoUrl ?? source.videoUrl ?? (useFallbackContent ? fallbackProduct.videoUrl ?? fallbackContent.videoUrl : undefined),
    shades: normalizeShades(source.shades, experience.shades, gallery, source, {
      allowFallbackSingle: useFallbackContent,
    }),
  };
};

/* ===== MAIN ===== */
export default function ProductDetails({ data }: { data?: any }) {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { state } = useLocation();
  const preloadedProduct = state?.product || data || null;
  const [remoteProduct, setRemoteProduct] = useState(preloadedProduct);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(id && HAS_API_BASE && !preloadedProduct));
  const [productError, setProductError] = useState(null);

  /* Sticky Bar Logic */
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const reviewsRef = useRef<HTMLDivElement | null>(null);

  /* ===== HOVER REVEAL STATE (NEW FEATURE) ===== */
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ctaRef.current) return;
      const ctaBottom = ctaRef.current.getBoundingClientRect().bottom;
      const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
      setShowStickyBar(ctaBottom < 0 && !scrolledToBottom);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (preloadedProduct) {
      setRemoteProduct(preloadedProduct);
    }
  }, [preloadedProduct]);

  useEffect(() => {
    let cancelled = false;
    if (!id || !HAS_API_BASE) {
      setLoadingProduct(false);
      return undefined;
    }
    async function load() {
      setLoadingProduct(true);
      setProductError(null);
      try {
        const response = await fetch(`${API_BASE}/products/${id}`);
        if (!response.ok) {
          const localFallback = findSampleProduct(id);
          if (!HAS_API_BASE && response.status === 404 && localFallback && !cancelled) {
            setRemoteProduct(localFallback);
            setProductError(null);
            return;
          }
          throw new Error("Failed to load product");
        }
        const payload = await response.json();
        if (!cancelled) setRemoteProduct(payload);
      } catch (err) {
        console.error(err);
        if (!cancelled) setProductError(err.message || "Unable to load product");
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fallbackProduct = HAS_API_BASE ? null : findSampleProduct(id) || SAMPLE_CONTENT || BASE_PRODUCT;
  const sourceProduct = remoteProduct || preloadedProduct || fallbackProduct;
  const useFallbackContent = !HAS_API_BASE;
  const p = useMemo(
    () => (sourceProduct ? buildProductView(sourceProduct, { useFallbackContent }) : EMPTY_PRODUCT_VIEW),
    [sourceProduct, useFallbackContent]
  );
  const crumbs = Array.isArray(p.categoryPath) ? p.categoryPath : p.category ? [p.category] : [];
  const { cartItems, wishlist, addToCart, toggleWishlist, openDrawer } = useShop();
  const { user, isAuthenticated, authFetch } = useAuth();
  const { products: catalogProducts } = useProductsCatalog();

  const [reviewsData, setReviewsData] = useState(() =>
    Array.isArray(p.reviewsList) ? p.reviewsList : []
  );
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    setReviewsData(Array.isArray(p.reviewsList) ? p.reviewsList : []);
    setEditingReviewId(null);
    setReviewForm({ rating: 5, title: "", comment: "" });
  }, [p.reviewsList, p.id]);

  /* Tone & backgrounds */
  const WHITE_BG = "#ffffff";
  const defaultBg = p?.theme?.defaultBg || WHITE_BG;
  const bgScenes = useMemo(
    () =>
      p?.theme?.bgScenes || (useFallbackContent ? SAMPLE_CONTENT.theme?.bgScenes : null) || {
        hero: defaultBg,
        features: defaultBg,
        ingredients: defaultBg,
        video: defaultBg,
        shades: defaultBg,
        reviews: defaultBg,
      },
    [defaultBg, p?.theme?.bgScenes, useFallbackContent]
  );
  const bgTone = useMemo(
    () =>
      p?.theme?.bgTone || {
        hero: "light",
        features: "light",
        ingredients: "light",
        video: "dark",
        shades: "light",
        reviews: "light",
      },
    [p?.theme?.bgTone]
  );
  const [tone, setTone] = useState(bgTone.hero || "light");
  const [pageBg, setPageBg] = useState(bgScenes.hero || defaultBg);
  const toneVars = useMemo(() => {
    const dark = tone === "dark";
    return {
      "--fg": dark ? "#ffffff" : "#0f0f0f",
      "--fg-muted": dark ? "rgba(255,255,255,0.76)" : "#545b63",
      "--divider": dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
      "--card-bg": dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",
      "--chip-bg": dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
    } as React.CSSProperties;
  }, [tone]);

  /* Smooth scene picking */
  const pageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const secs = Array.from(root.querySelectorAll("[data-bg-key]"));

    let rafPending = false;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    let lastKey: string | null = null;

    const compute = () => {
      rafPending = false;
      const center = window.innerHeight / 2;
      let bestKey: string | null = null;
      let bestDist = Infinity;
      secs.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; bestKey = el.getAttribute("data-bg-key"); }
      });
      const selectedKey = bestKey;
      if (selectedKey && selectedKey !== lastKey) {
        if (debounceId) clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          lastKey = selectedKey;
          setPageBg(bgScenes[selectedKey] || defaultBg);
          setTone(bgTone?.[selectedKey] || "light");
        }, 160);
      }
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(compute);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (debounceId) clearTimeout(debounceId);
    };
  }, [bgScenes, bgTone, defaultBg]);

  /* PDP images */
  const HERO = p.hero || {};
  const heroOverlay = HERO.overlay || "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.06) 100%)";
  const gallery = useMemo(() => (Array.isArray(p.gallery) ? p.gallery.map(resolveAsset) : []), [p.gallery]);
  const [activeImage, _setActiveImage] = useState(0);

  // Throttle image index updates to avoid jitter/overlap
  const changeRef = useRef(0);
  const MIN_IMAGE_CHANGE = 20;
  const setActiveImage = (next) => {
    const now = performance.now();
    if (now - changeRef.current < MIN_IMAGE_CHANGE) return; // throttle
    changeRef.current = now;
    _setActiveImage((curr) => (next === curr ? curr : next));
  };

  useEffect(() => {
    gallery.forEach((src) => { const i = new Image(); i.src = src; });
  }, [gallery]);

  // drag / swipe / wheel â€” but ignore interactive children so links work on desktop too
  const heroRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let startX = 0, startY = 0, dragging = false, startIdx = 0;

    const isInteractive = (t) =>
      !!(t && (t.closest?.("a,button,input,select,textarea,[role='button']")));

    const onPointerDown = (e) => {
      if (isInteractive(e.target)) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startIdx = activeImage;
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > Math.abs(e.clientY - startY) && Math.abs(dx) > 28) {
        const step = Math.round(dx / -140);
        const next = Math.max(0, Math.min(gallery.length - 1, startIdx + step));
        setActiveImage(next);
      }
    };
    const onPointerUp = (e) => {
      dragging = false;
      el.releasePointerCapture?.(e.pointerId);
    };
    const onWheel = (e) => {
      if (isInteractive(e.target)) return;
      if (gallery.length < 2) return;
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      setActiveImage((i) => Math.max(0, Math.min(gallery.length - 1, i + (dir > 0 ? 1 : -1))));
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gallery.length, activeImage]);

  const heroSrc = gallery[activeImage] || (HERO.image ? resolveAsset(HERO.image) : "");

  const featureList = useMemo(() => {
    const benefitLabels = Array.isArray(p.benefits) ? p.benefits.slice(0, 3) : [];
    const ingredientLabels = Array.isArray(p.ingredients_highlight)
      ? p.ingredients_highlight.slice(0, 3).map((ing) => ing?.name).filter(Boolean)
      : [];
    const labels = (benefitLabels.length ? benefitLabels : ingredientLabels)
      .map((label) => (typeof label === "string" ? label : `${label}`));
    if (!labels.length) return [];

    const images = [
      p.shades?.[0]?.thumb,
      p.shades?.[1]?.thumb,
      p.shades?.[2]?.thumb,
      p.hero?.image,
      gallery[0],
      ...(useFallbackContent ? [SAMPLE_CONTENT.gallery?.[0], "product1.png", "product2.png", "product3.png"] : []),
    ]
      .map(resolveAsset)
      .filter(Boolean);
    if (!images.length) return [];

    const palette = ["text-[#3f6212]", "text-[#14532d]", "text-[#166534]", "text-[#1d4ed8]"];

    return labels.map((label, idx) => ({
      label,
      img: images[idx % images.length] || resolveAsset("product1.png"),
      color: palette[idx % palette.length],
    }));
  }, [gallery, p.benefits, p.hero?.image, p.ingredients_highlight, p.shades, useFallbackContent]);

  useEffect(() => {
    if (featureList.length && activeFeatureIndex >= featureList.length) {
      setActiveFeatureIndex(0);
    }
  }, [featureList.length, activeFeatureIndex]);

  /* price, badges, etc. */
  const [qty, setQty] = useState(1);
  const priceBlock = useMemo(() => {
    const save = Math.max(0, (p.mrp || 0) - (p.price || 0));
    return { save, hasSave: save > 0 };
  }, [p.mrp, p.price]);

  /* ingredients view toggle */
  const [showFullIngredients, setShowFullIngredients] = useState(false);
  useEffect(() => {
    setShowFullIngredients(false);
  }, [sourceProduct]);
  const primaryIngredient = useMemo(
    () => (Array.isArray(p.ingredients_highlight) ? p.ingredients_highlight[0] : null),
    [p.ingredients_highlight]
  );
  const otherIngredientNames = useMemo(
    () =>
      (Array.isArray(p.ingredients_highlight) ? p.ingredients_highlight.slice(1) : [])
        .map((it) => it?.name)
        .filter(Boolean),
    [p.ingredients_highlight]
  );
  const fullIngredientsText = useMemo(() => {
    if (Array.isArray(p.ingredients_supporting) && p.ingredients_supporting.length) return p.ingredients_supporting.join(", ");
    if (typeof p.ingredients_supporting === "string") return p.ingredients_supporting;
    if (Array.isArray(p.ingredients_highlight) && p.ingredients_highlight.length) {
      return p.ingredients_highlight
        .map((it) => [it.name, it.why].filter(Boolean).join(" â€“ "))
        .join("\n");
    }
    return "";
  }, [p.ingredients_highlight, p.ingredients_supporting]);

  /* shades map + choose */
  const [activeShade, setActiveShade] = useState(p.shades?.[0]?.key || "");
  const [showTooltip, setShowTooltip] = useState(true);

  // Auto-hide tooltip after 2 seconds
  useEffect(() => {
    setShowTooltip(true);
    const timer = setTimeout(() => setShowTooltip(false), 2000);
    return () => clearTimeout(timer);
  }, [activeShade]);
  const shadeMap = useMemo(() =>
    (p.shades || []).reduce((acc, s) => {
      acc[s.key] = { ...s, img: s.thumb ? resolveAsset(s.thumb) : null };
      return acc;
    }, {}), [p.shades]
  );
  const shadeKeys = useMemo(
    () => (p.shades || []).map((s) => String(s.key || s.id || "").toLowerCase()).filter(Boolean),
    [p.shades]
  );
  useEffect(() => {
    const shade = shadeMap[activeShade];
    if (shade?.img && gallery.length > 0) {
      const idx = gallery.findIndex((g) => g === shade.img);
      if (idx >= 0) setActiveImage(idx);
    }
  }, [activeShade, gallery, shadeMap]);

  const shadeDetails = shadeMap[activeShade];
  const activeShadeLabel = shadeDetails?.name || "Selected shade";
  const shadeKey = shadeDetails?.key;
  const isActiveShadeInCart = useMemo(
    () => (shadeKey ? cartItems.some((item) => item.key === shadeKey) : false),
    [cartItems, shadeKey],
  );
  const isActiveShadeWishlisted = useMemo(
    () => (shadeKey ? wishlist.some((item) => item.key === shadeKey) : false),
    [wishlist, shadeKey],
  );

  const priceValue = Number(p.price ?? 0)
  const shadeImg = shadeDetails?.img || gallery[0] || heroSrc;
  const shadeItem = shadeKey
    ? {
      id: p.id || p.slug || shadeKey,
      key: shadeKey,
      sku: shadeKey,
      productId: p.id || p.slug || shadeKey,
      productName: p.name || p.title || activeShadeLabel,
      name: activeShadeLabel,
      color: shadeDetails?.hex,
      image: shadeImg,
      thumb: shadeImg,
      price: Number.isFinite(priceValue) ? priceValue : 0,
      currency: p.currency || "â‚¹",
    }
    : null;

  const handleAddToCart = () => {
    if (!shadeItem) return;
    const added = addToCart(shadeItem);
    if (added) {
      toast.success(`${activeShadeLabel} added to cart`);
      openDrawer("cart");
    } else {
      toast(`${activeShadeLabel} is already in your cart`);
    }
  };

  const handleToggleWishlist = () => {
    if (!shadeItem) return;
    const status = toggleWishlist(shadeItem);
    if (status === "added") {
      toast.success(`${activeShadeLabel} saved to wishlist`);
      openDrawer("wishlist");
    } else if (status === "removed") {
      toast(`${activeShadeLabel} removed from wishlist`);
    }
  };

  /* reviews */
  const reviewsApiEnabled = Boolean(HAS_API_BASE && p.id);

  const fetchReviews = useCallback(async () => {
    if (!reviewsApiEnabled) return [];
    setReviewsLoading(true);
    setReviewsError("");
    try {
      const response = await authFetch(
        `${API_BASE}/reviews?productId=${encodeURIComponent(p.id)}&status=ALL`
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to load reviews");
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      setReviewsData(list);
      return list;
    } catch (err) {
      setReviewsError(err?.message || "Unable to load reviews");
      return [];
    } finally {
      setReviewsLoading(false);
    }
  }, [API_BASE, authFetch, p.id, reviewsApiEnabled]);

  useEffect(() => {
    if (!reviewsApiEnabled) return;
    fetchReviews();
  }, [fetchReviews, reviewsApiEnabled]);

  useEffect(() => {
    if (!reviewsApiEnabled || !isAuthenticated) {
      setHasPurchased(false);
      return;
    }
    let cancelled = false;
    const verify = async () => {
      setCheckingPurchase(true);
      try {
        const res = await authFetch(`${API_BASE}/orders/my`);
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "Unable to verify purchase");
        }
        const data = await res.json();
        const orders = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const pid = String(p.id || "").toLowerCase();
        const slug = String(p.slug || "").toLowerCase();
        const pname = String(p.name || p.title || "").toLowerCase();
        const purchased = orders.some((order) =>
          (order.items || []).some((item) => {
            const itemId = String(item.productId || item.id || "").toLowerCase();
            const sku = String(item.sku || item.key || "").toLowerCase();
            const itemName = String(item.name || "").toLowerCase();
            return (
              (pid && itemId === pid) ||
              (slug && sku === slug) ||
              (sku && shadeKeys.includes(sku)) ||
              (itemId && shadeKeys.includes(itemId)) ||
              (pname && itemName.includes(pname))
            );
          })
        );
        if (!cancelled) setHasPurchased(purchased);
      } catch {
        if (!cancelled) setHasPurchased(false);
      } finally {
        if (!cancelled) setCheckingPurchase(false);
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, authFetch, isAuthenticated, p.id, p.slug, p.name, p.title, reviewsApiEnabled, shadeKeys]);

  const normalizedReviews = useMemo(() => {
    return (Array.isArray(reviewsData) ? reviewsData : []).map((r, idx) => {
      const dateVal = r.date || r.createdAt || r.updatedAt;
      const parsedDate = dateVal ? new Date(dateVal) : null;
      const safeDate =
        parsedDate && !Number.isNaN(parsedDate.valueOf())
          ? parsedDate.toISOString().split("T")[0]
          : "";
      return {
        id: r.id || r._id || `local-${idx}`,
        rating: Number(r.rating) || 0,
        title: r.title || r.heading || "",
        comment: r.comment || r.body || r.text || "",
        author: r.author || r.user?.name || r.user?.email || "Anonymous",
        date: safeDate,
        status: r.status || "PUBLISHED",
        userId: r.userId || r.user?.id,
        verified: Boolean(r.verified || r.isVerified || r.verifiedBuyer),
        helpfulCount: Number(r.helpfulCount ?? r.helpful ?? 0) || 0,
      };
    });
  }, [reviewsData]);

  const visibleReviews = useMemo(
    () =>
      normalizedReviews.filter(
        (r) => !r.status || r.status === "PUBLISHED" || (user?.id && r.userId === user.id)
      ),
    [normalizedReviews, user?.id]
  );

  const myReview = useMemo(
    () => normalizedReviews.find((r) => user?.id && r.userId === user.id),
    [normalizedReviews, user?.id]
  );

  useEffect(() => {
    if (myReview && !editingReviewId) {
      setReviewForm({
        rating: myReview.rating || 5,
        title: myReview.title || "",
        comment: myReview.comment || "",
      });
    }
  }, [myReview, editingReviewId]);

  const [sortOrder, setSortOrder] = useState("newest");
  const [filterRating, setFilterRating] = useState(0);

  const filteredAndSortedReviews = useMemo(() => {
    let reviews = [...visibleReviews];
    if (filterRating > 0) reviews = reviews.filter((r) => Math.round(r.rating) === filterRating);
    switch (sortOrder) {
      case "newest":
        reviews.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        break;
      case "oldest":
        reviews.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        break;
      case "highest":
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      default:
        break;
    }
    return reviews;
  }, [visibleReviews, sortOrder, filterRating]);

  const ratingDistribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const reviewList = visibleReviews.filter((r) => r.status === "PUBLISHED" || !r.status);
    const total = reviewList.length;
    if (!total) {
      return Object.keys(dist)
        .sort((a, b) => Number(b) - Number(a))
        .map((stars) => ({
          stars,
          count: 0,
          percent: 0,
        }));
    }
    reviewList.forEach((r) => {
      const floored = Math.max(1, Math.min(5, Math.floor(r.rating)));
      if (dist[floored] !== undefined) dist[floored]++;
    });
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([stars, count]) => ({
        stars,
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      }));
  }, [visibleReviews]);

  const averageRating = useMemo(() => {
    const list = visibleReviews.filter((r) => r.status === "PUBLISHED" || !r.status);
    if (!list.length) return Number(p.rating || 0);
    const avg = list.reduce((acc, item) => acc + (Number(item.rating) || 0), 0) / list.length;
    return Number(avg.toFixed(1));
  }, [visibleReviews, p.rating]);

  const reviewCount = useMemo(
    () => (visibleReviews ? visibleReviews.length : 0) || p.reviews || 0,
    [visibleReviews, p.reviews]
  );

  const handleStartEdit = (review) => {
    if (!review) return;
    setEditingReviewId(review.id);
    setReviewForm({
      rating: review.rating || 5,
      title: review.title || "",
      comment: review.comment || "",
    });
  };

  const resetReviewForm = () => {
    setEditingReviewId(null);
    setReviewForm({ rating: 5, title: "", comment: "" });
  };

  const handleSubmitReview = async (event) => {
    event?.preventDefault?.();
    if (!reviewsApiEnabled) {
      toast.error("Live reviews are not available for this product.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please log in to write a review.");
      return;
    }
    if (!hasPurchased) {
      toast.error("You can review only after purchasing this product.");
      return;
    }
    const payload = {
      rating: Number(reviewForm.rating) || 0,
      title: reviewForm.title.trim() || null,
      comment: reviewForm.comment.trim() || null,
      productId: p.id,
      userId: user?.id,
    };
    const endpoint = editingReviewId
      ? `${API_BASE}/reviews/${editingReviewId}`
      : `${API_BASE}/reviews`;
    const method = editingReviewId ? "PUT" : "POST";
    setSubmittingReview(true);
    try {
      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Unable to save review");
      }
      await fetchReviews();
      toast.success(editingReviewId ? "Review updated" : "Review submitted");
      resetReviewForm();
    } catch (err) {
      toast.error(err?.message || "Unable to save review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!reviewsApiEnabled || !reviewId) return;
    if (!isAuthenticated) {
      toast.error("Please log in to manage your review.");
      return;
    }
    const confirmed = typeof window !== "undefined" ? window.confirm("Delete your review?") : true;
    if (!confirmed) return;
    try {
      const res = await authFetch(`${API_BASE}/reviews/${reviewId}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Unable to delete review");
      }
      await fetchReviews();
      resetReviewForm();
      toast.success("Review removed");
    } catch (err) {
      toast.error(err?.message || "Could not delete review");
    }
  };

  /* Explore Shades scroll-scrub */
  const [sectionImgIdx, setSectionImgIdx] = useState(0);
  const shadeRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  shadeRefs.current = (p.shades || []).map((_, i) => shadeRefs.current[i] || React.createRef<HTMLDivElement>());

  useEffect(() => {
    const els = shadeRefs.current
      .map((r) => r.current)
      .filter((el): el is HTMLDivElement => Boolean(el));
    if (els.length === 0) return;

    let raf = 0, last = -1;
    const tick = () => {
      const center = window.innerHeight / 2;
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best !== last) {
        last = best;
        setSectionImgIdx(best);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.shades]);

  useEffect(() => {
    if (!p.shades?.length) return;
    let id;
    let userTouched = false;
    const stop = () => { userTouched = true; clearInterval(id); };
    window.addEventListener("scroll", stop, { passive: true, once: true });
    window.addEventListener("pointerdown", stop, { once: true });
    id = setInterval(() => {
      if (userTouched) return;
      setSectionImgIdx((i) => (i + 1) % p.shades.length);
    }, 3000);
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", stop);
      window.removeEventListener("pointerdown", stop);
    };
  }, [p.shades?.length]);

  const getShadeImageByIndex = (i) => {
    const s = p.shades?.[i];
    const fromThumb = s?.thumb ? resolveAsset(s.thumb) : "";
    const fromGallery = Array.isArray(gallery) && gallery[i] ? gallery[i] : "";
    const fromHero = heroSrc || resolveAsset(p.hero?.image);
    return fromThumb || fromGallery || fromHero || DEFAULT_PRODUCT_IMAGE;
  };

  const videoSrc = useMemo(
    () => (p.videoUrl ? resolveMedia(p.videoUrl) : useFallbackContent ? STATIC_ASSETS.introVideo1 : ""),
    [p.videoUrl, useFallbackContent]
  );

  const relatedProducts = useMemo(() => {
    const catalogPool = Array.isArray(catalogProducts) && catalogProducts.length
      ? catalogProducts
      : useFallbackContent && Array.isArray(cevonneProducts)
        ? cevonneProducts
        : [];
    const pool = catalogPool.filter((item) => {
      const sameId = p.id && item.id === p.id;
      const sameSlug = p.slug && item.slug === p.slug;
      return !sameId && !sameSlug;
    });
    if (!pool.length) return [];
    return pool.slice(0, 4);
  }, [catalogProducts, p.id, p.slug, useFallbackContent]);

  const pickProductImage = (item) => {
    const candidates = [
      item?.media?.heroImage,
      item?.hero?.image,
      Array.isArray(item?.gallery) ? item.gallery[0]?.url || item.gallery[0] : null,
      Array.isArray(item?.images) ? item.images[0]?.url || item.images[0]?.src : null,
      item?.media?.gallery?.[0]?.url,
    ].filter(Boolean);
    return resolveAsset(candidates[0] || p.hero?.image || gallery[0]);
  };

  const productSpecs = useMemo(
    () =>
      [
        p.finish ? `Finish: ${p.finish}` : null,
        p.coverage ? `Coverage: ${p.coverage}` : null,
        p.fragrance ? `Fragrance: ${p.fragrance}` : null,
      ].filter(Boolean),
    [p.coverage, p.finish, p.fragrance]
  );

  if (loadingProduct && !sourceProduct) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-neutral-500">
        Loading product...
      </div>
    );
  }

  if (!sourceProduct) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 text-center text-neutral-600 px-4">
        <p className="text-lg font-semibold text-neutral-800">Product not found</p>
        <p className="text-sm text-neutral-500">{productError || "Try reloading or go back to browse other products."}</p>
        <Link to="/" className="text-primary underline">Back to home</Link>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="relative" style={toneVars}>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <BackgroundFader background={pageBg} />

      {/* ===== HERO SECTION ===== */}
      <div className="w-full mt-8 md:mt-12 py-8 md:py-12" data-bg-key="hero">
        <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          {/* breadcrumbs */}
          <nav className="text-xs mb-4 overflow-x-auto whitespace-nowrap text-[var(--fg-muted)]">
            {crumbs.length ? (
              <>Home / {crumbs.map((c, i) => <span key={c + i}>{c}{i < crumbs.length - 1 ? " / " : " / "}</span>)}<span className="font-medium text-[var(--fg)]">{p.title}</span></>
            ) : <>Home / <span className="font-medium text-[var(--fg)]">{p.title}</span></>}
          </nav>

          {/* PDP grid */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-16">
            {/* media */}
            <div className="self-start lg:sticky lg:top-20">
              <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 lg:gap-8 lg:h-full">
                {/* thumbs (desktop) */}
                {!!gallery.length && (
                  <div className="hidden lg:flex pt-3 flex-col gap-4 overflow-y-auto overflow-x-hidden no-scrollbar snap-y snap-mandatory max-h-[calc(100vh-120px)] flex-shrink-0 min-w-[100px] items-center">
                    {gallery.map((g, i) => {
                      const isActive = i === activeImage;
                      return (
                        <button
                          key={g + i}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          onMouseEnter={() => setActiveImage(i)}
                          aria-label={`Thumbnail ${i + 1}`}
                          className={`relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center snap-start border bg-white p-1 transition-all duration-200 outline-none hover:scale-105 ${isActive
                            ? "border-neutral-800 shadow-[0_0_0_6px_rgba(0,0,0,0.08)] z-10"
                            : "border-[var(--divider)] hover:border-neutral-500"
                            }`}
                        >
                          <img
                            src={g}
                            alt={`thumb ${i + 1}`}
                            className="h-16 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* hero with ultra-smooth crossfade */}
                <div className="w-full lg:flex-1">
                  <div
                    ref={heroRef}
                    className="relative w-full aspect-[3/4] sm:aspect-square md:h-[48svh] lg:h-[80svh] lg:aspect-auto overflow-hidden select-none touch-pan-y"
                    style={{ WebkitUserSelect: "none", userSelect: "none" }}
                  >
                    {heroSrc && (
                      <SmoothImage
                        src={heroSrc}
                        alt={`${p.title} image`}
                        className="absolute inset-0 h-full w-full"
                      />
                    )}
                    {heroOverlay && <div className="absolute inset-0 pointer-events-none" style={{ background: heroOverlay }} />}

                    {/* bottom-right Try Virtually chip */}
                    <Link
                      to="/ar/lipstick"
                      onClickCapture={(e) => e.stopPropagation()}
                      className="absolute z-30 inline-flex items-center gap-1.5 bg-white/90 px-3 py-1.5 text-xs font-medium text-black shadow-lg backdrop-blur-md hover:bg-white hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-black/30 transition-all duration-200 top-4 right-4 bottom-auto lg:top-auto lg:bottom-4 lg:right-4"
                      aria-label="Try virtually"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v4l3 3-1.5 1.5L11 12V7h2z" />
                      </svg>
                      Try Virtually
                    </Link>

                    {/* dots â€” lifted to avoid chip overlap */}
                    {gallery.length > 1 && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/80 px-2.5 py-1.5 backdrop-blur-md shadow-md z-20 bottom-4 lg:bottom-14"
                      >
                        {gallery.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImage(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImage ? "bg-black w-6" : "bg-neutral-400 w-4 hover:bg-neutral-600"}`}
                            aria-label={`Go to image ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* thumbs (mobile/tablet) */}
                  {gallery.length > 1 && (
                    <div className="mt-4 overflow-x-auto no-scrollbar lg:hidden">
                      <div className="flex gap-2 pb-2 px-2 pt-2">
                        {gallery.slice(0, 12).map((g, i) => (
                          <button
                            key={g + i}
                            onClick={() => setActiveImage(i)}
                            onMouseEnter={() => setActiveImage(i)}
                            className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 overflow-hidden ring-2 transition-all duration-200 ${i === activeImage ? "ring-black shadow-lg scale-105" : "ring-neutral-200 hover:ring-neutral-400"}`}
                            aria-label={`Image ${i + 1}`}
                          >
                            <img src={g} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* info */}
            <div className="flex flex-col gap-6 md:h-auto py-8 lg:py-0 justify-center">
              <header className="space-y-4">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--fg)] animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {p.title}
                </h1>
                {p.subtitle && <p className="text-lg text-[var(--fg-muted)] animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">{p.subtitle}</p>}
                <div className="flex flex-wrap items-center gap-3 text-[var(--fg-muted)] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                  <RatingStars value={p.rating} />
                  <span className="text-sm font-medium">({averageRating}) · {reviewCount} reviews</span>
                  <Badge variant="outline" className="ml-2 inline-flex items-center bg-[var(--chip-bg)] border-transparent text-[var(--fg)] px-2.5 py-0.5 h-6">
                    <BadgeCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> <span className="translate-y-[1px]">Cevonne Verified</span>
                  </Badge>
                </div>
              </header>

              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                <div className="flex items-baseline gap-3">
                  <div className="text-2xl md:text-3xl font-bold text-[var(--fg)]">{p.currency}{p.price}</div>
                  {p.mrp ? <div className="text-xl line-through text-[var(--fg-muted)] decoration-1">{p.currency}{p.mrp}</div> : null}
                  {priceBlock.hasSave && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-2 py-0.5 text-sm">{p.discountText}</Badge>}
                </div>
                <div className="mt-1 text-sm text-[var(--fg-muted)]">Inclusive of all taxes</div>
              </div>

              {!!p.badges?.length && (
                <div className="flex flex-wrap gap-2">
                  {p.badges.map((b, i) => (
                    <Badge key={i} variant="secondary" className="bg-[var(--chip-bg)] text-[var(--fg)] border-transparent">
                      {typeof b === 'object' ? b.label : b}
                    </Badge>
                  ))}
                </div>
              )}

              {(p.subtitle || p.longDescription) && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-[var(--fg)]">Description</h3>
                  <p className="text-sm leading-relaxed text-[var(--fg-muted)] whitespace-pre-line">
                    {p.subtitle ? `${p.subtitle}\n` : ""}
                    {p.longDescription}
                  </p>
                </div>
              )}

              {(p.size?.unitCount || p.size?.sizePerUnit) && (
                <div className="text-sm text-[var(--fg-muted)]">
                  <span className="font-semibold text-[var(--fg)]">Size:</span>{" "}
                  {p.size?.unitCount ? `${p.size.unitCount} unit` : ""}
                  {p.size?.sizePerUnit
                    ? ` (${p.size.sizePerUnit.ml ?? 0} ml / ${p.size.sizePerUnit.flOz ?? 0} fl oz)`
                    : ""}
                </div>
              )}

              {(p.brand || p.type || (p.tags && p.tags.length)) && (
                <div className="rounded-2xl border border-[var(--divider)] bg-[var(--card-bg)] p-4 space-y-3">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-[var(--fg-muted)]">
                    {p.brand && <Badge variant="outline" className="border-[var(--divider)] text-[var(--fg)]">Brand: {p.brand}</Badge>}
                    {p.type && <Badge variant="outline" className="border-[var(--divider)] text-[var(--fg)]">Type: {p.type}</Badge>}
                  </div>
                  {Array.isArray(p.tags) && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {p.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="bg-[var(--chip-bg)] text-[var(--fg)] border-transparent">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!!p.shades?.length && (
                <section className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <Label className="text-sm font-medium text-[var(--fg)]">Select Shade</Label>
                      <span className="text-lg font-semibold text-[var(--fg)] mt-0.5">{activeShadeLabel}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {p.shades.map((s) => {
                      const isActive = activeShade === s.key;
                      return (
                        <div key={s.key} className="group relative">
                          <button
                            onClick={() => setActiveShade(s.key)}
                            className={`relative h-9 w-9 rounded-full transition-all duration-300 ${isActive
                              ? "ring-2 ring-offset-2 ring-black scale-110 shadow-md"
                              : "hover:scale-110 hover:shadow-sm ring-1 ring-black/5"
                              }`}
                            style={{ backgroundColor: s.hex }}
                            aria-label={`Select shade ${s.name}`}
                          >
                            {/* Inner highlight for depth */}
                            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
                          </button>

                          {/* Tooltip */}
                          <span className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium shadow-xl transition-all duration-200 pointer-events-none whitespace-nowrap z-20 ${isActive && showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                            }`}>
                            {s.name}
                            {/* Arrow */}
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-900 rotate-45" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* CTA block */}
              <section ref={ctaRef}>
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border px-2 border-[var(--divider)]">
                      <button className="px-3 py-1 text-lg text-[var(--fg)]" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
                      <input
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-10 text-center outline-none bg-transparent text-[var(--fg)]"
                        inputMode="numeric"
                      />
                      <button className="px-3 py-1 text-lg text-[var(--fg)]" onClick={() => setQty((q) => q + 1)}>+</button>
                    </div>

                    {/* Desktop/tablet inline buttons */}
                    <div className="hidden sm:flex items-center gap-3 ml-auto">
                      <Button
                        type="button"
                        onClick={handleAddToCart}
                        className="px-5 sm:px-6 min-h-10 sm:min-h-11"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {isActiveShadeInCart ? "In Cart" : "Add to Cart"}
                      </Button>
                      <Button variant="outline" className="px-5 sm:px-6 min-h-10 sm:min-h-11">
                        Buy Now
                      </Button>
                    </div>
                  </div>

                  {/* Mobile buttons side-by-side */}
                  <div className="grid grid-cols-2 gap-2 sm:hidden">
                    <Button
                      type="button"
                      onClick={handleAddToCart}
                      className="w-full min-h-11"
                      aria-label={isActiveShadeInCart ? "In Cart" : "Add to Cart"}
                    >
                      <ShoppingCart className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" className="w-full min-h-11">
                      Buy Now
                    </Button>
                  </div>

                  {(cartItems.length > 0 || wishlist.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--fg-muted)]">
                      {cartItems.length > 0 && (
                        <Badge className="bg-[var(--chip-bg)] border-transparent text-[var(--fg)] px-3 py-1">
                          Cart {cartItems.length} item{cartItems.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {wishlist.length > 0 && (
                        <Badge variant="outline" className="border-[var(--divider)] text-[var(--fg)] px-3 py-1">
                          Saved {wishlist.length} look{wishlist.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Icons row */}
                  <div className="flex items-center gap-2 justify-start sm:justify-end">
                    <button
                      type="button"
                      aria-pressed={isActiveShadeWishlisted}
                      onClick={handleToggleWishlist}
                      className={`p-2 border transition-colors ${isActiveShadeWishlisted
                        ? "border-rose-400/80 text-rose-400 bg-rose-400/10 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                        : "border-[var(--divider)] text-[var(--fg)] hover:border-rose-400/60 hover:text-rose-400"
                        }`}
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                    <button className="p-2 border border-[var(--divider)] text-[var(--fg)]"><Share2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-3 gap-3 text-xs mt-6">
                <div className="flex flex-col items-center justify-center gap-2 border p-4 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)] text-center h-full">
                  <Truck className="h-5 w-5 text-[var(--fg-muted)]" />
                  <span>{p.shipping || "Fast, tracked delivery"}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 border p-4 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)] text-center h-full">
                  <ShieldCheck className="h-5 w-5 text-[var(--fg-muted)]" />
                  <span>Secure payments</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 border p-4 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)] text-center h-full">
                  <Recycle className="h-5 w-5 text-[var(--fg-muted)]" />
                  <span>{p.returns || "Easy returns"}</span>
                </div>
              </section>

              <Separator className="bg-[var(--divider)]" />

              <section className="grid md:grid-cols-2 gap-6 pt-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-[var(--fg)] flex items-center gap-2">
                    <Heart className="h-5 w-5 text-rose-400" /> Why you will love it
                  </h2>
                  <div className="grid grid-cols-1 gap-3">
                    {p.benefits?.map((b, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[var(--card-bg)] border border-[var(--divider)] transition-all hover:shadow-sm hover:border-[var(--fg-muted)]">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--fg-muted)]">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border p-5 border-[var(--divider)] bg-[var(--card-bg)]">
                  <h3 className="font-semibold mb-4 text-[var(--fg)] flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-400" /> Ingredient highlights
                  </h3>
                  <ul className="space-y-3">
                    {p.ingredients_highlight?.map((it, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm group">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg)] mt-2 group-hover:scale-150 transition-transform" />
                        <span><span className="font-medium text-[var(--fg)]">{it.name}</span> <span className="text-[var(--fg-muted)]">â€” {it.why}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="mt-8">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full bg-[var(--chip-bg)] p-1">
                    <TabsTrigger
                      value="details"
                      className="data-[state=active]:bg-[var(--fg)] data-[state=active]:text-[var(--card-bg)] transition-all"
                    >
                      Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="claims"
                      className="data-[state=active]:bg-[var(--fg)] data-[state=active]:text-[var(--card-bg)] transition-all"
                    >
                      Claims
                    </TabsTrigger>
                    <TabsTrigger
                      value="how-to-use"
                      className="data-[state=active]:bg-[var(--fg)] data-[state=active]:text-[var(--card-bg)] transition-all"
                    >
                      How To Use
                    </TabsTrigger>
                    <TabsTrigger
                      value="faqs"
                      className="data-[state=active]:bg-[var(--fg)] data-[state=active]:text-[var(--card-bg)] transition-all"
                    >
                      FAQs
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-4 text-[var(--fg-muted)]">
                    {p.subtitle && <p className="text-[var(--fg)]">{p.subtitle}</p>}
                    {productSpecs.length ? (
                      <p>{productSpecs.join(" / ")}.</p>
                    ) : (
                      <p>Product details will be added soon.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="claims" className="mt-4 text-[var(--fg-muted)]">
                    {p.claims?.length ? (
                      <ul className="list-disc pl-5 space-y-1">{p.claims.map((c, i) => (<li key={i}>{c}</li>))}</ul>
                    ) : (
                      <p>Claims will be added soon.</p>
                    )}
                    {p.disclaimer && <div className="text-xs opacity-70 mt-2">{p.disclaimer}</div>}
                  </TabsContent>
                  <TabsContent value="how-to-use" className="mt-4 text-[var(--fg-muted)]">
                    {p.how_to_use?.length ? (
                      <ol className="list-decimal pl-5 space-y-1">
                        {p.how_to_use.map((step, i) => (<li key={i}>{step}</li>))}
                      </ol>
                    ) : (
                      <p>Directions will be added soon.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="faqs" className="mt-4 text-[var(--fg-muted)]">
                    {p.faqs?.length ? (
                      <Accordion type="single" collapsible className="w-full">
                        {p.faqs.map((f, i) => (
                          <AccordionItem key={i} value={`faq-${i}`}>
                            <AccordionTrigger className="text-[var(--fg)]">{f.q}</AccordionTrigger>
                            <AccordionContent>{f.a}</AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <p>FAQs will be added soon.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          </section>
        </div>

        {/* ===== INGREDIENTS ===== */}
        <section className="w-full px-4 sm:px-6 lg:px-12 py-16 md:py-24" data-bg-key="ingredients">
          <div className="overflow-hidden rounded-[22px] border border-[var(--divider)] shadow-md bg-white">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
              {/* Left panel */}
              <div className="relative bg-[#fdf8ef] px-6 sm:px-10 py-12 sm:py-14 flex flex-col justify-center">
                <span
                  className="absolute left-3 top-4 text-[11px] font-semibold tracking-[0.32em] text-neutral-500 hidden sm:block"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  what is inside
                </span>

                <div className="space-y-6 pr-3 sm:pr-8">
                  <p className="text-sm leading-relaxed text-neutral-700 max-w-2xl">
                    {p.subtitle ||
                      p.longDescription ||
                      "Peptides are our go-to skincare ingredient and come in many forms with unique benefits. Get to know the one in this formula."}
                  </p>
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                      {primaryIngredient?.name || "palmitoyl tripeptide-1"}
                    </h3>
                    <p className="mt-2 text-sm sm:text-base text-neutral-700 leading-relaxed border-l-4 border-amber-300 pl-3">
                      {primaryIngredient?.why ||
                        "A short chain of amino acids that hydrates, smooths, and plumps lips while reducing the look of fine lines."}
                    </p>
                  </div>
                  {otherIngredientNames.length > 0 && (
                    <p className="text-sm text-neutral-700">
                      also made with{" "}
                      <span className="font-semibold text-neutral-900">
                        {otherIngredientNames.join(", ")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Overlay for full list */}
                {showFullIngredients && (
                  <div className="absolute inset-0 bg-[#fdf8ef]/98 backdrop-blur-sm px-6 sm:px-10 py-10 flex flex-col gap-4 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setShowFullIngredients(false)}
                      className="absolute right-4 top-4 p-2 rounded-full border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
                      aria-label="Close ingredients list"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <h3 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                      {p.ingredientsTitle || "ingredients"}
                    </h3>
                    <p className="text-sm sm:text-base text-neutral-700 leading-relaxed whitespace-pre-line">
                      {fullIngredientsText || "Full ingredients list coming soon."}
                    </p>
                    {p.ingredientsNote && (
                      <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">{p.ingredientsNote}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Right panel */}
              <div className="relative bg-white flex items-center justify-center p-6 sm:p-10">
                <button
                  type="button"
                  aria-expanded={showFullIngredients}
                  onClick={() => setShowFullIngredients(true)}
                  className="absolute right-5 top-5 rounded-full border border-neutral-300 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase bg-white/85 hover:bg-white shadow-sm"
                >
                  Full ingredients list
                </button>
                <div className="relative w-full max-w-[360px] sm:max-w-[420px] lg:max-w-[480px]">
                  <div className="absolute inset-4 bg-gradient-to-tr from-amber-100/60 to-transparent rounded-full blur-3xl -z-10" />
                  <img
                    src={resolveAsset(p.hero?.image) || heroSrc}
                    alt="Product close-up"
                    className="w-full h-auto object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== VIDEO ===== */}
        {videoSrc && (
          <section className="w-full px-0 py-0" data-bg-key="video">
            <div className="relative overflow-hidden shadow-2xl">
              <VideoHero
                src={videoSrc}
                poster={resolveAsset(p.hero?.image) || heroSrc}
                heightClass="h-[80svh] md:h-[90svh]"
                overlayClass="bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                startMuted
                loop
                autoPauseOffscreen
                showControls
              >
                <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 text-white">
                  <div className="pointer-events-none absolute bottom-6 sm:bottom-8 left-4 sm:left-6 z-10 max-w-xl text-white md:bottom-12">
                    <h3 className="text-4xl font-bold md:text-6xl mb-6 tracking-tight text-white">
                      {p.videoTitle}
                    </h3>
                    {p.videoDescription && (
                      <p className="text-lg md:text-xl text-white/90 leading-relaxed max-w-2xl">
                        {p.videoDescription}
                      </p>
                    )}
                  </div>
                </div>
              </VideoHero>
            </div>
          </section>
        )}
      </div >

      {/* ===== NEW HOVER REVEAL SECTION (MOVED HERE) ===== */}
      {!!featureList.length && (
      <section className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 md:mt-20 mb-16" data-bg-key="features">
        <div className="bg-neutral-50 rounded-2xl p-5 sm:p-8 lg:p-12 border border-neutral-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
            {/* Left: Dynamic Image */}
            <div className="relative aspect-square sm:aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-neutral-100">
              <SmoothImage
                src={featureList[activeFeatureIndex]?.img}
                alt={featureList[activeFeatureIndex]?.label}
                className="h-full w-full object-contain bg-white transition-transform duration-700 hover:scale-105"
              />
            </div>

            {/* Right: Hover List */}
            <div className="flex flex-col justify-center space-y-4 sm:space-y-6 pl-0 md:pl-4 lg:pl-8">
              <span className="text-[11px] font-bold tracking-[0.24em] text-neutral-500 uppercase">
                Lip care that:
              </span>
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {featureList.map((feature, index) => (
                  <h3
                    key={feature.label}
                    onMouseEnter={() => setActiveFeatureIndex(index)}
                    onFocus={() => setActiveFeatureIndex(index)}
                    tabIndex={0}
                    className={`
                        text-[clamp(1.5rem,3.5vw,2.2rem)] sm:text-[clamp(1.75rem,3vw,2.6rem)] lg:text-[clamp(2rem,2.8vw,3rem)]
                        leading-[1.1] font-extrabold uppercase cursor-pointer transition-all duration-300 tracking-tight
                        ${activeFeatureIndex === index
                        ? `${feature.color} translate-x-2 sm:translate-x-4 drop-shadow-sm`
                        : "text-neutral-300 hover:text-neutral-400"
                      }
                      `}
                  >
                    {feature.label}
                  </h3>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ===== EXPLORE SHADES ===== */}
      {
        !!p.shades?.length && (
      <section className="w-full px-4 sm:px-6 lg:px-12 py-16 md:py-24" data-bg-key="shades">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl md:text-3xl font-semibold text-[var(--fg)]">Explore Shades</h2>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                    setSectionImgIdx((i) => Math.max(0, i - 1));
                    shadeRefs.current[Math.max(0, sectionImgIdx - 1)]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              aria-label="Previous shade"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                    setSectionImgIdx((i) => Math.min(p.shades.length - 1, i + 1));
                    shadeRefs.current[Math.min(p.shades.length - 1, sectionImgIdx + 1)]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              aria-label="Next shade"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Sticky preview */}
          <div className="lg:sticky lg:top-24 h-fit">
            <SmoothImage
              src={getShadeImageByIndex(sectionImgIdx)}
              alt={`Shade ${sectionImgIdx + 1}`}
              className="w-full h-auto"
            />
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {p.shades.map((_, i) => (
                    <span key={i} className={`h-1.5 w-4 rounded-full transition-all ${sectionImgIdx === i ? "bg-black w-6" : "bg-neutral-400"}`} />
                  ))}
                </div>
              </div>

          {/* Scrollable cards */}
          <div className="space-y-4">
                {p.shades.map((s, i) => (
                  <div
                    key={s.key}
                    ref={shadeRefs.current[i]}
                    onClick={() => {
                      setSectionImgIdx(i);
                      shadeRefs.current[i]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`cursor-pointer border p-4 transition-all duration-300 ${sectionImgIdx === i ? "border-black bg-[var(--card-bg)]" : "border-[var(--divider)]"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-6 w-6 rounded-full ring-1 ring-black/10 overflow-hidden"
                        style={{ background: s.hex }}
                      >
                        {s.thumb && <img src={resolveAsset(s.thumb)} alt={s.name} className="h-full w-full object-cover rounded-full" />}
                      </span>
                      <h3 className="text-base font-semibold text-[var(--fg)]">{s.name}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">{s.desc}</p>
                  </div>
            ))}
              </div>
            </div>
          </section>
        )
      }

      {/* ===== REVIEWS ===== */}
      <section ref={reviewsRef} className="w-full px-4 sm:px-6 lg:px-12 py-16 md:py-24" data-bg-key="reviews">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Summary Dashboard */}
          <div className="lg:col-span-4 space-y-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-[var(--fg)] mb-2">Customer Reviews</h2>
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-bold text-[var(--fg)]">{averageRating}</span>
                <div className="flex flex-col">
                  <RatingStars value={averageRating} />
                  <span className="text-sm text-[var(--fg-muted)] mt-1">Based on {reviewCount} reviews</span>
                  {reviewsLoading && (
                    <span className="text-xs text-[var(--fg-muted)]">Refreshing reviewsâ€¦</span>
                  )}
                  {reviewsError && (
                    <span className="text-xs text-rose-600">{reviewsError}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {ratingDistribution.map(({ stars, percent }) => (
                <div key={stars} className="flex items-center gap-3 text-sm">
                  <span className="w-3 font-medium text-[var(--fg)]">{stars}</span>
                  <Star className="h-3 w-3 fill-current text-[var(--fg-muted)]" />
                  <Progress value={percent} className="h-2 flex-1 bg-[var(--divider)]" indicatorClassName="bg-[var(--fg)]" />
                  <span className="w-8 text-right text-[var(--fg-muted)]">{percent}%</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--divider)] bg-[var(--card-bg)] p-6 text-center">
              <h3 className="font-semibold text-[var(--fg)] mb-2">Share your thoughts</h3>
              {reviewsApiEnabled ? (
                isAuthenticated ? (
                  checkingPurchase ? (
                    <p className="text-sm text-[var(--fg-muted)] mb-2">Checking your orders…</p>
                  ) : hasPurchased ? (
                    <form className="space-y-3 text-left" onSubmit={handleSubmitReview}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm text-[var(--fg)]">Rating</Label>
                          <select
                            className="w-full rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--fg)]/20"
                            value={reviewForm.rating}
                            onChange={(e) =>
                              setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))
                            }
                          >
                            {[5, 4, 3, 2, 1].map((value) => (
                              <option key={value} value={value}>
                                {value} star{value > 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm text-[var(--fg)]">Title (optional)</Label>
                          <input
                            type="text"
                            maxLength={150}
                            className="w-full rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--fg)]/20"
                            value={reviewForm.title}
                            onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Amazing texture and color"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[var(--fg)]">Share details</Label>
                        <textarea
                          rows={4}
                          maxLength={1000}
                          className="w-full rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--fg)]/20"
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                          placeholder="Tell us about the shade, comfort, wear time…"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={submittingReview} className="flex-1 min-w-[140px]">
                          {submittingReview
                            ? "Saving..."
                            : editingReviewId
                              ? "Update review"
                              : "Submit review"}
                        </Button>
                        {editingReviewId ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetReviewForm}
                              disabled={submittingReview}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleDeleteReview(editingReviewId)}
                              disabled={submittingReview}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetReviewForm}
                            disabled={submittingReview}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                      {myReview && !editingReviewId && (
                        <button
                          type="button"
                          className="text-xs text-[var(--fg)] underline"
                          onClick={() => handleStartEdit(myReview)}
                        >
                          Edit your existing review
                        </button>
                      )}
                    </form>
                  ) : (
                    <p className="text-sm text-[var(--fg-muted)]">
                      Reviews are available only to customers who purchased this product.
                    </p>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--fg-muted)]">Please log in to write a review.</p>
                    <Link
                      to="/login"
                      className="inline-flex w-full items-center justify-center rounded-full border border-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--fg)] hover:text-white transition-colors"
                    >
                      Login to review
                    </Link>
                  </div>
                )
              ) : (
                <p className="text-sm text-[var(--fg-muted)]">
                  Live reviews are unavailable for this product.
                </p>
              )}
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--divider)]">
              <span className="font-medium text-[var(--fg)]">{filteredAndSortedReviews.length} Reviews</span>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[160px] border-[var(--divider)] bg-transparent"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="highest">Highest Rating</SelectItem>
                  <SelectItem value="lowest">Lowest Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-8">
              {filteredAndSortedReviews.map((r, i) => (
                <div key={r.id || i} className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 80}ms` }}>
                  <Avatar className="h-10 w-10 border border-[var(--divider)]">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${r.author}`} />
                    <AvatarFallback>{r.author?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[var(--fg)]">{r.author}</h4>
                        {r.userId === user?.id && r.status !== "PUBLISHED" && (
                          <span className="text-[10px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-semibold">
                            Pending
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--fg-muted)]">{r.date || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RatingStars value={r.rating} />
                      {(r.verified || (r.userId === user?.id && hasPurchased)) && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Verified Buyer
                        </span>
                      )}
                    </div>
                    {r.title && <h5 className="font-medium text-[var(--fg)]">{r.title}</h5>}
                    <p className="text-[var(--fg-muted)] leading-relaxed text-sm whitespace-pre-line">{r.comment}</p>

                    <div className="flex items-center gap-4 pt-2">
                      <button className="flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
                        <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({r.helpfulCount})
                      </button>
                      <button className="flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
                        <MessageSquare className="h-3.5 w-3.5" /> Comment
                      </button>
                      {r.userId === user?.id && (
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            className="text-[var(--fg)] underline"
                            onClick={() => handleStartEdit(r)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-rose-600 underline"
                            onClick={() => handleDeleteReview(r.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!filteredAndSortedReviews.length && (
                <div className="text-center py-12 text-[var(--fg-muted)]">
                  <p>No reviews match your current filters.</p>
                  <Button variant="link" onClick={() => { setFilterRating(0); setSortOrder("newest"); }}>Clear filters</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== INGREDIENTS (BOTTOM) ===== */}
      <section className="w-full px-4 sm:px-6 lg:px-12 py-14 md:py-20 bg-white" data-bg-key="ingredients">
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-neutral-500 uppercase tracking-[0.2em]">Key Ingredients</p>
            <h2 className="text-2xl md:text-3xl font-bold text-neutral-900">Whatâ€™s inside</h2>
            <div className="space-y-3">
              {(p.ingredients_highlight || []).map((ing, i) => (
                <div key={ing.name || i} className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50">
                  <h4 className="font-semibold text-neutral-900">{ing.name}</h4>
                  <p className="text-sm text-neutral-600">{ing.why}</p>
                </div>
              ))}
              {!p.ingredients_highlight?.length && (
                <p className="text-sm text-neutral-600">Ingredient story coming soon.</p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-neutral-500 uppercase tracking-[0.2em]">Supporting ingredients</p>
            {Array.isArray(p.ingredients_supporting) && p.ingredients_supporting.length ? (
              <ul className="space-y-2 text-sm text-neutral-700 list-disc list-inside">
                {p.ingredients_supporting.map((item, i) => (
                  <li key={item || i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-600">Supporting ingredients will be added soon.</p>
            )}
          </div>
        </div>
      </section>

      {/* ===== YOU MAY ALSO LIKE ===== */}
      {!!relatedProducts.length && (
        <section className="w-full bg-white py-10 sm:px-6 lg:px-1" data-bg-key="recommendations">
          <h2 className="text-2xl md:text-3xl font-semibold text-[var(--fg)] mb-8 text-center">You May Also Like</h2>
          <div className="mx-auto flex w-full snap-x snap-mandatory gap-3 sm:gap-4 overflow-x-auto pb-4 sm:grid sm:max-w-screen-2xl sm:grid-cols-2 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4 no-scrollbar">
            {relatedProducts.map((rp, i) => {
              const rpHero = pickProductImage(rp);
              const rpCurrency = rp.pricing?.currency || rp.currency || p.currency || "â‚¹";
              const rpPrice = rp.pricing?.price ?? rp.price ?? rp.mrp ?? rp.pricing?.originalValue ?? "";
              return (
                <Link
                  to={`/product/${rp.id || rp.slug || ""}`}
                  key={(rp.id || rp.slug || "rp") + i}
                  className="group relative flex min-w-[80vw] sm:min-w-0 flex-col justify-between overflow-hidden border border-neutral-200 bg-white text-center shadow-sm min-h-[400px] snap-center hover:shadow-lg transition-all duration-300"
                >
                  {/* Image Area */}
                  <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden">
                    <img
                      src={rpHero}
                      alt={rp.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Badges */}
                    <div className="absolute left-2 top-2 flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white/90 backdrop-blur text-black shadow-sm">
                        <Video className="h-3 w-3" /> Try On
                      </span>
                    </div>

                    {/* Wishlist */}
                    <button
                      onClick={(e) => { e.preventDefault(); toggleWishlist(rp); }}
                      className="absolute right-2 top-2 p-1.5 bg-white/80 backdrop-blur hover:bg-white text-neutral-600 hover:text-red-500 transition-colors"
                      aria-label="Save to wishlist"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-neutral-900 line-clamp-1">{rp.name}</h3>
                      <span className="text-sm font-semibold text-neutral-900">
                        {rpCurrency}{rpPrice}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-3 line-clamp-2">
                      {rp.subtitle || rp.description?.headline || "Beauty essentials"}
                    </p>

                    {/* Shades Preview */}
                    <div className="flex items-center gap-1 mb-4 justify-center">
                      {[...Array(3)].map((_, j) => (
                        <span
                          key={j}
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5"
                          style={{ backgroundColor: ['#AD0F23', '#BF4A57', '#8E0F1E'][j] }}
                        />
                      ))}
                      <span className="text-[10px] text-neutral-500 ml-1">+ more</span>
                    </div>

                    <Button
                      variant="outline"
                      onClick={(e) => { e.preventDefault(); addToCart(rp); }}
                      className="w-full text-xs h-9 border-neutral-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                    >
                      Add to Cart
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <StickyProductBar
        product={p}
        activeShade={p.shades?.find(s => s.key === activeShade)}
        activeShadeLabel={activeShadeLabel}
        onAddToCart={handleAddToCart}
        isVisible={showStickyBar}
      />
    </div >
  );
}

function StickyProductBar({ product, activeShade, activeShadeLabel, onAddToCart, isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-neutral-200 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom-full duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4">
        {/* Left: Product Info (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden border border-neutral-200">
            <img
              src={resolveAsset(activeShade?.thumb) || resolveAsset(product.hero?.image)}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-neutral-900">{product.title}</h4>
            <p className="text-xs text-neutral-500">{activeShadeLabel}</p>
          </div>
        </div>

        {/* Center: Shades (Mobile optimized) */}
        <div className="flex-1 md:flex-none flex justify-center">
          <div className="flex items-center gap-2">
            {product.shades.map(s => (
              <div
                key={s.key}
                className={`h-6 w-6 rounded-full border ${activeShade?.key === s.key ? 'ring-1 ring-black ring-offset-1' : 'border-transparent'}`}
                style={{ backgroundColor: s.hex }}
              />
            ))}
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex items-center gap-2">
          <Button onClick={onAddToCart} className="bg-black text-white hover:bg-neutral-800">
            Add to Cart - {product.currency}{product.price}
          </Button>
        </div>
      </div>
    </div>
  );
}
