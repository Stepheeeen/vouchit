"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [email, setEmail] = useState("");
  // ?mode=2fa is the second step of a login, not a new-account verification.
  const isTwoFactor = searchParams.get("mode") === "2fa";

  useEffect(() => {
    // The address used to arrive as ?email=..., which wrote a personal
    // identifier into browser history, the server's access logs and any
    // referrer this page sent. sessionStorage keeps it to this tab.
    const stored = sessionStorage.getItem("vouchit_pending_email") || "";
    const legacy = searchParams.get("email") || "";
    const resolved = stored || legacy;
    setEmail(resolved);
    // Clean a legacy link so the address stops being re-shared on reload.
    if (!stored && legacy) {
      sessionStorage.setItem("vouchit_pending_email", legacy);
      router.replace(isTwoFactor ? "/auth/verify?mode=2fa" : "/auth/verify", { scroll: false });
    }
    if (!resolved) router.replace("/auth/login");
  }, [searchParams, router, isTwoFactor]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pastedData.length === 0) return;

    const newOtp = [...otp];
    pastedData.forEach((char, idx) => {
      if (idx < 6 && /[0-9]/.test(char)) {
        newOtp[idx] = char;
      }
    });
    setOtp(newOtp);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleResend = async () => {
    if (!email || isLoading) return;
    setResendStatus("Sending...");
    try {
      const { authApi } = await import("@/lib/api");
      // This used to call register(email, "resend_otp_placeholder") — a new
      // registration with a hardcoded password standing in for a resend. It
      // only avoided overwriting the stored password because register took a
      // different branch for unverified accounts, and it reported "Failed to
      // send" for anyone whose address was already verified.
      await authApi.resendOtp(email);
      setResendStatus("Code sent!");
      setTimeout(() => setResendStatus(""), 3000);
    } catch (err: any) {
      setResendStatus(err?.message?.includes("many") ? "Too many requests." : "Failed to send.");
      setTimeout(() => setResendStatus(""), 4000);
    }
  };

  /**
   * Submit as soon as the sixth digit lands.
   *
   * The form sat there fully filled waiting for a button press, which reads
   * as a dead end on a phone where the keyboard covers the button.
   */
  useEffect(() => {
    if (otp.join("").length === 6 && !isLoading && email && !errorMsg) {
      void submitCode(otp.join(""));
    }
    // Only react to the digits changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp.join("")]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6 || !email) return;
    await submitCode(code);
  };

  const submitCode = async (code: string) => {
    if (isLoading) return;
    setErrorMsg("");

    setIsLoading(true);
    try {
      const { authApi, setAuthToken } = await import("@/lib/api");
      const res = isTwoFactor
        ? await authApi.loginTwoFactor(email, code)
        : await authApi.verifyEmail(email, code);
      if (res.accessToken) {
        setAuthToken(res.accessToken);
        sessionStorage.removeItem("vouchit_pending_email");
        router.push("/dashboard");
      } else {
        setErrorMsg("Failed to authenticate.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid code");
      // Clear the boxes and go back to the first one. Leaving the rejected
      // digits sitting there meant the next attempt started by deleting six
      // characters one at a time.
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 pt-12 md:pt-24 w-full max-w-7xl mx-auto tracking-tight justify-center">
      <div className="flex-1 flex flex-col items-center justify-center gap-10 max-w-md mx-auto w-full bg-white border border-[var(--border)] p-6 md:p-10 rounded-2xl shadow-md my-auto h-fit">
        
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-2 overflow-hidden bg-[var(--primary)] shadow-md">
            <img src="/logo-mark-transparent.png" alt="Vouchit Logo" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter w-full border-b border-[var(--border)] pb-4">
            {isTwoFactor ? "Confirm." : "Verify."}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            {isTwoFactor ? "Two-factor code sent to" : "Enter the 6-digit code sent to"} <br />
            <span className="text-[var(--foreground)] font-bold">{email || "your email"}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest text-center mb-2">Verification Code</label>
            <div className="flex justify-between gap-2 md:gap-3">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="flex-1 min-w-[32px] max-w-[48px] h-14 md:h-16 text-center text-xl md:text-2xl font-bold border-2 border-[var(--border)] bg-white focus:border-[var(--primary)] focus:outline-none transition-all rounded-xl p-0 shadow-sm"
                />
              ))}
            </div>
          </div>

          {errorMsg && <p className="text-red-500 text-xs font-semibold text-center uppercase tracking-widest">{errorMsg}</p>}

          <Button 
            type="submit" 
            className="w-full mt-4"
            disabled={otp.join("").length !== 6 || !email || isLoading}
          >
            {isLoading ? "VERIFYING..." : "VERIFY & CONTINUE"}
            {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
          </Button>

          <div className={`text-center text-[10px] font-semibold uppercase tracking-widest mt-2 border-t border-[var(--border)] pt-6 ${isTwoFactor ? "hidden" : ""}`}>
            <span className="text-[var(--muted-foreground)]">Didn&apos;t receive code? </span>
            <button 
              type="button" 
              onClick={handleResend}
              disabled={resendStatus !== ""}
              className="text-[var(--foreground)] hover:underline border-b border-[var(--foreground)] pb-0.5 ml-2 disabled:opacity-50"
            >
              {resendStatus || "Resend"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center uppercase tracking-widest font-bold">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
