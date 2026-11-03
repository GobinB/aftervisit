import type { Metadata, Viewport } from "next";
import { Lexend, Newsreader } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Body: Lexend, designed to improve reading fluency; large x-height and a plain zero (no "0" vs "Ø" confusion in doses).
const sans = Lexend({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Headlines: Newsreader, an editorial serif, so a handoff reads like a careful note.
const display = Newsreader({ subsets: ["latin"], variable: "--font-serif", axes: ["opsz"], style: ["normal", "italic"], display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "AfterVisit: one shared care page for the person you look after", template: "%s · AfterVisit" },
  description:
    "One shared care page for the person you look after. Family, home aides and the day program each get their own private link. Free, private by design and nonprofit.",
  openGraph: { siteName: "AfterVisit", type: "website" },
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
      </body>
    </html>
  );
}
