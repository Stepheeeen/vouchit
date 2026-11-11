import Link from "next/link";
import { Compass, Home } from "lucide-react";

/**
 * Branded 404.
 *
 * Without this file Next serves its built-in default — an unstyled black
 * page reading "404 | This page could not be found", rendered inside the
 * signed-in app chrome, which looks exactly like the site has crashed.
 */
export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
        <Compass className="h-8 w-8 text-[var(--primary)]" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          The link may be wrong, or the wager it pointed to has been settled or removed.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}
        >
          <Home className="h-4 w-4" /> Go to dashboard
        </Link>
        <Link
          href="/explore"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold border border-[var(--border)] bg-white hover:bg-[var(--muted)] transition-colors"
        >
          Browse open wagers
        </Link>
      </div>
    </main>
  );
}
