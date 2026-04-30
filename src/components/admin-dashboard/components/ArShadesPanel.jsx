import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_BASE } from "../utils";
import { Link2, Palette, Plus, Sparkles, Upload, Trash2, Edit } from "lucide-react";

export function ArShadesPanel({ shades = [], products = [], loading, request, refresh }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeShade, setActiveShade] = useState(null);
  const shadeList = useMemo(() => (Array.isArray(shades) ? shades : []), [shades]);
  const arReady = useMemo(() => shadeList.filter((shade) => shade?.arAssetUrl).length, [shadeList]);

  const handleCreate = () => {
    setActiveShade(null);
    setDialogOpen(true);
  };

  const handleEdit = (shade) => {
    setActiveShade(shade);
    setDialogOpen(true);
  };

  const handleDelete = async (shade) => {
    if (!shade?.id) return;
    if (!window.confirm(`Remove AR shade "${shade.name}"? This cannot be undone.`)) return;
    try {
      const response = await request(`${API_BASE}/shades/${shade.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to delete shade");
      }
      toast.success("Shade removed");
      refresh?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to delete shade");
    }
  };

  return (
    <Card id="shades" className="border-none bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AR Shades
          </CardTitle>
          <CardDescription>Upload AR-ready shades and manage their assets.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
            {arReady} ready / {shadeList.length} total
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            {products?.length ?? 0} products
          </Badge>
          <Button onClick={handleCreate} className="rounded-full bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" />
            Upload AR shade
          </Button>
        </div>
      </CardHeader>
      <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full border-dashed">
            <Palette className="mr-1 h-3 w-3 text-primary" />
            Hex + AR asset stored in Neon
          </Badge>
          <Badge variant="outline" className="rounded-full border-dashed">
            <Upload className="mr-1 h-3 w-3 text-primary" />
            Upload supports images, GLB/USDZ, ZIP (≤5MB)
          </Badge>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shade</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Hex</TableHead>
                <TableHead>AR Asset</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Loading shades...
                  </TableCell>
                </TableRow>
              ) : shadeList.length ? (
                shadeList.map((shade) => (
                  <TableRow key={shade.id}>
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full border"
                          style={{ backgroundColor: shade.hexColor }}
                        />
                        <span className="truncate">{shade.name}</span>
                      </div>
                      {shade.sku ? (
                        <p className="text-xs text-muted-foreground">SKU: {shade.sku}</p>
                      ) : null}
                      {shade.arCode ? (
                        <p className="text-xs text-muted-foreground">AR code: {shade.arCode}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{shade.product?.name ?? "Unassigned"}</TableCell>
                    <TableCell className="font-mono text-xs">{shade.hexColor}</TableCell>
                    <TableCell>
                      {shade.arAssetUrl ? (
                        <a
                          href={shade.arAssetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Link2 className="h-4 w-4" />
                          View
                        </a>
                      ) : (
                        <Badge variant="outline" className="rounded-full">
                          Missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {shade.arPreviewUrl ? (
                        <a
                          href={shade.arPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Link2 className="h-4 w-4" />
                          Preview
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(shade)}>
                          <Edit className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(shade)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No shades yet. Upload your first AR shade.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ArShadeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setActiveShade(null);
          setDialogOpen(open);
        }}
        shade={activeShade}
        products={products}
        request={request}
        refresh={refresh}
      />
    </Card>
  );
}

function ArShadeDialog({ open, onOpenChange, shade, products, request, refresh }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm({
    defaultValues: {
      name: "",
      productId: "",
      hexColor: "#B82229",
      sku: "",
      arAssetUrl: "",
      arPreviewUrl: "",
      arCode: "",
    },
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  useEffect(() => {
    if (shade && open) {
      reset({
        name: shade.name ?? "",
        productId: shade.productId ?? shade.product?.id ?? "",
        hexColor: shade.hexColor ?? "#B82229",
        sku: shade.sku ?? "",
        arAssetUrl: shade.arAssetUrl ?? "",
        arPreviewUrl: shade.arPreviewUrl ?? "",
        arCode: shade.arCode ?? "",
      });
    } else if (!open) {
      reset({
        name: "",
        productId: "",
        hexColor: "#B82229",
        sku: "",
        arAssetUrl: "",
        arPreviewUrl: "",
        arCode: "",
      });
      setSaving(false);
      setUploadingAsset(false);
      setUploadingPreview(false);
    }
  }, [shade, open, reset]);

  const uploadFile = async (file, field) => {
    if (!file) return;
    const isPreview = field === "arPreviewUrl";
    try {
      isPreview ? setUploadingPreview(true) : setUploadingAsset(true);
      const formData = new FormData();
      formData.append("image", file);
      const response = await request(`${API_BASE}/uploads`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Upload failed");
      }
      const body = await response.json();
      setValue(field, body.url);
      toast.success("File uploaded");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Upload failed");
    } finally {
      isPreview ? setUploadingPreview(false) : setUploadingAsset(false);
    }
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name?.trim(),
        productId: values.productId || undefined,
        hexColor: values.hexColor || "#B82229",
        sku: values.sku?.trim() || undefined,
        arAssetUrl: values.arAssetUrl?.trim() || null,
        arPreviewUrl: values.arPreviewUrl?.trim() || null,
        arCode: values.arCode?.trim() || null,
      };

      if (!payload.productId) {
        toast.error("Link this AR shade to a product.");
        setSaving(false);
        return;
      }

      const url = shade?.id ? `${API_BASE}/shades/${shade.id}` : `${API_BASE}/shades`;
      const response = await request(url, {
        method: shade?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to save shade");
      }

      toast.success(shade?.id ? "Shade updated" : "Shade created");
      refresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to save shade");
    } finally {
      setSaving(false);
    }
  };

  const shadeName = watch("name");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{shade ? "Edit AR shade" : "Upload AR shade"}</DialogTitle>
          <DialogDescription>
            Store AR shade assets alongside their catalog shade in Neon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ar-name">Name</Label>
              <Input id="ar-name" required {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-product">Product</Label>
              <Select
                value={watch("productId")}
                onValueChange={(value) => setValue("productId", value)}
              >
                <SelectTrigger id="ar-product">
                  <SelectValue placeholder="Link to product" />
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ar-hex">Hex colour</Label>
              <Input id="ar-hex" type="color" {...register("hexColor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-sku">SKU</Label>
              <Input id="ar-sku" placeholder="Optional" {...register("sku")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-code">AR code</Label>
              <Input id="ar-code" placeholder="E.g. 601" {...register("arCode")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <Label htmlFor="ar-asset">AR asset URL</Label>
              <div className="flex gap-2">
                <Input id="ar-asset" placeholder="https://..." {...register("arAssetUrl")} />
                <Button
                  type="button"
                  variant="secondary"
                  className="whitespace-nowrap"
                  disabled={uploadingAsset}
                  onClick={(event) => {
                    event.preventDefault();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".glb,.usdz,.zip,.png,.jpg,.jpeg,.webp";
                    input.onchange = (e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file, "arAssetUrl");
                    };
                    input.click();
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingAsset ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Accepts GLB/USDZ or image assets up to 5MB. Stored via uploads endpoint.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-preview">Preview image URL</Label>
              <Input id="ar-preview" placeholder="https://..." {...register("arPreviewUrl")} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                disabled={uploadingPreview}
                onClick={(event) => {
                  event.preventDefault();
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".png,.jpg,.jpeg,.webp";
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file, "arPreviewUrl");
                  };
                  input.click();
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingPreview ? "Uploading..." : "Upload preview"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <div className="flex-1 text-left text-xs text-muted-foreground">
              {shadeName ? `Saving "${shadeName}" to Neon.` : "Shade will be stored in Neon DB."}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : shade ? "Save changes" : "Create shade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
