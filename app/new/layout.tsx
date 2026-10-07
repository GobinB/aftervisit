import type { Metadata } from "next";
import { AppBar } from "@/components/AppBar";

export const metadata: Metadata = { title: "New handoff", robots: { index: false, follow: false } };

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBar />
      <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-32">
        {children}
      </main>
    </>
  );
}
