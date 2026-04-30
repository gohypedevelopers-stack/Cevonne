import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";

import { AppSidebar } from "./app-sidebar";
import { ProductForm } from "./components/ProductDialog";
import { API_BASE } from "./utils";

const defaultRequest = (url, options) => fetch(url, options);

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { collections, refresh } = useDashboardData(true, request);
  const collectionOptions = Array.isArray(collections) ? collections : [];

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [error, setError] = useState(null);

  const handleCancel = () => navigate("/dashboard");
  const handleSuccess = () => navigate("/dashboard");

  useEffect(() => {
    document.body.classList.add("dashboard-form-lock");
    return () => document.body.classList.remove("dashboard-form-lock");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      if (!id) return;
      setLoadingProduct(true);
      setError(null);
      try {
        const response = await request(`${API_BASE}/products/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load product");
        }
        const data = await response.json();
        if (active) {
          setProduct(data);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err.message || "Unable to load product");
        }
      } finally {
        if (active) {
          setLoadingProduct(false);
        }
      }
    }

    loadProduct();
    return () => {
      active = false;
    };
  }, [id, request]);

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f7fb]">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-[#f5f7fb]/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#f5f7fb]/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <header className="flex flex-col gap-4 border-b border-border bg-white/95 px-4 py-5 shadow-sm md:flex-row md:items-center md:justify-between lg:px-6">
            <div className="flex items-center gap-3 text-primary">
              <div>
                <p className="font-serif text-3xl font-semibold leading-tight">Edit product</p>
                <p className="text-sm text-muted-foreground">
                  Update product descriptions, media, and pricing before republishing.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" className="rounded-full" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="product-edit-form"
                disabled={loadingProduct}
                className="rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow"
              >
                Save changes
              </Button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-0 pt-6 md:px-6">
            {loadingProduct ? (
              <Skeleton className="h-[480px] w-full rounded-3xl" />
            ) : error ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
                {error}
              </div>
            ) : product ? (
              <div className="flex flex-col gap-6">
                <ProductForm
                  mode="edit"
                  product={product}
                  productId={id}
                  collections={collectionOptions}
                  request={request}
                  refresh={refresh}
                  afterSubmit={handleSuccess}
                  formId="product-edit-form"
                  onClose={handleCancel}
                />
              </div>
            ) : null}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
