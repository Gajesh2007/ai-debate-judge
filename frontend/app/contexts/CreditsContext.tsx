"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CreditPack {
  id: string;
  name: string;
  price: number;
  credits: number;
  pricePerCredit: number;
}

interface CreditsContextType {
  userId: string | null;
  email: string | null;
  credits: number;
  packs: CreditPack[];
  isLoading: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  refreshCredits: () => Promise<void>;
  purchaseCredits: (packId: string) => Promise<string>;
}

const CreditsContext = createContext<CreditsContextType | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const [credits, setCredits] = useState(0);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress || null;

  // Fetch packs on mount
  useEffect(() => {
    fetchPacks();
  }, []);

  // Fetch credits when user signs in
  useEffect(() => {
    if (isSignedIn && userId) {
      refreshCredits();
    } else {
      setCredits(0);
    }
  }, [isSignedIn, userId]);

  async function fetchPacks() {
    try {
      const res = await fetch(`${API_URL}/credits/packs`);
      const data = await res.json();
      if (data.success) {
        setPacks(data.packs);
      }
    } catch {
      // Use defaults
      setPacks([
        { id: "pack_1", name: "1 Analysis", price: 5, credits: 1, pricePerCredit: 5 },
        { id: "pack_5", name: "5 Analyses", price: 20, credits: 5, pricePerCredit: 4 },
        { id: "pack_10", name: "10 Analyses", price: 35, credits: 10, pricePerCredit: 3.5 },
      ]);
    }
  }

  const refreshCredits = useCallback(async () => {
    if (!isSignedIn || !userId) return;
    
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/credits/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCredits(data.credits);
      }
    } catch {
      // Keep current credits
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, userId, getToken]);

  const purchaseCredits = useCallback(async (packId: string): Promise<string> => {
    if (!isSignedIn || !userId) {
      throw new Error("Must be signed in");
    }

    const token = await getToken();
    const res = await fetch(`${API_URL}/checkout`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ packId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create checkout");
    }

    return data.url;
  }, [isSignedIn, userId, getToken]);

  const getTokenFn = useCallback(async () => {
    if (!isSignedIn) return null;
    return getToken();
  }, [isSignedIn, getToken]);

  return (
    <CreditsContext.Provider
      value={{
        userId: userId || null,
        email,
        credits,
        packs,
        isLoading,
        isSignedIn: !!isSignedIn,
        getToken: getTokenFn,
        refreshCredits,
        purchaseCredits,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error("useCredits must be used within CreditsProvider");
  }
  return context;
}

