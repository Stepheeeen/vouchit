"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref");
    const refToUse = reference || trxref;

    if (!refToUse) {
      setStatus("error");
      setMessage("No transaction reference found.");
      return;
    }

    async function verify() {
      try {
        const { walletApi } = await import("@/lib/api");
        const res = await walletApi.verifyDeposit(refToUse as string);
        if (res.success) {
          setStatus("success");
          setMessage(`Successfully deposited ₦${res.amount}`);
        } else {
          setStatus("error");
          setMessage(res.message || "Verification failed");
        }
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "An error occurred during verification.");
      }
    }

    verify();
  }, [searchParams]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-[var(--primary)] mb-4" />
          <h1 className="text-xl font-bold tracking-tight">Verifying Payment...</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-2">Please do not close this page.</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="h-16 w-16 text-[var(--success)] mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Payment Successful</h1>
          <p className="text-[var(--muted-foreground)] mt-2 font-medium">{message}</p>
          <Button onClick={() => router.push("/wallet")} className="mt-8 rounded-full px-8">
            Return to Wallet
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-16 w-16 text-[var(--danger)] mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Payment Failed</h1>
          <p className="text-[var(--muted-foreground)] mt-2 font-medium">{message}</p>
          <Button onClick={() => router.push("/wallet")} variant="outline" className="mt-8 rounded-full px-8">
            Return to Wallet
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
