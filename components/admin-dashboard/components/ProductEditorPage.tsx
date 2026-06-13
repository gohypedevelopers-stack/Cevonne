"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  AlertTriangle,
  ArrowRight,
  Bold,
  Check,
  Eye,
  EyeOff,
  ImageIcon,
  Italic,
  MoveDown,
  MoveUp,
  Plus,
  RemoveFormatting,
  ShieldCheck,
  Sparkles,
  Trash2,
  Underline,
  UploadCloud,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { API_BASE, slugify } from "../utils";
import type { Product, ProductCollection, ProductShade } from "@/types/product";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

const PRODUCT_TYPE_OPTIONS = [
  "Bullet lipstick",
  "Liquid matte lipstick",
  "Lip gloss",
  "Lip liner",
  "Lip care",
  "Single",
];

const PRODUCT_CATEGORY_OPTIONS = [
  "Makeup > Lips > Lipstick",
  "Makeup > Lips > Lip Gloss",
  "Makeup > Lips > Lip Liner",
  "Makeup > Lips > Lip Care",
];

const PRODUCT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Storefront visible" },
  { value: "hidden", label: "Hidden" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

const generateId = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const optionalString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const optionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const parseLines = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== "string") return [];

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
};

const parseCategoryPath = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = typeof value === "string" ? value : "";
  return text
    .split(/\s*>\s*|\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const joinLines = (value: unknown) => {
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "string") return value;
  return "";
};

const plainTextFromHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const inferMediaKind = (file: File | { type?: string | null } | string) => {
  const type = typeof file === "string" ? file : String(file.type || "");
  if (type.toLowerCase().startsWith("video/")) return "video";
  if (typeof file === "string") {
    return /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(file) ? "video" : "image";
  }
  return "image";
};

const mediaItemKey = (item: ProductMediaItem, index: number) => item.key || item.id || `media-${index}`;

const mediaUrlFromValue = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (isRecord(value)) return String(value.url || value.src || value.id || "");
  return "";
};

type ProductMediaItem = {
  id: string;
  url: string;
  key?: string;
  mimeType?: string;
  fileName?: string;
  alt?: string;
  kind: "image" | "video";
  isPrimary?: boolean;
};

type UploadQueueItem = {
  id: string;
  fileName: string;
  progress: number;
  status: "preparing" | "uploading" | "done" | "error";
  error?: string;
};

type ProductEditorMode = "create" | "edit";

type ProductEditorValues = {
  name: string;
  slug: string;
  description: string;
  brand: string;
  type: string;
  finish: string;
  collectionId: string;
  tags: string;
  price: string;
  originalValue: string;
  currency: string;
  productStatus: "draft" | "active" | "archived";
  visibility: "visible" | "hidden";
  categoryPath: string;
  trackInventory: boolean;
  sellWhenOutOfStock: boolean;
  barcode: string;
  headline: string;
  subtitle: string;
  longDescription: string;
  coverage: string;
  fragrance: string;
  heroImageUrl: string;
  heroObjectPosition: string;
  galleryUrls: string;
  videoUrl: string;
  videoTitle: string;
  videoDescription: string;
  badges: string;
  benefits: string;
  howToUse: string;
  claims: string;
  disclaimer: string;
  shippingNote: string;
  returnPolicy: string;
  ingredientsTitle: string;
  supportingIngredients: string;
  unitCount: string;
  sizeMl: string;
  sizeFlOz: string;
  shades: ShadeFormValue[];
  heroIngredients: IngredientFormValue[];
  faqs: FaqFormValue[];
};

type ShadeFormValue = {
  id: string;
  name: string;
  hexColor: string;
  sku: string;
  price: string;
  quantity: string;
};

type IngredientFormValue = {
  id: string;
  name: string;
  why: string;
};

type FaqFormValue = {
  id: string;
  question: string;
  answer: string;
};

type ProductEditorPageProps = {
  mode: ProductEditorMode;
  product?: Product | null;
  productId?: string;
  collections: ProductCollection[];
  request: (url: string, options?: RequestInit) => Promise<Response>;
  refresh?: () => void;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
  mobileMenuTrigger?: ReactNode;
};

const createEmptyShade = (): ShadeFormValue => ({
  id: generateId(),
  name: "",
  hexColor: "#a21caf",
  sku: "",
  price: "",
  quantity: "",
});

const createEmptyIngredient = (): IngredientFormValue => ({
  id: generateId(),
  name: "",
  why: "",
});

const createEmptyFaq = (): FaqFormValue => ({
  id: generateId(),
  question: "",
  answer: "",
});

const createDefaultValues = (mode: ProductEditorMode): ProductEditorValues => ({
  name: "",
  slug: "",
  description: "",
  brand: "CEVONNE",
  type: "Bullet lipstick",
  finish: "",
  collectionId: "",
  tags: "",
  price: "",
  originalValue: "",
  currency: "INR",
  productStatus: mode === "edit" ? "active" : "draft",
  visibility: "visible",
  categoryPath: PRODUCT_CATEGORY_OPTIONS[0],
  trackInventory: true,
  sellWhenOutOfStock: false,
  barcode: "",
  headline: "",
  subtitle: "",
  longDescription: "",
  coverage: "",
  fragrance: "",
  heroImageUrl: "",
  heroObjectPosition: "50% 50%",
  galleryUrls: "",
  videoUrl: "",
  videoTitle: "",
  videoDescription: "",
  badges: "",
  benefits: "",
  howToUse: "",
  claims: "",
  disclaimer: "",
  shippingNote: "",
  returnPolicy: "",
  ingredientsTitle: "Powered by Science",
  supportingIngredients: "",
  unitCount: "1",
  sizeMl: "",
  sizeFlOz: "",
  shades: [createEmptyShade()],
  heroIngredients: [createEmptyIngredient()],
  faqs: [createEmptyFaq()],
});

const mapMediaItemsFromProduct = (product?: Product | null): ProductMediaItem[] => {
  if (!product) return [];

  const items: ProductMediaItem[] = [];
  const seen = new Set<string>();
  const existingMedia = isRecord(product.media) ? product.media : {};
  const existingGallery = Array.isArray(existingMedia.gallery) ? existingMedia.gallery : [];
  const imageList = Array.isArray(product.images) ? product.images : [];

  const pushItem = (item: ProductMediaItem) => {
    const key = item.key || item.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const item of existingGallery) {
    const url = mediaUrlFromValue(item);
    if (!url) continue;
    const kind = isRecord(item) && item.kind ? String(item.kind).toLowerCase() : inferMediaKind(url);
    pushItem({
      id: String((isRecord(item) && (item.id || item.key || item.storageKey)) || generateId()),
      url,
      key: isRecord(item) ? String(item.key || item.storageKey || item.id || "") || undefined : undefined,
      mimeType: isRecord(item) ? String(item.mimeType || "") || undefined : undefined,
      fileName: isRecord(item) ? String(item.fileName || "") || undefined : undefined,
      alt: isRecord(item) ? String(item.alt || "") || undefined : undefined,
      kind: kind === "video" || kind === "VIDEO" ? "video" : "image",
      isPrimary: Boolean(isRecord(item) && item.isPrimary),
    });
  }

  for (const image of imageList) {
    if (!image?.url) continue;
    pushItem({
      id: image.id || generateId(),
      url: image.url,
      alt: image.alt || product.name,
      kind: inferMediaKind(image.url),
      isPrimary: false,
    });
  }

  const heroUrl =
    (isRecord(existingMedia) && String(existingMedia.heroImage || "")) ||
    (isRecord(product.experience) && isRecord(product.experience.hero) && String(product.experience.hero.image || "")) ||
    "";

  if (heroUrl && !seen.has(heroUrl)) {
    items.unshift({
      id: generateId(),
      url: heroUrl,
      alt: product.name,
      kind: inferMediaKind(heroUrl),
      isPrimary: true,
    });
  }

  if (!items.length) {
    const fallbackGallery = isRecord(product.experience) ? product.experience.gallery : undefined;
    if (Array.isArray(fallbackGallery)) {
      for (const item of fallbackGallery) {
        const url = mediaUrlFromValue(item);
        if (!url) continue;
        pushItem({
          id: generateId(),
          url,
          alt: product.name,
          kind: inferMediaKind(url),
          isPrimary: false,
        });
      }
    }
  }

  return items.map((item, index) => ({
    ...item,
    isPrimary: index === 0 ? true : item.isPrimary,
  }));
};

