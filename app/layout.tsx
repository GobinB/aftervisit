import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Geist } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Body: Geist, a compact sans with a plain zero, so doses read "20 mg", never "2Ø mg".
const sans = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Titles: DM Serif Display, one weight, used only for page and section titles.
const display = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-sans-display", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "All Hands Care: one shared care page for the person you look after", template: "%s · All Hands Care" },
  description:
    "One shared care page for the person you look after. Family, home aides and the day program each get their own private link. Free, private by design and nonprofit.",
  applicationName: "All Hands Care",
  appleWebApp: { capable: true, title: "All Hands Care", statusBarStyle: "default" },
  openGraph: { siteName: "All Hands Care", type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
