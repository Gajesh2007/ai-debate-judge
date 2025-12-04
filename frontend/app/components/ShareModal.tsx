"use client";

import { useRef, useState } from "react";
import type { CouncilVerdict, FormattedTranscript } from "../types";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  verdict: CouncilVerdict;
  transcript: FormattedTranscript;
  debateUrl: string;
}

export function ShareModal({ isOpen, onClose, verdict, transcript, debateUrl }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const voteCount = typeof verdict.voteCount === "string" 
    ? JSON.parse(verdict.voteCount) 
    : verdict.voteCount;

  const totalVotes = Object.values(voteCount).reduce((sum: number, v) => sum + (v as number), 0);
  const winnerVotes = (voteCount[verdict.finalWinner] as number) || 0;
  const winnerPercent = totalVotes > 0 ? Math.round((winnerVotes / totalVotes) * 100) : 50;

  // Find opponent: filter out moderators/hosts and pick the one with most votes
  const nonDebaterPatterns = /moderator|host|interviewer|mc|emcee/i;
  const opponents = Object.keys(voteCount)
    .filter((s) => s !== verdict.finalWinner && !nonDebaterPatterns.test(s));
  
  // Pick opponent with highest vote count
  const opponent = opponents.length > 0
    ? opponents.reduce((best, s) => (voteCount[s] > voteCount[best] ? s : best), opponents[0])
    : Object.keys(voteCount).find(s => s !== verdict.finalWinner) || "Opposition";
  const opponentVotes = (voteCount[opponent] as number) || 0;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(debateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#FAFAFA",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `${transcript.topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}-verdict.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to download:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#FAFAFA",
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch (err) {
            // Fallback to download if clipboard fails
            handleDownload();
          }
        }
      }, "image/png");
    } catch (err) {
      console.error("Failed to copy image:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="card max-w-[560px] w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-surface)] border-b border-subtle px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">Share Verdict</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-2 -mr-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Shareable Card - fixed size for consistent image generation */}
          <div
            ref={cardRef}
            style={{ 
              width: 500,
              minHeight: 360,
              padding: 28,
              background: "linear-gradient(135deg, #FAFAFA 0%, #F0F0F0 100%)",
              borderRadius: 16,
              border: "1px solid #E0E0E0",
            }}
          >
            {/* Brand name */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#059669", letterSpacing: "-0.01em" }}>AI Debate Judge</span>
            </div>

            {/* Topic */}
            <h3 style={{ 
              fontSize: 18, 
              fontWeight: 600, 
              color: "#1A1A1A", 
              marginBottom: 20,
              lineHeight: 1.4,
              overflowWrap: "break-word",
              wordWrap: "break-word",
            }}>
              {transcript.topic}
            </h3>

            {/* Winner card */}
            <div style={{ 
              background: "white", 
              borderRadius: 12, 
              padding: 20, 
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: "#555555" }}>Winner</span>
                {verdict.unanimity && (
                  <span style={{ 
                    fontSize: 12, 
                    background: "rgba(5, 150, 105, 0.1)", 
                    color: "#059669",
                    padding: "4px 10px",
                    borderRadius: 20,
                  }}>
                    Unanimous
                  </span>
                )}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#059669", marginBottom: 8 }}>
                {verdict.finalWinner}
              </div>
              <div style={{ fontSize: 14, color: "#555555" }}>
                {winnerVotes}–{opponentVotes}
              </div>
            </div>

            {/* Verdict bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555555", marginBottom: 6 }}>
                <span>{verdict.finalWinner}</span>
                <span>{opponent}</span>
              </div>
              <div style={{ height: 8, background: "#E0E0E0", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ 
                  height: "100%", 
                  width: `${winnerPercent}%`, 
                  background: "#059669",
                  borderRadius: 4,
                }} />
              </div>
            </div>

            {/* Council info */}
            <div style={{ fontSize: 13, color: "#555555" }}>
              Judged by {totalVotes} AI models · getjudgedbyai.com
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyImage}
              disabled={downloading}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {downloading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? "Copied!" : "Copy Image"}
            </button>

            <button onClick={handleDownload} disabled={downloading} className="btn-secondary flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>

          {/* Copy link */}
          <div className="flex gap-2">
            <input
              type="text"
              value={debateUrl}
              readOnly
              className="flex-1 font-mono text-sm"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button onClick={handleCopyLink} className="btn-secondary px-4">
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

