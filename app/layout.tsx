import "./globals.css";

import Providers from "@/components/providers";

export const metadata = {
  title: {
    default: "Cevonne",
    template: "%s | Cevonne",
  },
  description: "Cevonne storefront, profile center, and admin dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
