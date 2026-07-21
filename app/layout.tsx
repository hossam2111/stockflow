import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "StockFlow — إدارة مخزون الاشتراكات",
  description: "منصة آمنة لإدارة المخزون وتتبع سحوبات الموظفين.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={thmanyah.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
