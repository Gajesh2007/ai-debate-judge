"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { ResultView } from "../../components/ResultView";
import type { JudgeResponse } from "../../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface DebateClientProps {
  id: string;
}

export function DebateClient({ id }: DebateClientProps) {
  const router = useRouter();
  const [result, setResult] = useState<JudgeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJudgment() {
      try {
        const res = await fetch(`${API_URL}/judgments/${id}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Judgment not found");
        }

        const judgment = data.judgment;
        
        if (!judgment) {
          throw new Error("Judgment data is missing");
        }

        // Parse JSON fields if they're strings (with fallbacks)
        const voteCount =
          typeof judgment.voteCount === "string"
            ? JSON.parse(judgment.voteCount)
            : judgment.voteCount || {};
        const averageScores =
          typeof judgment.averageScores === "string"
            ? JSON.parse(judgment.averageScores)
            : judgment.averageScores || [];
        const formattedTranscript =
          typeof judgment.formattedTranscript === "string"
            ? JSON.parse(judgment.formattedTranscript)
            : judgment.formattedTranscript || { topic: "", speakers: [], segments: [], summary: "" };
        const individualJudgments =
          typeof judgment.individualJudgments === "string"
            ? JSON.parse(judgment.individualJudgments)
            : judgment.individualJudgments || [];

        const judgeResponse: JudgeResponse = {
          success: true,
          id: judgment.id,
          formattedTranscript,
          signedVerdict: {
            verdict: {
              finalWinner: judgment.finalWinner,
              unanimity: judgment.unanimity,
              voteCount,
              averageScores,
              individualJudgments,
              consensusSummary: judgment.consensusSummary,
            },
            hash: judgment.verdictHash,
            signature: judgment.signature,
            signerAddress: judgment.signerAddress,
            timestamp: judgment.signedAt,
          },
          prompts: data.prompts || undefined,
        };

        setResult(judgeResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load debate");
      } finally {
        setIsLoading(false);
      }
    }

    fetchJudgment();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <Header onNewDebate={() => router.push("/")} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg
              className="animate-spin w-10 h-10 mx-auto mb-4 text-[var(--accent-mint)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-secondary">Loading debate...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <Header onNewDebate={() => router.push("/")} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2">Debate Not Found</h2>
            <p className="text-secondary mb-6">{error || "This debate doesn't exist or has been removed."}</p>
            <button onClick={() => router.push("/")} className="btn-primary">
              Go to Gallery
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header onNewDebate={() => router.push("/")} />
      <main className="py-8 px-4 flex-1">
        <ResultView result={result} onBack={() => router.push("/")} debateId={id} />
      </main>
      <Footer />
    </div>
  );
}

