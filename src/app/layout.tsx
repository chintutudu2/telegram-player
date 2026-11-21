import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: "#091e22",
  colorScheme: "dark",
};

/**
 * Bare document. The app chrome (sidebar, header) lives in `(app)/layout.tsx`;
 * the sign-in and approval screens in `(auth)/` render without it.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink font-sans text-fg">{children}</body>
    </html>
  );
}
