import type { Metadata, Viewport } from "next";
import { Lexend, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Body: Lexend, designed to improve reading fluency; large x-height and a plain zero (no "0" vs "Ø" confusion in doses).
const sans = Lexend({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Headlines: Newsreader, an editorial serif, so a handoff reads like a careful note.
const display = Newsreader({ subsets: ["latin"], variable: "--font-serif", axes: ["opsz"], style: ["normal", "italic"], display: "swap" });

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
  themeColor: "#F8F5EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
