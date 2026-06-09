"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  PencilLine,
  Trash2,
  Tag,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { API_BASE, slugify } from "./utils";
import { CollectionMediaDialog, type CollectionMediaDraftItem } from "./components/CollectionMediaDialog";
import type { CollectionMedia, Product, ProductCollection } from "@/types/product";

type CollectionRow = ProductCollection & {
  _count?: {
    products?: number;
  };
  media?: CollectionMedia[];
};

type CollectionFilter = "all" | "with-products" | "empty" | "with-artwork";

type CollectionFormValues = {
  name: string;
  description: string;
};

type ProductSort = "relevant" | "newest" | "oldest" | "name";
type ProductBrowserScope = "all" | "name" | "slug" | "brand";

const productSortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: "relevant", label: "Most relevant" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A-Z" },
];

const productBrowserScopeOptions: Array<{ value: ProductBrowserScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "name", label: "Name" },
  { value: "slug", label: "Slug" },
  { value: "brand", label: "Brand" },
];

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

const formatDate = (value?: Date | string | null) => {
  if (!value) return "Recently updated";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Recently updated";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const readResponseMessage = async (response: Response, fallback: string) => {
  try {
    const text = await response.clone().text();
    if (!text.trim()) {
      return response.statusText || fallback;
    }

    try {
      const data = JSON.parse(text);
      if (typeof data?.message === "string" && data.message.trim()) {
        return data.message;
      }
    } catch {
      return text.trim();
    }
  } catch {
    // Fall through to the fallback message below.
  }

  return response.statusText || fallback;
};

