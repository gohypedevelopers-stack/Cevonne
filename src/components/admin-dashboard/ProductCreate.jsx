import { useNavigate } from "react-router-dom";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useEffect } from "react";

import { AppSidebar } from "./app-sidebar";
import { ProductForm } from "./components/ProductDialog";

const defaultRequest = (url, options) => fetch(url, options);

export default function ProductCreate() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { collections, refresh, loading } = useDashboardData(true, request);
  const collectionOptions = Array.isArray(collections) ? collections : [];

  useEffect(() => {
    document.body.classList.add("dashboard-form-lock");
    return () => document.body.classList.remove("dashboard-form-lock");
  }, []);

  const handleCancel = () => navigate("/dashboard");
  const handleSuccess = () => navigate("/dashboard/products");

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f7fb]">
          <header className="flex flex-col gap-4 border-b border-border bg-white/95 px-4 py-5 shadow-sm md:flex-row md:items-center md:justify-between lg:px-6">
            <div className="flex items-center gap-3 text-primary">
              <SidebarTrigger className="md:hidden rounded-full border border-primary/20 bg-primary/10 p-2 text-primary shadow-sm" />
              <div>
                <p className="font-serif text-3xl font-semibold leading-tight">Create product</p>
                <p className="text-sm text-muted-foreground">
                  Provide full product details, upload media, and publish to the catalogue.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="product-create-form"
                disabled={loading}
                className="rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow"
              >
                Save product
              </Button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-0 pt-6 md:px-6">
            <div className="flex flex-col gap-6">
              <ProductForm
                collections={collectionOptions}
                request={request}
                refresh={refresh}
                afterSubmit={handleSuccess}
                formId="product-create-form"
                onClose={handleCancel}
              />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
