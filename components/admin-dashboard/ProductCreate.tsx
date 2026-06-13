"use client";

import { useNavigate } from "@/lib/router";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useEffect } from "react";

import { AppSidebar } from "./app-sidebar";
import { ProductEditorPage } from "./components/ProductEditorPage";

const defaultRequest = (url, options) => fetch(url, options);

export default function ProductCreate() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { collections, refresh } = useDashboardData(true, request);
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
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f8f3ef]">
          <ProductEditorPage
            mode="create"
            collections={collectionOptions}
            request={request}
            refresh={refresh}
            onCancel={handleCancel}
            onSuccess={handleSuccess}
            mobileMenuTrigger={<SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