const mapShadeRowsFromProduct = (product?: Product | null): ShadeFormValue[] => {
  if (!product || !Array.isArray(product.shades) || !product.shades.length) {
    return [createEmptyShade()];
  }

  return product.shades.map((shade) => ({
    id: shade.id || generateId(),
    name: shade.name || "",
    hexColor: shade.hexColor || "#a21caf",
    sku: shade.sku || "",
    price: shade.price != null ? String(shade.price) : "",
    quantity: shade.inventory?.quantity != null ? String(shade.inventory.quantity) : "",
  }));
};

const mapIngredientsFromProduct = (product?: Product | null): IngredientFormValue[] => {
  if (!product) return [createEmptyIngredient()];

  const experience = isRecord(product.experience) ? product.experience : {};
  const rawList =
    experience.ingredientsHighlight ||
    experience.ingredients_highlight ||
    (isRecord(product.ingredients) ? product.ingredients.keyActives : undefined) ||
    [];

  if (!Array.isArray(rawList) || !rawList.length) {
    return [createEmptyIngredient()];
  }

  return rawList.map((item, index) => ({
    id: String((isRecord(item) && item.id) || index || generateId()),
    name: String((isRecord(item) && (item.name || item.ingredient)) || ""),
    why: String((isRecord(item) && (item.why || item.detail || item.description)) || ""),
  }));
};

const mapFaqsFromProduct = (product?: Product | null): FaqFormValue[] => {
  if (!product) return [createEmptyFaq()];
  const experience = isRecord(product.experience) ? product.experience : {};
  const rawFaqs = Array.isArray(experience.faqs) ? experience.faqs : [];

  if (!rawFaqs.length) return [createEmptyFaq()];

  return rawFaqs.map((faq, index) => ({
    id: String((isRecord(faq) && faq.id) || index || generateId()),
    question: String((isRecord(faq) && (faq.question || faq.q)) || ""),
    answer: String((isRecord(faq) && (faq.answer || faq.a)) || ""),
  }));
};

const mapFormValuesFromProduct = (product: Product | null | undefined, mode: ProductEditorMode): ProductEditorValues => {
  const experience = isRecord(product?.experience) ? product.experience : {};
  const media = isRecord(product?.media) ? product.media : {};
  const pricing = isRecord(product?.pricing) ? product.pricing : {};
  const size = isRecord(product?.size) ? product.size : {};
  const ingredients = isRecord(product?.ingredients) ? product.ingredients : {};
  const categoryPath = parseCategoryPath(experience.categoryPath);
  const hero = isRecord(experience.hero) ? experience.hero : {};
  const inventory = isRecord(experience.inventory) ? experience.inventory : {};

  return {
    ...createDefaultValues(mode),
    name: product?.name || "",
    slug: product?.slug || "",
    description: typeof product?.description === "string" ? product.description : "",
    brand: product?.brand || "CEVONNE",
    type: product?.productType || "Bullet lipstick",
    finish: product?.finish || "",
    collectionId: product?.collectionId || "",
    tags: Array.isArray(product?.tags) ? product.tags.join(", ") : typeof product?.tags === "string" ? product.tags : "",
    price: pricing.price != null ? String(pricing.price) : product?.basePrice != null ? String(product.basePrice) : "",
    originalValue: pricing.originalValue != null ? String(pricing.originalValue) : "",
    currency: pricing.currency || "INR",
    productStatus: (experience.status as ProductEditorValues["productStatus"]) || (mode === "edit" ? "active" : "draft"),
    visibility: (experience.visibility as ProductEditorValues["visibility"]) || "visible",
    categoryPath: categoryPath.join(" > ") || PRODUCT_CATEGORY_OPTIONS[0],
    trackInventory:
      typeof inventory.trackInventory === "boolean" ? inventory.trackInventory : true,
    sellWhenOutOfStock:
      typeof inventory.sellWhenOutOfStock === "boolean" ? inventory.sellWhenOutOfStock : false,
    barcode: inventory.barcode ? String(inventory.barcode) : "",
    headline: String(experience.headline || ""),
    subtitle: String(experience.subtitle || ""),
    longDescription: String(experience.longDescription || ""),
    coverage: String(experience.coverage || ""),
    fragrance: String(experience.fragrance || ""),
    heroImageUrl: String(media.heroImage || hero.image || ""),
    heroObjectPosition: String(hero.objectPosition || ""),
    galleryUrls: Array.isArray(media.gallery)
      ? media.gallery.map((item: unknown) => mediaUrlFromValue(item)).filter(Boolean).join("\n")
      : Array.isArray(experience.gallery)
      ? experience.gallery.map((item: unknown) => mediaUrlFromValue(item)).filter(Boolean).join("\n")
      : "",
    videoUrl: String(media.videoUrl || experience.videoUrl || ""),
    videoTitle: String(media.videoTitle || experience.videoTitle || ""),
    videoDescription: String(media.videoDescription || experience.videoDescription || ""),
    badges: parseLines(experience.badges).join("\n"),
    benefits: parseLines(experience.benefits).join("\n"),
    howToUse: parseLines(experience.howToUse || experience.how_to_use).join("\n"),
    claims: parseLines(experience.claims).join("\n"),
    disclaimer: String(experience.disclaimer || ""),
    shippingNote: String(experience.shipping || ""),
    returnPolicy: String(experience.returns || ""),
    ingredientsTitle: String(experience.ingredientsTitle || ""),
    supportingIngredients: Array.isArray(ingredients.supportingIngredients)
      ? ingredients.supportingIngredients.join("\n")
      : typeof ingredients.supportingIngredients === "string"
      ? ingredients.supportingIngredients
      : "",
    unitCount: size.unitCount != null ? String(size.unitCount) : "1",
    sizeMl: isRecord(size.sizePerUnit) && size.sizePerUnit.ml != null ? String(size.sizePerUnit.ml) : "",
    sizeFlOz: isRecord(size.sizePerUnit) && size.sizePerUnit.flOz != null ? String(size.sizePerUnit.flOz) : "",
    shades: mapShadeRowsFromProduct(product),
    heroIngredients: mapIngredientsFromProduct(product),
    faqs: mapFaqsFromProduct(product),
  };
};

