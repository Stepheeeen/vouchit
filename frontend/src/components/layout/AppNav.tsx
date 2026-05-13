"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck, LayoutDashboard, Flame, Wallet,
  User, TrendingUp, Bell, Plus, ChevronDown, Settings
} from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/explore",     label: "Explore",    icon: Flame           },
  { href: "/wallet",      label: "Wallet",     icon: Wallet          },
  { href: "/leaderboard", label: "Rankings",   icon: TrendingUp      },
  { href: "/profile",     label: "Profile",    icon: User            },
];

export default function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── DESKTOP TOP NAV (md+) ─────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-[var(--border)] items-center gap-0">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 px-6 py-4 border-r border-[var(--border)] shrink-0">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)] flex items-center justify-center shadow-sm">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">Vouchit</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 md:px-2 lg:px-4 flex-1 overflow-x-auto no-scrollbar">
          {NAV_LINKS.filter(item => item.href !== "/profile").map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 md:px-2.5 lg:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-[var(--muted)] text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">{item.label}</span>
                {active && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)] shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 md:px-3 lg:px-6 py-3 border-l border-[var(--border)] shrink-0">
          {/* Create CTA */}
          <Link href="/vouch/create">
            <button
              className="flex items-center justify-center gap-1.5 w-9 h-9 lg:w-auto lg:px-3.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
              style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 2px 8px rgba(13,148,136,0.3)" }}
            >
              <Plus className="h-4 w-4 lg:h-3.5 lg:w-3.5 shrink-0" />
              <span className="hidden lg:inline">New</span>
            </button>
          </Link>

          {/* Notification bell */}
          <button className="relative h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors shrink-0">
            <Bell className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse-red" />
          </button>

          {/* Settings icon */}
          <Link href="/settings">
            <button className="h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors shrink-0">
              <Settings className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
            </button>
          </Link>

          {/* Avatar dropdown */}
          <Link href="/profile">
            <button className="flex items-center gap-2 lg:pl-2 lg:pr-3 lg:py-1.5 md:p-1 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)] transition-colors shrink-0">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: "linear-gradient(135deg,#0d9488,#115e59)" }}
              >
                JD
              </div>
              <span className="hidden lg:block text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">John D.</span>
              <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
            </button>
          </Link>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV (< md) ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-md border-t border-[var(--border)]">
        <div className="flex justify-around items-center px-2 py-2">
          {NAV_LINKS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 py-1 px-3 min-w-[52px]"
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
                  active ? "bg-[var(--muted)]" : "bg-transparent"
                }`}>
                  <item.icon className={`h-5 w-5 ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                </div>
                <span className={`text-[9px] font-semibold leading-none ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
