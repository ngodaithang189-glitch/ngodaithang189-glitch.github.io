import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

const font = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "DU HỌC TH – CRM & Management",
  description: "Hệ thống quản trị tuyển sinh, hồ sơ, tài chính nội bộ DU HỌC TH (bản demo)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2563eb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
