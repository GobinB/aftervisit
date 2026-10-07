import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[640px] flex-1 px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">We could not find that page</h1>
        <p className="mt-2 text-ink-500">Check the link, or start from the home page.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-primary-700 underline underline-offset-4">
          Go to AfterVisit
        </Link>
      </main>
    </PageShell>
  );
}
