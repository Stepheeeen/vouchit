import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell for the legal pages.
 *
 * These did not exist. The signup form made people tick "I agree to the Terms
 * of Service" where that phrase was plain text with no link and no document
 * behind it — an agreement to nothing, on a product that moves real money.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-white/80 backdrop-blur-md">
        <Link href="/" className="flex items-center">
          <img src="/logo-full-colored.png" alt="Vouchit" className="h-8 w-auto object-contain" />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold text-[var(--muted-foreground)]">
          <Link href="/legal/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
          <Link href="/legal/responsible-play" className="hover:text-[var(--foreground)] transition-colors">Responsible Play</Link>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <article className="prose-vouchit flex flex-col gap-6 text-[var(--foreground)]">{children}</article>
      </main>

      <footer className="w-full py-8 px-6 text-center text-[var(--muted-foreground)] text-xs border-t border-[var(--border)]">
        <p>&copy; {new Date().getFullYear()} Vouchit. 18+ only.</p>
      </footer>
    </div>
  );
}
