"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, User, Bell, Shield, CreditCard, LogOut,
  ChevronRight, Check, Eye, EyeOff, Smartphone, Lock,
  Trash2, AlertTriangle, Camera, ToggleLeft, ToggleRight
} from "lucide-react";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
        <Icon className="h-5 w-5 text-[var(--primary)]" />
      </div>
      <div>
        <h2 className="font-bold text-base text-[var(--foreground)]">{title}</h2>
        <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
    </div>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
        {sub && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");
  const [showPhone, setShowPhone] = useState(false);
  const [saved, setSaved] = useState(false);

  // Notification toggles
  const [notifWager, setNotifWager] = useState(true);
  const [notifPayout, setNotifPayout] = useState(true);
  const [notifDispute, setNotifDispute] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSMS, setNotifSMS] = useState(false);

  // Security toggles
  const [twoFA, setTwoFA] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // Privacy
  const [publicProfile, setPublicProfile] = useState(true);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);

  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const SECTIONS = ["Profile", "Notifications", "Security", "Payment", "Privacy", "Account"];
  const [activeSection, setActiveSection] = useState("Profile");

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/profile">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Settings</h1>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8">
        {/* Desktop title */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Settings</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage your account, notifications and security preferences.</p>
          </div>
          <Link href="/profile">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold hover:bg-[var(--muted)] transition-colors" style={{ boxShadow: "var(--shadow-sm)" }}>
              <ArrowLeft className="h-4 w-4" /> Back to Profile
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar nav */}
          <nav className="lg:col-span-1">
            <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              {SECTIONS.map((s, i) => {
                const icons = [User, Bell, Shield, CreditCard, Eye, Trash2];
                const Icon = icons[i];
                const isActive = activeSection === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSection(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all border-b border-[var(--border)] last:border-0 ${
                      isActive
                        ? "bg-[var(--muted)] text-[var(--primary)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {s}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main content */}
          <div className="lg:col-span-3 flex flex-col gap-6">

            {/* ── PROFILE ── */}
            {activeSection === "Profile" && (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <SectionHeader icon={User} title="Profile Information" subtitle="Update your name, email, and avatar." />

                {/* Avatar */}
                <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[var(--border)]">
                  <div className="relative">
                    <div
                      className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                      style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "0 4px 16px rgba(13,148,136,0.3)" }}
                    >
                      JD
                    </div>
                    <button className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-md hover:opacity-90 transition-opacity">
                      <Camera className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Profile Photo</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">PNG, JPG or GIF — max 5MB</p>
                    <button className="mt-2 text-xs font-semibold text-[var(--primary)] hover:underline">Upload new photo</button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Full Name</label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Email Address</label>
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                        placeholder="john@example.com"
                        type="email"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Phone Number</label>
                    <div className="flex gap-0 border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-[var(--primary)] transition-colors">
                      <span className="flex items-center px-4 text-sm font-semibold bg-[var(--muted)] border-r border-[var(--border)]">+234</span>
                      <div className="flex-1 relative">
                        <input
                          type={showPhone ? "text" : "password"}
                          defaultValue="8012345678"
                          className="w-full px-4 py-2.5 text-sm bg-white focus:outline-none"
                        />
                        <button
                          onClick={() => setShowPhone(!showPhone)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                        >
                          {showPhone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">Your phone number is used for login and verification only.</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Bio</label>
                    <textarea
                      className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
                      rows={3}
                      placeholder="Tell others a bit about yourself..."
                      defaultValue="I wager, therefore I am. 🎯"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveProfile}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}
                    >
                      {saved ? <><Check className="h-4 w-4" /> Saved!</> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeSection === "Notifications" && (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <SectionHeader icon={Bell} title="Notifications" subtitle="Choose what alerts you receive." />
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">In-App Alerts</p>
                  <SettingRow label="Wager Activity" sub="Updates on your active wagers">
                    <Toggle enabled={notifWager} onToggle={() => setNotifWager(!notifWager)} />
                  </SettingRow>
                  <SettingRow label="Payouts & Settlements" sub="When funds are released or received">
                    <Toggle enabled={notifPayout} onToggle={() => setNotifPayout(!notifPayout)} />
                  </SettingRow>
                  <SettingRow label="Disputes" sub="Updates on open dispute cases">
                    <Toggle enabled={notifDispute} onToggle={() => setNotifDispute(!notifDispute)} />
                  </SettingRow>
                  <SettingRow label="Promotions & News" sub="Platform updates and featured wagers">
                    <Toggle enabled={notifMarketing} onToggle={() => setNotifMarketing(!notifMarketing)} />
                  </SettingRow>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Delivery Channels</p>
                  <SettingRow label="Email Notifications" sub={email}>
                    <Toggle enabled={notifEmail} onToggle={() => setNotifEmail(!notifEmail)} />
                  </SettingRow>
                  <SettingRow label="SMS Alerts" sub="+234 801 234 5678">
                    <Toggle enabled={notifSMS} onToggle={() => setNotifSMS(!notifSMS)} />
                  </SettingRow>
                </div>
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeSection === "Security" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <SectionHeader icon={Shield} title="Security" subtitle="Keep your account safe." />
                  <SettingRow label="Two-Factor Authentication" sub="Require OTP on every login">
                    <Toggle enabled={twoFA} onToggle={() => setTwoFA(!twoFA)} />
                  </SettingRow>
                  <SettingRow label="Biometric Login" sub="Use fingerprint or Face ID">
                    <Toggle enabled={biometric} onToggle={() => setBiometric(!biometric)} />
                  </SettingRow>
                  <SettingRow label="Login Alerts" sub="Get notified of new sign-ins">
                    <Toggle enabled={loginAlerts} onToggle={() => setLoginAlerts(!loginAlerts)} />
                  </SettingRow>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Change Password</p>
                  <div className="flex flex-col gap-3">
                    {["Current Password", "New Password", "Confirm New Password"].map(label => (
                      <div key={label} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</label>
                        <input
                          type="password"
                          className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 12px rgba(13,148,136,0.25)" }}>
                        Update Password
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Active Sessions</p>
                  {[
                    { device: "iPhone 15 Pro", location: "Lagos, NG", time: "Now", current: true },
                    { device: "Chrome / macOS", location: "Abuja, NG", time: "2 hours ago", current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                          <Smartphone className="h-4 w-4 text-[var(--primary)]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {s.device}
                            {s.current && <span className="text-[10px] font-semibold bg-[var(--muted)] text-[var(--primary)] px-2 py-0.5 rounded-full">Current</span>}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">{s.location} · {s.time}</p>
                        </div>
                      </div>
                      {!s.current && (
                        <button className="text-xs font-semibold text-[var(--danger)] hover:underline">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PAYMENT ── */}
            {activeSection === "Payment" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <SectionHeader icon={CreditCard} title="Payment Methods" subtitle="Manage your linked bank accounts." />
                  <div className="flex flex-col gap-3 mb-4">
                    {[
                      { bank: "GTBank", number: "****4521", name: "John Doe", primary: true },
                      { bank: "Access Bank", number: "****8832", name: "John Doe", primary: false },
                    ].map((acc, i) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${acc.primary ? "border-[var(--primary)] bg-[var(--muted)]" : "border-[var(--border)]"}`}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white border border-[var(--border)] flex items-center justify-center shadow-sm">
                            <CreditCard className="h-5 w-5 text-[var(--primary)]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{acc.bank} — {acc.number}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">{acc.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {acc.primary
                            ? <span className="text-[10px] font-semibold text-[var(--primary)] bg-white border border-[var(--border)] px-2 py-0.5 rounded-full">Primary</span>
                            : <button className="text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">Set Primary</button>
                          }
                          <button className="text-xs font-semibold text-[var(--danger)] hover:underline">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-sm font-semibold text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2">
                    + Add New Bank Account
                  </button>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Withdrawal Limit</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Daily Limit</span>
                    <span className="text-sm font-bold text-[var(--primary)]">₦500,000</span>
                  </div>
                  <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "22%", background: "linear-gradient(90deg,#0d9488,#0f766e)" }} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">₦110,000 used today of ₦500,000 limit</p>
                </div>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {activeSection === "Privacy" && (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <SectionHeader icon={Eye} title="Privacy" subtitle="Control your visibility and data." />
                <SettingRow label="Public Profile" sub="Anyone can view your profile and stats">
                  <Toggle enabled={publicProfile} onToggle={() => setPublicProfile(!publicProfile)} />
                </SettingRow>
                <SettingRow label="Show on Leaderboard" sub="Appear in public rankings">
                  <Toggle enabled={showOnLeaderboard} onToggle={() => setShowOnLeaderboard(!showOnLeaderboard)} />
                </SettingRow>
                <SettingRow label="Activity Status" sub="Show when you were last active">
                  <Toggle enabled={false} onToggle={() => {}} />
                </SettingRow>
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Data & Export</p>
                  <button className="w-full py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-left px-4 flex items-center justify-between">
                    Download My Data <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                </div>
              </div>
            )}

            {/* ── ACCOUNT ── */}
            {activeSection === "Account" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <SectionHeader icon={Lock} title="Account" subtitle="Manage your account status." />
                  <SettingRow label="Member Since" sub="Account creation date">
                    <span className="text-sm font-semibold text-[var(--muted-foreground)]">Jan 2024</span>
                  </SettingRow>
                  <SettingRow label="Account Status" sub="Your current account standing">
                    <span className="text-xs font-semibold text-[var(--success)] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Active</span>
                  </SettingRow>
                  <SettingRow label="KYC Verification" sub="Identity verification status">
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">Pending</span>
                  </SettingRow>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Session</p>
                  <Link href="/auth/login">
                    <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors mb-3">
                      <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" /> Sign Out of All Devices
                    </button>
                  </Link>
                  <Link href="/auth/login">
                    <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                      <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" /> Sign Out
                    </button>
                  </Link>
                </div>

                <div className="bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[var(--danger)]/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-[var(--danger)]" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-[var(--danger)]">Danger Zone</h2>
                      <p className="text-xs text-[var(--muted-foreground)]">These actions are permanent and cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--danger)]/30 bg-white text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors">
                      <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Freeze Account Temporarily</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--danger)]/30 bg-white text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors">
                      <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete Account</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
