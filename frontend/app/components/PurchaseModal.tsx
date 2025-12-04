"use client";

import { useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useCredits } from "../contexts/CreditsContext";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PurchaseModal({ isOpen, onClose }: PurchaseModalProps) {
  const { isSignedIn, email, credits, packs, purchaseCredits } = useCredits();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (packId: string) => {
    if (!isSignedIn) return;

    setIsLoading(true);
    setError(null);
    setSelectedPack(packId);

    try {
      const checkoutUrl = await purchaseCredits(packId);
      // Redirect to Stripe
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setSelectedPack(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="card max-w-lg w-full animate-scale-in">
        {/* Header */}
        <div className="border-b border-subtle px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium">Get Analysis Credits</h2>
            <p className="text-sm text-secondary mt-1">
              Each debate analysis costs 1 credit
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost p-2 -mr-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Not signed in - show sign in prompt */}
          {!isSignedIn ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
                <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Sign in to continue</h3>
              <p className="text-secondary text-sm mb-6">
                Create an account to purchase credits and analyze debates.
              </p>
              <SignInButton mode="modal">
                <button type="button" className="btn-primary w-full">
                  Sign In with Google
                </button>
              </SignInButton>
            </div>
          ) : (
            <>
              {/* Current balance */}
              <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg">
                <div>
                  <p className="text-sm text-secondary">Signed in as</p>
                  <p className="font-medium truncate max-w-[200px]">{email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary">Current balance</p>
                  <p className="text-2xl font-mono font-medium text-[var(--accent-mint)]">
                    {credits}
                  </p>
                </div>
              </div>

              {/* Credit packs */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Purchase credits</p>
                {packs.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => handlePurchase(pack.id)}
                    disabled={isLoading}
                    className={`
                      w-full p-4 rounded-lg border-2 text-left transition-all
                      ${selectedPack === pack.id && isLoading
                        ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/10"
                        : "border-[var(--border)] hover:border-[var(--accent-mint)] hover:bg-[var(--bg-elevated)]"
                      }
                      ${isLoading && selectedPack !== pack.id ? "opacity-50" : ""}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{pack.name}</p>
                        <p className="text-sm text-secondary">
                          ${pack.pricePerCredit.toFixed(2)} per analysis
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-mono font-medium">${pack.price}</p>
                        {pack.credits > 1 && (
                          <p className="text-xs text-[var(--accent-mint)]">
                            Save ${((5 * pack.credits) - pack.price).toFixed(0)}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedPack === pack.id && isLoading && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-[var(--accent-mint)]">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Redirecting to checkout...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-subtle px-6 py-4">
          <p className="text-xs text-secondary text-center">
            Secure payment powered by Stripe. Credits never expire.
          </p>
        </div>
      </div>
    </div>
  );
}

