"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Bell, Shield, CreditCard, LogOut,
  ChevronRight, Check, Eye, EyeOff, Smartphone, Lock,
  Trash2, AlertTriangle, Camera, Loader2
} from "lucide-react";
import Cookies from "js-cookie";
import { NIGERIAN_BANKS } from "../wallet/page";

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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Profile Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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

  // Bank Account State
  const [bankAccount, setBankAccount] = useState<{ accountName: string; accountNumber: string; bankName: string; bankCode?: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState("");

  // KYC Verification State
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycType, setKycType] = useState<"BVN" | "NIN">("BVN");
  const [kycNumber, setKycNumber] = useState("");
  const [isVerifyingKyc, setIsVerifyingKyc] = useState(false);
  const [kycError, setKycError] = useState("");

  useEffect(() => {
    const resolve = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setIsResolving(true);
        setResolutionError("");
        setAccountName("");
        try {
          const { walletApi } = await import("@/lib/api");
          const res = await walletApi.resolveBank(accountNumber, bankCode);
          setAccountName(res.accountName);
        } catch (err: any) {
          setResolutionError(err.message || "Failed to resolve bank account.");
        } finally {
          setIsResolving(false);
        }
      } else {
        setAccountName("");
        setResolutionError("");
      }
    };
    resolve();
  }, [accountNumber, bankCode]);

  useEffect(() => {
    if (!showBankModal) {
      setBankName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
      setResolutionError("");
    }
  }, [showBankModal]);

  useEffect(() => {
    if (!showKycModal) {
      setKycNumber("");
      setKycError("");
    }
  }, [showKycModal]);

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi } = await import("@/lib/api");
        const profile = await userApi.getProfile();
        setUser(profile);

        try {
          const { walletApi } = await import("@/lib/api");
          const bank = await walletApi.getLinkedBank();
          if (bank) {
            setBankAccount(bank);
          }
        } catch (e) {
          console.error(e);
        }
        setName(profile.displayName || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setBio(profile.bio || "");

        // Load local toggles
        setNotifWager(localStorage.getItem("notifWager") !== "false");
        setNotifPayout(localStorage.getItem("notifPayout") !== "false");
        setNotifDispute(localStorage.getItem("notifDispute") !== "false");
        setNotifMarketing(localStorage.getItem("notifMarketing") === "true");
        setNotifEmail(localStorage.getItem("notifEmail") !== "false");
        setNotifSMS(localStorage.getItem("notifSMS") === "true");
        setTwoFA(localStorage.getItem("twoFA") === "true");
        setBiometric(localStorage.getItem("biometric") === "true");
        setLoginAlerts(localStorage.getItem("loginAlerts") !== "false");
        setPublicProfile(localStorage.getItem("publicProfile") !== "false");
        setShowOnLeaderboard(localStorage.getItem("showOnLeaderboard") !== "false");
      } catch {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleSaveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileError("");
    try {
      const { userApi } = await import("@/lib/api");
      await userApi.updateProfile({ displayName: name, phone, bio });
      setSaved(true);
      const { toast } = await import("sonner");
      toast.success("Profile updated successfully!");
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
      const { toast } = await import("sonner");
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (savingPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    try {
      const { userApi } = await import("@/lib/api");
      await userApi.changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const { toast } = await import("sonner");
      toast.success("Password changed successfully!");
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
      const { toast } = await import("sonner");
      toast.error(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Cookies.remove("vouchit_token");
    localStorage.removeItem("vouchit_token");
    router.push("/auth/login");
  };

  const SECTIONS = ["Profile", "Notifications", "Security", "Payment", "Privacy", "Account"];
  const [activeSection, setActiveSection] = useState("Profile");

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const initials = name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "??";

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

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 tracking-tight">
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
                const icons = [User, Bell, Shield, CreditCard, Eye, Lock];
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
                      {initials}
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
                  {profileError && (
                    <div className="p-3 border border-red-300 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                      {profileError}
                    </div>
                  )}

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
                        disabled
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                        placeholder="john@example.com"
                        type="email"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Phone Number</label>
                    <div className="flex gap-0 border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-[var(--primary)] transition-colors">
                      <div className="flex-1 relative">
                        <input
                          type={showPhone ? "text" : "password"}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="e.g. +2348012345678"
                          className="w-full pl-4 pr-10 py-2.5 text-sm bg-white focus:outline-none"
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
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
                      rows={3}
                      placeholder="Tell others a bit about yourself..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}
                    >
                      {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                    <Toggle enabled={notifWager} onToggle={() => {
                      const val = !notifWager;
                      setNotifWager(val);
                      localStorage.setItem("notifWager", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="Payouts & Settlements" sub="When funds are released or received">
                    <Toggle enabled={notifPayout} onToggle={() => {
                      const val = !notifPayout;
                      setNotifPayout(val);
                      localStorage.setItem("notifPayout", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="Disputes" sub="Updates on open dispute cases">
                    <Toggle enabled={notifDispute} onToggle={() => {
                      const val = !notifDispute;
                      setNotifDispute(val);
                      localStorage.setItem("notifDispute", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="Promotions & News" sub="Platform updates and featured wagers">
                    <Toggle enabled={notifMarketing} onToggle={() => {
                      const val = !notifMarketing;
                      setNotifMarketing(val);
                      localStorage.setItem("notifMarketing", String(val));
                    }} />
                  </SettingRow>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Delivery Channels</p>
                  <SettingRow label="Email Notifications" sub={email}>
                    <Toggle enabled={notifEmail} onToggle={() => {
                      const val = !notifEmail;
                      setNotifEmail(val);
                      localStorage.setItem("notifEmail", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="SMS Alerts" sub={phone || "No phone added"}>
                    <Toggle enabled={notifSMS} onToggle={() => {
                      const val = !notifSMS;
                      setNotifSMS(val);
                      localStorage.setItem("notifSMS", String(val));
                    }} />
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
                    <Toggle enabled={twoFA} onToggle={() => {
                      const val = !twoFA;
                      setTwoFA(val);
                      localStorage.setItem("twoFA", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="Biometric Login" sub="Use fingerprint or Face ID">
                    <Toggle enabled={biometric} onToggle={() => {
                      const val = !biometric;
                      setBiometric(val);
                      localStorage.setItem("biometric", String(val));
                    }} />
                  </SettingRow>
                  <SettingRow label="Login Alerts" sub="Get notified of new sign-ins">
                    <Toggle enabled={loginAlerts} onToggle={() => {
                      const val = !loginAlerts;
                      setLoginAlerts(val);
                      localStorage.setItem("loginAlerts", String(val));
                    }} />
                  </SettingRow>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Change Password</p>
                  <div className="flex flex-col gap-3">
                    {passwordError && (
                      <div className="p-3 border border-red-300 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                        {passwordError}
                      </div>
                    )}
                    {passwordSaved && (
                      <div className="p-3 border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl">
                        Password successfully updated!
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--muted-foreground)]">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--muted-foreground)]">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--muted-foreground)]">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={handleChangePassword}
                        disabled={savingPassword || !currentPassword || !newPassword}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 12px rgba(13,148,136,0.25)" }}>
                        {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                        Update Password
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Active Sessions</p>
                  {[
                    { device: "Current Device", location: "Unknown", time: "Now", current: true },
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
                  {bankAccount ? (
                    <div className="flex flex-col gap-4 mb-4">
                      <div className="p-4 border border-[var(--border)] rounded-2xl bg-neutral-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-lg">
                            🏦
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--foreground)]">{bankAccount.bankName}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {bankAccount.accountNumber} · {bankAccount.accountName}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            try {
                              const { walletApi } = await import("@/lib/api");
                              await walletApi.unlinkBank();
                              setBankAccount(null);
                              const { toast } = await import("sonner");
                              toast.success("Bank account unlinked.");
                            } catch (e: any) {
                              const { toast } = await import("sonner");
                              toast.error("Failed to unlink bank account.");
                            }
                          }}
                          className="text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5 border border-[var(--danger)]/20 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 mb-4">
                      <p className="text-sm text-[var(--muted-foreground)]">No bank account linked. Link your account to withdraw funds.</p>
                    </div>
                  )}

                  {!bankAccount && (
                    <button 
                      onClick={() => setShowBankModal(true)}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-sm font-semibold text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      + Link Bank Account
                    </button>
                  )}
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Withdrawal Limit</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Daily Limit</span>
                    <span className="text-sm font-bold text-[var(--primary)]">₦500,000</span>
                  </div>
                  <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "0%", background: "linear-gradient(90deg,#0d9488,#0f766e)" }} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">₦0 used today of ₦500,000 limit</p>
                </div>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {activeSection === "Privacy" && (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <SectionHeader icon={Eye} title="Privacy" subtitle="Control your visibility and data." />
                <SettingRow label="Public Profile" sub="Anyone can view your profile and stats">
                  <Toggle enabled={publicProfile} onToggle={() => {
                    const val = !publicProfile;
                    setPublicProfile(val);
                    localStorage.setItem("publicProfile", String(val));
                  }} />
                </SettingRow>
                <SettingRow label="Show on Leaderboard" sub="Appear in public rankings">
                  <Toggle enabled={showOnLeaderboard} onToggle={() => {
                    const val = !showOnLeaderboard;
                    setShowOnLeaderboard(val);
                    localStorage.setItem("showOnLeaderboard", String(val));
                  }} />
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
                    <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                      {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  </SettingRow>
                  <SettingRow label="Account Status" sub="Your current account standing">
                    <span className="text-xs font-semibold text-[var(--success)] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Active</span>
                  </SettingRow>
                  <SettingRow label="KYC Verification" sub="Identity verification status">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        user.kycTier > 0 
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                          : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}>
                        {user.kycTier > 0 ? "Verified" : "Not Verified"}
                      </span>
                      {user.kycTier === 0 && (
                        <button 
                          onClick={() => setShowKycModal(true)}
                          className="text-xs font-semibold bg-[var(--primary)] text-white px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Verify Now
                        </button>
                      )}
                    </div>
                  </SettingRow>
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Session</p>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors mb-3">
                    <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" /> Sign Out of All Devices
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                    <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" /> Sign Out
                  </button>
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
                    <button 
                      onClick={() => {
                        import("sonner").then(({ toast }) => toast.info("Freezing accounts is disabled in demo mode. Contact support at support@usevouchit.com."));
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--danger)]/30 bg-white text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors">
                      <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Freeze Account Temporarily</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => {
                        import("sonner").then(({ toast }) => toast.error("Account deletion requires admin validation. Please submit a request to support@usevouchit.com."));
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--danger)]/30 bg-white text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors">
                      <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete Account</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
            )}

          </div>
        </div>
      </main>

      {/* Link Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Link Bank Account</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Enter your bank details to link your account for withdrawals.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Select Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setBankCode(code);
                    const selected = NIGERIAN_BANKS.find(b => b.code === code);
                    setBankName(selected ? selected.name : "");
                  }}
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm bg-white"
                >
                  <option value="">Select a Bank</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Account Number</label>
                <input 
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 0123456789"
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm"
                />
                {isResolving && (
                  <p className="text-xs text-[var(--primary)] flex items-center gap-1.5 mt-1 font-semibold">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying account details...
                  </p>
                )}
                {resolutionError && (
                  <p className="text-xs text-[var(--danger)] mt-1 font-semibold">
                    {resolutionError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Account Name</label>
                <input 
                  type="text"
                  value={accountName}
                  readOnly
                  placeholder={isResolving ? "Resolving account name..." : "Account name will auto-resolve"}
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm bg-neutral-50 text-neutral-500 cursor-not-allowed"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-3 font-semibold border border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!bankName || !accountNumber || !accountName) return;
                    setIsResolving(true);
                    try {
                      const { walletApi } = await import("@/lib/api");
                      const data = { bankName, bankCode, accountNumber, accountName };
                      await walletApi.linkBank(data);
                      setBankAccount(data);
                      setShowBankModal(false);
                      const { toast } = await import("sonner");
                      toast.success("Bank account linked successfully!");
                    } catch (err: any) {
                      setResolutionError(err.message || "Failed to link bank account");
                    } finally {
                      setIsResolving(false);
                    }
                  }}
                  disabled={!bankName || accountNumber.length !== 10 || !accountName || isResolving}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {isResolving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Link Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Verification Modal */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Verify Identity</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Enter your Bank Verification Number (BVN) or National Identification Number (NIN) to upgrade your account tier.
            </p>
            {kycError && (
              <div className="mb-4 p-3 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                {kycError}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">ID Type</label>
                <div className="flex gap-2 mt-1">
                  {(["BVN", "NIN"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setKycType(t)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                        kycType === t
                          ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {kycType} Number (11 Digits)
                </label>
                <input 
                  type="text"
                  maxLength={11}
                  value={kycNumber}
                  onChange={(e) => setKycNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder={`Enter your 11-digit ${kycType}`}
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowKycModal(false)}
                  className="flex-1 py-3 font-semibold border border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  disabled={isVerifyingKyc}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (kycNumber.length !== 11) {
                      setKycError("Identification number must be exactly 11 digits.");
                      return;
                    }
                    setIsVerifyingKyc(true);
                    setKycError("");
                    try {
                      const { userApi } = await import("@/lib/api");
                      const res = await userApi.verifyKYC(kycType, kycNumber);
                      setUser(res.user);
                      setShowKycModal(false);
                      const { toast } = await import("sonner");
                      toast.success(`${kycType} verified successfully! Your account status is now verified.`);
                    } catch (err: any) {
                      setKycError(err.message || "KYC verification failed. Please check the number.");
                    } finally {
                      setIsVerifyingKyc(false);
                    }
                  }}
                  disabled={isVerifyingKyc || kycNumber.length !== 11}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 flex justify-center items-center"
                >
                  {isVerifyingKyc ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
