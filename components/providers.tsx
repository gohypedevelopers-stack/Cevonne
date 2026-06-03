"use client";

import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ShopProvider } from "@/context/ShopContext";
import ScrollToTop from "@/components/ScrollToTop";

export default function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <LanguageProvider>
        <ShopProvider>
          <AuthProvider>
            <ScrollToTop />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </ShopProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
