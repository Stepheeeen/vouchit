"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, FileText, Link2, CheckCircle2, AlertTriangle, Upload, Loader2 } from "lucide-react";

const STEPS = ["Describe", "Evidence", "Submit"];

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [additionalDetail, setAdditionalDetail] = useState("");
  const [proofType, setProofType] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canProceedStep0 = reason.length > 0;
  const canProceedStep1 = true; // evidence is optional
  const canSubmit = reason.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const { disputesApi } = await import("@/lib/api");
      await disputesApi.create({
        wagerId: id,
        reason: `${reason}${additionalDetail ? `\n\nAdditional details: ${additionalDetail}` : ""}`,
        proofType: proofType || undefined,
        mediaUrl: proofType === "link" && mediaUrl ? mediaUrl : undefined,
      });
      setSubmitted(true);
      setTimeout(() => router.push(`/vouch/${id}`), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to file dispute. Please try again.");
      const { toast } = await import("sonner");
      toast.error(err.message || "Failed to file dispute. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
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
        <Link href={`/vouch/${id}`}>
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
            <div
              key={i}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                i === step ? "bg-[var(--primary)] text-white" :
                i < step   ? "bg-emerald-50 text-[var(--success)]" :
                             "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-3 w-3" /> : null}
              {s}
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Important</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              False dispute claims may result in account penalties. Only file if you genuinely believe you won.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* STEP 0: Describe */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg mb-1">What happened?</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Explain why you believe you won this wager.</p>
            </div>
            <div className="flex flex-col gap-2">
              {[
                "The event clearly went in my favor",
                "My opponent is falsely claiming they won",
                "The outcome is verifiable via a public source",
                "Other reason",
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-left p-3 rounded-xl border text-sm font-medium transition-all ${
                    reason === r
                      ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]/50"
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
                value={additionalDetail}
                onChange={(e) => setAdditionalDetail(e.target.value)}
                placeholder="Add any extra context or details…"
                className="w-full border border-[var(--border)] rounded-xl bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 1: Evidence */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg mb-1">Upload Evidence</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Attach proof to support your claim. (Optional but recommended)</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: "screenshot", icon: Camera,   label: "Screenshot" },
                { type: "document",  icon: FileText,  label: "Document"   },
                { type: "link",      icon: Link2,     label: "Web Link"   },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    const nextType = proofType === opt.type ? null : opt.type;
                    setProofType(nextType);
                    setSelectedFile(null);
                    setMediaUrl("");
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    proofType === opt.type
                      ? "border-[var(--primary)] bg-[var(--muted)]"
                      : "border-[var(--border)] bg-white hover:border-[var(--primary)]/50"
                  }`}
                >
                  <opt.icon className={`h-6 w-6 ${proofType === opt.type ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${proofType === opt.type ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            {(proofType === "screenshot" || proofType === "document") && (
              selectedFile ? (
                <div className="border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between bg-white w-full">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setMediaUrl("");
                    }}
                    className="text-xs font-semibold text-[var(--danger)] hover:underline shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 flex flex-col items-center gap-3 text-center bg-[var(--muted)] hover:border-[var(--primary)] transition-colors cursor-pointer w-full"
                >
                  <input 
                    type="file" 
                    id="file-input" 
                    className="hidden" 
                    accept={proofType === "screenshot" ? "image/*" : ".pdf,.doc,.docx,.txt"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        setMediaUrl(`https://vouchit-proofs.s3.amazonaws.com/proofs/${Date.now()}_${file.name}`);
                      }
                    }}
                  />
                  <div className="h-12 w-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Drop file here or tap to browse</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {proofType === "screenshot" ? "PNG, JPG, GIF" : "PDF, DOC, TXT"} — up to 10MB
                  </p>
                </div>
              )
            )}
            {proofType === "link" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Source URL</label>
                <input
                  type="url"
                  placeholder="https://bbc.com/sport/article..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full border border-[var(--border)] rounded-xl bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Review & Submit */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg mb-1">Review & Submit</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Double-check before sending.</p>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Your Reason</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{reason || "Not specified"}</p>
              </div>
              {additionalDetail && (
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Additional Details</p>
                  <p className="text-sm text-[var(--foreground)]">{additionalDetail}</p>
                </div>
              )}
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
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-4 rounded-2xl border border-[var(--border)] bg-white text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--muted)] transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => step < 2 ? setStep((s) => s + 1) : handleSubmit()}
            disabled={(step === 0 && !canProceedStep0) || isSubmitting}
            className="flex-[2] py-4 rounded-2xl font-bold text-sm text-white uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 20px rgba(13,148,136,0.3)" }}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Filing…</>
            ) : step < 2 ? "Continue" : "File Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
