"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCredits } from "../../contexts/CreditsContext";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshCredits, credits, email } = useCredits();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Refresh credits after successful payment
    const timer = setTimeout(() => {
      refreshCredits();
    }, 1000);

    return () => clearTimeout(timer);
  }, [refreshCredits]);

  return (
    <div className="card p-8 text-center animate-scale-in">
      {/* Success icon */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-medium mb-2">Payment Successful!</h1>
      <p className="text-secondary mb-6">
        Your credits have been added to your account.
      </p>

      {/* Credit balance */}
      <div className="p-4 bg-[var(--bg-elevated)] rounded-lg mb-6">
        <p className="text-sm text-secondary mb-1">Current balance</p>
        <p className="text-4xl font-mono font-medium text-[var(--accent-mint)]">
          {credits}
        </p>
        {email && (
          <p className="text-sm text-secondary mt-1 truncate">
            {email}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn-primary"
        >
          Analyze a Debate
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn-secondary"
        >
          Back to Gallery
        </button>
      </div>

      {sessionId && (
        <p className="text-xs text-secondary mt-6 font-mono">
          Session: {sessionId.slice(0, 20)}...
        </p>
      )}
    </div>
  );
}

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header onNewDebate={() => router.push("/")} />

      <main className="max-w-2xl mx-auto px-4 py-16 flex-1 w-full">
        <Suspense fallback={<div className="card p-8 text-center">Loading...</div>}>
          <SuccessContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