const productMatchesSearch = (product: Product, term: string) => {
  if (!term) return true;
  return [
    product?.name,
    product?.slug,
    product?.brand,
    product?.productType,
    product?.collection?.name,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
};

const getProductThumbnail = (product: Product) => {
  const image = product?.images?.[0]?.url;
  return image ? encodeURI(image) : "";
};

const productMatchesBrowserSearch = (product: Product, term: string, scope: ProductBrowserScope) => {
  if (!term) return true;

  const query = term.toLowerCase();
  const fieldsByScope = {
    all: [product?.name, product?.slug, product?.brand, product?.productType],
    name: [product?.name],
    slug: [product?.slug],
    brand: [product?.brand],
  }[scope];

  return fieldsByScope
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
};

function CollectionDialog({
  open,
  collection,
  products = [],
  request,
  refresh,
  onOpenChange,
}: {
  open: boolean;
  collection: CollectionRow | null;
  products?: Product[];
  request: (url: string, options?: RequestInit) => Promise<Response>;
  refresh?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState<ProductSort>("relevant");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [initialProductIds, setInitialProductIds] = useState<string[]>([]);
  const [productBrowserOpen, setProductBrowserOpen] = useState(false);
  const [productBrowserSearch, setProductBrowserSearch] = useState("");
  const [productBrowserScope, setProductBrowserScope] = useState<ProductBrowserScope>("all");
  const [productBrowserSelection, setProductBrowserSelection] = useState<string[]>([]);
  const [productBrowserSubmitting, setProductBrowserSubmitting] = useState(false);
  const [collectionMedia, setCollectionMedia] = useState<CollectionMediaDraftItem[]>([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaTouched, setMediaTouched] = useState(false);
  const [urlHandle, setUrlHandle] = useState("");
  const [urlHandleTouched, setUrlHandleTouched] = useState(false);
  const [seoEditorOpen, setSeoEditorOpen] = useState(false);
  const [seoSlugError, setSeoSlugError] = useState("");
  const isEditing = Boolean(collection);
  const productList = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const collectionImageItems = useMemo(
    () => collectionMedia.filter((item) => item.kind === "IMAGE"),
    [collectionMedia]
  );
  const collectionVideoItems = useMemo(
    () => collectionMedia.filter((item) => item.kind === "VIDEO"),
    [collectionMedia]
  );
  const coverPreviewSource =
    collectionImageItems[0] ??
    (collection?.imageUrl
      ? { kind: "IMAGE" as const, url: collection.imageUrl }
      : collectionVideoItems[0] ?? null);
  const coverPreviewUrl = coverPreviewSource?.url ?? "";
  const coverPreviewKind = coverPreviewSource?.kind ?? null;

  const { register, handleSubmit, reset, setValue, watch } = useForm<CollectionFormValues>({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const nameValue = watch("name");
  const descriptionValue = watch("description");

  const productById = useMemo(
    () => new Map(productList.map((product) => [product.id, product])),
    [productList]
  );
  const selectedProducts = useMemo(
    () =>
      selectedProductIds
        .map((productId) => productById.get(productId))
        .filter((product): product is Product => Boolean(product)),
    [productById, selectedProductIds]
  );

  const browserProducts = useMemo(() => {
    const term = productBrowserSearch.trim();
    return [...productList]
      .filter((product) => productMatchesBrowserSearch(product, term, productBrowserScope))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [productBrowserScope, productBrowserSearch, productList]);

  const browserSelectedSet = useMemo(() => new Set(productBrowserSelection), [productBrowserSelection]);

  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const items = selectedProducts.filter((product) => productMatchesSearch(product, term));

    switch (productSort) {
      case "name":
        return items.sort((left, right) => left.name.localeCompare(right.name));
      case "newest":
        return items.sort((left, right) => {
          const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
          const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
          return rightTime - leftTime;
        });
      case "oldest":
        return items.sort((left, right) => {
          const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
          const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
          return leftTime - rightTime;
        });
      case "relevant":
      default:
        return items;
    }
  }, [productSearch, productSort, selectedProducts]);

  useEffect(() => {
    if (!open) {
      reset({
        name: "",
        description: "",
      });
      setCollectionMedia([]);
      setMediaDialogOpen(false);
      setMediaTouched(false);
      setProductSort("relevant");
      setProductSearch("");
      setProductBrowserOpen(false);
      setProductBrowserSearch("");
      setProductBrowserScope("all");
      setProductBrowserSelection([]);
      setSelectedProductIds([]);
      setInitialProductIds([]);
      setUrlHandle("");
      setUrlHandleTouched(false);
      setSeoEditorOpen(false);
      setSeoSlugError("");
      setSubmitting(false);
      return;
    }

    const currentProductIds = isEditing && collection?.id
      ? productList
          .filter((product) => product.collectionId === collection.id)
          .map((product) => product.id)
      : [];

    reset({
      name: collection?.name ?? "",
      description: collection?.description ?? "",
    });
    setUrlHandle(collection?.slug?.trim() || slugify(collection?.name ?? "collection"));
    setUrlHandleTouched(Boolean(collection));
    setCollectionMedia(
      Array.isArray(collection?.media)
        ? collection.media.map((item) => ({
            ...item,
            origin: "existing" as const,
          }))
        : []
    );
    setMediaDialogOpen(false);
    setMediaTouched(false);
    setProductSort("relevant");
    setProductSearch("");
    setProductBrowserOpen(false);
    setProductBrowserSearch("");
    setProductBrowserScope("all");
    setProductBrowserSelection(currentProductIds);
    setSelectedProductIds(currentProductIds);
    setInitialProductIds(currentProductIds);
    setSeoEditorOpen(false);
    setSeoSlugError("");
    setSubmitting(false);
  }, [collection, isEditing, open, productList, reset]);

  useEffect(() => {
    if (!open) return;

    if (!urlHandleTouched) {
      setUrlHandle(nameValue ? slugify(nameValue) : "");
    }
  }, [nameValue, open, urlHandleTouched]);

  useEffect(() => {
    if (!seoEditorOpen) return;

    const targetId = seoSlugError ? "seo-url-handle" : "seo-title";
    document.getElementById(targetId)?.focus();
  }, [seoEditorOpen, seoSlugError]);

  const toggleProductSelection = (productId: string, checked: boolean | "indeterminate") => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return Array.from(next);
    });
  };

  const removeSelectedProduct = (productId: string) => {
    setSelectedProductIds((current) => current.filter((id) => id !== productId));
  };

  const openProductBrowser = () => {
    setProductBrowserSelection(selectedProductIds);
    setProductBrowserSearch("");
    setProductBrowserScope("all");
    setProductBrowserOpen(true);
  };

  const closeProductBrowser = () => {
    setProductBrowserOpen(false);
    setProductBrowserSelection(selectedProductIds);
    setProductBrowserSearch("");
    setProductBrowserScope("all");
  };

  const confirmProductBrowser = async () => {
    const nextSelection = productBrowserSelection;

    if (!collection?.id) {
      setSelectedProductIds(nextSelection);
      setProductBrowserOpen(false);
      return;
    }

    setProductBrowserSubmitting(true);
    try {
      const failures = await syncSelectedProducts(collection.id, initialProductIds, nextSelection);
      if (failures > 0) {
        toast.error(
          `Products added, but ${failures} product${failures === 1 ? "" : "s"} could not be updated`
        );
        refresh?.();
        return;
      }

      setSelectedProductIds(nextSelection);
      setInitialProductIds(nextSelection);
      setProductBrowserSelection(nextSelection);
      setProductBrowserOpen(false);
      toast.success("Products added to collection");
      refresh?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to add products to collection");
    } finally {
      setProductBrowserSubmitting(false);
    }
  };

  const updateProductCollection = async (productId: string, collectionId: string | null) => {
    const response = await request(`${API_BASE}/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    });

    if (!response.ok) {
      throw new Error(await readResponseMessage(response, "Failed to update product collection"));
    }
  };

  const syncSelectedProducts = async (collectionId: string, previousIds: string[], nextIds: string[]) => {
    const previous = new Set(previousIds);
    const next = new Set(nextIds);
    const toAdd = Array.from(next).filter((id) => !previous.has(id));
    const toRemove = Array.from(previous).filter((id) => !next.has(id));

    const results = await Promise.allSettled([
      ...toAdd.map((productId) => updateProductCollection(productId, collectionId)),
      ...toRemove.map((productId) => updateProductCollection(productId, null)),
    ]);

    return results.filter((result) => result.status === "rejected").length;
  };

  const onSubmit = async (values: CollectionFormValues) => {
    setSeoSlugError("");
    const mediaPayload = mediaTouched
      ? collectionMedia.map(({ id, origin, createdAt, updatedAt, collectionId, ...item }) => item)
      : [];
    const coverImageUrl = collectionImageItems[0]?.url ?? collection?.imageUrl ?? undefined;
    const payload = {
      name: values.name.trim(),
      slug: slugify(urlHandle || values.name),
      description: values.description.trim() || undefined,
      imageUrl: coverImageUrl,
      media: mediaTouched ? mediaPayload : undefined,
    };

    setSubmitting(true);
    try {
      const response = await request(
        isEditing && collection ? `${API_BASE}/collections/${collection.id}` : `${API_BASE}/collections`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const message = await readResponseMessage(
          response,
          isEditing ? "Failed to update collection" : "Failed to create collection"
        );

        if (response.status === 409) {
          setSeoEditorOpen(true);
          setSeoSlugError(message);
          toast.error(message);
          return;
        }

        throw new Error(
          message
        );
      }

      const savedCollection = (await response.json().catch(() => null)) as CollectionRow | null;
      const collectionId = savedCollection?.id || collection?.id;

      let productSyncFailures = 0;
      if (collectionId && (selectedProductIds.length > 0 || initialProductIds.length > 0)) {
        productSyncFailures = await syncSelectedProducts(collectionId, initialProductIds, selectedProductIds);
      }

      if (productSyncFailures > 0) {
        toast.error(
          `${isEditing ? "Collection updated" : "Collection created"}, but ${productSyncFailures} product${productSyncFailures === 1 ? "" : "s"} could not be updated`
        );
      } else {
        toast.success(isEditing ? "Collection updated" : "Collection created");
      }

      refresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : `Unable to ${isEditing ? "update" : "create"} collection`);
    } finally {
      setSubmitting(false);
    }
  };

  const previewSlug = slugify(urlHandle || nameValue || "collection");
  const seoTitleChars = Math.min((nameValue || "").trim().length, 70);
  const seoDescriptionChars = Math.min((descriptionValue || "").trim().length, 160);
  const hasSelectedProducts = selectedProducts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/30 backdrop-blur-[2px]"
        className="fixed left-[5vw] top-[5vh] h-[90dvh] w-[90vw] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-[32px] border-border/60 bg-white p-0 sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isEditing ? "Edit collection" : "Add collection"}</DialogTitle>
          <DialogDescription>
            Create or update a collection, manage its products, and attach media.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
            <div className="mb-5 flex items-center gap-2 text-xl font-semibold text-foreground">
              <Layers3 className="h-4 w-4 text-primary" />
              <span>{isEditing ? "Edit collection" : "Add collection"}</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-none gap-0 py-0">
                  <div className="space-y-1 border-b border-border/60 px-5 py-4">
                    <CardTitle className="text-base font-semibold text-foreground">Collection details</CardTitle>
                    <CardDescription>
                      Define the name and merchandising note for this collection.
                    </CardDescription>
                  </div>
                  <CardContent className="space-y-4 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="collection-name">Title</Label>
                      <Input
                        id="collection-name"
                        placeholder="Collection title"
                        required
                        className="shadow-none"
                        {...register("name", {
                          required: true,
                          onChange: () => {
                            if (!urlHandleTouched) {
                              setSeoSlugError("");
                            }
                          },
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collection-description">Description</Label>
                      <Textarea
                        id="collection-description"
                        rows={7}
                        placeholder="Add a title and description to see how this collection might appear in a search engine listing."
                        className="shadow-none"
                        {...register("description")}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-none gap-0 py-0">
                  <div className="space-y-4 border-b border-border/60 px-5 py-4">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-foreground">Products</CardTitle>
                      <CardDescription>Search, browse, and add products to this collection.</CardDescription>
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={productSearch}
                          onChange={(event) => {
                            setProductSearch(event.target.value);
                          }}
                          placeholder="Search products"
                          className="h-10 rounded-full border-border/70 bg-white pl-9 shadow-none"
                        />
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-full border-border/70 bg-white px-4 shadow-none hover:bg-muted/40"
                          onClick={openProductBrowser}
                        >
                          Browse
                        </Button>

                        <Select value={productSort} onValueChange={(value) => setProductSort(value as ProductSort)}>
                        <SelectTrigger className="!h-10 !min-h-10 min-w-[220px] rounded-full border-border/70 bg-white !px-3 !py-0 !leading-none !shadow-none">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Sort:</span>
                            <SelectValue placeholder="Most relevant" />
                          </div>
                        </SelectTrigger>
                          <SelectContent>
                            {productSortOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-0 bg-muted/10">
                    {!hasSelectedProducts ? (
                      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-14 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground">
                          <Tag className="h-6 w-6" />
                        </div>
                        <div className="mt-4 space-y-1">
                          <p className="text-base font-medium text-foreground">
                            There are no products in this collection.
                          </p>
                          <p className="text-sm text-muted-foreground">Search or browse to add products.</p>
                        </div>
                      </div>
                    ) : visibleProducts.length ? (
                      <ScrollArea className="h-[360px]">
                        <div className="divide-y divide-border/60 bg-muted/10">
                          {visibleProducts.map((product, index) => {
                            const thumbnail = getProductThumbnail(product);

                            return (
                              <div
                                key={product.id}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 transition hover:bg-primary/5"
                                )}
                              >
                                <span className="flex w-7 shrink-0 items-center justify-center text-sm font-medium text-muted-foreground">
                                  {index + 1}.
                                </span>
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-white text-xs font-semibold text-primary">
                                  {thumbnail ? (
                                    <div
                                      aria-hidden="true"
                                      className="h-full w-full bg-cover bg-center"
                                      style={{ backgroundImage: `url("${thumbnail}")` }}
                                    />
                                  ) : (
                                    <span>{product.name.slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                                </div>
                                <Badge className="rounded-full border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-none hover:bg-emerald-100">
                                  Active
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  onClick={() => removeSelectedProduct(product.id)}
                                  aria-label={`Remove ${product.name} from collection`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-14 text-center">
                        <div className="rounded-full border border-border/60 bg-white p-4 text-muted-foreground">
                          <Search className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-foreground">No products match your search.</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Try a different keyword or clear the search to browse all products.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-none gap-0 py-0">
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-foreground">Search engine listing</CardTitle>
                      <CardDescription>
                        Add a title and description to preview how the collection may appear in search.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      onClick={() => {
                        setSeoEditorOpen((current) => !current);
                      }}
                      aria-expanded={seoEditorOpen}
                      aria-controls="seo-details-fields"
                      aria-label="Edit search engine listing"
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-0">
                    <div className="border-b border-border/60 px-5 py-4">
                      <div className="rounded-3xl border border-border/60 bg-white px-4 py-3 shadow-none">
                        <p className="text-sm font-medium uppercase tracking-[0.16em] text-foreground">
                          Cevonne
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          https://cevonne.com &rsaquo; collections &rsaquo; {previewSlug}
                        </p>
                        <p className="mt-2 text-[22px] font-medium leading-tight text-[#0b57d0]">
                          {toTitleCase(nameValue || "Collection title")}
                        </p>
                      </div>
                    </div>

                    {seoEditorOpen ? (
                      <div id="seo-details-fields" className="space-y-4 px-5 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="seo-title">Page title</Label>
                          <Input
                            id="seo-title"
                            value={nameValue || ""}
                            onChange={(event) => {
                              if (!urlHandleTouched) {
                                setSeoSlugError("");
                              }
                              setValue("name", event.target.value, { shouldDirty: true, shouldTouch: true });
                            }}
                            placeholder="Collection title"
                            className="h-11 rounded-2xl border-border/70 bg-white shadow-none"
                          />
                          <p className="text-xs text-muted-foreground">{seoTitleChars} of 70 characters used</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="seo-description">Meta description</Label>
                          <Textarea
                            id="seo-description"
                            rows={5}
                            value={descriptionValue || ""}
                            onChange={(event) => {
                              setValue("description", event.target.value, { shouldDirty: true, shouldTouch: true });
                            }}
                            placeholder="Add a title and description to see how this collection might appear in a search engine listing."
                            className="min-h-32 rounded-2xl border-border/70 bg-white shadow-none"
                          />
                          <p className="text-xs text-muted-foreground">{seoDescriptionChars} of 160 characters used</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="seo-url-handle">URL handle</Label>
                          <div className="flex items-stretch overflow-hidden rounded-2xl border border-border/70 bg-white shadow-none">
                            <span className="flex items-center border-r border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground">
                              cevonne.com/collections/
                            </span>
                            <Input
                              id="seo-url-handle"
                              value={urlHandle}
                              onChange={(event) => {
                                setUrlHandleTouched(true);
                                setSeoSlugError("");
                                setUrlHandle(event.target.value);
                              }}
                              placeholder="collection-title"
                              className="h-11 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            https://cevonne.com/collections/{previewSlug}
                          </p>
                          {seoSlugError ? (
                            <p className="text-xs font-medium text-destructive">{seoSlugError}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-none gap-0 py-0">
                  <div className="space-y-1 border-b border-border/60 px-5 py-4">
                    <CardTitle className="text-base font-semibold text-foreground">Image</CardTitle>
                    <CardDescription>Upload a hero image, optional gallery, and one video.</CardDescription>
                  </div>
                  <CardContent className="p-4">
                    {coverPreviewUrl ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                          {coverPreviewKind === "VIDEO" ? (
                            <div className="relative aspect-[4/3]">
                              <video
                                src={coverPreviewUrl}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 py-3">
                                <p className="text-sm font-semibold text-white">Video attached</p>
                                <p className="text-xs text-white/80">
                                  {collectionVideoItems[0]?.fileName || "Collection video"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div
                              aria-hidden="true"
                              className="h-48 w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${encodeURI(coverPreviewUrl)}")` }}
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Badge variant="secondary" className="rounded-full">
                            {collectionImageItems.length}/5 images
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {collectionVideoItems.length}/1 video
                          </Badge>
                          <span>Media is saved with the collection record.</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-border/70 bg-white px-4 shadow-none hover:bg-muted/40"
                            onClick={() => setMediaDialogOpen(true)}
                          >
                            {collectionMedia.length ? "Manage media" : "Add image"}
                          </Button>
                          {collectionMedia.length ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-full px-4 text-muted-foreground hover:bg-muted/40"
                              onClick={() => {
                                setCollectionMedia([]);
                                setMediaTouched(true);
                              }}
                            >
                              Clear media
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full border-border/70 bg-white px-4 shadow-none hover:bg-muted/40"
                          onClick={() => setMediaDialogOpen(true)}
                        >
                          Add image
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          Upload up to 5 images and 1 video.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 bg-white px-5 py-4 backdrop-blur md:px-8">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border/70 bg-white px-5 shadow-none hover:bg-muted/40"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-[#111111] px-6 text-white shadow-none hover:bg-black"
              disabled={submitting || !nameValue.trim()}
            >
              {submitting ? "Saving..." : isEditing ? "Save changes" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <CollectionMediaDialog
        open={mediaDialogOpen}
        value={collectionMedia}
        request={request}
        onOpenChange={setMediaDialogOpen}
        onConfirm={(nextMedia) => {
          setCollectionMedia(nextMedia);
          setMediaTouched(true);
        }}
      />

      <Dialog
        open={productBrowserOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !productBrowserSubmitting) {
            closeProductBrowser();
          }
        }}
      >
        <DialogContent
          showCloseButton={!productBrowserSubmitting}
          overlayClassName="bg-black/45 backdrop-blur-[2px]"
          className="w-[min(42rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[28px] border-border/60 bg-white p-0 shadow-none"
        >
          <div className="flex max-h-[90vh] flex-col">
            <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
              <DialogTitle className="text-xl font-semibold text-foreground">Add products</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Search and select products to add to this collection.
              </DialogDescription>
            </DialogHeader>

            <div className="border-b border-border/60 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productBrowserSearch}
                    onChange={(event) => setProductBrowserSearch(event.target.value)}
                    placeholder="Search products"
                    className="h-11 rounded-full border-border/70 bg-white pl-9"
                  />
                </div>

                <Select value={productBrowserScope} onValueChange={(value) => setProductBrowserScope(value as ProductBrowserScope)}>
                  <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white sm:w-[190px]">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Search by</span>
                      <SelectValue placeholder="All" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {productBrowserScopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-3 h-9 rounded-full border-dashed border-border/70 bg-white px-4 text-sm shadow-none hover:bg-muted/40"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add filter
              </Button>
            </div>

            <div className="min-h-0 flex-1">
              <ScrollArea className="h-[360px]">
                {browserProducts.length ? (
                  <div className="divide-y divide-border/60">
                    {browserProducts.map((product) => {
                      const checked = browserSelectedSet.has(product.id);
                      const thumbnail = getProductThumbnail(product);

                      return (
                        <label
                          key={product.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-primary/5",
                            checked && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              setProductBrowserSelection((current) => {
                                const next = new Set(current);
                                if (state === true) {
                                  next.add(product.id);
                                } else {
                                  next.delete(product.id);
                                }
                                return Array.from(next);
                              });
                            }}
                          />
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-white text-xs font-semibold text-primary">
                            {thumbnail ? (
                              <div
                                aria-hidden="true"
                                className="h-full w-full bg-cover bg-center"
                                style={{ backgroundImage: `url("${thumbnail}")` }}
                              />
                            ) : (
                              <span>{product.name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="rounded-full border border-border/60 bg-white p-4 text-muted-foreground">
                      <Search className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-foreground">No products match your search.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try a different keyword or clear the search to browse all products.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="border-t border-border/60 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 bg-white px-5 shadow-none hover:bg-muted/40"
                onClick={closeProductBrowser}
                disabled={productBrowserSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-[#111111] px-6 text-white shadow-none hover:bg-black"
                disabled={productBrowserSelection.length === 0 || productBrowserSubmitting}
                onClick={confirmProductBrowser}
              >
                {productBrowserSubmitting ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { products, collections, loading, refresh } = useDashboardData(true, request);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  const collectionRows = useMemo(() => {
    if (!Array.isArray(collections)) return [];

    const term = search.trim().toLowerCase();

    return [...collections]
      .filter((collection: CollectionRow) => {
        const productCount = collection._count?.products ?? 0;
        const haystack = [collection.name, collection.slug, collection.description ?? ""].join(" ").toLowerCase();

        const matchesSearch = !term || haystack.includes(term);
        const matchesFilter =
          filter === "all" ||
          (filter === "with-products" && productCount > 0) ||
          (filter === "empty" && productCount === 0) ||
          (filter === "with-artwork" && Boolean(collection.imageUrl || collection.media?.length));

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [collections, filter, search]);

  const selectedCollectionSet = useMemo(() => new Set(selectedCollectionIds), [selectedCollectionIds]);
  const allVisibleCollectionsSelected =
    collectionRows.length > 0 && collectionRows.every((collection) => selectedCollectionSet.has(collection.id));
  const someVisibleCollectionsSelected =
    collectionRows.length > 0 && collectionRows.some((collection) => selectedCollectionSet.has(collection.id));

  const openCreateDialog = () => {
    setEditingCollection(null);
    setDialogOpen(true);
  };

  const openEditDialog = (collection: CollectionRow) => {
    setEditingCollection(collection);
    setDialogOpen(true);
  };

  const toggleCollectionSelection = (collectionId: string, checked: boolean | "indeterminate") => {
    setSelectedCollectionIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        next.add(collectionId);
      } else {
        next.delete(collectionId);
      }
      return Array.from(next);
    });
  };

  const toggleAllVisibleCollections = (checked: boolean | "indeterminate") => {
    setSelectedCollectionIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        collectionRows.forEach((collection) => next.add(collection.id));
      } else {
        collectionRows.forEach((collection) => next.delete(collection.id));
      }
      return Array.from(next);
    });
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingCollection(null);
    }
  };

  const handleDelete = async (collection: CollectionRow) => {
    const confirmed = window.confirm(`Delete collection "${collection.name}"?`);
    if (!confirmed) return;

    setDeletingId(collection.id);
    try {
      const response = await request(`${API_BASE}/collections/${collection.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(await readResponseMessage(response, "Failed to delete collection"));
      }

      toast.success("Collection deleted");
      refresh?.();
      if (editingCollection?.id === collection.id) {
        closeDialog(false);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to delete collection");
    } finally {
      setDeletingId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilter("all");
  };

  const hasFilters = Boolean(search.trim()) || filter !== "all";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden bg-[#f7f8fb]">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 space-y-4 px-3 pb-6 pt-0 md:px-4 lg:px-5">
              <div className="flex min-h-10 w-full flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-primary" />
                  <h1 className="text-[15px] font-semibold leading-none tracking-tight text-foreground">
                    Collections
                  </h1>
                </div>

                <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap sm:justify-end">
                  <Button
                    onClick={openCreateDialog}
                    className="h-9 rounded-full bg-[#111111] px-4 text-sm font-medium text-white shadow-none hover:bg-black"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add collection
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden rounded-3xl border-border/60 bg-white shadow-none gap-0 py-0">
                <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">All collections</p>
                    <p className="text-sm text-muted-foreground">Search, filter, and open any collection record in a few clicks.</p>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
                    <Select value={filter} onValueChange={(value) => setFilter(value as CollectionFilter)}>
                      <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white lg:w-48">
                        <SelectValue placeholder="All collections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All collections</SelectItem>
                        <SelectItem value="with-products">With products</SelectItem>
                        <SelectItem value="empty">Empty</SelectItem>
                        <SelectItem value="with-artwork">With artwork</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="relative w-full lg:min-w-[320px] lg:flex-1">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search collections by name, slug, or note"
                        className="h-11 rounded-full border-border/70 bg-white pl-9"
                      />
                    </div>

                    {hasFilters ? (
                      <Button variant="ghost" className="h-11 rounded-full px-4" onClick={resetFilters}>
                        Reset
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[880px] table-fixed">
                    <colgroup>
                      <col className="w-[2%]" />
                      <col className="w-[58%]" />
                      <col className="w-[18%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="px-4 py-3">
                          <span className="sr-only">Select collections</span>
                          <Checkbox
                            checked={
                              allVisibleCollectionsSelected
                                ? true
                                : someVisibleCollectionsSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={toggleAllVisibleCollections}
                            aria-label="Select all collections"
                          />
                        </TableHead>
                        <TableHead className="px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <div className="grid min-w-0 grid-cols-[4px_minmax(0,1fr)_44px] items-center gap-2">
                            <span aria-hidden="true" />
                            <span className="block truncate">Title</span>
                            <span aria-hidden="true" />
                          </div>
                        </TableHead>
                        <TableHead className="px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Products
                        </TableHead>
                        <TableHead className="px-2 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell className="px-4 py-3">
                              <Skeleton className="h-5 w-5 rounded-md" />
                            </TableCell>
                            <TableCell colSpan={3} className="px-2 py-3">
                              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-center gap-4">
                                <Skeleton className="h-12 w-full rounded-2xl" />
                                <Skeleton className="h-8 w-20 rounded-full" />
                                <Skeleton className="h-9 w-9 rounded-full" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : collectionRows.length ? (
                        collectionRows.map((collection) => {
                          const productCount = collection._count?.products ?? 0;
                          const previewImage = collection.media?.find((item) => item.kind === "IMAGE");
                          const previewVideo = collection.media?.find((item) => item.kind === "VIDEO");
                          const previewUrl = previewImage?.url ?? collection.imageUrl ?? previewVideo?.url ?? "";
                          const isSelected = selectedCollectionSet.has(collection.id);

                          return (
                              <TableRow
                                key={collection.id}
                                className={cn("group transition hover:bg-primary/5", isSelected && "bg-primary/5")}
                              >
                              <TableCell className="px-4 py-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(state) => toggleCollectionSelection(collection.id, state)}
                                  aria-label={`Select ${collection.name}`}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-3">
                                <div className="grid min-w-0 grid-cols-[4px_minmax(0,1fr)_44px] items-center gap-2">
                                  <span aria-hidden="true" />
                                  <div className="flex min-w-0 items-center gap-3">
                                    {previewUrl ? (
                                      previewVideo && !previewImage ? (
                                        <div className="relative h-11 w-11 overflow-hidden rounded-2xl ring-1 ring-border/70">
                                          <video
                                            src={previewUrl}
                                            className="h-full w-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                                            <Video className="h-4 w-4" />
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          aria-hidden="true"
                                          className="h-11 w-11 rounded-2xl bg-cover bg-center ring-1 ring-border/70"
                                          style={{ backgroundImage: `url("${encodeURI(previewUrl)}")` }}
                                        />
                                      )
                                    ) : (
                                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-border/70">
                                        {collection.name.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => openEditDialog(collection)}
                                        className="block truncate text-left text-sm font-semibold text-foreground hover:text-primary"
                                      >
                                        {collection.name}
                                      </button>
                                    </div>
                                  </div>
                                  <span aria-hidden="true" />
                                </div>
                              </TableCell>

                              <TableCell className="px-4 py-3">
                                <p className="text-sm font-semibold leading-none text-foreground">{productCount}</p>
                              </TableCell>

                              <TableCell className="px-4 py-3 text-right">
                                <div
                                  className="flex items-center justify-end gap-2"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full"
                                    onClick={() => openEditDialog(collection)}
                                    aria-label={`Edit ${collection.name}`}
                                  >
                                    <PencilLine className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-full border-border/70 bg-white shadow-none hover:bg-muted/40"
                                        aria-label={`More actions for ${collection.name}`}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-2xl border-border/60">
                                      <DropdownMenuItem onSelect={() => openEditDialog(collection)}>
                                        <PencilLine className="h-4 w-4" />
                                        Edit collection
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        disabled={deletingId === collection.id}
                                        onSelect={() => void handleDelete(collection)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete collection
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="px-5 py-10 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                              <div className="rounded-full bg-primary/10 p-4 text-primary">
                                <Layers3 className="h-6 w-6" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-semibold text-foreground">
                                  {Array.isArray(collections) && collections.length
                                    ? "No collections match your filters."
                                    : "No collections yet."}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {Array.isArray(collections) && collections.length
                                    ? "Try another search term or clear the filters to reveal more collections."
                                    : "Create your first collection to start grouping products for the storefront."}
                                </p>
                              </div>
                              <Button type="button" className="rounded-full bg-primary text-primary-foreground" onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add collection
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </main>
          </div>
        </SidebarInset>
      </div>

      <CollectionDialog
        open={dialogOpen}
        collection={editingCollection}
        products={products}
        request={request}
        refresh={refresh}
        onOpenChange={closeDialog}
      />
    </SidebarProvider>
  );
}
