"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { IntroModal } from "./components/IntroModal";
import { EmptyState } from "./components/EmptyState";
import { UploadModal } from "./components/UploadModal";
import { ProgressModal } from "./components/ProgressModal";
import { VerdictCard } from "./components/VerdictCard";
import type { JudgmentSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProgressState {
  message: string;
  progress: number;
  estimatedTimeRemaining?: number;
  judges?: Array<{
    name: string;
    status: "pending" | "evaluating" | "completed";
    winner?: string;
    confidence?: number;
  }>;
  completedJudges?: number;
  totalJudges?: number;
  moderation?: {
    approved: boolean;
    reason?: string;
    flags?: string[];
  };
}

type SortOrder = "newest" | "oldest";

export default function Home() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [judgments, setJudgments] = useState<JudgmentSummary[]>([]);
  const [isLoadingJudgments, setIsLoadingJudgments] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Check if first visit and fetch judgments
  useEffect(() => {
    const hasVisited = localStorage.getItem("ai-judge-visited");
    if (!hasVisited) {
      setShowIntro(true);
    }
    fetchJudgments();
  }, []);

  async function fetchJudgments() {
    setIsLoadingJudgments(true);
    try {
      const res = await fetch(`${API_URL}/judgments?limit=50`);
      const data = await res.json();
      if (data.success) {
        setJudgments(data.judgments);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingJudgments(false);
    }
  }

  // Filter and sort judgments
  const filteredJudgments = useMemo(() => {
    let result = [...judgments];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.topic.toLowerCase().includes(query) ||
          j.description?.toLowerCase().includes(query) ||
          j.finalWinner.toLowerCase().includes(query)
      );
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [judgments, searchQuery, sortOrder]);

  function handleCloseIntro() {
    localStorage.setItem("ai-judge-visited", "true");
    setShowIntro(false);
  }

  function handleOpenUpload() {
    setShowUpload(true);
    setError(null);
  }

  async function handleSubmit(data: {
    topic: string;
    description?: string;
    thumbnail?: string;
    transcript?: string;
  }) {
    setIsLoading(true);
    setError(null);
    setShowUpload(false);
    setProgressState({
      message: "Starting analysis...",
      progress: 5,
      estimatedTimeRemaining: 120,
    });

    try {
      const response = await fetch(`${API_URL}/judge/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: data.topic,
          description: data.description,
          thumbnail: data.thumbnail,
          transcript: data.transcript,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to analyze debate");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;
              
              const eventData = JSON.parse(jsonStr);

              if (eventData.step === "complete" && eventData.result) {
                // Navigate to the debate page
                const debateId = eventData.result.id;
                setProgressState(null);
                fetchJudgments();
                if (debateId) {
                  router.push(`/debate/${debateId}`);
                }
              } else if (eventData.step === "error") {
                throw new Error(eventData.error || "Unknown error");
              } else {
                setProgressState((prev) => ({
                  message: eventData.message || "Processing...",
                  progress: eventData.progress || 0,
                  estimatedTimeRemaining: eventData.estimatedTimeRemaining,
                  judges: eventData.judges || prev?.judges,
                  completedJudges: eventData.completedJudges,
                  totalJudges: eventData.totalJudges,
                  moderation: eventData.moderation || prev?.moderation,
                }));
              }
            } catch (parseError) {
              // Ignore parse errors for partial data
              console.debug("SSE parse error:", parseError);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setProgressState(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header onNewDebate={handleOpenUpload} />

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Loading state */}
        {isLoadingJudgments ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin w-8 h-8 text-[var(--accent-mint)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : judgments.length === 0 ? (
          /* Empty state */
          <EmptyState onNewDebate={handleOpenUpload} />
        ) : (
          /* Gallery */
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-medium mb-2">Debate Gallery</h1>
              <p className="text-secondary">
                {judgments.length} debate{judgments.length !== 1 ? "s" : ""} analyzed by the council
              </p>
            </div>

            {/* Search and sort row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              {/* Search bar */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search debates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-mint)] focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary hover:text-[var(--text-primary)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-mint)] focus:border-transparent sm:w-auto"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            {/* Results */}
            {filteredJudgments.length === 0 && searchQuery ? (
              <div className="text-center py-16">
                <p className="text-secondary mb-2">No debates found matching &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[var(--accent-mint)] hover:underline text-sm"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJudgments.map((judgment, index) => (
                  <div 
                    key={judgment.id} 
                    className={`animate-fade-in`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <VerdictCard 
                      judgment={judgment}
                      onClick={() => router.push(`/debate/${judgment.id}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Intro modal */}
      {showIntro && <IntroModal onClose={handleCloseIntro} />}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      )}

      {/* Progress modal */}
      {progressState && (
        <ProgressModal
          message={progressState.message}
          progress={progressState.progress}
          estimatedTimeRemaining={progressState.estimatedTimeRemaining}
          judges={progressState.judges}
          completedJudges={progressState.completedJudges}
          totalJudges={progressState.totalJudges}
          moderation={progressState.moderation}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-md p-4 rounded-lg bg-amber-50 border border-amber-200 shadow-lg animate-slide-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-amber-800">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
        </div>
      )}
    </div>
  );
}
