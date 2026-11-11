"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Mirrors AuthService.assertPasswordAcceptable on the server. */
const MIN_PASSWORD_LENGTH = 10;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password));
  if (classes.length < 2) return "Mix at least two of: lowercase, uppercase, numbers, symbols.";
  return null;
}

/**
 * Password recovery.
 *
 * There was none. The login page had no "forgot password" link and the API
 * had no reset route, so forgetting your password meant losing the account
 * and the whole wager history attached to it, permanently.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pwProblem = password ? passwordProblem(password) : null;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const { authApi } = await import("@/lib/api");
      const res = await authApi.forgotPassword(email);
      // The reply is deliberately the same whether or not the address has an
      // account, so this page cannot be used to find out who is registered.
      setNotice(res.message || "If that address has an account, a reset code is on its way.");
      setStep("reset");
    } catch (err: any) {
      setError(err?.message || "Could not start a reset. Try again shortly.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { authApi, setAuthToken } = await import("@/lib/api");
      const res = await authApi.resetPassword(email, otp.trim(), password);
      if (res.accessToken) {
        setAuthToken(res.accessToken);
        router.push("/dashboard");
      } else {
        setError("Could not reset your password.");
      }
    } catch (err: any) {
      setError(err?.message || "That code was not accepted.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 pt-12 md:pt-24 w-full max-w-7xl mx-auto tracking-tight">
      <div className="flex-1 flex flex-col items-center justify-center gap-10 max-w-md mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] md:p-12">
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-2 overflow-hidden bg-[var(--primary)] shadow-md">
            <img src="/logo-mark-transparent.png" alt="Vouchit" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter w-full border-b border-[var(--border)] pb-4">
            {step === "request" ? "Reset Password." : "New Password."}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            {step === "request"
              ? "We'll email you a 6-digit code."
              : "Enter the code we emailed, then choose a new password."}
          </p>
        </div>

        <form onSubmit={step === "request" ? handleRequest : handleReset} className="w-full flex flex-col gap-6">
          {error && (
            <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {notice && step === "reset" && (
            <div className="p-4 border border-[var(--border)] bg-[var(--muted)]/20 text-sm font-semibold rounded-xl">
              {notice}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              disabled={step === "reset"}
              className="text-lg font-semibold h-14 rounded-none bg-transparent disabled:opacity-60"
              autoComplete="email"
            />
          </div>

          {step === "reset" && (
            <>
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="otp">
                  Reset code
                </label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  className="text-lg font-semibold h-14 rounded-none bg-transparent tracking-[0.4em]"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="password">
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    className="text-lg font-semibold h-14 rounded-none bg-transparent pr-12"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${pwProblem ? "text-[var(--danger)]" : "text-[var(--muted-foreground)]"}`}>
                  {pwProblem ?? `At least ${MIN_PASSWORD_LENGTH} characters, mixing two character types.`}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Resetting signs you out on every other device.
                </p>
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={
              isLoading ||
              !email ||
              (step === "reset" && (otp.length !== 6 || !!pwProblem || !password))
            }
          >
            {isLoading ? "PLEASE WAIT…" : step === "request" ? "SEND RESET CODE" : "SET NEW PASSWORD"}
            {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
          </Button>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login
          </Link>
        </form>
      </div>
    </main>
  );
}
