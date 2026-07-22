import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

const thmanyah = localFont({
  variable: "--font-thmanyah",
  display: "swap",
  src: [
    { path: "../public/fonts/thmanyahsans-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/thmanyahsans-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/thmanyahsans-Bold.otf", weight: "700", style: "normal" },
    { path: "../public/fonts/thmanyahsans-Black.otf", weight: "900", style: "normal" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "StockFlow — إدارة مخزون الاشتراكات";
  const description = "منصة آمنة لإدارة المخزون وتتبع سحوبات الموظفين.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, type: "website", url: origin, images: [{ url: `${origin}/og.png`, width: 1734, height: 907, alt: "StockFlow dashboard" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={thmanyah.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
