import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "AfterVisit: a care handoff after every visit", template: "%s · AfterVisit" },
  description:
    "Turn an after-visit summary into a short, confirmed care handoff and share it with the people who help. No accounts. Links expire in 30 days. Open source.",
  openGraph: { siteName: "AfterVisit", type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#163A6B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
