"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Flame, Wallet,
  User, TrendingUp, Bell, Plus, ChevronDown, Settings
} from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/explore",     label: "Explore",    icon: Flame           },
  { href: "/wallet",      label: "Wallet",     icon: Wallet          },
  { href: "/leaderboard", label: "Rankings",   icon: TrendingUp      },
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

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
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
      } catch (err) {
        console.error("Failed to load user profile in nav", err);
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

  return (
    <>
      {/* ── DESKTOP TOP NAV (md+) ─────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-[var(--border)] items-center gap-0">
        {/* Brand */}
        <Link href="/" className="flex items-center px-6 py-4 border-r border-[var(--border)] shrink-0">
          <img src="/logo-full-colored.png" alt="Vouchit Logo" className="h-10 w-auto object-contain" />
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
                {initials}
              </div>
              <span className="hidden lg:block text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">{name}</span>
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
