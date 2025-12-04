"use client";

import Image from "next/image";
import type { JudgmentSummary } from "../types";

interface VerdictCardProps {
  judgment: JudgmentSummary;
  onClick?: () => void;
}

export function VerdictCard({ judgment, onClick }: VerdictCardProps) {
  // Parse voteCount if it's a string (from JSON)
  const voteCount = typeof judgment.voteCount === "string" 
    ? JSON.parse(judgment.voteCount) 
    : judgment.voteCount || {};

  const votes = Object.entries(voteCount);
  const totalVotes = votes.reduce((sum, [, count]) => sum + (count as number), 0);
  const winnerVotes = (voteCount[judgment.finalWinner] as number) || 0;
  const winnerPercent = totalVotes > 0 ? Math.round((winnerVotes / totalVotes) * 100) : 50;
  
  const opponents = Object.keys(voteCount).filter(s => s !== judgment.finalWinner);
  const opponent = opponents[0] || "Opposition";
  const opponentVotes = (voteCount[opponent] as number) || 0;
  const opponentPercent = 100 - winnerPercent;

  // Handle date - could be string or Date object
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div 
      className="card overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      {judgment.thumbnail ? (
        <div className="relative h-40 bg-[var(--bg-elevated)]">
          <Image
            src={judgment.thumbnail}
            alt={judgment.topic}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-emerald-50 to-sky-50 flex items-center justify-center">
          <svg className="w-12 h-12 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      )}

      <div className="p-5">
        {/* Topic */}
        <h3 className="font-medium mb-1 group-hover:text-[var(--accent-mint)] transition-colors line-clamp-1">
          {judgment.topic}
        </h3>
        
        {/* Description */}
        {judgment.description && (
          <p className="text-secondary text-sm mb-4 line-clamp-2">
            {judgment.description}
          </p>
        )}

        {/* Winner badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="chip chip-mint">
            {judgment.finalWinner} wins
          </span>
          {judgment.unanimity && (
            <span className="chip">Unanimous</span>
          )}
        </div>

        {/* Verdict bar */}
        <div className="mb-3">
          <div className="verdict-bar">
            <div 
              className="verdict-bar-fill"
              style={{ width: `${winnerPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="font-mono text-xs text-[var(--accent-mint)]">{winnerPercent}%</span>
            <span className="font-mono text-xs text-secondary">{opponentPercent}%</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-secondary">
          <span className="font-mono">
            {totalVotes} judges · {winnerVotes}–{opponentVotes}
          </span>
          <span>
            {formatDate(judgment.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
