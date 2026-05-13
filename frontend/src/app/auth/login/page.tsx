"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isOver18, setIsOver18] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !isOver18)) return;
    
    setIsLoading(true);
    try {
      const { authApi } = await import("@/lib/api");
      
      if (isLogin) {
        const res = await authApi.login(email, password);
        if (res.accessToken) {
          localStorage.setItem("vouchit_token", res.accessToken);
          router.push("/dashboard");
        }
      } else {
        await authApi.register(email, password);
        router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      alert(error.message || "Authentication failed. Please try again.");
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
          <h1 className="text-3xl font-bold uppercase tracking-tighter w-full border-b border-[var(--border)] pb-4">
            {isLogin ? "Welcome Back." : "Create Account."}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            {isLogin ? "Enter your credentials to login." : "Sign up with your email to continue."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-lg font-semibold h-14 rounded-none bg-transparent"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-lg font-semibold h-14 rounded-none bg-transparent"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {!isLogin && (
            <div className="flex items-start gap-4 p-5 border border-[var(--border)] bg-[var(--muted)]/10 group hover:border-[var(--foreground)] transition-colors cursor-pointer" onClick={() => setIsOver18(!isOver18)}>
              <div className={`mt-0.5 h-5 w-5 border-2 flex items-center justify-center shrink-0 transition-colors ${isOver18 ? 'bg-[var(--foreground)] border-[var(--foreground)]' : 'border-[var(--border)] group-hover:border-[var(--foreground)]'}`}>
                {isOver18 && <div className="h-2.5 w-2.5 bg-[var(--background)]"></div>}
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
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-[var(--foreground)] hover:underline border-b border-[var(--foreground)] pb-0.5 ml-2">
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
