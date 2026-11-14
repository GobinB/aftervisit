import type { Metadata } from "next";
import { AppBar } from "@/components/AppBar";
import { ReaderProvider } from "@/components/intake/ReaderContext";
import { getActor } from "@/lib/auth";
import { providerDisclosure } from "@/lib/extract/provider";

export const metadata: Metadata = { title: "Scan after-visit summary", robots: { index: false, follow: false } };
// Which reader is on is set on the server at run time, so the scan page says the right thing.
export const dynamic = "force-dynamic";

export default async function NewLayout({ children }: { children: React.ReactNode }) {
  // OpenAI reads only for a signed-in caregiver (see app/api/extract); anyone else's photos are read on the phone.
  const readsPages = providerDisclosure().readsPages && (await getActor())?.kind === "caregiver";
  return (
    <>
      <AppBar minimal />
      <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-32">
        <ReaderProvider readsPages={readsPages}>{children}</ReaderProvider>
      </main>
    </>
  );
}