const compactObject = (value: Record<string, unknown>) => {
  const entries = Object.entries(value).filter(([, item]) => {
    if (Array.isArray(item)) return item.length > 0;
    if (isRecord(item)) return Object.keys(item).length > 0;
    return item !== undefined && item !== null && item !== "";
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const buildImageList = (mediaItems: ProductMediaItem[], fallbackName: string) =>
  mediaItems
    .filter((item) => item.kind !== "video")
    .map((item, index) => ({
      id: mediaItemKey(item, index),
      url: item.url,
      alt: item.alt || fallbackName,
      key: item.key,
      storageKey: item.key,
      kind: "IMAGE",
      isPrimary: item.isPrimary,
      mimeType: item.mimeType,
      fileName: item.fileName,
    }));

const buildMediaGallery = (
  mediaItems: ProductMediaItem[],
  manualUrls: string[],
  productName: string
) => {
  const items = [
    ...mediaItems.map((item, index) => ({
      id: mediaItemKey(item, index),
      url: item.url,
      key: item.key,
      storageKey: item.key,
      alt: item.alt || productName,
      kind: item.kind === "video" ? "VIDEO" : "IMAGE",
      isPrimary: item.isPrimary,
      mimeType: item.mimeType,
      fileName: item.fileName,
    })),
    ...manualUrls.map((url, index) => ({
      id: `manual-${index}`,
      url,
      alt: productName,
      kind: inferMediaKind(url).toUpperCase(),
      isPrimary: false,
    })),
  ];

  const deduped: typeof items = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }
  return deduped;
};

const uploadFileToR2 = async (
  request: ProductEditorPageProps["request"],
  file: File,
  productId?: string,
  onProgress?: (progress: number) => void
) => {
  const presignResponse = await request("/api/uploads/r2/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      productId: productId || undefined,
    }),
  });

  if (!presignResponse.ok) {
    const body = await presignResponse.json().catch(() => null);
    throw new Error(body?.message || "Failed to prepare upload");
  }

  const { uploadUrl, publicUrl, key } = (await presignResponse.json()) as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error("Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });

  return { publicUrl, key };
};

