import "./globals.css";

import Script from "next/script";

import Providers from "@/components/providers";

export const metadata = {
  title: {
    default: "Cevonne",
    template: "%s | Cevonne",
  },
  description: "Cevonne storefront, profile center, and admin dashboard.",
  verification: {
    google: "KTDG2CXUX9YnQyBA0_6OXBKxtdmXt3FWffYwTgdNDKs",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LC2F8MD0H8"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LC2F8MD0H8');
          `}
        </Script>
      </body>
    </html>
  );
}
