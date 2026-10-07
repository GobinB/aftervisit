import Link from "next/link";
import { AppBar } from "@/components/AppBar";

export default function NotFound() {
  return (
    <>
      <AppBar />
      <main id="main" className="mx-auto max-w-[640px] px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">We could not find that page</h1>
        <p className="mt-2 text-ink-500">Check the link, or start from the home page.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-primary-700 underline underline-offset-4">
          Go to AfterVisit
        </Link>
      </main>
    </>
  );
}
