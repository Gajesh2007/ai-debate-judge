"use client";

import { useState } from "react";
import type { JudgeResponse } from "../types";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { JudgeAccordion } from "./JudgeAccordion";
import { ShareModal } from "./ShareModal";
import { TranscriptViewer } from "./TranscriptViewer";
import { PromptsViewer } from "./PromptsViewer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ResultViewProps {
  result: JudgeResponse;
  onBack: () => void;
  debateId?: string;
}

interface VerificationResult {
  valid: boolean;
  expectedSigner: string;
  recoveredSigner: string | null;
  hashMatch: boolean;
}

export function ResultView({ result, onBack, debateId }: ResultViewProps) {
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  const { signedVerdict, formattedTranscript } = result;
  const { verdict } = signedVerdict;
  
  const totalVotes = Object.values(verdict.voteCount).reduce((a, b) => a + b, 0);
  const winnerVotes = verdict.voteCount[verdict.finalWinner] || 0;
  const opponents = Object.keys(verdict.voteCount).filter(s => s !== verdict.finalWinner);
  const opponent = opponents[0] || "Opposition";
  const opponentVotes = verdict.voteCount[opponent] || 0;
  
  // Use vote count for percentages (how many judges voted for each side)
  const winnerPercent = totalVotes > 0 ? Math.round((winnerVotes / totalVotes) * 100) : 50;

  const avgConfidence = Math.round(
    verdict.individualJudgments.reduce((sum, j) => sum + j.evaluation.confidence, 0) / 
    verdict.individualJudgments.length
  );

  // Build shareable URL
  const shareId = debateId || result.id;
  const debateUrl = shareId 
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/debate/${shareId}`
    : "";

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);

    try {
      const response = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: signedVerdict.verdict,
          hash: signedVerdict.hash,
          signature: signedVerdict.signature,
          signerAddress: signedVerdict.signerAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setVerification(data);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with back and share */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost flex items-center gap-2 -ml-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to gallery
        </button>

        {shareId && (
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        )}
      </div>

      {/* Summary verdict card */}
      <div className="card p-8 mb-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <span className="chip chip-mint font-medium">Council verdict</span>
          {verdict.unanimity && (
            <span className="chip">Unanimous</span>
          )}
        </div>

        {/* Winner */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium mb-2">
            <span className="text-[var(--accent-mint)]">{verdict.finalWinner}</span> wins
          </h1>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-medium text-[var(--accent-mint)]">{winnerVotes}</span>
            <span className="text-secondary text-2xl">–</span>
            <span className="font-mono text-4xl font-medium text-secondary">{opponentVotes}</span>
          </div>
        </div>

        {/* Verdict bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-sm text-[var(--accent-mint)]">{verdict.finalWinner}</span>
            <span className="font-mono text-sm text-secondary">{opponent}</span>
          </div>
          <div className="verdict-bar h-3">
            <div 
              className="verdict-bar-fill"
              style={{ width: `${winnerPercent}%` }}
            />
          </div>
        </div>

        {/* Consensus summary */}
        <p className="text-secondary leading-relaxed mb-6">
          {verdict.consensusSummary}
        </p>

        {/* Stats footer */}
        <div className="pt-6 border-t border-subtle">
          <p className="font-mono text-sm text-secondary">
            {totalVotes} judges · {winnerVotes} for {verdict.finalWinner} · {opponentVotes} for {opponent} · avg confidence {avgConfidence}%
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="mb-6 animate-fade-in delay-1">
        <ScoreBreakdown 
          scores={verdict.averageScores} 
          winner={verdict.finalWinner}
        />
      </div>

      {/* Council reasoning */}
      <div className="mb-6 animate-fade-in delay-2">
        <JudgeAccordion 
          judgments={verdict.individualJudgments}
          winner={verdict.finalWinner}
        />
      </div>

      {/* Verification section */}
      <div className="card p-6 animate-fade-in delay-3">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium">Verification</h3>
          
          {!verification ? (
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${verifying 
                  ? "bg-[var(--bg-elevated)] text-secondary cursor-wait" 
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                }
              `}
            >
              {verifying ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify Signature
                </>
              )}
            </button>
          ) : verification.valid ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium text-sm">Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-sm">Invalid</span>
            </div>
          )}
        </div>

        {verification && (
          <div className={`mb-6 p-4 rounded-lg ${verification.valid ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex items-center gap-2">
                {verification.hashMatch ? (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="text-secondary">Hash matches:</span>
                <span className={verification.hashMatch ? "text-emerald-700" : "text-amber-700"}>
                  {verification.hashMatch ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {verification.valid ? (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="text-secondary">Signature valid:</span>
                <span className={verification.valid ? "text-emerald-700" : "text-amber-700"}>
                  {verification.valid ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        )}

        {verifyError && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-100">
            <p className="font-mono text-sm text-amber-700">{verifyError}</p>
          </div>
        )}

        {/* Signature details */}
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-secondary">Hash</span>
            <span className="text-xs truncate max-w-[280px]">{signedVerdict.hash}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Signer</span>
            <span className="text-xs">{signedVerdict.signerAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Time</span>
            <span className="text-xs">
              {new Date(signedVerdict.timestamp).toLocaleString()}
            </span>
          </div>
          {result.id && (
            <div className="flex justify-between">
              <span className="text-secondary">ID</span>
              <span className="text-xs">{result.id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Transcript summary */}
      <div className="card p-6 mt-6 animate-fade-in delay-4">
        <h3 className="text-lg font-medium mb-4">Debate summary</h3>
        <p className="text-secondary leading-relaxed mb-4">
          {formattedTranscript.summary}
        </p>
        <div className="flex flex-wrap gap-2">
          {formattedTranscript.speakers.map((speaker) => (
            <span key={speaker.id} className="chip">
              {speaker.id} · {speaker.position}
            </span>
          ))}
        </div>
      </div>

      {/* Full transcript */}
      <TranscriptViewer transcript={formattedTranscript} />

      {/* AI Prompts - for transparency */}
      {result.prompts && (
        <PromptsViewer prompts={result.prompts} />
      )}

      {/* Share Modal */}
      {showShare && debateUrl && (
        <ShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          verdict={verdict}
          transcript={formattedTranscript}
          debateUrl={debateUrl}
        />
      )}
    </div>
  );
}
