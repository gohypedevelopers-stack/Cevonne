import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { format, parseISO } from "date-fns";
import { Eye, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { API_BASE, formatCurrency, slugify, toNumber } from "../utils";
import { AR_STATIC_SHADES } from "@/data/arShades";

export function ManagementPanel({
  products,
  collections,
  shades,
  inventory,
  reviews,
  reviewMeta,
  refresh,
  request,
  loading,
  onCreateProduct,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("products");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [shadeDialogOpen, setShadeDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryTarget, setInventoryTarget] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);

  const quickStats = [
    { label: "Products", value: products?.length ?? 0 },
    { label: "Collections", value: collections?.length ?? 0 },
    { label: "Shades", value: shades?.length ?? 0 },
    { label: "Inventory items", value: inventory?.length ?? 0 },
    {
      label: "Reviews",
      value:
        reviewMeta?.count ??
        (Array.isArray(reviews) ? reviews.length : 0),
    },
  ];

  const openInventoryDialog = (entry) => {
    setInventoryTarget(entry || null);
    setInventoryDialogOpen(true);
  };

  const openReviewDialog = (review) => {
    setSelectedReview(review);
    setReviewDialogOpen(true);
  };

  const updateReviewStatus = async (review, status) => {
    if (!review?.id || !status) return;
    try {
      const response = await request(`${API_BASE}/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to update review");
      }
      toast.success(`Review ${status.toLowerCase()}`);
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update review");
    }
  };

  const deleteReview = async (review) => {
    if (!review?.id) return;
    if (!window.confirm("Remove this review?")) return;
    try {
      const response = await request(`${API_BASE}/reviews/${review.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to delete review");
      }
      toast.success("Review removed");
      if (selectedReview?.id === review.id) {
        setReviewDialogOpen(false);
        setSelectedReview(null);
      }
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to delete review");
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Remove product "${product.name}"?`)) return;
    try {
      const response = await request(`${API_BASE}/products/${product.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to delete product");
      }
      toast.success("Product removed");
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to delete product");
    }
  };

  const deleteCollection = async (collection) => {
    if (!window.confirm(`Remove collection "${collection.name}"?`)) return;
    try {
      const response = await request(`${API_BASE}/collections/${collection.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to delete collection");
      }
      toast.success("Collection removed");
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to delete collection");
    }
  };

  const deleteShade = async (shade) => {
    if (!window.confirm(`Remove shade "${shade.name}"?`)) return;
    try {
      const response = await request(`${API_BASE}/shades/${shade.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to delete shade");
      }
      toast.success("Shade removed");
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to delete shade");
    }
  };

  return (
    <Card id="management" className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-xl">
      <CardHeader className="space-y-4 border-b border-border/60 bg-[linear-gradient(145deg,var(--primary-100),var(--secondary-100))] px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">Catalogue management</CardTitle>
            <CardDescription>
              Add products, curate collections, maintain shades, and keep inventory current.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickStats.map((stat) => (
              <span
                key={stat.label}
                className="rounded-full border border-[var(--secondary-200)] bg-white/80 px-3 py-1 text-xs font-medium text-primary/70 shadow-sm"
              >
                {stat.label}:{" "}
                <span className="font-semibold text-primary">{stat.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--secondary-200)] bg-white/70 px-3 py-2 text-xs font-semibold text-primary/70">
          <span className="text-[11px] uppercase tracking-widest">Quick actions</span>
          <Button
            size="sm"
            className="rounded-full bg-primary px-4 text-xs text-primary-foreground shadow"
            onClick={() => {
              setTab("products");
              onCreateProduct?.();
            }}
          >
            Add product
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-secondary px-4 text-xs shadow-sm"
            onClick={() => setCollectionDialogOpen(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            New collection
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-secondary px-4 text-xs shadow-sm"
            onClick={() => setShadeDialogOpen(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            New shade
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full px-4 text-xs"
            onClick={() => openInventoryDialog(null)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adjust stock
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="rounded-full bg-muted/60 p-1">
              <TabsTrigger
                value="products"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Products
              </TabsTrigger>
              <TabsTrigger
                value="collections"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Collections
              </TabsTrigger>
              <TabsTrigger
                value="shades"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Shades
              </TabsTrigger>
              <TabsTrigger
                value="inventory"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Inventory
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Reviews
              </TabsTrigger>
            </TabsList>
            <div className="text-xs font-medium text-muted-foreground">
              {tab === "products" && `${products?.length ?? 0} products`}
              {tab === "collections" && `${collections?.length ?? 0} collections`}
              {tab === "shades" && `${shades?.length ?? 0} shades`}
              {tab === "inventory" && `${inventory?.length ?? 0} inventory records`}
              {tab === "reviews" &&
                `${Array.isArray(reviews) ? reviews.length : 0} reviews`}
            </div>
          </div>

          <TabsContent value="products">
            <ScrollArea className="h-[340px] rounded-2xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Collection</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : products.length ? (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.collection?.name ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(toNumber(product.basePrice))}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => navigate(`/dashboard/products/${product.id}/edit`)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => deleteProduct(product)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No products yet. Create your first product to populate the catalogue.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="collections">
            <ScrollArea className="h-[340px] rounded-2xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : collections.length ? (
                    collections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell className="font-medium">
                          {collection.name}
                        </TableCell>
                        <TableCell>{collection.slug}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteCollection(collection)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No collections have been created yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="shades">
            <ScrollArea className="h-[340px] rounded-2xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : shades.length ? (
                    shades.map((shade) => (
                      <TableRow key={shade.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border"
                              style={{ backgroundColor: shade.hex }}
                            />
                            {shade.name}
                          </span>
                        </TableCell>
                        <TableCell>{shade.slug}</TableCell>
                        <TableCell>{shade.product?.name ?? "Unassigned"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteShade(shade)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No shades yet. Create a shade to make assortments available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-primary">AR static shades</p>
                  <p className="text-xs text-muted-foreground">
                    Pulled from the AR experience file; managed here for reference only.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {AR_STATIC_SHADES.length} shades
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {AR_STATIC_SHADES.map((shade) => (
                  <div
                    key={shade.id}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-white px-3 py-2 shadow-sm"
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-border/70 shadow-sm flex items-center justify-center text-[10px] font-semibold"
                      style={{ backgroundColor: shade.color === "transparent" ? "#f7f7f7" : shade.color }}
                    >
                      {shade.color === "transparent" ? "Ø" : ""}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{shade.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shade.code ? `Code ${shade.code}` : "No code"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <ScrollArea className="h-[340px] rounded-2xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : inventory.length ? (
                    inventory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.product?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.quantity <= entry.lowStockThreshold
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {entry.quantity ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.lowStockThreshold ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openInventoryDialog(entry)}
                          >
                            Adjust stock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Inventory records will appear once products are created.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reviews">
            <ScrollArea className="h-[340px] rounded-2xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : Array.isArray(reviews) && reviews.length ? (
                    reviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="max-w-[200px]">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {review.user?.name ?? review.user?.email ?? "Unknown"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {review.title ?? review.comment ?? "No title"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <div className="flex flex-col">
                            <span className="font-medium">{review.product?.name ?? "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              {review.product?.slug ?? ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
                            <Star className="h-3.5 w-3.5" />
                            {review.rating}/5
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={review.status}
                            onValueChange={(value) => updateReviewStatus(review, value)}
                          >
                            <SelectTrigger className="h-9 w-[150px] rounded-full border border-border/60 bg-white text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PUBLISHED">Published</SelectItem>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {review.createdAt
                            ? format(
                                review.createdAt ? parseISO(review.createdAt) : new Date(),
                                "MMM d, yyyy"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReviewDialog(review)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteReview(review)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No reviews yet. Customers can submit feedback from the storefront.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CollectionDialog
        open={collectionDialogOpen}
        onClose={setCollectionDialogOpen}
        request={request}
        refresh={refresh}
      />
      <ShadeDialog
        open={shadeDialogOpen}
        onClose={setShadeDialogOpen}
        request={request}
        refresh={refresh}
        products={products}
      />
      <InventoryDialog
        open={inventoryDialogOpen}
        onClose={(open) => {
          setInventoryDialogOpen(open);
          if (!open) setInventoryTarget(null);
        }}
        entry={inventoryTarget}
        products={products}
        request={request}
        refresh={refresh}
      />
      <ReviewDialog
        open={reviewDialogOpen}
        review={selectedReview}
        onClose={setReviewDialogOpen}
        request={request}
        refresh={refresh}
        deleteReview={deleteReview}
      />
    </Card>
  );
}

function CollectionDialog({ open, onClose, request, refresh }) {
  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
    },
  });

  const [manualSlug, setManualSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameValue = watch("name");

  useEffect(() => {
    if (!manualSlug) {
      setValue("slug", slugify(nameValue));
    }
  }, [manualSlug, nameValue, setValue]);

  useEffect(() => {
    if (!open) {
      reset();
      setManualSlug(false);
      setSubmitting(false);
    }
  }, [open, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const response = await request(`${API_BASE}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          slug: values.slug,
          description: values.description || null,
          imageUrl: values.imageUrl || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to create collection");
      }

      toast.success("Collection created");
      refresh();
      onClose(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to create collection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>
            Collections help group products together for merchandising.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              required
              {...register("name", { required: true })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="collection-slug">Slug</Label>
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => setManualSlug((value) => !value)}
              >
                {manualSlug ? "Auto-generate" : "Edit manually"}
              </button>
            </div>
            <Input
              id="collection-slug"
              value={watch("slug")}
              onChange={(event) => {
                setManualSlug(true);
                setValue("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description</Label>
            <Textarea
              id="collection-description"
              rows={3}
              placeholder="Describe the focus of this collection"
              {...register("description")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-image">Hero image URL</Label>
            <Input
              id="collection-image"
              placeholder="https://"
              {...register("imageUrl")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Create collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShadeDialog({ open, onClose, request, refresh, products }) {
  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      name: "",
      slug: "",
      hexColor: "#FFFFFF",
      productId: "",
    },
  });

  const [manualSlug, setManualSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameValue = watch("name");

  useEffect(() => {
    if (!manualSlug) {
      setValue("slug", slugify(nameValue));
    }
  }, [manualSlug, nameValue, setValue]);

  useEffect(() => {
    if (!open) {
      reset();
      setManualSlug(false);
      setSubmitting(false);
    }
  }, [open, reset]);

  const onSubmit = async (values) => {
    if (!values.productId) {
      toast.error("Select a product to attach this shade");
      return;
    }
    setSubmitting(true);
    try {
      const response = await request(`${API_BASE}/shades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          slug: values.slug,
          productId: values.productId,
          hexColor: values.hexColor,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to create shade");
      }

      toast.success("Shade created");
      refresh();
      onClose(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to create shade");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New shade</DialogTitle>
          <DialogDescription>
            Define a new shade swatch and optionally link it to an existing product.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shade-name">Name</Label>
            <Input id="shade-name" required {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shade-slug">Slug</Label>
            <Input
              id="shade-slug"
              value={watch("slug")}
              onChange={(event) => {
                setManualSlug(true);
                setValue("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shade-hex">Hex colour</Label>
              <Input id="shade-hex" type="color" {...register("hexColor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shade-product">Product</Label>
              <Select
                value={watch("productId")}
                onValueChange={(value) => setValue("productId", value)}
              >
                <SelectTrigger id="shade-product">
                  <SelectValue placeholder="Choose product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save shade"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryDialog({ open, onClose, entry, products, request, refresh }) {
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      productId: "",
      quantity: 0,
      lowStockThreshold: 5,
    },
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (entry) {
      setValue("productId", entry.productId ?? "");
      setValue("quantity", entry.quantity ?? 0);
      setValue("lowStockThreshold", entry.lowStockThreshold ?? 5);
    } else {
      reset({ productId: "", quantity: 0, lowStockThreshold: 5 });
    }
  }, [entry, setValue, reset]);

  useEffect(() => {
    if (!open) {
      reset({ productId: "", quantity: 0, lowStockThreshold: 5 });
      setSubmitting(false);
    }
  }, [open, reset]);

  const onSubmit = async (values) => {
    if (!values.productId) {
      toast.error("Select a product to update");
      return;
    }
    setSubmitting(true);
    try {
      const response = await request(`${API_BASE}/inventory/${values.productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(values.quantity ?? 0),
          lowStockThreshold: Number(values.lowStockThreshold ?? 5),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to update inventory");
      }

      toast.success("Inventory updated");
      refresh();
      onClose(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update inventory");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Update the available quantity and low stock threshold.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inventory-product">Product</Label>
            <Select
              value={watch("productId")}
              onValueChange={(value) => setValue("productId", value)}
            >
              <SelectTrigger id="inventory-product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inventory-quantity">Quantity</Label>
              <Input
                id="inventory-quantity"
                type="number"
                min="0"
                {...register("quantity", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-threshold">Low stock threshold</Label>
              <Input
                id="inventory-threshold"
                type="number"
                min="0"
                {...register("lowStockThreshold", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ open, review, onClose, request, refresh, deleteReview }) {
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      rating: 5,
      title: "",
      comment: "",
      status: "PENDING",
      media: "",
    },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (review && open) {
      reset({
        rating: review.rating ?? 5,
        title: review.title ?? "",
        comment: review.comment ?? "",
        status: review.status ?? "PENDING",
        media: Array.isArray(review.media)
          ? review.media.map((item) => item.url).join("\n")
          : "",
      });
    } else if (!open) {
      reset({
        rating: 5,
        title: "",
        comment: "",
        status: "PENDING",
        media: "",
      });
      setSubmitting(false);
    }
  }, [review, open, reset]);

  const statusValue = watch("status");

  const onSubmit = async (values) => {
    if (!review?.id) return;
    setSubmitting(true);
    try {
      const payload = {
        rating: Number(values.rating ?? 0),
        title: values.title?.trim() || null,
        comment: values.comment?.trim() || null,
        status: values.status,
        media: values.media
          ? values.media
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((url) => ({ url }))
          : [],
      };

      const response = await request(`${API_BASE}/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to update review");
      }

      toast.success("Review updated");
      refresh();
      onClose(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (review) {
      deleteReview(review);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => onClose(value)}>
      <DialogContent className="max-w-2xl">
        {review ? (
          <>
            <DialogHeader>
              <DialogTitle>Manage review</DialogTitle>
              <DialogDescription>
                Moderate customer feedback, adjust content, and manage review media links.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-[1.3fr,1fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="review-rating">Rating</Label>
                    <Input
                      id="review-rating"
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      {...register("rating", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-status">Status</Label>
                    <Select
                      value={statusValue}
                      onValueChange={(value) => setValue("status", value, { shouldDirty: true })}
                    >
                      <SelectTrigger id="review-status" className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-title">Title</Label>
                  <Input id="review-title" placeholder="Short headline" {...register("title")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-comment">Comment</Label>
                  <Textarea
                    id="review-comment"
                    rows={6}
                    placeholder="Customer feedback..."
                    {...register("comment")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-media">Media URLs</Label>
                  <Textarea
                    id="review-media"
                    rows={4}
                    placeholder="One URL per line"
                    {...register("media")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports up to 6 images or videos. URLs should already be uploaded via the media manager.
                  </p>
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Customer</p>
                  <p className="text-sm text-foreground">
                    {review.user?.name ?? review.user?.email ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">{review.user?.email ?? ""}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Product</p>
                  <p className="text-sm text-foreground">{review.product?.name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">{review.product?.slug ?? ""}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Timeline</p>
                  <p className="text-xs text-muted-foreground">
                    Created{" "}
                    {review.createdAt
                      ? format(parseISO(review.createdAt), "MMM d, yyyy 'at' HH:mm")
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated{" "}
                    {review.updatedAt
                      ? format(parseISO(review.updatedAt), "MMM d, yyyy 'at' HH:mm")
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Attachments</p>
                  {Array.isArray(review.media) && review.media.length ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {review.media.map((item) => (
                        <li key={item.id}>
                          <a
                            href={item.url}
                            className="text-primary underline-offset-2 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No attachments supplied.</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onClose(false)}
                    disabled={submitting}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={submitting}
                  >
                    Delete review
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-4 p-4 text-sm text-muted-foreground">
            <p>Select a review from the management table to view details.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
