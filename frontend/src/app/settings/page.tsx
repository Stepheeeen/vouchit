"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Bell, Shield, CreditCard, LogOut,
  ChevronRight, Check, Eye, EyeOff, Smartphone, Lock,
  Trash2, AlertTriangle, Camera, Loader2
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Profile Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
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

  // Security toggles. "Biometric login" is gone: it was a localStorage flag
  // with nothing behind it, and the passkey it implied belongs to the wallet,
  // not to a Vouchit account setting.
  const [twoFA, setTwoFA] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  // Privacy
  const [publicProfile, setPublicProfile] = useState(true);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [username, setUsername] = useState("");

  // Data export + account deletion
  const [isExporting, setIsExporting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /**
   * Persist one preference.
   *
   * Every switch on this page used to call localStorage.setItem and stop
   * there. The server never heard about any of it, so "public profile: off"
   * left the profile public and "two-factor: on" added no second factor —
   * the UI simply lied about the state of the account.
   */
  const savePreference = async (key: string, value: boolean, apply: (v: boolean) => void) => {
    const previous = !value;
    apply(value);
    setSavingPref(key);
    try {
      const { userApi } = await import("@/lib/api");
      await userApi.updatePreferences({ [key]: value });
    } catch (err: any) {
      // Put the switch back rather than showing a state the server rejected.
      apply(previous);
      const { toast } = await import("sonner");
      toast.error(err?.message || "Could not save that setting.");
    } finally {
      setSavingPref(null);
    }
  };

  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("That image is larger than 5MB.");
      return;
    }

    setAvatarError("");
    setIsUploadingAvatar(true);
    try {
      const { disputesApi, userApi } = await import("@/lib/api");
      const { url } = await disputesApi.uploadFile(file);
      await userApi.updateProfile({ avatarUrl: url });
      setAvatarUrl(url);
      const { toast } = await import("sonner");
      toast.success("Profile photo updated.");
    } catch (err: any) {
      const message = err?.message || "Could not upload that image.";
      setAvatarError(message);
      const { toast } = await import("sonner");
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  /**
   * Remove the wallet from the account.
   *
   * The API refuses while a wager is live, because payouts go to the wallet
   * that staked and the app's on-chain checks are keyed to this field. That
   * refusal is shown as-is rather than being softened into a generic failure.
   */
  const handleUnlinkWallet = async () => {
    if (isUnlinking) return;
    setIsUnlinking(true);
    try {
      const { web3Api, userApi } = await import("@/lib/api");
      await web3Api.unlinkWallet();
      setUser(await userApi.getProfile());
      const { toast } = await import("sonner");
      toast.success("Wallet unlinked.");
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err?.message || "Could not unlink that wallet.");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (isSigningOutAll) return;
    setIsSigningOutAll(true);
    try {
      const { authApi, clearAuthToken } = await import("@/lib/api");
      await authApi.signOutAllDevices();
      clearAuthToken();
      const { toast } = await import("sonner");
      toast.success("Signed out on every device.");
      router.push("/auth/login");
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err?.message || "Could not sign out everywhere.");
      setIsSigningOutAll(false);
    }
  };

  /**
   * Delete the account for good.
   *
   * There was no way to leave at all. The password is required because this
   * cannot be undone, and the API refuses while any wager is still live
   * on-chain — someone else's stake is sitting opposite yours.
   */
  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const { userApi, clearAuthToken } = await import("@/lib/api");
      await userApi.deleteAccount(deletePassword);
      clearAuthToken();
      const { toast } = await import("sonner");
      toast.success("Your account has been deleted.");
      router.push("/");
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err?.message || "Could not delete your account.");
      setIsDeleting(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { userApi } = await import("@/lib/api");
      const data = await userApi.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vouchit-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err?.message || "Could not export your data.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi } = await import("@/lib/api");
        const [profile, prefs] = await Promise.all([
          userApi.getProfile(),
          userApi.getPreferences().catch(() => null),
        ]);
        setUser(profile);

        setName(profile.displayName || "");
        setUsername(profile.username || "");
        setEmail(profile.email || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatarUrl || null);

        // Preferences come from the account, so they follow the user to any
        // device and actually govern behaviour. They used to be read out of
        // this browser's localStorage, where they governed nothing.
        if (prefs) {
          setNotifWager(prefs.notifyWager);
          setNotifPayout(prefs.notifyPayout);
          setNotifDispute(prefs.notifyDispute);
          setNotifMarketing(prefs.notifyMarketing);
          setNotifEmail(prefs.notifyEmail);
          setTwoFA(prefs.twoFactorEnabled);
          setLoginAlerts(prefs.loginAlertsEnabled);
          setPublicProfile(prefs.publicProfile);
          setShowOnLeaderboard(prefs.showOnLeaderboard);
        }
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
      await userApi.updateProfile({
        displayName: name,
        bio,
        ...(username.trim() ? { username: username.trim() } : {}),
      });
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

  const handleLogout = async () => {
    const { clearAuthToken } = await import("@/lib/api");
    clearAuthToken();
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
      <div className="bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
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
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <div
                        className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                        style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "0 4px 16px rgba(13,148,136,0.3)" }}
                      >
                        {initials}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5 text-white" />
                      )}
                    </button>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Profile Photo</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">PNG, JPG or GIF — max 5MB</p>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="mt-2 text-xs font-semibold text-[var(--primary)] hover:underline disabled:opacity-60"
                    >
                      {isUploadingAvatar ? "Uploading…" : "Upload new photo"}
                    </button>
                    {avatarError && (
                      <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{avatarError}</p>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
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
                      <label htmlFor="full-name" className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Full Name</label>
                      <input
                        id="full-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    {/* No handle was ever collected, so every public profile
                        and leaderboard row rendered as "Vouchit user" — you
                        could not tell who you were staking against. */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="username" className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Username</label>
                      <input
                        id="username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                        placeholder="yourhandle"
                        autoComplete="username"
                        spellCheck={false}
                      />
                      <p className="text-[10px] text-[var(--muted-foreground)] font-medium">
                        3–20 characters. Letters, numbers, underscore or hyphen. Shown publicly.
                      </p>
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
                    <Toggle
                      enabled={notifWager}
                      onToggle={() => savePreference("notifyWager", !notifWager, setNotifWager)}
                    />
                  </SettingRow>
                  <SettingRow label="Payouts & Settlements" sub="When funds are released or received">
                    <Toggle
                      enabled={notifPayout}
                      onToggle={() => savePreference("notifyPayout", !notifPayout, setNotifPayout)}
                    />
                  </SettingRow>
                  <SettingRow label="Disputes" sub="Updates on open dispute cases">
                    <Toggle
                      enabled={notifDispute}
                      onToggle={() => savePreference("notifyDispute", !notifDispute, setNotifDispute)}
                    />
                  </SettingRow>
                  <SettingRow label="Promotions & News" sub="Platform updates and featured wagers">
                    <Toggle
                      enabled={notifMarketing}
                      onToggle={() => savePreference("notifyMarketing", !notifMarketing, setNotifMarketing)}
                    />
                  </SettingRow>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Delivery Channels</p>
                  <SettingRow label="Email Notifications" sub={email}>
                    <Toggle
                      enabled={notifEmail}
                      onToggle={() => savePreference("notifyEmail", !notifEmail, setNotifEmail)}
                    />
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
                    <Toggle
                      enabled={twoFA}
                      onToggle={() => savePreference("twoFactorEnabled", !twoFA, setTwoFA)}
                    />
                  </SettingRow>
                  <SettingRow label="Login Alerts" sub="Get notified of new sign-ins">
                    <Toggle
                      enabled={loginAlerts}
                      onToggle={() => savePreference("loginAlertsEnabled", !loginAlerts, setLoginAlerts)}
                    />
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
                  <SectionHeader
                    icon={CreditCard}
                    title="Funds"
                    subtitle="Vouchit is non-custodial — your funds never leave your wallet."
                  />
                  <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-4">
                    Stakes go straight from your wallet into the escrow contract, and payouts come
                    straight back. There is no Vouchit balance to top up or withdraw, and no bank
                    account to link.
                  </p>
                  <Link
                    href="/wallet"
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-sm font-semibold text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Open wallet
                  </Link>
                </div>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {activeSection === "Privacy" && (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <SectionHeader icon={Eye} title="Privacy" subtitle="Control your visibility and data." />
                <SettingRow label="Public Profile" sub="Anyone can view your profile and stats">
                  <Toggle
                    enabled={publicProfile}
                    onToggle={() => savePreference("publicProfile", !publicProfile, setPublicProfile)}
                  />
                </SettingRow>
                <SettingRow label="Show on Leaderboard" sub="Appear in public rankings">
                  <Toggle
                    enabled={showOnLeaderboard}
                    onToggle={() => savePreference("showOnLeaderboard", !showOnLeaderboard, setShowOnLeaderboard)}
                  />
                </SettingRow>
                {/* "Activity Status" lived here with onToggle={() => {}} and
                    no feature behind it — a switch that could not be switched,
                    describing something the app does not track. Removed rather
                    than left as furniture. */}
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Data & Export</p>
                  <button
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="w-full py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-left px-4 flex items-center justify-between disabled:opacity-60"
                  >
                    {isExporting ? "Preparing your data…" : "Download My Data"}
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
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
                  <SettingRow label="Wallet Verification" sub="Signature-linked wallet on Base">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        user.web3Address
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}
                    >
                      {user.web3Address ? "Linked" : "Not Linked"}
                    </span>
                  </SettingRow>
                  {/* This row stated the wallet was linked and offered no way
                      to change it, so connecting the wrong one — or wanting to
                      move from an extension to a passkey — was a dead end.
                      Distinct from Disconnect on the wallet page: that ends the
                      browser session, this removes the payout address from the
                      account. */}
                  {user.web3Address && (
                    <div className="pt-4 mt-2 border-t border-[var(--border)] flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          Linked wallet
                        </p>
                        <p className="font-mono text-[11px] text-[var(--muted-foreground)] break-all">
                          {user.web3Address}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                          Winnings are paid to this address by the escrow contract. Unlinking does
                          not move any money — it only stops Vouchit associating this wallet with
                          your account. You can link a different one afterwards.
                        </p>
                      </div>
                      <button
                        onClick={handleUnlinkWallet}
                        disabled={isUnlinking}
                        className="self-start text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition-colors disabled:opacity-60 flex items-center gap-2"
                      >
                        {isUnlinking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {isUnlinking ? "Unlinking…" : "Unlink this wallet"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Session</p>
                  {/* This called handleLogout, which only drops the token in
                      THIS browser. Every other session stayed valid for the
                      rest of its seven days, while the label promised the
                      opposite — the one control you reach for after a
                      suspected compromise. It now moves the account's session
                      generation forward server-side, which invalidates every
                      token already issued. */}
                  <button
                    onClick={handleSignOutEverywhere}
                    disabled={isSigningOutAll}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors mb-3 disabled:opacity-60">
                    {isSigningOutAll ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                    ) : (
                      <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                    {isSigningOutAll ? "Signing out everywhere…" : "Sign Out of All Devices"}
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                    <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" /> Sign Out
                  </button>
                </div>

                {/* Deleting the account was simply not offered anywhere, which
                    leaves people with no way to withdraw consent for the data
                    we hold on them. */}
                <div className="bg-white border border-[var(--danger)]/40 rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--danger)] mb-2">Danger zone</p>
                  <p className="text-sm text-[var(--muted-foreground)] mb-4 leading-relaxed">
                    Deleting your account removes your profile, notifications and wager
                    participation from Vouchit. It cannot be undone. Wagers already settled on
                    the blockchain stay on the blockchain — we cannot erase those.
                  </p>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-3 rounded-xl border border-[var(--danger)]/50 text-sm font-semibold text-[var(--danger)] hover:bg-red-50 transition-colors"
                    >
                      Delete my account
                    </button>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <label htmlFor="delete-password" className="text-xs font-semibold text-[var(--foreground)]">
                        Confirm with your password
                      </label>
                      <input
                        id="delete-password"
                        type="password"
                        autoComplete="current-password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--danger)]"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeletePassword("");
                          }}
                          className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold hover:bg-[var(--muted)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isDeleting || deletePassword.length === 0}
                          className="flex-1 py-3 rounded-xl bg-[var(--danger)] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                          {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isDeleting ? "Deleting…" : "Permanently delete"}
                        </button>
                      </div>
                    </div>
                  )}
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

    </div>
  );
}