function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(value || "");

  useEffect(() => {
    draftRef.current = value || "";
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const applyFormatting = (command: "bold" | "italic" | "underline" | "removeFormat") => {
    if (!editorRef.current || typeof document === "undefined") return;
    editorRef.current.focus();
    document.execCommand(command, false, undefined);
    draftRef.current = editorRef.current.innerHTML;
    onChange(draftRef.current);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Format</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => applyFormatting("bold")} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => applyFormatting("italic")} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => applyFormatting("underline")} aria-label="Underline">
            <Underline className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => applyFormatting("removeFormat")} aria-label="Clear formatting">
            <RemoveFormatting className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative">
        {!value ? (
          <span className="pointer-events-none absolute left-4 top-4 z-10 text-sm text-muted-foreground">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[180px] rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground shadow-sm outline-none focus:border-[#4b0d4b] focus:ring-2 focus:ring-[#4b0d4b]/15"
          onInput={(event) => {
            const html = event.currentTarget.innerHTML;
            draftRef.current = html;
          }}
          onBlur={() => onChange(draftRef.current)}
        />
      </div>
      <p className="text-xs text-muted-foreground">Use simple formatting for a cleaner storefront description.</p>
    </div>
  );
}

function ProductMediaPreview({ item }: { item: ProductMediaItem }) {
  const [failed, setFailed] = useState(false);

  if (item.kind === "video") {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-xl border border-border/60 bg-[#fbf7f4] text-[#4b0d4b]">
        <div className="text-center">
          <Video className="mx-auto mb-2 h-5 w-5" />
          <p className="text-xs font-medium">{item.fileName || "Video"}</p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-xl border border-border/60 bg-[#fbf7f4] text-muted-foreground">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-2 h-5 w-5" />
          <p className="text-xs font-medium">Preview unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={item.url}
      alt={item.alt || item.fileName || "Product media"}
      className="h-32 w-full rounded-xl border border-border/60 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function ProductImageCard({
  item,
  index,
  total,
  onRemove,
  onMove,
  onSetPrimary,
  onAltChange,
}: {
  item: ProductMediaItem;
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onSetPrimary: (index: number) => void;
  onAltChange: (index: number, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.fileName || `Media ${index + 1}`}</p>
          <p className="text-xs text-muted-foreground">{item.kind === "video" ? "Video" : "Image"}</p>
        </div>
        <div className="flex items-center gap-1">
          {item.isPrimary ? (
            <Badge className="rounded-full bg-[#fbf7f4] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4b0d4b]">
              Primary
            </Badge>
          ) : null}
        </div>
      </div>

      <ProductMediaPreview item={item} />

      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => onSetPrimary(index)}
            disabled={item.kind === "video"}
          >
            <Check className="mr-2 h-4 w-4" />
            Set as hero
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              aria-label="Move media up"
            >
              <MoveUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => onMove(index, 1)}
              disabled={index === total - 1}
              aria-label="Move media down"
            >
              <MoveDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Alt text</Label>
          <Input
            value={item.alt || ""}
            onChange={(event) => onAltChange(index, event.target.value)}
            placeholder="Soft matte lipstick in velvet berry"
            className="h-10 rounded-xl"
          />
        </div>

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function R2UploadDropzone({
  disabled,
  isUploading,
  onFiles,
}: {
  disabled?: boolean;
  isUploading?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | File[] | null | undefined) => {
    const nextFiles = Array.from(files || []).filter((file) => {
      const mime = file.type.toLowerCase();
      return ALLOWED_UPLOAD_MIME_TYPES.has(mime);
    });
    if (!nextFiles.length) {
      toast.error("Select PNG, JPG, WEBP, GIF, or MP4 files up to 10MB.");
      return;
    }
    onFiles(nextFiles.slice(0, 10));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition",
        isDragging ? "border-[#4b0d4b] bg-[#fbf7f4]" : "border-border/70 bg-[#fbf7f4]",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-[#4b0d4b]/40 hover:bg-[#f8f3ef]"
      )}
    >
      <UploadCloud className="h-8 w-8 text-[#4b0d4b]" />
      <p className="mt-3 text-sm font-semibold text-[#4b0d4b]">
        {isUploading ? "Uploading media..." : "Click or drag files to upload"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Supports PNG, JPG, WEBP, GIF, and MP4 up to 10MB each.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        disabled={disabled}
      />
    </div>
  );
}

function ProductDetailsCard({
  form,
  manualSlug,
  onManualSlugChange,
  descriptionValue,
  onDescriptionChange,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
  manualSlug: boolean;
  onManualSlugChange: (next: boolean) => void;
  descriptionValue: string;
  onDescriptionChange: (value: string) => void;
}) {
  const { register, setValue, watch, getValues } = form;

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Product details</CardTitle>
        <CardDescription>Title, description, and search-friendly slug.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-6 py-5">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product name</Label>
            <Input
              id="product-name"
              autoComplete="off"
              className="h-11 rounded-xl bg-white"
              {...register("name", {
                onChange: (event) => {
                  if (!manualSlug) {
                    setValue("slug", slugify(event.target.value), { shouldDirty: true });
                  }
                },
              })}
              placeholder="Caramel Éclair — Velvet Power™ Bullet Lipstick"
            />
          </div>

          <RichTextEditor
            label="Product description"
            value={descriptionValue}
            onChange={onDescriptionChange}
            placeholder="Write a clean product description that helps customers understand the finish, feel, and promise."
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="product-slug">Slug</Label>
              <button
                type="button"
                className="text-xs font-semibold text-[#4b0d4b]"
                onClick={() => {
                  onManualSlugChange(!manualSlug);
                  if (manualSlug) {
                    setValue("slug", slugify(getValues("name") || ""), { shouldDirty: true });
                  }
                }}
              >
                {manualSlug ? "Auto-generate" : "Edit manually"}
              </button>
            </div>
            <Input
              id="product-slug"
              autoComplete="off"
              className="h-11 rounded-xl bg-white"
              {...register("slug", {
                onChange: (event) => {
                  onManualSlugChange(true);
                  setValue("slug", slugify(event.target.value), { shouldDirty: true });
                },
              })}
              placeholder="velvet-power-caramel-eclair"
            />
            <p className="text-xs text-muted-foreground">Used in the product URL and SEO metadata.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductPricingCard({ form }: { form: ReturnType<typeof useForm<ProductEditorValues>> }) {
  const { register, watch } = form;
  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Pricing</CardTitle>
        <CardDescription>Retail price and compare-at value.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="product-price">Price</Label>
            <Input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              className="h-11 rounded-xl bg-white"
              {...register("price")}
              placeholder="999.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-currency">Currency</Label>
            <Input
              id="product-currency"
              className="h-11 rounded-xl bg-white"
              {...register("currency")}
              placeholder="INR"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-original-value">Compare-at price</Label>
            <Input
              id="product-original-value"
              type="number"
              min="0"
              step="0.01"
              className="h-11 rounded-xl bg-white"
              {...register("originalValue")}
              placeholder="1299.00"
            />
          </div>
          <div className="rounded-2xl border border-border/60 bg-[#fbf7f4] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Preview</p>
            <p className="mt-2 text-2xl font-serif text-[#4b0d4b]">
              {formatCurrency(optionalNumber(watch("price")) ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Compare-at {formatCurrency(optionalNumber(watch("originalValue")) ?? 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductInventoryCard({ form }: { form: ReturnType<typeof useForm<ProductEditorValues>> }) {
  const { register, watch, setValue } = form;
  const trackInventory = watch("trackInventory");
  const sellWhenOut = watch("sellWhenOutOfStock");
  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Inventory</CardTitle>
        <CardDescription>Inventory is managed through shade variants.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Track stock per shade. Use this section for control settings and identifiers.</p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Track inventory</p>
              <p className="text-xs text-muted-foreground">Enable stock awareness for this product.</p>
            </div>
            <Checkbox
              checked={trackInventory}
              onCheckedChange={(checked) => setValue("trackInventory", Boolean(checked), { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Sell when out of stock</p>
              <p className="text-xs text-muted-foreground">Allow orders to continue when shade stock hits zero.</p>
            </div>
            <Checkbox
              checked={sellWhenOut}
              onCheckedChange={(checked) => setValue("sellWhenOutOfStock", Boolean(checked), { shouldDirty: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-barcode">Barcode</Label>
            <Input
              id="product-barcode"
              className="h-11 rounded-xl bg-white"
              {...register("barcode")}
              placeholder="Optional barcode"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductOrganizationCard({
  form,
  collections,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
  collections: ProductCollection[];
}) {
  const { register, watch, setValue } = form;
  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Product organization</CardTitle>
        <CardDescription>Brand, type, finish, collection, and tags.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="space-y-2">
          <Label htmlFor="product-brand">Brand</Label>
          <Input id="product-brand" className="h-11 rounded-xl bg-white" {...register("brand")} placeholder="CEVONNE" />
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={watch("type")} onValueChange={(value) => setValue("type", value, { shouldDirty: true })}>
            <SelectTrigger className="h-11 rounded-xl bg-white">
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-finish">Finish</Label>
          <Input id="product-finish" className="h-11 rounded-xl bg-white" {...register("finish")} placeholder="Matte, satin, glossy..." />
        </div>

        <div className="space-y-2">
          <Label>Collection</Label>
          <Select
            value={watch("collectionId") || "__none__"}
            onValueChange={(value) => setValue("collectionId", value === "__none__" ? "" : value, { shouldDirty: true })}
          >
            <SelectTrigger className="h-11 rounded-xl bg-white">
              <SelectValue placeholder="All collections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No collection</SelectItem>
              {collections.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-tags">Tags</Label>
          <Input
            id="product-tags"
            className="h-11 rounded-xl bg-white"
            {...register("tags")}
            placeholder="lipstick, matte, rose"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProductStatusCard({
  form,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
}) {
  const { watch, setValue } = form;
  const status = watch("productStatus");
  const visibility = watch("visibility");

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Status</CardTitle>
        <CardDescription>Draft, publish, and storefront visibility.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(value) => setValue("productStatus", value as ProductEditorValues["productStatus"], { shouldDirty: true })}>
            <SelectTrigger className="h-11 rounded-xl bg-white">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={(value) => setValue("visibility", value as ProductEditorValues["visibility"], { shouldDirty: true })}>
            <SelectTrigger className="h-11 rounded-xl bg-white">
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full uppercase tracking-[0.22em]">
            {status}
          </Badge>
          <Badge variant="outline" className="rounded-full uppercase tracking-[0.22em]">
            {visibility}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCategoryCard({ form }: { form: ReturnType<typeof useForm<ProductEditorValues>> }) {
  const { watch, setValue } = form;
  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Category</CardTitle>
        <CardDescription>Used for storefront filters, search, and merchandising.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="space-y-2">
          <Label>Product category</Label>
          <Select value={watch("categoryPath")} onValueChange={(value) => setValue("categoryPath", value, { shouldDirty: true })}>
            <SelectTrigger className="h-11 rounded-xl bg-white">
              <SelectValue placeholder="Choose a product category" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">This keeps lipstick products easy to filter on the storefront.</p>
      </CardContent>
    </Card>
  );
}

function SeoPreviewCard({ form, mediaItems }: { form: ReturnType<typeof useForm<ProductEditorValues>>; mediaItems: ProductMediaItem[] }) {
  const { watch } = form;
  const title = watch("name") || "Product title";
  const slug = watch("slug") || "product-slug";
  const description = plainTextFromHtml(watch("description") || "") || "A premium beauty product made for Cevonne.";
  const primaryMedia = mediaItems.find((item) => item.isPrimary && item.kind !== "video") || mediaItems[0];

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">SEO preview</CardTitle>
        <CardDescription>How the product may appear in search and previews.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="rounded-2xl border border-border/60 bg-[#fbf7f4] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">cevonne.com/products/{slug}</p>
          <p className="mt-1 font-serif text-xl text-[#4b0d4b]">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {primaryMedia ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-white p-3">
              {primaryMedia.kind === "video" ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fbf7f4] text-[#4b0d4b]">
                  <Video className="h-4 w-4" />
                </div>
              ) : (
                <img
                  src={primaryMedia.url}
                  alt={primaryMedia.alt || title}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{primaryMedia.fileName || "Primary media"}</p>
                <p className="truncate text-xs text-muted-foreground">{primaryMedia.url}</p>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductAdvancedContent({
  form,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
}) {
  const { register, watch, setValue } = form;

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-base font-semibold text-foreground">Advanced content</CardTitle>
        <CardDescription>Collapsed by default to keep the editor clean.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-5">
        <Accordion type="multiple" className="w-full space-y-3" defaultValue={[]}>
          <AccordionItem value="story" className="overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f4] px-4">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground">Product story</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-headline">Headline</Label>
                  <Textarea id="product-headline" rows={2} className="rounded-xl bg-white" {...register("headline")} placeholder="A soft mauve-rose for everyday wear." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-subtitle">Subtitle</Label>
                  <Input id="product-subtitle" className="h-11 rounded-xl bg-white" {...register("subtitle")} placeholder="Feather-light. Full pigment." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-long-description">Long description</Label>
                  <Textarea id="product-long-description" rows={4} className="rounded-xl bg-white" {...register("longDescription")} placeholder="Share the sensory story, finish, and why it matters." />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-coverage">Coverage</Label>
                    <Input id="product-coverage" className="h-11 rounded-xl bg-white" {...register("coverage")} placeholder="Full, medium, sheer..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-fragrance">Fragrance</Label>
                    <Input id="product-fragrance" className="h-11 rounded-xl bg-white" {...register("fragrance")} placeholder="Fragrance-free, vanilla..." />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="media" className="overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f4] px-4">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground">Advanced media URLs</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hero-image-url">Hero image URL</Label>
                  <Input id="hero-image-url" className="h-11 rounded-xl bg-white" {...register("heroImageUrl")} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-object-position">Image focal point</Label>
                  <Input id="hero-object-position" className="h-11 rounded-xl bg-white" {...register("heroObjectPosition")} placeholder="50% 50%" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-urls">Gallery URLs</Label>
                <Textarea id="gallery-urls" rows={3} className="rounded-xl bg-white" {...register("galleryUrls")} placeholder="One URL per line" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="video-url">Product video URL</Label>
                  <Input id="video-url" className="h-11 rounded-xl bg-white" {...register("videoUrl")} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-title">Video title</Label>
                  <Input id="video-title" className="h-11 rounded-xl bg-white" {...register("videoTitle")} placeholder="Cevonne" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-description">Video description</Label>
                <Textarea id="video-description" rows={2} className="rounded-xl bg-white" {...register("videoDescription")} placeholder="Velvet matte color..." />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trust" className="overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f4] px-4">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground">Highlights & trust</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="badges">Badges</Label>
                  <Textarea id="badges" rows={4} className="rounded-xl bg-white" {...register("badges")} placeholder="Vegan&#10;Cruelty-Free&#10;Paraben-Free" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benefits">Benefits</Label>
                  <Textarea id="benefits" rows={4} className="rounded-xl bg-white" {...register("benefits")} placeholder="12-hour comfortable matte&#10;Weightless feel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="how-to-use">How to use</Label>
                  <Textarea id="how-to-use" rows={4} className="rounded-xl bg-white" {...register("howToUse")} placeholder="Exfoliate lips&#10;Outline with bullet tip&#10;Blot and reapply" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claims">Claims</Label>
                  <Textarea id="claims" rows={4} className="rounded-xl bg-white" {...register("claims")} placeholder="93% agreed lips felt soft" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disclaimer">Disclaimer</Label>
                  <Textarea id="disclaimer" rows={3} className="rounded-xl bg-white" {...register("disclaimer")} placeholder="* Consumer study, n=60, after 1 week of use" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping-note">Shipping note</Label>
                  <Textarea id="shipping-note" rows={3} className="rounded-xl bg-white" {...register("shippingNote")} placeholder="Free shipping on orders above..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return-policy">Return policy</Label>
                  <Textarea id="return-policy" rows={3} className="rounded-xl bg-white" {...register("returnPolicy")} placeholder="Easy 7-day returns..." />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ingredients" className="overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f4] px-4">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground">Ingredients & FAQs</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="ingredients-title">Section title</Label>
                <Input id="ingredients-title" className="h-11 rounded-xl bg-white" {...register("ingredientsTitle")} placeholder="Powered by Science" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supporting-ingredients">Supporting ingredients</Label>
                <Textarea id="supporting-ingredients" rows={3} className="rounded-xl bg-white" {...register("supportingIngredients")} placeholder="Castor Oil&#10;Candelilla Wax&#10;Carnauba Wax" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">Hero ingredients</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      const current = form.getValues("heroIngredients") || [];
                      form.setValue("heroIngredients", [...current, createEmptyIngredient()], { shouldDirty: true });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add ingredient
                  </Button>
                </div>
                <div className="space-y-3">
                  {(watch("heroIngredients") || []).map((item: IngredientFormValue, index: number) => (
                    <div key={item.id} className="rounded-2xl border border-border/60 bg-white p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
                        <div className="space-y-1.5">
                          <Label htmlFor={`hero-ingredient-${index}-name`}>Name</Label>
                          <Input
                            id={`hero-ingredient-${index}-name`}
                            className="h-11 rounded-xl bg-white"
                            value={item.name}
                            onChange={(event) => {
                              const next = [...(form.getValues("heroIngredients") || [])];
                              next[index] = { ...next[index], name: event.target.value };
                              form.setValue("heroIngredients", next, { shouldDirty: true });
                            }}
                            placeholder="Shea Butter"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`hero-ingredient-${index}-why`}>Why it matters</Label>
                          <Input
                            id={`hero-ingredient-${index}-why`}
                            className="h-11 rounded-xl bg-white"
                            value={item.why}
                            onChange={(event) => {
                              const next = [...(form.getValues("heroIngredients") || [])];
                              next[index] = { ...next[index], why: event.target.value };
                              form.setValue("heroIngredients", next, { shouldDirty: true });
                            }}
                            placeholder="Helps nourish and soften lips"
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => {
                              const next = (form.getValues("heroIngredients") || []).filter((_: IngredientFormValue, idx: number) => idx !== index);
                              form.setValue("heroIngredients", next.length ? next : [createEmptyIngredient()], { shouldDirty: true });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">FAQs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      const current = form.getValues("faqs") || [];
                      form.setValue("faqs", [...current, createEmptyFaq()], { shouldDirty: true });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add FAQ
                  </Button>
                </div>
                <div className="space-y-3">
                  {(watch("faqs") || []).map((item: FaqFormValue, index: number) => (
                    <div key={item.id} className="rounded-2xl border border-border/60 bg-white p-3">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`faq-${index}-question`}>Question</Label>
                          <Input
                            id={`faq-${index}-question`}
                            className="h-11 rounded-xl bg-white"
                            value={item.question}
                            onChange={(event) => {
                              const next = [...(form.getValues("faqs") || [])];
                              next[index] = { ...next[index], question: event.target.value };
                              form.setValue("faqs", next, { shouldDirty: true });
                            }}
                            placeholder="Is it vegan?"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`faq-${index}-answer`}>Answer</Label>
                          <Textarea
                            id={`faq-${index}-answer`}
                            rows={2}
                            className="rounded-xl bg-white"
                            value={item.answer}
                            onChange={(event) => {
                              const next = [...(form.getValues("faqs") || [])];
                              next[index] = { ...next[index], answer: event.target.value };
                              form.setValue("faqs", next, { shouldDirty: true });
                            }}
                            placeholder="Yes, 100% vegan and cruelty-free."
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => {
                              const next = (form.getValues("faqs") || []).filter((_: FaqFormValue, idx: number) => idx !== index);
                              form.setValue("faqs", next.length ? next : [createEmptyFaq()], { shouldDirty: true });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="size" className="overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f4] px-4">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground">Displayed size</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="unit-count">Unit count</Label>
                  <Input id="unit-count" type="number" min="1" className="h-11 rounded-xl bg-white" {...register("unitCount")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size-ml">Size (ml)</Label>
                  <Input id="size-ml" type="number" step="0.1" className="h-11 rounded-xl bg-white" {...register("sizeMl")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size-floz">Size (fl oz)</Label>
                  <Input id="size-floz" type="number" step="0.01" className="h-11 rounded-xl bg-white" {...register("sizeFlOz")} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ProductVariantsCard({
  form,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
}) {
  const { control, register } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "shades",
  });
  const shades = form.watch("shades") || [];
  const totalShadeQuantity = shades.reduce((sum: number, shade: ShadeFormValue) => sum + (Number(shade.quantity) || 0), 0);

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Shade variants</CardTitle>
            <CardDescription>Add shades with color, SKU, price, and stock.</CardDescription>
          </div>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => append(createEmptyShade())}>
            <Plus className="mr-2 h-4 w-4" />
            Add shade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full uppercase tracking-[0.22em]">
            {fields.length} shade{fields.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="rounded-full uppercase tracking-[0.22em]">
            {formatNumber(totalShadeQuantity)} units
          </Badge>
        </div>
        {fields.length ? (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-border/60 bg-[#fbf7f4] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Shade {index + 1}</p>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => move(index, Math.max(0, index - 1))} disabled={index === 0}>
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => move(index, Math.min(fields.length - 1, index + 1))} disabled={index === fields.length - 1}>
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" className="h-9 px-3 text-red-600 hover:bg-red-50" onClick={() => remove(index)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor={`shade-${index}-name`}>Shade name</Label>
                    <Input id={`shade-${index}-name`} className="h-11 rounded-xl bg-white" {...register(`shades.${index}.name`)} placeholder="Velvet berry" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`shade-${index}-sku`}>SKU</Label>
                    <Input id={`shade-${index}-sku`} className="h-11 rounded-xl bg-white" {...register(`shades.${index}.sku`)} placeholder="SKU-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`shade-${index}-price`}>Price</Label>
                    <Input id={`shade-${index}-price`} type="number" min="0" step="0.01" className="h-11 rounded-xl bg-white" {...register(`shades.${index}.price`)} placeholder="799" />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Hex color</Label>
                    <Controller
                      control={control}
                      name={`shades.${index}.hexColor`}
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={field.value || "#a21caf"}
                            onChange={(event) => field.onChange(event.target.value)}
                            className="h-11 w-16 rounded-xl border border-border/60 bg-white p-1"
                          />
                          <Input
                            value={field.value || ""}
                            onChange={(event) => field.onChange(event.target.value)}
                            placeholder="#a21caf"
                            className="h-11 rounded-xl bg-white"
                          />
                        </div>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`shade-${index}-quantity`}>Initial quantity</Label>
                    <Input id={`shade-${index}-quantity`} type="number" min="0" className="h-11 rounded-xl bg-white" {...register(`shades.${index}.quantity`)} placeholder="150" />
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-border/60 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Preview</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{fields[index]?.name || "Unnamed shade"}</p>
                    <p className="text-xs text-muted-foreground">{fields[index]?.sku || "No SKU"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-[#fbf7f4] px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No shades added yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Use shade variants to manage stock, pricing, and lipstick colors.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductMediaCard({
  form,
  productId,
  productName,
  mediaItems,
  uploadQueue,
  onFiles,
  onRemove,
  onMove,
  onSetPrimary,
  onAltChange,
  onMediaFieldChange,
  isUploading,
}: {
  form: ReturnType<typeof useForm<ProductEditorValues>>;
  productId?: string;
  productName: string;
  mediaItems: ProductMediaItem[];
  uploadQueue: UploadQueueItem[];
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onSetPrimary: (index: number) => void;
  onAltChange: (index: number, value: string) => void;
  onMediaFieldChange: (field: "heroImageUrl" | "heroObjectPosition" | "galleryUrls" | "videoUrl" | "videoTitle" | "videoDescription", value: string) => void;
  isUploading: boolean;
}) {
  const { watch } = form;

  return (
    <Card className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Media</CardTitle>
            <CardDescription>Upload product images and videos for the storefront.</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full uppercase tracking-[0.22em]">
            {mediaItems.length} shown
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-6 py-5">
        <R2UploadDropzone disabled={isUploading} isUploading={isUploading} onFiles={onFiles} />

        {uploadQueue.length ? (
          <div className="space-y-2 rounded-2xl border border-border/60 bg-[#fbf7f4] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Uploading media</p>
              <p className="text-xs text-muted-foreground">{uploadQueue.length} file{uploadQueue.length === 1 ? "" : "s"}</p>
            </div>
            <div className="space-y-3">
              {uploadQueue.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-foreground">{item.fileName}</span>
                    <span className="text-muted-foreground capitalize">{item.status}</span>
                  </div>
                  <Progress value={item.progress} className="h-2" indicatorClassName="bg-[#4b0d4b]" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mediaItems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mediaItems.map((item, index) => (
              <ProductImageCard
                key={mediaItemKey(item, index)}
                item={item}
                index={index}
                total={mediaItems.length}
                onRemove={onRemove}
                onMove={onMove}
                onSetPrimary={onSetPrimary}
                onAltChange={onAltChange}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No media uploaded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload product images or videos to build the storefront gallery.</p>
          </div>
        )}

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced-media" className="rounded-2xl border border-border/60 px-4">
            <AccordionTrigger className="text-base font-semibold text-foreground">Advanced media URLs</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hero-image-url-duplicate">Hero image URL</Label>
                  <Input
                    id="hero-image-url-duplicate"
                    className="h-11 rounded-xl bg-white"
                    value={watch("heroImageUrl")}
                    onChange={(event) => onMediaFieldChange("heroImageUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-object-position-duplicate">Image focal point</Label>
                  <Input
                    id="hero-object-position-duplicate"
                    className="h-11 rounded-xl bg-white"
                    value={watch("heroObjectPosition")}
                    onChange={(event) => onMediaFieldChange("heroObjectPosition", event.target.value)}
                    placeholder="50% 50%"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-urls-duplicate">Gallery URLs</Label>
                <Textarea
                  id="gallery-urls-duplicate"
                  rows={3}
                  className="rounded-xl bg-white"
                  value={watch("galleryUrls")}
                  onChange={(event) => onMediaFieldChange("galleryUrls", event.target.value)}
                  placeholder="One URL per line"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="video-url-duplicate">Product video URL</Label>
                  <Input
                    id="video-url-duplicate"
                    className="h-11 rounded-xl bg-white"
                    value={watch("videoUrl")}
                    onChange={(event) => onMediaFieldChange("videoUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-title-duplicate">Video title</Label>
                  <Input
                    id="video-title-duplicate"
                    className="h-11 rounded-xl bg-white"
                    value={watch("videoTitle")}
                    onChange={(event) => onMediaFieldChange("videoTitle", event.target.value)}
                    placeholder="Cevonne"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-description-duplicate">Video description</Label>
                <Textarea
                  id="video-description-duplicate"
                  rows={2}
                  className="rounded-xl bg-white"
                  value={watch("videoDescription")}
                  onChange={(event) => onMediaFieldChange("videoDescription", event.target.value)}
                  placeholder="Velvet matte color..."
                />
              </div>
              <p className="text-xs text-muted-foreground">Media uploads use Cloudflare R2. Manual URLs stay available for legacy content.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ProductEditorHeader({
  mode,
  isDirty,
  isSaving,
  isUploading,
  onCancel,
  onSaveDraft,
  onSave,
  mobileMenuTrigger,
}: {
  mode: ProductEditorMode;
  isDirty: boolean;
  isSaving: boolean;
  isUploading: boolean;
  onCancel: () => void;
  onSaveDraft?: () => void;
  onSave: () => void;
  mobileMenuTrigger?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 rounded-[28px] border border-border/60 bg-background/90 px-4 py-4 shadow-sm backdrop-blur-xl lg:px-6 lg:py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 md:hidden">
          {mobileMenuTrigger}
          <span className="text-sm font-medium text-muted-foreground">Menu</span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">CEVONNE ADMIN</p>
            <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">
              {mode === "edit" ? "Edit product" : "Add product"}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
              {mode === "edit"
                ? "Update product details, media, pricing, and stock before publishing."
                : "Create product details, media, pricing, and stock for your catalogue."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {isDirty ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Unsaved changes
                </Badge>
              ) : null}
              {isUploading ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Uploading media...
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-3xl lg:flex-1 lg:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm" onClick={onCancel}>
              Cancel
            </Button>
            {mode === "create" && onSaveDraft ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                onClick={onSaveDraft}
                disabled={isSaving || isUploading}
              >
                Save draft
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/90"
              onClick={onSave}
              disabled={isSaving || isUploading}
            >
              {isSaving ? "Saving..." : mode === "edit" ? "Save changes" : "Add product"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ProductEditorSkeleton() {
  return (
    <div className="space-y-6 px-6 py-6">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ProductEditorPage({
  mode,
  product,
  productId,
  collections,
  request,
  refresh,
  onCancel,
  onSuccess,
  mobileMenuTrigger,
}: ProductEditorPageProps) {
  const initialValues = useMemo(() => mapFormValuesFromProduct(product, mode), [product, mode]);
  const form = useForm<ProductEditorValues>({
    defaultValues: initialValues,
  });
  const { handleSubmit, register, setValue, reset, watch, formState } = form;
  const [descriptionValue, setDescriptionValue] = useState(initialValues.description);
  const [manualSlug, setManualSlug] = useState(mode === "edit");
  const [mediaItems, setMediaItems] = useState<ProductMediaItem[]>(mapMediaItemsFromProduct(product));
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const descriptionDraftRef = useRef(initialValues.description);

  useEffect(() => {
    const nextValues = mapFormValuesFromProduct(product, mode);
    reset(nextValues);
    setDescriptionValue(nextValues.description);
    descriptionDraftRef.current = nextValues.description;
    setMediaItems(mapMediaItemsFromProduct(product));
    setManualSlug(mode === "edit");
  }, [mode, product, reset]);

  const productName = watch("name");
  const saveForm = handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const slugValue = values.slug?.trim() || slugify(values.name || "");
      const slugSafe = slugify(slugValue);
      const existingMedia = isRecord(product?.media) ? product.media : {};
      const existingExperience = isRecord(product?.experience) ? product.experience : {};
      const existingPricing = isRecord(product?.pricing) ? product.pricing : {};
      const existingSize = isRecord(product?.size) ? product.size : {};
      const existingIngredients = isRecord(product?.ingredients) ? product.ingredients : {};
      const galleryUrls = parseLines(values.galleryUrls);
      const manualHero = optionalString(values.heroImageUrl) || undefined;
      const primaryMedia = mediaItems.find((item) => item.isPrimary && item.kind !== "video") || mediaItems.find((item) => item.kind !== "video") || mediaItems[0];
      const heroImageUrl = manualHero || primaryMedia?.url || values.heroImageUrl || "";
      const galleryItems = buildMediaGallery(mediaItems, galleryUrls, values.name || "Cevonne product");
      const imageItems = buildImageList(mediaItems, values.name || "Cevonne product");
      const imageUrls = Array.from(new Set([
        heroImageUrl,
        ...imageItems.map((item) => item.url),
        ...galleryUrls.filter((url) => inferMediaKind(url) !== "video"),
      ])).filter(Boolean);

      const shadePayload = (values.shades || [])
        .map((shade) => ({
          name: shade.name.trim(),
          hexColor: shade.hexColor.trim(),
          sku: optionalString(shade.sku),
          price: optionalNumber(shade.price),
          quantity: optionalNumber(shade.quantity) != null ? Math.max(0, Math.round(optionalNumber(shade.quantity) || 0)) : undefined,
        }))
        .filter((shade) => shade.name && shade.hexColor);

      const ingredientsPayload = (values.heroIngredients || [])
        .map((ingredient) => ({
          name: optionalString(ingredient.name),
          why: optionalString(ingredient.why),
        }))
        .filter((ingredient) => ingredient.name || ingredient.why);

      const faqPayload = (values.faqs || [])
        .map((faq) => ({
          q: optionalString(faq.question),
          a: optionalString(faq.answer),
        }))
        .filter((faq) => faq.q && faq.a);

      const pricingPayload = {
        ...existingPricing,
        price: optionalNumber(values.price) ?? existingPricing.price ?? 0,
        originalValue: optionalNumber(values.originalValue) ?? existingPricing.originalValue ?? 0,
        currency: values.currency || existingPricing.currency || "INR",
      };

      const sizePayload = {
        ...existingSize,
        unitCount: optionalNumber(values.unitCount) ?? existingSize.unitCount ?? 1,
        sizePerUnit: {
          ...(isRecord(existingSize.sizePerUnit) ? existingSize.sizePerUnit : {}),
          ml: optionalNumber(values.sizeMl) ?? (isRecord(existingSize.sizePerUnit) ? existingSize.sizePerUnit.ml : 0) ?? 0,
          flOz: optionalNumber(values.sizeFlOz) ?? (isRecord(existingSize.sizePerUnit) ? existingSize.sizePerUnit.flOz : 0) ?? 0,
        },
      };

      const ingredients = {
        ...existingIngredients,
        keyActives: ingredientsPayload.map((item) => ({
          name: item.name,
          description: item.why,
        })),
        supportingIngredients: parseLines(values.supportingIngredients),
      };

      const mediaPayload = {
        ...existingMedia,
        heroImage: heroImageUrl || existingMedia.heroImage || "",
        gallery: galleryItems,
        videoUrl: optionalString(values.videoUrl) || existingMedia.videoUrl || undefined,
        videoTitle: optionalString(values.videoTitle) || existingMedia.videoTitle || undefined,
        videoDescription: optionalString(values.videoDescription) || existingMedia.videoDescription || undefined,
        hero: compactObject({
          ...(isRecord(existingMedia.hero) ? existingMedia.hero : {}),
          image: heroImageUrl || (isRecord(existingMedia.hero) ? existingMedia.hero.image : undefined),
          objectPosition: optionalString(values.heroObjectPosition) || (isRecord(existingMedia.hero) ? existingMedia.hero.objectPosition : undefined),
        }),
      };

      const experiencePayload = {
        ...existingExperience,
        status: values.productStatus,
        visibility: values.visibility,
        headline: optionalString(values.headline),
        subtitle: optionalString(values.subtitle),
        longDescription: optionalString(values.longDescription),
        categoryPath: parseCategoryPath(values.categoryPath),
        coverage: optionalString(values.coverage),
        fragrance: optionalString(values.fragrance),
        videoUrl: optionalString(values.videoUrl),
        videoTitle: optionalString(values.videoTitle),
        videoDescription: optionalString(values.videoDescription),
        hero: compactObject({
          ...(isRecord(existingExperience.hero) ? existingExperience.hero : {}),
          image: heroImageUrl || (isRecord(existingExperience.hero) ? existingExperience.hero.image : undefined),
          objectPosition: optionalString(values.heroObjectPosition),
        }),
        gallery: galleryItems,
        badges: parseLines(values.badges),
        benefits: parseLines(values.benefits),
        howToUse: parseLines(values.howToUse),
        claims: parseLines(values.claims),
        disclaimer: optionalString(values.disclaimer),
        shipping: optionalString(values.shippingNote),
        returns: optionalString(values.returnPolicy),
        ingredientsHighlight: ingredientsPayload,
        faqs: faqPayload,
        ingredientsTitle: optionalString(values.ingredientsTitle),
        inventory: {
          ...(isRecord(existingExperience.inventory) ? existingExperience.inventory : {}),
          trackInventory: values.trackInventory,
          sellWhenOutOfStock: values.sellWhenOutOfStock,
          barcode: optionalString(values.barcode),
        },
      };

      const endpoint = mode === "edit" ? `${API_BASE}/products/${productId || product?.id}` : `${API_BASE}/products`;
      const response = await request(endpoint, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          slug: slugSafe,
          description: values.description,
          brand: values.brand,
          type: values.type,
          finish: optionalString(values.finish),
          tags: parseLines(values.tags),
          badges: parseLines(values.badges).map((label) => ({ type: "marketing", label })),
          collectionId: values.collectionId || undefined,
          basePrice: optionalNumber(values.price) ?? 0,
          pricing: pricingPayload,
          size: sizePayload,
          ingredients,
          media: mediaPayload,
          experience: experiencePayload,
          images: imageUrls.length
            ? imageUrls.map((url) => ({
                url,
                alt: values.name || productName || "Cevonne product",
              }))
            : undefined,
          shades: shadePayload.length ? shadePayload : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Unable to save product");
      }

      refresh?.();
      toast.success("Product saved successfully.");
      await Promise.resolve(onSuccess());
    } catch (error) {
      console.error(error);
      toast.error("Unable to save product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  });

  const handleMediaFiles = async (files: File[]) => {
    if (!files.length || isUploading) return;
    setIsUploading(true);
    setUploadQueue([]);

    try {
      for (const file of files) {
        const queueId = generateId();
        setUploadQueue((prev) => [
          ...prev,
          {
            id: queueId,
            fileName: file.name,
            progress: 0,
            status: "preparing",
          },
        ]);

        if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`File too large: ${file.name}`);
        }

        const upload = await uploadFileToR2(request, file, productId || product?.id, (progress) => {
          setUploadQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, progress, status: "uploading" } : item)));
        });

        setMediaItems((prev) => [
          ...prev,
          {
            id: generateId(),
            url: upload.publicUrl,
            key: upload.key,
            fileName: file.name,
            mimeType: file.type,
            alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
            kind: inferMediaKind(file),
            isPrimary: !prev.some((item) => item.isPrimary),
          },
        ]);

        setUploadQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, progress: 100, status: "done" } : item)));
      }
      toast.success("Media uploaded");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to upload media");
      setUploadQueue((prev) => prev.map((item) => (item.status === "done" ? item : { ...item, status: "error", error: error instanceof Error ? error.message : "Upload failed" })));
    } finally {
      window.setTimeout(() => setUploadQueue([]), 1200);
      setIsUploading(false);
    }
  };

  const handleMediaFieldChange = (
    field: "heroImageUrl" | "heroObjectPosition" | "galleryUrls" | "videoUrl" | "videoTitle" | "videoDescription",
    value: string
  ) => {
    form.setValue(field, value, { shouldDirty: true });
  };

  const deleteMediaAsset = async (storageKey: string) => {
    try {
      const response = await request("/api/uploads/r2/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });

      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Unable to delete uploaded media");
      }
    } catch (error) {
      console.error(error);
      toast.error("Media was removed from the form, but the stored file could not be deleted.");
    }
  };

  const handleMediaRemove = (index: number) => {
    const item = mediaItems[index];
    setMediaItems((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      if (!next.length || next.some((media) => media.isPrimary)) {
        return next;
      }

      return next.map((media, itemIndex) => ({
        ...media,
        isPrimary: itemIndex === 0,
      }));
    });

    if (item?.key) {
      void deleteMediaAsset(item.key);
    }
  };

  const handleMediaMove = (index: number, delta: number) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, itemIndex) => ({
        ...item,
        isPrimary: itemIndex === 0 ? true : item.isPrimary,
      }));
    });
  };

  const handleMediaPrimary = (index: number) => {
    setMediaItems((prev) =>
      prev.map((item, itemIndex) => ({
        ...item,
        isPrimary: itemIndex === index,
      }))
    );
  };

  const handleMediaAltChange = (index: number, value: string) => {
    setMediaItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, alt: value } : item)));
  };

  const submitPublish = () => {
    form.setValue("productStatus", "active", { shouldDirty: true });
    void saveForm();
  };

  const submitDraft = () => {
    form.setValue("productStatus", "draft", { shouldDirty: true });
    void saveForm();
  };

  const saveChanges = () => {
    form.setValue("productStatus", watch("productStatus"), { shouldDirty: true });
    void saveForm();
  };

  const formClass = "space-y-6";
  const isUploadingOrSaving = isSaving || isUploading;

  return (
    <div className="flex min-h-full flex-col bg-[#f8f3ef]">
      <main className="flex-1 px-4 pb-8 pt-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
          <ProductEditorHeader
            mode={mode}
            isDirty={formState.isDirty}
            isSaving={isSaving}
            isUploading={isUploading}
            onCancel={onCancel}
            onSaveDraft={mode === "create" ? submitDraft : undefined}
            onSave={mode === "edit" ? saveChanges : submitPublish}
            mobileMenuTrigger={mobileMenuTrigger}
          />

          <form onSubmit={saveForm} className="min-h-0 flex-1">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className={formClass}>
                <ProductDetailsCard
                  form={form}
                  manualSlug={manualSlug}
                  onManualSlugChange={setManualSlug}
                  descriptionValue={descriptionValue}
                  onDescriptionChange={(value) => {
                    setDescriptionValue(value);
                    descriptionDraftRef.current = value;
                    setValue("description", value, { shouldDirty: true });
                  }}
                />

                <ProductMediaCard
                  form={form}
                  productId={productId || product?.id}
                  productName={watch("name") || product?.name || "Cevonne product"}
                  mediaItems={mediaItems}
                  uploadQueue={uploadQueue}
                  onFiles={handleMediaFiles}
                  onRemove={handleMediaRemove}
                  onMove={handleMediaMove}
                  onSetPrimary={handleMediaPrimary}
                  onAltChange={handleMediaAltChange}
                  onMediaFieldChange={handleMediaFieldChange}
                  isUploading={isUploading}
                />

                <ProductPricingCard form={form} />
                <ProductInventoryCard form={form} />
                <ProductVariantsCard form={form} />
                <ProductAdvancedContent form={form} />
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                <ProductStatusCard form={form} />
                <ProductOrganizationCard form={form} collections={collections} />
                <ProductCategoryCard form={form} />
                <SeoPreviewCard form={form} mediaItems={mediaItems} />
              </aside>
            </div>

            <div className="sticky bottom-0 z-20 border-t border-border/60 bg-white/95 px-4 py-4 backdrop-blur lg:hidden">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-11 rounded-xl sm:flex-1" onClick={onCancel} disabled={isUploadingOrSaving}>
                  Cancel
                </Button>
                {mode === "create" ? (
                  <Button type="button" variant="outline" className="h-11 rounded-xl sm:flex-1" onClick={submitDraft} disabled={isUploadingOrSaving}>
                    Save draft
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-[#4b0d4b] text-white hover:bg-[#3a083a] sm:flex-1"
                  onClick={mode === "edit" ? saveChanges : submitPublish}
                  disabled={isUploadingOrSaving}
                >
                  {isSaving ? "Saving..." : mode === "edit" ? "Save changes" : "Add product"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export { ProductEditorSkeleton };
