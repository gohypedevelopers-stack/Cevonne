import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { API_BASE, slugify } from "../utils";

const FORMAT_ACTIONS = [
  { key: "bold", label: "B", className: "font-bold" },
  { key: "italic", label: "I", className: "italic" },
  { key: "underline", label: "U", className: "underline" },
];

const SECTIONS = [
  { value: "details", label: "Details", description: "Core product information" },
  { value: "story", label: "Story", description: "Product page content & theme" },
  { value: "inventory", label: "Inventory", description: "Stock levels and availability" },
  { value: "media", label: "Media", description: "Images and visual assets" },
  { value: "shipping", label: "Shipping", description: "Packaging and fulfilment" },
  { value: "pricing", label: "Pricing", description: "Retail and compare-at pricing" },
];

const defaultRequest = (url, options) => fetch(url, options);

const generateId = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

function ProductFormBase({
  layout = "dialog",
  mode = "create",
  product = null,
  productId,
  open = false,
  onClose = () => { },
  collections = [],
  request = defaultRequest,
  refresh = () => { },
  afterSubmit,
  formId,
}) {
  const isDialog = layout === "dialog";
  const isEdit = mode === "edit";
  const resolvedFormId = formId ?? (isDialog ? "product-dialog-form" : "product-create-form");
  const showAllSections = !isDialog;

  const generateShadeKey = () => generateId();

  const createEmptyShade = () => ({
    id: generateShadeKey(),
    name: "",
    hexColor: "#a21caf",
    sku: "",
    price: "",
    quantity: "",
  });

  const defaultValues = {
    name: "",
    slug: "",
    brand: "CEVONNE",
    type: "single",
    tags: "",
    headline: "",
    description: "", // This will be mapped to body
    finish: "",
    basePrice: "",
    currency: "INR",
    originalValue: "",
    collectionId: "",
    compareAtPrice: "", // Keep for backward compat or map to originalValue
    shippingWeight: "",
    shippingLength: "",
    shippingWidth: "",
    shippingHeight: "",
    unitCount: "1",
    sizeMl: "",
    sizeFlOz: "",
    inventoryQuantity: "",
    inventorySku: "",
    onlineSelling: true,
    inStoreSelling: false,
    experienceSubtitle: "",
    experienceCategoryPath: "",
    experienceLongDescription: "",
    experienceVideoUrl: "",
    experienceHeroImage: "",
    experienceHeroObjectPosition: "",
    experienceHeroBg: "",
    experienceHeroOverlay: "",
    experienceThemeDefaultBg: "",
    experienceSceneBgHero: "",
    experienceSceneBgFeatures: "",
    experienceSceneBgIngredients: "",
    experienceSceneBgVideo: "",
    experienceSceneBgShades: "",
    experienceSceneBgReviews: "",
    experienceToneHero: "",
    experienceToneFeatures: "",
    experienceToneIngredients: "",
    experienceToneVideo: "",
    experienceToneShades: "",
    experienceToneReviews: "",
    experienceGallery: "",
    experienceBadges: "",
    experienceBenefits: "",
    experienceHowToUse: "",
    experienceClaims: "",
    experienceDisclaimer: "",
    experienceShipping: "",
    experienceReturns: "",
    experienceRating: "",
    experienceReviewCount: "",
    experienceReviewCount: "",
    supportingIngredients: "",
    coverage: "",
    fragrance: "",
    videoTitle: "",
    videoDescription: "",
    ingredientsTitle: "",
  };

  const { register, handleSubmit, setValue, reset, getValues, watch, control } = useForm({
    defaultValues: {
      ...defaultValues,
      shades: [createEmptyShade()],
      experienceIngredients: [{ name: "", why: "" }],
      experienceFaqs: [{ q: "", a: "" }],
      reviewsList: [{ author: "", date: "", rating: "5", title: "", comment: "" }],
    },
  });

  const [manualSlug, setManualSlug] = useState(false);
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [descriptionFileName, setDescriptionFileName] = useState("");
  const [activeTab, setActiveTab] = useState(SECTIONS[0].value);
  const [heroUploading, setHeroUploading] = useState(false);

  const {
    fields: shadeFields,
    append: appendShade,
    remove: removeShade,
    replace: replaceShades,
  } = useFieldArray({
    control,
    name: "shades",
  });
  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
    replace: replaceIngredients,
  } = useFieldArray({
    control,
    name: "experienceIngredients",
  });
  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
    replace: replaceFaqs,
  } = useFieldArray({
    control,
    name: "experienceFaqs",
  });
  const {
    fields: reviewFields,
    append: appendReview,
    remove: removeReview,
    replace: replaceReviews,
  } = useFieldArray({
    control,
    name: "reviewsList",
  });

  // NOTE: no TS generics here; this is .jsx
  const editorRef = useRef(null);
  const textFileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const heroImageInputRef = useRef(null);

  // Keep description in a ref to avoid re-renders while typing
  const descriptionRef = useRef("");

  const collectionOptions = Array.isArray(collections) ? collections : [];

  useEffect(() => {
    if (!isDialog) return;
    if (!open) {
      reset();
      setManualSlug(false);
      setImages([]);
      setSubmitting(false);
      setDescriptionFileName("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      descriptionRef.current = "";
      setActiveTab(SECTIONS[0].value);
      setExistingImages([]);
      replaceShades([createEmptyShade()]);
      replaceIngredients([{ name: "", why: "" }]);
      replaceFaqs([{ q: "", a: "" }]);
    }
  }, [isDialog, open, reset, replaceFaqs, replaceIngredients, replaceShades]);

  // keep the field registered, but don't mirror on each keystroke
  useEffect(() => {
    register("description");
  }, [register]);

  // Map product to form values (used on edit)
  const mapProductToForm = (prod) => {
    const experience = prod?.experience ?? {};
    const joinLines = (value) => {
      if (Array.isArray(value)) return value.join("\n");
      if (typeof value === "string") return value;
      return "";
    };
    const galleryFromImages = Array.isArray(prod?.images)
      ? prod.images.map((image) => image.url).filter(Boolean)
      : [];
    const ingredientList =
      experience.ingredientsHighlight ?? experience.ingredients_highlight ?? [];
    const faqList = Array.isArray(experience.faqs) ? experience.faqs : [];

    return {
      ...defaultValues,
      name: prod?.name ?? "",
      slug: prod?.slug ?? "",
      brand: prod?.brand ?? "CEVONNE",
      type: prod?.type ?? "single",
      tags: Array.isArray(prod?.tags) ? prod.tags.join(", ") : "",
      headline: prod?.description?.headline ?? "",
      description: prod?.description?.body ?? prod?.description ?? "",
      headline: prod?.description?.headline ?? "",
      description: prod?.description?.body ?? prod?.description ?? "",
      finish: prod?.finish ?? "",
      coverage: prod?.coverage ?? "",
      fragrance: prod?.fragrance ?? "",
      videoTitle: experience.videoTitle ?? "",
      videoDescription: experience.videoDescription ?? "",
      ingredientsTitle: experience.ingredientsTitle ?? "",
      basePrice: prod?.pricing?.price != null ? String(prod.pricing.price) : (prod?.basePrice != null ? String(prod.basePrice) : ""),
      currency: prod?.pricing?.currency ?? "INR",
      originalValue: prod?.pricing?.originalValue != null ? String(prod.pricing.originalValue) : "",
      collectionId: prod?.collectionId ?? "",
      compareAtPrice: prod?.compareAtPrice != null ? String(prod.compareAtPrice) : "",
      unitCount: prod?.size?.unitCount != null ? String(prod.size.unitCount) : "1",
      sizeMl: prod?.size?.sizePerUnit?.ml != null ? String(prod.size.sizePerUnit.ml) : "",
      sizeFlOz: prod?.size?.sizePerUnit?.flOz != null ? String(prod.size.sizePerUnit.flOz) : "",
      experienceSubtitle: experience.subtitle ?? "",
      experienceCategoryPath: Array.isArray(experience.categoryPath)
        ? experience.categoryPath.join("\n")
        : "",
      experienceLongDescription: experience.longDescription ?? prod?.description ?? "",
      experienceVideoUrl: experience.videoUrl ?? "",
      experienceHeroImage: prod?.media?.heroImage ?? experience.hero?.image ?? prod?.images?.[0]?.url ?? "",
      experienceHeroObjectPosition: experience.hero?.objectPosition ?? "",
      experienceHeroBg: experience.hero?.bg ?? "",
      experienceHeroOverlay: experience.hero?.overlay ?? "",
      experienceThemeDefaultBg: experience.theme?.defaultBg ?? "",
      experienceSceneBgHero: experience.theme?.bgScenes?.hero ?? "",
      experienceSceneBgFeatures: experience.theme?.bgScenes?.features ?? "",
      experienceSceneBgIngredients: experience.theme?.bgScenes?.ingredients ?? "",
      experienceSceneBgVideo: experience.theme?.bgScenes?.video ?? "",
      experienceSceneBgShades: experience.theme?.bgScenes?.shades ?? "",
      experienceSceneBgReviews: experience.theme?.bgScenes?.reviews ?? "",
      experienceToneHero: experience.theme?.bgTone?.hero ?? "",
      experienceToneFeatures: experience.theme?.bgTone?.features ?? "",
      experienceToneIngredients: experience.theme?.bgTone?.ingredients ?? "",
      experienceToneVideo: experience.theme?.bgTone?.video ?? "",
      experienceToneShades: experience.theme?.bgTone?.shades ?? "",
      experienceToneReviews: experience.theme?.bgTone?.reviews ?? "",
      experienceGallery: joinLines(prod?.media?.gallery?.map(g => g.id || g.url) ?? experience.gallery ?? galleryFromImages),
      experienceBadges: joinLines(prod?.badges?.map(b => b.label) ?? experience.badges),
      experienceBenefits: joinLines(experience.benefits),
      experienceHowToUse: joinLines(experience.howToUse ?? experience.how_to_use),
      experienceClaims: joinLines(experience.claims),
      experienceDisclaimer: experience.disclaimer ?? "",
      experienceShipping: experience.shipping ?? prod?.shipping ?? "",
      experienceReturns: experience.returns ?? prod?.returns ?? "",
      experienceRating: experience.rating != null ? String(experience.rating) : "",
      experienceReviewCount:
        experience.reviewCount != null
          ? String(experience.reviewCount)
          : prod?.reviewCount != null
            ? String(prod.reviewCount)
            : prod?.reviews != null
              ? String(prod.reviews)
              : "",
      supportingIngredients: Array.isArray(prod?.ingredients?.supportingIngredients)
        ? prod.ingredients.supportingIngredients.join("\n")
        : "",
      experienceIngredients:
        Array.isArray(prod?.ingredients?.keyActives)
          ? prod.ingredients.keyActives.map((item, index) => ({
            name: item.name,
            why: item.description,
            id: `${index}`
          }))
          : Array.isArray(ingredientList) && ingredientList.length
            ? ingredientList.map((item, index) => ({
              name: item?.name ?? item?.ingredient ?? "",
              why: item?.why ?? item?.detail ?? item?.description ?? "",
              id: item.id ?? `${index}`,
            }))
            : [{ name: "", why: "" }],
      experienceFaqs:
        faqList.length && Array.isArray(faqList)
          ? faqList.map((faq, index) => ({
            q: faq.q ?? faq.question ?? "",
            a: faq.a ?? faq.answer ?? "",
            id: faq.id ?? `${index}`,
          }))
          : [{ q: "", a: "" }],
      reviewsList:
        Array.isArray(prod?.reviewsList) && prod.reviewsList.length
          ? prod.reviewsList.map((r, index) => ({
            author: r.author ?? "",
            date: r.date ?? "",
            rating: r.rating != null ? String(r.rating) : "5",
            title: r.title ?? "",
            comment: r.comment ?? "",
          }))
          : [{ author: "", date: "", rating: "5", title: "", comment: "" }],
      shades: Array.isArray(prod?.shades)
        ? prod.shades.map((shade) => ({
          id: shade.id ?? generateShadeKey(),
          name: shade.name ?? "",
          hexColor: shade.hexColor ?? "#a855f7",
          sku: shade.sku ?? "",
          price:
            typeof shade.price === "string" || typeof shade.price === "number"
              ? String(shade.price)
              : "",
          quantity: shade.inventory?.quantity != null ? String(shade.inventory.quantity) : "",
        }))
        : [createEmptyShade()],
    };
  };

  useEffect(() => {
    if (isEdit && product) {
      const formValues = mapProductToForm(product);
      reset(formValues);
      setManualSlug(true); // editing: keep current slug unless user toggles
      setExistingImages(Array.isArray(product.images) ? product.images : []);
      if (editorRef.current) editorRef.current.innerHTML = product.description ?? "";
      descriptionRef.current = product.description ?? "";
      const mappedShades = Array.isArray(product.shades)
        ? product.shades.map((shade) => ({
          id: shade.id ?? generateShadeKey(),
          name: shade.name ?? "",
          hexColor: shade.hexColor ?? "#a855f7",
          sku: shade.sku ?? "",
          price:
            typeof shade.price === "string" || typeof shade.price === "number"
              ? String(shade.price)
              : "",
          quantity: shade.inventory?.quantity != null ? String(shade.inventory.quantity) : "",
        }))
        : [];
      replaceShades(mappedShades.length ? mappedShades : [createEmptyShade()]);
      replaceIngredients(
        Array.isArray(formValues.experienceIngredients) && formValues.experienceIngredients.length
          ? formValues.experienceIngredients
          : [{ name: "", why: "" }]
      );
      replaceFaqs(
        Array.isArray(formValues.experienceFaqs) && formValues.experienceFaqs.length
          ? formValues.experienceFaqs
          : [{ q: "", a: "" }]
      );
    }
  }, [isEdit, product, reset, replaceFaqs, replaceIngredients, replaceShades]);

  const handleAddShade = () => appendShade(createEmptyShade());
  const handleRemoveShade = (index) => removeShade(index);

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    setImages(files);
  };

  const handleHeroImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    try {
      const url = await uploadImageFile(file);
      setValue("experienceHeroImage", url, { shouldDirty: true });
      toast.success("Hero image uploaded");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to upload hero image");
    } finally {
      setHeroUploading(false);
    }
  };

  const uploadImageFile = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await request(`${API_BASE}/uploads`, { method: "POST", body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || "Image upload failed");
    }
    const data = await response.json();
    return data.url;
  };

  const applyFormatting = (command) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (typeof document !== "undefined") {
      document.execCommand(command, false, undefined);
      descriptionRef.current = editorRef.current.innerHTML; // no state update
    }
  };

  const clearDescriptionFile = () => {
    setDescriptionFileName("");
    if (textFileInputRef.current) textFileInputRef.current.value = "";
  };

  const handleDescriptionFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      descriptionRef.current = text;
      setDescriptionFileName(file.name);
      if (editorRef.current) editorRef.current.innerHTML = text;
      setValue("description", text, { shouldDirty: true });
    };
    reader.readAsText(file, "utf-8");
  };

  const currentStep = SECTIONS.findIndex((s) => s.value === activeTab);
  const goToPreviousSection = () => currentStep > 0 && setActiveTab(SECTIONS[currentStep - 1].value);
  const goToNextSection = () => currentStep < SECTIONS.length - 1 && setActiveTab(SECTIONS[currentStep + 1].value);

  const asOptionalString = (value) => {
    if (typeof value !== "string") return undefined;
    const t = value.trim();
    return t.length ? t : undefined;
  };
  const asOptionalNumber = (value) => {
    if (value == null || value === "") return undefined;
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : undefined;
  };
  const parseList = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value !== "string") return [];
    return value
      .split(/[\r\n,]+/)
      .map((item) => item.replace(/^[\s*-]+/, "").trim())
      .filter(Boolean);
  };
  const compactObject = (obj) => {
    if (!obj || typeof obj !== "object") return undefined;
    const entries = Object.entries(obj).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
  };

  const handleRemoveExistingImage = (imageId) =>
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const basePriceFloat = parseFloat(values.basePrice ?? "0");
      const basePrice = Number.isFinite(basePriceFloat) ? basePriceFloat : 0;
      const slugValue = values.slug?.trim() || slugify(values.name || generateId());
      const slugSafe = slugify(slugValue);
      const tagList = parseList(values.tags);

      let uploadedImages = [];
      if (images.length) {
        uploadedImages = await Promise.all(images.map((file) => uploadImageFile(file)));
      }

      const payloadImages = [
        ...existingImages.map((image) => ({ url: image.url })),
        ...uploadedImages.map((url) => ({ url })),
      ];

      const galleryListRaw = parseList(values.experienceGallery);
      const galleryList = galleryListRaw.length
        ? galleryListRaw
        : payloadImages.map((img) => img.url).filter(Boolean);

      const heroImage = values.experienceHeroImage || galleryList[0] || payloadImages[0]?.url || "";

      const shadePayload = (values.shades || [])
        .map((shade) => ({
          name: shade.name?.trim() ?? "",
          hexColor: shade.hexColor?.trim() ?? "",
          sku: asOptionalString(shade.sku),
          price: asOptionalNumber(shade.price),
          quantity:
            shade.quantity !== undefined && shade.quantity !== ""
              ? Math.max(0, parseInt(shade.quantity, 10) || 0)
              : undefined,
        }))
        .filter((s) => s.name && s.hexColor);

      const hero = compactObject({
        image: asOptionalString(heroImage),
        objectPosition: asOptionalString(values.experienceHeroObjectPosition),
        bg: asOptionalString(values.experienceHeroBg),
        overlay: asOptionalString(values.experienceHeroOverlay),
      });

      const themeScenes = compactObject({
        hero: asOptionalString(values.experienceSceneBgHero),
        features: asOptionalString(values.experienceSceneBgFeatures),
        ingredients: asOptionalString(values.experienceSceneBgIngredients),
        video: asOptionalString(values.experienceSceneBgVideo),
        shades: asOptionalString(values.experienceSceneBgShades),
        reviews: asOptionalString(values.experienceSceneBgReviews),
      });
      const themeTone = compactObject({
        hero: asOptionalString(values.experienceToneHero),
        features: asOptionalString(values.experienceToneFeatures),
        ingredients: asOptionalString(values.experienceToneIngredients),
        video: asOptionalString(values.experienceToneVideo),
        shades: asOptionalString(values.experienceToneShades),
        reviews: asOptionalString(values.experienceToneReviews),
      });
      const theme = compactObject({
        defaultBg: asOptionalString(values.experienceThemeDefaultBg),
        bgScenes: themeScenes,
        bgTone: themeTone,
      });

      const ingredientsPayload = (values.experienceIngredients || [])
        .map((item) => ({
          name: asOptionalString(item.name),
          why: asOptionalString(item.why),
        }))
        .filter((item) => item.name || item.why);

      const faqPayload = (values.experienceFaqs || [])
        .map((item) => ({
          q: asOptionalString(item.q),
          a: asOptionalString(item.a),
        }))
        .filter((item) => item.q && item.a);

      const experiencePayload = compactObject({
        subtitle: asOptionalString(values.experienceSubtitle),
        categoryPath: parseList(values.experienceCategoryPath),
        longDescription: asOptionalString(values.experienceLongDescription),
        videoUrl: asOptionalString(values.experienceVideoUrl),
        videoTitle: asOptionalString(values.videoTitle),
        videoDescription: asOptionalString(values.videoDescription),
        ingredientsTitle: asOptionalString(values.ingredientsTitle),
        hero,
        theme,
        gallery: galleryList,
        badges: parseList(values.experienceBadges),
        benefits: parseList(values.experienceBenefits),
        howToUse: parseList(values.experienceHowToUse),
        claims: parseList(values.experienceClaims),
        disclaimer: asOptionalString(values.experienceDisclaimer),
        shipping: asOptionalString(values.experienceShipping),
        returns: asOptionalString(values.experienceReturns),
        rating: asOptionalNumber(values.experienceRating),
        reviewCount: asOptionalNumber(values.experienceReviewCount),
        ingredientsHighlight: ingredientsPayload.length ? ingredientsPayload : undefined,
        faqs: faqPayload.length ? faqPayload : undefined,
      });

      const endpointUrl = isEdit
        ? `${API_BASE}/products/${productId ?? product?.id}`
        : `${API_BASE}/products`;

      const response = await request(endpointUrl, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slugSafe, // Use slug as ID for now as per sample
          slug: slugSafe,
          name: values.name,
          brand: values.brand,
          type: values.type,
          tags: tagList,
          badges: parseList(values.experienceBadges).map(label => ({ type: "marketing", label })),
          description: {
            headline: values.headline,
            body: asOptionalString(descriptionRef.current),
          },
          pricing: {
            currency: values.currency || "INR",
            price: basePrice,
            originalValue: asOptionalNumber(values.originalValue) || 0,
          },
          size: {
            unitCount: asOptionalNumber(values.unitCount) || 1,
            sizePerUnit: {
              ml: asOptionalNumber(values.sizeMl) || 0,
              flOz: asOptionalNumber(values.sizeFlOz) || 0,
            }
          },
          ingredients: {
            keyActives: ingredientsPayload.map(i => ({ name: i.name, description: i.why })),
            supportingIngredients: parseList(values.supportingIngredients),
          },
          reviewsList: values.reviewsList.map(r => ({
            ...r,
            rating: Number(r.rating) || 5
          })),
          media: {
            heroImage,
            gallery: galleryList.map((url, i) => ({
              id: `${slugSafe}-gallery-${i}`,
              alt: values.name,
              role: i === 0 ? "hero" : "swatch", // simplified role assignment
              url: url // assuming url is stored here, though schema implies objects
            }))
          },
          // Keep old fields for backward compatibility if needed, or just rely on new structure
          finish: asOptionalString(values.finish),
          coverage: asOptionalString(values.coverage),
          fragrance: asOptionalString(values.fragrance),
          basePrice,
          collectionId: values.collectionId || undefined,
          images: payloadImages.length ? payloadImages : undefined,
          shades: shadePayload.length ? shadePayload : undefined,
          experience: experiencePayload,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.message || body?.error || "Failed to create product";
        throw new Error(message);
      }

      refresh?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      if (typeof afterSubmit === "function") afterSubmit();
      else if (isDialog) onClose(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to create product");
    } finally {
      setSubmitting(false);
    }
  };

  const headerPadding = isDialog ? "px-6 pb-4 pt-6" : "px-8 pb-6 pt-8";
  const formPadding = isDialog ? "px-6 pb-6" : "px-8 pb-10 lg:px-10";
  const scrollAreaHeightClass = "h-[calc(92vh-260px)] md:h-[calc(92vh-220px)]";

  const ScrollContainer = ({ className = "", children, allowScroll = false }) => {
    if (isDialog) {
      const heightClass = allowScroll ? "max-h-96" : scrollAreaHeightClass;
      return (
        <div className={`${heightClass} overflow-y-auto pr-3 md:pr-4 ${className}`}>
          {children}
        </div>
      );
    }
    return <div className={`pr-1 md:pr-2 lg:pr-3 ${className} ${showAllSections ? "pb-0" : ""}`}>{children}</div>;
  };

  const Section = ({ value, className = "", children }) => {
    const resolvedClass = className;
    if (showAllSections) {
      return (
        <div id={`section-${value}`} className={resolvedClass}>
          {children}
        </div>
      );
    }
    return (
      <TabsContent value={value} forceMount className={`h-full ${resolvedClass}`}>
        {children}
      </TabsContent>
    );
  };

  const contentHeader = isDialog ? (
    <DialogHeader className={`border-b border-border/60 text-left ${headerPadding}`}>
      <DialogTitle>Add new product</DialogTitle>
      <DialogDescription>
        Provide product details, pricing, and imagery to publish this item to your catalogue.
      </DialogDescription>
    </DialogHeader>
  ) : (
    <div className={`border-b border-border/60 text-left ${headerPadding}`}>
      <h2 className="text-2xl font-semibold text-primary">Add new product</h2>
      <p className="text-sm text-muted-foreground">
        Provide product details, pricing, and imagery to publish this item to your catalogue.
      </p>
    </div>
  );

  const content = (
    <div className={`flex flex-col ${isDialog ? "h-full overflow-hidden" : ""}`}>
      {contentHeader}
      <form
        id={resolvedFormId}
        onSubmit={handleSubmit(onSubmit)}
        className={`flex flex-col gap-6 ${isDialog ? "flex-1 min-h-0 overflow-hidden" : "overflow-visible"} ${formPadding}`}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={`flex flex-col gap-4 ${isDialog ? "flex-1 min-h-0" : "mt-4"}`}
        >
          {!showAllSections ? (
            <div className={isDialog ? "md:hidden" : ""}>
              <TabsList className={`${isDialog ? "grid grid-cols-2" : "flex flex-wrap"} gap-2 rounded-2xl bg-muted/30 p-1`}>
                {SECTIONS.map((section) => (
                  <TabsTrigger
                    key={section.value}
                    value={section.value}
                    className={`rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isDialog ? "" : "md:text-sm"
                      }`}
                  >
                    {section.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ) : null}

          <div className={`flex flex-col gap-4 ${isDialog ? "md:flex-row md:items-start md:gap-6 flex-1 min-h-0" : ""}`}>
            {isDialog ? (
              <div className="hidden md:flex w-64 flex-shrink-0 flex-col gap-3 rounded-3xl bg-muted/20 p-4 shadow-sm">
                <TabsList className="flex flex-col gap-3">
                  {SECTIONS.map((section, index) => (
                    <TabsTrigger
                      key={section.value}
                      value={section.value}
                      className="w-full justify-start rounded-2xl border border-transparent bg-white px-4 py-3 text-left text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm data-[state=active]:text-primary"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Step {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{section.label}</span>
                        <span className="text-xs text-muted-foreground">{section.description}</span>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ) : null}

            <div className={`flex-1 min-w-0 rounded-3xl border border-border/40 bg-white/95 px-1 py-1 md:px-4 ${isDialog ? "min-h-0 overflow-hidden" : "overflow-visible"}`}>
              <div className={`${showAllSections ? "flex flex-col gap-8 pb-0" : ""}`}>
                {/* DETAILS */}
              <Section value="details">
                <ScrollContainer className={`space-y-6 ${showAllSections ? "" : "pb-6"}`}>
                    <div className="space-y-6 pb-6">
                      <Card className="border-none shadow-sm">
                        <CardHeader className="pb-4">
                          <CardTitle>Description</CardTitle>
                          <CardDescription>Tell customers what makes this product special.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* NAME (uncontrolled; updates slug when auto) */}
                            <div className="space-y-2">
                              <Label htmlFor="product-name">Product name</Label>
                              <Input
                                id="product-name"
                                autoComplete="off"
                                required
                                {...register("name", {
                                  required: true,
                                  onChange: (e) => {
                                    if (!manualSlug) {
                                      setValue("slug", slugify(e.target.value), { shouldDirty: true });
                                    }
                                  },
                                })}
                              />
                            </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor="product-brand">Brand</Label>
                              <Input id="product-brand" placeholder="CEVONNE" {...register("brand")} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product-type">Type</Label>
                              <Input id="product-type" placeholder="single" {...register("type")} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product-tags">Tags</Label>
                              <Input id="product-tags" placeholder="lipstick, matte, rose" {...register("tags")} />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor="product-finish">Finish</Label>
                              <Input id="product-finish" placeholder="Matte, satin, glossy..." autoComplete="off" {...register("finish")} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product-coverage">Coverage</Label>
                              <Input id="product-coverage" placeholder="Full, medium, sheer..." autoComplete="off" {...register("coverage")} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product-fragrance">Fragrance</Label>
                              <Input id="product-fragrance" placeholder="Fragrance-free, vanilla..." autoComplete="off" {...register("fragrance")} />
                            </div>
                          </div>

                          {/* SLUG (uncontrolled; no watch/value prop) */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="product-slug">Slug</Label>
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary"
                                onClick={() => {
                                  setManualSlug((prev) => {
                                    const next = !prev;
                                    if (!next) {
                                      const nameNow = getValues("name") || "";
                                      setValue("slug", slugify(nameNow), { shouldDirty: true });
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {manualSlug ? "Auto-generate" : "Edit manually"}
                              </button>
                            </div>
                            <Input
                              id="product-slug"
                              autoComplete="off"
                              aria-describedby="product-slug-help"
                              {...register("slug", {
                                onChange: (e) => {
                                  setManualSlug(true);
                                  const s = slugify(e.target.value);
                                  setValue("slug", s, { shouldDirty: true });
                                },
                              })}
                            />
                            <p id="product-slug-help" className="sr-only">Slug is used in the product URL.</p>
                          </div>

                          {/* Collection */}
                          <div className="space-y-2">
                            <Label id="product-collection-label">Collection</Label>
                            <Select
                              value={watch("collectionId")}
                              onValueChange={(value) => setValue("collectionId", value, { shouldDirty: true })}
                            >
                              <SelectTrigger id="product-collection" aria-labelledby="product-collection-label" name="collectionId">
                                <SelectValue placeholder="Optional" />
                              </SelectTrigger>
                              <SelectContent>
                                {collectionOptions.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* DESCRIPTION EDITOR */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <span id="product-description-label" className="text-sm font-medium leading-none">Business description</span>
                            <div className="flex items-center gap-2">
                              {descriptionFileName ? (
                                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                  <span className="max-w-[140px] truncate">{descriptionFileName}</span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 text-primary hover:text-primary/80"
                                    onClick={clearDescriptionFile}
                                    aria-label="Remove uploaded file"
                                  >
                                    ×
                                  </Button>
                                </div>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-full border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"
                                onClick={() => textFileInputRef.current?.click()}
                                aria-describedby="product-description-help"
                              >
                                Upload .txt file
                              </Button>
                            </div>
                          </div>

                          <input
                            id="product-description-file"
                            type="file"
                            accept=".txt,text/plain"
                            ref={textFileInputRef}
                            onChange={handleDescriptionFile}
                            className="hidden"
                          />
                          <p id="product-description-help" className="text-xs text-muted-foreground">
                            Uploading a text file will replace the editor content with the file contents.
                          </p>

                          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 shadow-sm">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</span>
                            <div className="flex gap-1">
                              {FORMAT_ACTIONS.map((action) => (
                                <Button
                                  key={action.key}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className={`h-8 w-8 rounded-full ${action.className}`}
                                  onClick={() => applyFormatting(action.key)}
                                  aria-label={`Make ${action.key}`}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div
                            id="product-description"
                            ref={editorRef}
                            className="min-h-[320px] max-h-[520px] overflow-auto rounded-2xl border border-primary/30 bg-white px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            contentEditable
                            tabIndex={0}
                            role="textbox"
                            aria-multiline="true"
                            aria-labelledby="product-description-label"
                            aria-describedby="product-description-help"
                            spellCheck
                            suppressContentEditableWarning
                            onInput={(e) => {
                              // No state updates here -> no scroll/caret jump
                              descriptionRef.current = e.currentTarget.innerHTML;
                            }}
                            onBlur={() => {
                              // Commit to RHF when the user leaves the editor
                              setValue("description", descriptionRef.current, { shouldDirty: true });
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Use the toolbar to add bold, italic, or underlined emphasis. Rich text is saved with the product.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollContainer>
              </Section>

              {/* STORY */}
              <Section value="story">
                <ScrollContainer className={`space-y-6 ${showAllSections ? "" : "pb-6"}`}>
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle>Product story</CardTitle>
                      <CardDescription>Copy that powers the hero, subtitle, and long description.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="product-headline">Headline</Label>
                          <Textarea id="product-headline" rows={2} placeholder="A soft mauve-rose..." {...register("headline")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-subtitle">Subtitle</Label>
                          <Input id="experience-subtitle" placeholder="Feather-light. Full-pigment." autoComplete="off" {...register("experienceSubtitle")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-category">Category path</Label>
                          <Textarea
                            id="experience-category"
                            rows={3}
                            placeholder={"Makeup\nLips\nLipstick"}
                            {...register("experienceCategoryPath")}
                          />
                          <p className="text-xs text-muted-foreground">One line per level; used for breadcrumbs and tone matching.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="experience-long-description">Long description</Label>
                        <Textarea
                          id="experience-long-description"
                          rows={5}
                          placeholder="Share the sensory story, finish, and why it matters."
                          {...register("experienceLongDescription")}
                        />
                        <p className="text-xs text-muted-foreground">This feeds the story section on the product page.</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle>Visual theme & media</CardTitle>
                      <CardDescription>Hero media, gallery, background gradients, and video.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="experience-hero-image">Hero image</Label>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Input
                                id="experience-hero-image"
                                placeholder="https://.../hero.jpg"
                                {...register("experienceHeroImage")}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={() => heroImageInputRef.current?.click()}
                                disabled={heroUploading}
                              >
                                {heroUploading ? "Uploading..." : "Upload"}
                              </Button>
                            </div>
                            <input
                              ref={heroImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleHeroImageChange}
                            />
                            <p className="text-xs text-muted-foreground">Upload to host and save the URL for the product hero.</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-hero-object">Image focal point</Label>
                          <Input id="experience-hero-object" placeholder="68% 34%" {...register("experienceHeroObjectPosition")} />
                          <p className="text-xs text-muted-foreground">Use CSS object-position to keep the product centered.</p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="experience-hero-bg">Hero background</Label>
                          <Input id="experience-hero-bg" placeholder="linear-gradient(...)" {...register("experienceHeroBg")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-hero-overlay">Hero overlay</Label>
                          <Input id="experience-hero-overlay" placeholder="rgba(0,0,0,.05)" {...register("experienceHeroOverlay")} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="experience-gallery">Gallery (one URL per line)</Label>
                        <Textarea id="experience-gallery" rows={3} placeholder="https://.../image-1.jpg" {...register("experienceGallery")} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="experience-video">Product video URL</Label>
                          <Input id="experience-video" placeholder="intro1.mp4 or https://..." {...register("experienceVideoUrl")} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="video-title">Video Title</Label>
                            <Input id="video-title" placeholder="Cevonne" {...register("videoTitle")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="video-description">Video Description</Label>
                            <Textarea id="video-description" rows={2} placeholder="Velvet matte color..." {...register("videoDescription")} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-theme-default">Default gradient / background</Label>
                          <Input id="experience-theme-default" placeholder="radial-gradient(...)" {...register("experienceThemeDefaultBg")} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Section backgrounds</Label>
                        <div className="grid gap-3 md:grid-cols-3">
                          <Input placeholder="Hero bg" {...register("experienceSceneBgHero")} />
                          <Input placeholder="Features bg" {...register("experienceSceneBgFeatures")} />
                          <Input placeholder="Ingredients bg" {...register("experienceSceneBgIngredients")} />
                          <Input placeholder="Video bg" {...register("experienceSceneBgVideo")} />
                          <Input placeholder="Shades bg" {...register("experienceSceneBgShades")} />
                          <Input placeholder="Reviews bg" {...register("experienceSceneBgReviews")} />
                        </div>
                        <p className="text-xs text-muted-foreground">Optional: helps replicate the gradients used on the product page sections.</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle>Highlights & trust</CardTitle>
                      <CardDescription>Badges, benefits, rituals, claims, and post-purchase info.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="experience-badges">Badges (one per line)</Label>
                          <Textarea id="experience-badges" rows={3} placeholder={"Vegan\nCruelty-Free\nDermat Tested"} {...register("experienceBadges")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-benefits">Benefits (one per line)</Label>
                          <Textarea id="experience-benefits" rows={4} placeholder={"12-hour comfortable matte\nWeightless feel"} {...register("experienceBenefits")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-howto">How to use (one step per line)</Label>
                          <Textarea id="experience-howto" rows={4} placeholder={"Exfoliate lips\nOutline with bullet tip\nBlot and reapply"} {...register("experienceHowToUse")} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="experience-claims">Claims (one per line)</Label>
                          <Textarea id="experience-claims" rows={4} placeholder={"93% agreed lips felt soft"} {...register("experienceClaims")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience-disclaimer">Disclaimer</Label>
                          <Textarea id="experience-disclaimer" rows={2} placeholder="* Consumer study, n=60, after 1 week of use" {...register("experienceDisclaimer")} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="supporting-ingredients">Supporting Ingredients (comma or newline separated)</Label>
                          <Textarea id="supporting-ingredients" rows={4} placeholder="Ricinus Communis (Castor) Seed Oil..." {...register("supportingIngredients")} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="experience-rating">Avg. rating</Label>
                            <Input id="experience-rating" type="number" step="0.1" min="0" max="5" {...register("experienceRating")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="experience-reviews">Reviews count</Label>
                            <Input id="experience-reviews" type="number" min="0" {...register("experienceReviewCount")} />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="experience-shipping">Shipping note</Label>
                            <Textarea id="experience-shipping" rows={2} placeholder="Free shipping on orders above..." {...register("experienceShipping")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="experience-returns">Return policy</Label>
                            <Textarea id="experience-returns" rows={2} placeholder="Easy 7-day returns..." {...register("experienceReturns")} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle>Ingredients & FAQs</CardTitle>
                      <CardDescription>Pair key actives with reasons-to-believe and answer top shopper questions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Hero ingredients</Label>
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => appendIngredient({ name: "", why: "" })}>
                            Add ingredient
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ingredients-title">Section Title</Label>
                          <Input id="ingredients-title" placeholder="Powered by Science" {...register("ingredientsTitle")} />
                        </div>
                        {ingredientFields.length ? (
                          <div className="space-y-3">
                            {ingredientFields.map((field, index) => (
                              <div key={field.id ?? index} className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3 md:grid-cols-[1.2fr,2fr,auto]">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`experience-ingredient-${index}-name`}>Name</Label>
                                  <Input id={`experience-ingredient-${index}-name`} placeholder="Squalane" {...register(`experienceIngredients.${index}.name`)} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`experience-ingredient-${index}-why`}>Why it matters</Label>
                                  <Input id={`experience-ingredient-${index}-why`} placeholder="locks in moisture" {...register(`experienceIngredients.${index}.why`)} />
                                </div>
                                <div className="flex items-end justify-end">
                                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeIngredient(index)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No hero ingredients yet.</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">FAQs</Label>
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => appendFaq({ q: "", a: "" })}>
                            Add FAQ
                          </Button>
                        </div>
                        {faqFields.length ? (
                          <div className="space-y-3">
                            {faqFields.map((field, index) => (
                              <div key={field.id ?? index} className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`experience-faq-${index}-q`}>Question</Label>
                                  <Input id={`experience-faq-${index}-q`} placeholder="Is it vegan?" {...register(`experienceFaqs.${index}.q`)} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`experience-faq-${index}-a`}>Answer</Label>
                                  <Textarea id={`experience-faq-${index}-a`} rows={2} placeholder="Yes, 100% vegan and cruelty-free." {...register(`experienceFaqs.${index}.a`)} />
                                </div>
                                <div className="flex justify-end">
                                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeFaq(index)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Add common questions shoppers ask.</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Reviews</Label>
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => appendReview({ author: "", date: "", rating: "5", title: "", comment: "" })}>
                            Add Review
                          </Button>
                        </div>
                        {reviewFields.length ? (
                          <div className="space-y-3">
                            {reviewFields.map((field, index) => (
                              <div key={field.id ?? index} className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`review-${index}-author`}>Author</Label>
                                    <Input id={`review-${index}-author`} placeholder="Jane Doe" {...register(`reviewsList.${index}.author`)} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`review-${index}-date`}>Date</Label>
                                    <Input id={`review-${index}-date`} placeholder="Oct 12, 2023" {...register(`reviewsList.${index}.date`)} />
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-[1fr,3fr]">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`review-${index}-rating`}>Rating</Label>
                                    <Input id={`review-${index}-rating`} type="number" min="1" max="5" step="0.1" {...register(`reviewsList.${index}.rating`)} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`review-${index}-title`}>Title</Label>
                                    <Input id={`review-${index}-title`} placeholder="Great product!" {...register(`reviewsList.${index}.title`)} />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`review-${index}-comment`}>Comment</Label>
                                  <Textarea id={`review-${index}-comment`} rows={2} placeholder="I loved the texture..." {...register(`reviewsList.${index}.comment`)} />
                                </div>
                                <div className="flex justify-end">
                                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeReview(index)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No reviews added manually.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </ScrollContainer>
              </Section>

              {/* INVENTORY */}
              <Section value="inventory">
                <ScrollContainer className={`space-y-6 ${showAllSections ? "" : "pb-4"}`} allowScroll>
                  <div className="space-y-6 pb-4">
                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle>Inventory & variants</CardTitle>
                        <CardDescription>Record stock information and SKU identifiers.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="inventory-quantity">Quantity (optional)</Label>
                            <Input id="inventory-quantity" type="number" min="0" placeholder="e.g. 120" {...register("inventoryQuantity")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="inventory-sku">SKU (optional)</Label>
                            <Input id="inventory-sku" placeholder="UGG-BB-PUR-06" {...register("inventorySku")} />
                          </div>
                        </div>

                        {/* Selling type */}
                        <div className="space-y-3">
                          <span id="selling-type-label" className="text-sm font-medium">Selling type</span>
                          <div className="grid gap-3 md:grid-cols-3" role="group" aria-labelledby="selling-type-label">
                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 shadow-sm">
                              <Checkbox
                                id="selling-instore"
                                checked={watch("inStoreSelling")}
                                onCheckedChange={(checked) => setValue("inStoreSelling", Boolean(checked))}
                              />
                              <Label htmlFor="selling-instore" className="text-sm font-medium">In-store selling only</Label>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 shadow-sm">
                              <Checkbox
                                id="selling-online"
                                checked={watch("onlineSelling")}
                                onCheckedChange={(checked) => setValue("onlineSelling", Boolean(checked))}
                              />
                              <Label htmlFor="selling-online" className="text-sm font-medium">Online selling only</Label>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 shadow-sm">
                              <Checkbox id="selling-both" disabled />
                              <Label htmlFor="selling-both" className="text-sm font-medium text-muted-foreground">Both in-store and online</Label>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                          Product variants like shade or finish can be added once the product is created.
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <CardTitle>Shade variants</CardTitle>
                            <CardDescription>Capture popular shades with hex colors, SKU, and stock.</CardDescription>
                          </div>
                          <Button type="button" variant="outline" className="rounded-full" onClick={handleAddShade}>
                            Add shade
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {shadeFields.length ? (
                          <div className="space-y-4">
                            {shadeFields.map((shade, index) => {
                              const baseId = `${resolvedFormId}-shade-${shade.id ?? index}`;
                              const nameId = `${baseId}-name`;
                              const hexTextId = `${baseId}-hex-text`;
                              const hexPickerId = `${baseId}-hex-picker`;
                              const skuId = `${baseId}-sku`;
                              const priceId = `${baseId}-price`;
                              const quantityId = `${baseId}-quantity`;
                              const namePath = `shades.${index}.name`;
                              const skuPath = `shades.${index}.sku`;
                              const pricePath = `shades.${index}.price`;
                              const quantityPath = `shades.${index}.quantity`;

                              return (
                                <div key={shade.id ?? index} className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                      <Label htmlFor={nameId}>Shade name</Label>
                                      <Input
                                        id={nameId}
                                        autoComplete="off"
                                        defaultValue={shade.name}
                                        {...register(namePath)}
                                        placeholder="Velvet berry"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={hexTextId}>Hex color</Label>
                                      <Controller
                                        control={control}
                                        name={`shades.${index}.hexColor`}
                                        defaultValue={shade.hexColor}
                                        render={({ field: hexField }) => {
                                          const value = hexField.value || "";
                                          const handleChange = (next) => hexField.onChange(next);
                                          return (
                                            <div className="flex items-center gap-2">
                                              <Input
                                                id={hexPickerId}
                                                type="color"
                                                value={value || "#a21caf"}
                                                onChange={(e) => handleChange(e.target.value)}
                                                className="h-10 w-16 cursor-pointer rounded-full border border-border/60 px-1"
                                                aria-label="Shade color"
                                              />
                                              <Input
                                                id={hexTextId}
                                                autoComplete="off"
                                                value={value}
                                                onChange={(e) => handleChange(e.target.value)}
                                                placeholder="#a21caf"
                                                ref={hexField.ref}
                                              />
                                            </div>
                                          );
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={skuId}>SKU (optional)</Label>
                                      <Input
                                        id={skuId}
                                        autoComplete="off"
                                        defaultValue={shade.sku}
                                        {...register(skuPath)}
                                        placeholder="SKU-001"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                      <Label htmlFor={priceId}>Shade price (optional)</Label>
                                      <Input
                                        id={priceId}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        autoComplete="off"
                                        defaultValue={shade.price}
                                        {...register(pricePath)}
                                        placeholder="799"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={quantityId}>Initial quantity</Label>
                                      <Input
                                        id={quantityId}
                                        type="number"
                                        min="0"
                                        autoComplete="off"
                                        defaultValue={shade.quantity}
                                        {...register(quantityPath)}
                                        placeholder="150"
                                      />
                                    </div>
                                    <div className="flex items-end justify-end">
                                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => handleRemoveShade(index)}>
                                        Remove shade
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                            No shades added yet. Use the button above to create variants for each lipstick shade.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollContainer>
              </Section>

              {/* MEDIA */}
              <Section value="media">
                <ScrollContainer className={`space-y-4 ${showAllSections ? "" : "pb-4"}`} allowScroll>
                  <div className="space-y-6 pb-4">
                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle>Product images</CardTitle>
                        <CardDescription>Upload polished imagery to bring the product to life.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 p-6 text-center transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-describedby="product-images-help"
                        >
                          <p className="text-sm font-semibold text-primary">Click or drag image files to upload</p>
                          <p id="product-images-help" className="text-xs text-muted-foreground">Supports PNG, JPG, GIF up to 10MB each.</p>
                        </button>
                        <Input
                          ref={imageInputRef}
                          id="product-images"
                          name="images"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        {existingImages.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing gallery</p>
                            <div className="grid gap-3 sm:grid-cols-3">
                              {existingImages.map((image) => (
                                <div key={image.id ?? image.url} className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                                  <img src={image.url} alt={image.alt ?? image.url} className="h-32 w-full object-cover" />
                                  <button
                                    type="button"
                                    className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-destructive shadow"
                                    onClick={() => handleRemoveExistingImage(image.id ?? image.url)}
                                    aria-label="Remove image"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {images.length ? (
                          <ScrollArea className="h-32 rounded-lg border border-border/60" aria-label="Selected images to upload">
                            <ul className="space-y-1 p-3 text-xs text-muted-foreground">
                              {images.map((file) => (
                                <li key={file.name}>{file.name}</li>
                              ))}
                            </ul>
                          </ScrollArea>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollContainer>
              </Section>

              {/* SHIPPING */}
              <Section value="shipping">
                <ScrollContainer className={`space-y-5 ${showAllSections ? "" : "pb-5"}`} allowScroll>
                  <div className="space-y-6 pb-4">
                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle>Shipping & delivery</CardTitle>
                        <CardDescription>Provide optional measurements to streamline fulfilment.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="shipping-weight">Item weight</Label>
                          <div className="flex items-center gap-3">
                            <Input id="shipping-weight" type="number" min="0" step="0.01" placeholder="12" {...register("shippingWeight")} className="flex-1" />
                            <div className="flex items-center gap-2">
                              <span id="shipping-weight-unit-label" className="sr-only">Weight unit</span>
                              <Select defaultValue="kg">
                                <SelectTrigger id="shipping-weight-unit" aria-labelledby="shipping-weight-unit-label" name="shippingWeightUnit" className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="kg">kg</SelectItem>
                                  <SelectItem value="lb">lb</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span id="package-size-label" className="text-sm font-medium">Package size (cm)</span>
                          <div className="grid gap-3 md:grid-cols-3" role="group" aria-labelledby="package-size-label">
                            <div className="space-y-1.5">
                              <Label htmlFor="package-length">Length</Label>
                              <Input id="package-length" placeholder="Length" type="number" min="0" step="0.1" autoComplete="off" {...register("shippingLength")} />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="package-width">Width</Label>
                              <Input id="package-width" placeholder="Width" type="number" min="0" step="0.1" autoComplete="off" {...register("shippingWidth")} />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="package-height">Height</Label>
                              <Input id="package-height" placeholder="Height" type="number" min="0" step="0.1" autoComplete="off" {...register("shippingHeight")} />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor="unit-count">Unit Count</Label>
                            <Input id="unit-count" type="number" min="1" placeholder="1" {...register("unitCount")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="size-ml">Size (ml)</Label>
                            <Input id="size-ml" type="number" step="0.1" placeholder="0" {...register("sizeMl")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="size-floz">Size (fl oz)</Label>
                            <Input id="size-floz" type="number" step="0.01" placeholder="0" {...register("sizeFlOz")} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollContainer>
              </Section>

              {/* PRICING */}
              <Section value="pricing">
                <ScrollContainer className={`space-y-6 ${showAllSections ? "" : "pb-4"}`} allowScroll>
                  <div className="space-y-6 pb-4">
                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle>Pricing</CardTitle>
                        <CardDescription>Define retail pricing and optional compare-at pricing.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="product-price">Price</Label>
                          <Input id="product-price" type="number" min="0" step="0.01" placeholder="0.00" {...register("basePrice")} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="product-currency">Currency</Label>
                            <Input id="product-currency" placeholder="INR" {...register("currency")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="product-original-value">Original Value</Label>
                            <Input id="product-original-value" type="number" min="0" step="0.01" placeholder="0.00" {...register("originalValue")} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="compare-price">Compare at price</Label>
                          <Input id="compare-price" type="number" min="0" step="0.01" placeholder="Optional" {...register("compareAtPrice")} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollContainer>
              </Section>
              </div>
            </div>
          </div>
        </Tabs>

        <div className={`border-t border-border/60 pt-4 ${showAllSections ? "mt-6 flex flex-wrap justify-end gap-2" : "mt-2 flex flex-col gap-3 md:mt-6 md:flex-row md:items-center md:justify-between"}`}>
          {showAllSections ? (
            <>
              <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={submitting}>
                Discard
              </Button>
              <Button type="button" variant="secondary" disabled={submitting}>
                Schedule
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add product"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={goToPreviousSection} disabled={currentStep <= 0}>
                  Previous
                </Button>
                <Button type="button" variant="ghost" onClick={goToNextSection} disabled={currentStep >= SECTIONS.length - 1}>
                  Next
                </Button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={submitting}>
                  Discard
                </Button>
                <Button type="button" variant="secondary" disabled={submitting}>
                  Schedule
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Add product"}
                </Button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-h-[92vh] w-[92vw] max-w-5xl overflow-hidden rounded-3xl p-0">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex w-full flex-col overflow-visible rounded-3xl border border-border/60 bg-white/95 shadow-xl">
      {content}
    </div>
  );
}

export function ProductDialog({ onClose = () => { }, ...props }) {
  return (
    <ProductFormBase
      {...props}
      onClose={onClose}
      layout="dialog"
      afterSubmit={() => onClose(false)}
    />
  );
}

export function ProductForm(props) {
  return <ProductFormBase {...props} layout="page" />;
}
