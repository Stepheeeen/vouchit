"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clipboard, HelpCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinByCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      let cleanText = text.trim();
      if (cleanText.includes("/vouch/join/")) {
        const parts = cleanText.split("/vouch/join/");
        const lastPart = parts[parts.length - 1]?.trim();
        if (lastPart) {
          cleanText = lastPart.split(/[?#/]/)[0] || lastPart;
        }
      } else if (cleanText.includes("/vouch/")) {
        const parts = cleanText.split("/vouch/");
        const lastPart = parts[parts.length - 1]?.trim();
        if (lastPart) {
          cleanText = lastPart.split(/[?#/]/)[0] || lastPart;
        }
      }
      setCode(cleanText);
      setError("");
    } catch {
      setError("Clipboard read permission denied. Please paste manually.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanCode = code.trim();
    if (cleanCode.includes("/vouch/join/")) {
      const parts = cleanCode.split("/vouch/join/");
      const lastPart = parts[parts.length - 1]?.trim();
      if (lastPart) {
        cleanCode = lastPart.split(/[?#/]/)[0] || lastPart;
      }
    } else if (cleanCode.includes("/vouch/")) {
      const parts = cleanCode.split("/vouch/");
      const lastPart = parts[parts.length - 1]?.trim();
      if (lastPart) {
        cleanCode = lastPart.split(/[?#/]/)[0] || lastPart;
      }
    }
    if (!cleanCode) {
      setError("Please enter a valid invite code or wager ID.");
      return;
    }
    router.push(`/vouch/join/${cleanCode}`);
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto md:py-8 tracking-tight">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] overflow-hidden">
        
        {/* Header */}
        <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
          <Link href="/dashboard" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Join Wager</h1>
        </header>

        <div className="flex-1 flex flex-col p-6 gap-8 pb-24 justify-center max-w-md mx-auto w-full">
          
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Enter Invite Code</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Paste the wager ID or invite link shared by your opponent to join their bet.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 p-3 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="relative">
              <Input
                type="text"
                placeholder="Paste code or link here..."
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                className="pr-12 text-sm h-14 rounded-xl focus-visible:ring-0 focus-visible:border-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Paste from clipboard"
              >
                <Clipboard className="h-5 w-5" />
              </button>
            </div>

            <Button type="submit" disabled={!code.trim()} className="w-full h-14 rounded-xl">
              Proceed to Wager <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Guide info */}
          <div className="border border-[var(--border)] rounded-2xl p-4 flex gap-3 bg-[var(--muted)]/20">
            <HelpCircle className="h-5 w-5 shrink-0 text-[var(--primary)] mt-0.5" />
            <div className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              <p className="font-semibold text-[var(--foreground)] mb-1">Where do I find the code?</p>
              Invite codes are generated automatically when a wager is created. Ask the creator of the wager to share their invite link with you.
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
