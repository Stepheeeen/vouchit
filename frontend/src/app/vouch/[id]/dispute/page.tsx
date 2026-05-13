"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, FileText, Link2, CheckCircle2, AlertTriangle, Upload } from "lucide-react";

const STEPS = ["Describe", "Evidence", "Submit"];

export default function DisputePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [proofType, setProofType] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => router.push(`/vouch/${params.id}`), 2000);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 animate-fade-in">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#d97706,#b45309)", boxShadow: "0 0 40px rgba(217,119,6,0.3)" }}
        >
          <AlertTriangle className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h2 className="font-bold text-2xl tracking-tight text-[var(--foreground)]">Dispute Filed</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed max-w-xs">
            Our team will review your evidence and respond within 24 hours. Funds remain locked safely.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 md:top-[65px] z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <Link href={`/vouch/${params.id}`}>
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors">
            <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
          </button>
        </Link>
        <h1 className="font-bold text-base tracking-tight flex-1">Open Dispute</h1>
        <span className="text-xs font-semibold text-[var(--muted-foreground)]">Step {step + 1}/3</span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--border)] mx-4 mt-0 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 md:p-8 gap-6 pb-32">

        {/* Step pills */}
        <div className="flex gap-2 pt-2">
          {STEPS.map((s, i) => (
            <div key={i} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
              i === step ? "bg-[var(--primary)] text-white" :
              i < step  ? "bg-emerald-50 text-[var(--success)]" :
              "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}>
              {i < step ? <CheckCircle2 className="h-3 w-3" /> : null}
              {s}
            </div>
          ))}
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Important</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">False dispute claims may result in account penalties. Only file if you genuinely believe you won.</p>
          </div>
        </div>

        {/* STEP 0: Describe */}
        {step === 0 && (
          <div className="flex flex-col gap-5 animate-slide-up">
            <div>
              <h2 className="font-bold text-lg mb-1">What happened?</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Explain why you believe you won this wager.</p>
            </div>

            {/* Dispute reason quick picks */}
            <div className="flex flex-col gap-2">
              {[
                "The event clearly went in my favor",
                "My opponent is falsely claiming they won",
                "The outcome is verifiable via a public source",
                "Other reason",
              ].map((r, i) => (
                <button
                  key={i}
                  onClick={() => setReason(r)}
                  className={`text-left p-3 rounded-xl border text-sm font-medium transition-all ${
                    reason === r
                      ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Additional details</label>
              <textarea
                rows={4}
                placeholder="Add any extra context or details…"
                className="w-full border border-[var(--border)] rounded-xl bg-[var(--surface)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 1: Evidence */}
        {step === 1 && (
          <div className="flex flex-col gap-5 animate-slide-up">
            <div>
              <h2 className="font-bold text-lg mb-1">Upload Evidence</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Attach proof to support your claim.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { type: "screenshot", icon: Camera,   label: "Screenshot" },
                { type: "document",  icon: FileText,  label: "Document"   },
                { type: "link",      icon: Link2,     label: "Web Link"   },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setProofType(opt.type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    proofType === opt.type
                      ? "border-[var(--primary)] bg-[var(--muted)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <opt.icon className={`h-6 w-6 ${proofType === opt.type ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${proofType === opt.type ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>{opt.label}</span>
                </button>
              ))}
            </div>

            {proofType === "screenshot" || proofType === "document" ? (
              <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 flex flex-col items-center gap-3 text-center bg-[var(--muted)] hover:border-[var(--primary)] transition-colors cursor-pointer">
                <div className="h-12 w-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-[var(--primary)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Drop file here or tap to browse</p>
                <p className="text-xs text-[var(--muted-foreground)]">PNG, JPG, PDF — up to 10MB</p>
              </div>
            ) : proofType === "link" ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Source URL</label>
                <input
                  type="url"
                  placeholder="https://bbc.com/sport/article..."
                  className="w-full border border-[var(--border)] rounded-xl bg-[var(--surface)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 2: Review & Submit */}
        {step === 2 && (
          <div className="flex flex-col gap-5 animate-slide-up">
            <div>
              <h2 className="font-bold text-lg mb-1">Review & Submit</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Double-check before sending.</p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Wager</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">Arsenal to beat Chelsea by 2 goals margin</p>
              </div>
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Your Reason</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{reason || "Not specified"}</p>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Evidence Type</p>
                <p className="text-sm font-semibold text-[var(--foreground)] capitalize">{proofType || "None attached"}</p>
              </div>
            </div>

            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl p-4">
              <p className="text-xs font-semibold text-[var(--muted-foreground)] leading-relaxed">
                By submitting this dispute you agree that all information provided is accurate and truthful. Our team will review within <strong className="text-[var(--foreground)]">24 hours</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation CTAs */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)]/90 backdrop-blur-md border-t border-[var(--border)] z-20">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--muted)] transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => step < 2 ? setStep(s => s + 1) : handleSubmit()}
            className="flex-[2] py-4 rounded-2xl font-bold text-sm text-white uppercase tracking-widest transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#0d9488,#0f766e)",
              boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
            }}
          >
            {step < 2 ? "Continue" : "File Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
