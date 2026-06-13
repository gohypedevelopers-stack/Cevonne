"use client";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { Product } from "@/types/product";

import { AppSidebar } from "./app-sidebar";
import { ProductEditorPage, ProductEditorSkeleton } from "./components/ProductEditorPage";
import { API_BASE } from "./utils";

const defaultRequest = (url, options) => fetch(url, options);

export default function ProductEdit() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { collections, refresh } = useDashboardData(true, request);
  const collectionOptions = Array.isArray(collections) ? collections : [];

  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setError(err instanceof Error ? err.message : "Unable to load product");
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
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f8f3ef]">
          {loadingProduct ? (
            <ProductEditorSkeleton />
          ) : error ? (
            <div className="flex min-h-full items-center justify-center bg-[#f8f3ef] px-6 py-12">
              <div className="max-w-md rounded-2xl border border-destructive/20 bg-white p-6 shadow-sm">
                <p className="font-serif text-2xl text-[#4b0d4b]">Unable to load product</p>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-[#fbf7f4]"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4b0d4b] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#3a083a]"
                    onClick={handleCancel}
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          ) : product ? (
            <ProductEditorPage
              mode="edit"
              product={product}
              productId={id}
              collections={collectionOptions}
              request={request}
              refresh={refresh}
              onCancel={handleCancel}
              onSuccess={handleSuccess}
              mobileMenuTrigger={<SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />}
            />
          ) : null}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
