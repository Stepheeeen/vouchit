"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Cookies from "js-cookie";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isOver18, setIsOver18] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !isOver18)) return;
    
    setIsLoading(true);
    setError("");
    try {
      const { authApi } = await import("@/lib/api");
      
      if (isLogin) {
        const res = await authApi.login(email, password);
        if (res.accessToken) {
          Cookies.set("vouchit_token", res.accessToken, { expires: 7 });
          localStorage.setItem("vouchit_token", res.accessToken); // keep for backward compatibility during transition
          router.push("/dashboard");
        }
      } else {
        await authApi.register(email, password);
        router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 pt-12 md:pt-24 w-full max-w-7xl mx-auto tracking-tight">
      <div className="flex-1 flex flex-col items-center justify-center gap-10 max-w-md mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] md:p-12">
        
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-2 overflow-hidden bg-[var(--primary)] shadow-md">
            <img src="/logo-mark-transparent.png" alt="Vouchit Logo" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter w-full border-b border-[var(--border)] pb-4">
            {isLogin ? "Welcome Back." : "Create Account."}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            {isLogin ? "Enter your credentials to login." : "Sign up with your email to continue."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          {error && (
            <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="text-lg font-semibold h-14 rounded-none bg-transparent"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="password">Password</label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="text-lg font-semibold h-14 rounded-none bg-transparent pr-12"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-4 p-5 border border-[var(--border)] bg-[var(--muted)]/10 group hover:border-[var(--foreground)] transition-colors cursor-pointer" onClick={() => setIsOver18(!isOver18)}>
              <div className={`mt-0.5 h-5 w-5 border-2 flex items-center justify-center shrink-0 transition-colors ${isOver18 ? 'bg-[var(--foreground)] border-[var(--foreground)]' : 'border-[var(--border)] group-hover:border-[var(--foreground)]'}`}>
                {isOver18 && <Check className="h-3.5 w-3.5 text-[var(--background)] stroke-[3]" />}
              </div>
              <label htmlFor="age" className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] leading-relaxed cursor-pointer group-hover:text-[var(--foreground)] transition-colors">
                I confirm that I am at least <strong className="text-[var(--foreground)]">18 years old</strong> and I agree to the Terms of Service.
              </label>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full mt-2"
            disabled={!email || !password || (!isLogin && !isOver18) || isLoading}
          >
            {isLoading ? "PROCESSING..." : (isLogin ? "LOGIN" : "SIGN UP")}
            {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
          </Button>

          <div className="text-center text-[10px] font-semibold uppercase tracking-widest border-b border-[var(--border)] pb-6">
            <span className="text-[var(--muted-foreground)]">{isLogin ? "Don't have an account? " : "Already have an account? "}</span>
            <button type="button" onClick={() => {
              setError("");
              setIsLogin(!isLogin);
            }} className="text-[var(--foreground)] hover:underline border-b border-[var(--foreground)] pb-0.5 ml-2">
              {isLogin ? "Sign up" : "Login"}
            </button>
          </div>

          <Button type="button" variant="outline" className="w-full flex items-center gap-2 rounded-none h-14 opacity-50 cursor-not-allowed">
            <Smartphone className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Phone Login (Coming Soon)</span>
          </Button>
        </form>
      </div>
    </main>
  );
}
