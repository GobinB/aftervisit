import type { Metadata } from "next";
import { AppBar } from "@/components/AppBar";
import { ReaderProvider } from "@/components/intake/ReaderContext";
import { providerDisclosure } from "@/lib/extract/provider";

export const metadata: Metadata = { title: "Scan after-visit summary", robots: { index: false, follow: false } };
// Which reader is on is set on the server at run time, so the scan page says the right thing.
export const dynamic = "force-dynamic";

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBar minimal />
      <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-32">
        <ReaderProvider readsPages={providerDisclosure().readsPages}>{children}</ReaderProvider>
      </main>
    </>
  );
}
