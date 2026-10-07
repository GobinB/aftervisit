import Link from "next/link";
import { COPY } from "@/lib/copy";
import { SOURCE_URL } from "./AppBar";

export function Footer() {
  return (
    <footer className="no-print mt-16 bg-primary-900 text-white/85">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">{COPY.notMedicalAdvice}</p>
        <nav className="flex gap-5" aria-label="Footer">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <a href={SOURCE_URL} className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            Source code
          </a>
        </nav>
      </div>
    </footer>
  );
}
