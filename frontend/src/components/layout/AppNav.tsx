"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Flame, Wallet,
  User, TrendingUp, Bell, Plus, ChevronDown, Settings, Shield, Link2
} from "lucide-react";
import { useWeb3 } from "@/context/Web3Context";

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/explore",     label: "Explore",    icon: Flame           },
  { href: "/wallet",      label: "Wallet",     icon: Wallet          },
  { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp     },
  { href: "/profile",     label: "Profile",    icon: User            },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  // "unknown" until the profile call resolves. The nav used to render the
  // full signed-in chrome — Dashboard, Wallet, Connect Wallet, "+ New", the
  // notification bell and an avatar reading "..." — to anyone who opened a
  // public page logged out.
  const [authState, setAuthState] = useState<"unknown" | "in" | "out">("unknown");
  const { account, isConnected, isConnecting, linkWalletToBackend } = useWeb3();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const { notificationsApi } = await import("@/lib/api");
      const list = await notificationsApi.getAll();
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.readAt).length);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { notificationsApi } = await import("@/lib/api");
      await notificationsApi.markAllRead();
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const { notificationsApi } = await import("@/lib/api");
      await notificationsApi.markRead(id);
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi } = await import("@/lib/api");
        const profile = await userApi.getProfile();
        setUser(profile);
        setAuthState("in");
      } catch {
        // A 401 here is the normal case for a signed-out visitor on a public
        // page, not an error worth logging.
        setAuthState("out");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const name = user ? (user.displayName || user.email.split("@")[0]) : "...";
  const initials = user ? getInitials(name) : "..";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const links = [...NAV_LINKS];
  if (user && user.role === "ADMIN") {
    const profileIdx = links.findIndex((l) => l.href === "/profile");
    if (profileIdx !== -1) {
      links.splice(profileIdx, 0, { href: "/admin/disputes", label: "Admin", icon: Shield });
    } else {
      links.push({ href: "/admin/disputes", label: "Admin", icon: Shield });
    }
  }

  if (authState === "out") {
    return (
      <header className="fixed top-0 left-0 right-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between px-4 md:px-6 py-3">
        <Link href="/" className="flex items-center">
          <img src="/logo-full-colored.png" alt="Vouchit" className="h-9 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="hidden sm:inline text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/auth/login"
            className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/auth/login?mode=signup"
            className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}
          >
            Sign up
          </Link>
        </div>
      </header>
    );
  }

  return (
    <>
      {/* ── DESKTOP TOP NAV (md+) ─────────────────────────── */}
      {/*
        The bar carried five separate controls on the right — wallet, New,
        bell, a settings gear and the avatar — with hard vertical rules
        boxing off the brand and the actions. It read as a crowded toolbar.
        Settings now lives inside the account menu where it belongs, the
        rules are gone, and the links sit in the middle so the two ends
        stay light.
      */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-30 w-full h-[var(--desktop-nav-h)] bg-white/80 backdrop-blur-xl border-b border-[var(--border)] items-center px-5 lg:px-7 gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logo-full-colored.png" alt="Vouchit Logo" className="h-8 w-auto object-contain" />
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 flex-1 justify-center overflow-x-auto no-scrollbar">
          {links.filter(item => item.href !== "/profile").map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 px-3 lg:px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-[var(--muted)] text-[var(--foreground)] font-semibold"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                }`}
              >
                {/* The label was rendered twice, once per breakpoint, with the
                    same text — and an active pill plus a separate active dot
                    said the same thing twice over. */}
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Web3 Wallet Connect — `user.web3Address` is the wallet linked to this
              account server-side and survives reload; `isConnected` only reflects
              whether the injected provider currently grants live permission in
              *this* browser session. Show the linked address first so the badge
              doesn't wrongly flip to "Connect Wallet" on every reload. */}
          {(() => {
            const linkedAddress: string | null = user?.web3Address || null;
            const displayAddress = account || linkedAddress;
            const isLinked = !!linkedAddress;
            return (
              <button
                onClick={linkWalletToBackend}
                disabled={isConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] bg-white hover:bg-[var(--muted)] transition-colors shrink-0 cursor-pointer"
                title={
                  isLinked
                    ? `Linked wallet: ${linkedAddress}${isConnected ? " (connected)" : " — reconnect for signing"}`
                    : "Connect Web3 Wallet"
                }
              >
                <Link2 className={`h-3.5 w-3.5 ${isLinked ? "text-emerald-500" : isConnected ? "text-amber-500" : "text-slate-400"}`} />
                <span className="hidden lg:inline text-[var(--foreground)]">
                  {displayAddress
                    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                    : isConnecting
                    ? "Connecting..."
                    : "Connect Wallet"}
                </span>
              </button>
            );
          })()}

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
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors shrink-0 cursor-pointer"
            >
              <Bell className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white animate-pulse" />
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-50/50">
                    <span className="font-bold text-sm text-[var(--foreground)]">Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🔔</span>
                        <p className="text-xs text-[var(--muted-foreground)] font-semibold">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => {
                            if (!n.readAt) handleMarkRead(n.id);
                          }}
                          className={`p-3.5 flex gap-3 text-left transition-colors cursor-pointer ${
                            !n.readAt ? "bg-[var(--primary)]/[0.03] hover:bg-[var(--primary)]/[0.05]" : "hover:bg-neutral-50"
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                            n.type === 'WAGER_CREATED' ? 'bg-blue-50 text-blue-600' :
                            n.type === 'WAGER_JOINED' ? 'bg-purple-50 text-purple-600' :
                            n.type === 'DISPUTE_OPENED' ? 'bg-red-50 text-red-600' :
                            'bg-emerald-50 text-emerald-600'
                          }`}>
                            {n.type === 'WAGER_CREATED' ? '➕' :
                             n.type === 'WAGER_JOINED' ? '🤝' :
                             n.type === 'DISPUTE_OPENED' ? '🚨' :
                             '🏆'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-relaxed ${!n.readAt ? "font-bold text-[var(--foreground)]" : "text-neutral-600"}`}>
                              {n.message}
                            </p>
                            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                              {new Date(n.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          {!n.readAt && (
                            <span className="h-2 w-2 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Account menu. The avatar had a chevron suggesting a dropdown but
              was only a link to /profile, while Settings sat beside it as a
              fifth separate control. One menu now holds both. */}
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              aria-haspopup="menu"
              aria-expanded={showAccountMenu}
              className="flex items-center gap-2 pl-1 pr-1 lg:pr-2.5 py-1 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--muted)] transition-colors shrink-0"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: "linear-gradient(135deg,#0d9488,#115e59)" }}
              >
                {initials}
              </div>
              <span className="hidden lg:block text-xs font-semibold text-[var(--foreground)] whitespace-nowrap max-w-[9rem] truncate">
                {name}
              </span>
              <ChevronDown
                className={`hidden lg:block h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform ${showAccountMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showAccountMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden py-1"
                >
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    {user?.email && (
                      <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</p>
                    )}
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setShowAccountMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    <User className="h-4 w-4 text-[var(--muted-foreground)]" /> Profile
                  </Link>
                  <Link
                    href="/wallet"
                    onClick={() => setShowAccountMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    <Wallet className="h-4 w-4 text-[var(--muted-foreground)]" /> Wallet
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setShowAccountMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    <Settings className="h-4 w-4 text-[var(--muted-foreground)]" /> Settings
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── MOBILE TOP BAR (< md) ────────────────────────── */}
      {/* There was no header at all on mobile, so notifications, settings and
          the wallet connect — all of which live in the desktop header — were
          simply unreachable on a phone. The bottom bar only carries the five
          primary routes. */}
      <header className="md:hidden sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between px-4 py-2.5">
        <Link href="/dashboard" className="flex items-center">
          <img src="/logo-full-colored.png" alt="Vouchit" className="h-7 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={linkWalletToBackend}
            disabled={isConnecting}
            aria-label={user?.web3Address ? "Wallet linked" : "Connect wallet"}
            className="h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center"
          >
            <Link2
              className={`h-4 w-4 ${
                user?.web3Address ? "text-emerald-500" : isConnected ? "text-amber-500" : "text-slate-400"
              }`}
            />
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center"
          >
            <Bell className="h-4 w-4 text-[var(--muted-foreground)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-[var(--danger)] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <Link href="/settings" aria-label="Settings">
            <span className="h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Settings className="h-4 w-4 text-[var(--muted-foreground)]" />
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile notifications sheet. The desktop dropdown lives inside the
          `hidden md:flex` header, so on a phone the bell would toggle state
          and show nothing at all. */}
      {showNotifications && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <button
            aria-label="Close notifications"
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowNotifications(false)}
          />
          <div className="relative mt-auto bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-semibold text-[var(--primary)]">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto divide-y divide-[var(--border)]">
              {notifications.length === 0 ? (
                <p className="p-8 text-center text-xs text-[var(--muted-foreground)] font-semibold">
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.readAt) handleMarkRead(n.id);
                    }}
                    className={`w-full p-4 text-left ${!n.readAt ? "bg-[var(--primary)]/[0.04]" : ""}`}
                  >
                    <p className={`text-xs leading-relaxed ${!n.readAt ? "font-bold" : "text-neutral-600"}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                      {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="p-4 border-t border-[var(--border)] text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV (< md) ─────────────────────── */}
      {/* Height is pinned to --mobile-nav-h so bottom-anchored page elements
          can offset themselves by exactly this and stop being covered. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[var(--mobile-nav-h)] bg-white/90 backdrop-blur-md border-t border-[var(--border)]">
        <div className="flex justify-around items-center px-2 py-2">
          {links.map((item) => {
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
