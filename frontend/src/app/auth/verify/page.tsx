"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Cookies from "js-cookie";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = searchParams.get("email") || "";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const code = otp.join("");
    if (code.length !== 6 || !email) return;

    setIsLoading(true);
    try {
      const { authApi } = await import("@/lib/api");
      const res = await authApi.verifyEmail(email, code);
      if (res.accessToken) {
        Cookies.set("vouchit_token", res.accessToken, { expires: 7 });
        localStorage.setItem("vouchit_token", res.accessToken);
        router.push("/dashboard");
      } else {
        setErrorMsg("Failed to authenticate.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 pt-12 md:pt-24 w-full max-w-7xl mx-auto tracking-tight">
      <div className="flex-1 flex flex-col items-center justify-center gap-10 max-w-md mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] md:p-12">
        
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <div className="h-20 w-20 bg-[var(--foreground)] text-[var(--background)] rounded-none flex items-center justify-center mb-2">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter w-full border-b border-[var(--border)] pb-4">Verify.</h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            Enter the 6-digit code sent to <br />
            <span className="text-[var(--foreground)] font-bold">{email || "your email"}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest text-center mb-2">OTP Code (123456)</label>
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
                  className="w-12 h-16 md:w-14 md:h-16 text-center text-2xl font-bold border border-[var(--border)] bg-transparent focus:border-[var(--foreground)] focus:outline-none transition-colors rounded-none"
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

          <div className="text-center text-[10px] font-semibold uppercase tracking-widest mt-2 border-t border-[var(--border)] pt-6">
            <span className="text-[var(--muted-foreground)]">Didn't receive code? </span>
            <button type="button" className="text-[var(--foreground)] hover:underline border-b border-[var(--foreground)] pb-0.5 ml-2">
              Resend
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
