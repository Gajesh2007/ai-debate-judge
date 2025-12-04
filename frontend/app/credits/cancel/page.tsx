"use client";

import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export default function CancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header onNewDebate={() => router.push("/")} />

      <main className="max-w-2xl mx-auto px-4 py-16 flex-1 w-full">
        <div className="card p-8 text-center animate-scale-in">
          {/* Cancel icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-medium mb-2">Payment Cancelled</h1>
          <p className="text-secondary mb-6">
            No worries! You can purchase credits anytime you&apos;re ready.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-primary"
            >
              Back to Gallery
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

