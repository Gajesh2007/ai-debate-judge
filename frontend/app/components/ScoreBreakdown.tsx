"use client";

import type { SpeakerScore } from "../types";

interface ScoreBreakdownProps {
  scores: SpeakerScore[];
  winner: string;
}

const DIMENSIONS = [
  { key: "argumentation", label: "Argumentation" },
  { key: "evidence", label: "Evidence" },
  { key: "delivery", label: "Delivery" },
  { key: "rebuttal", label: "Rebuttal" },
] as const;

export function ScoreBreakdown({ scores, winner }: ScoreBreakdownProps) {
  if (scores.length < 2) return null;

  // Find the winner and their main opponent (exclude moderators, hosts, etc.)
  const winnerScore = scores.find(s => s.speaker === winner);
  
  // Find opponent: highest scoring speaker that isn't the winner
  // Filter out common non-debater roles
  const nonDebaterPatterns = /moderator|host|interviewer|mc|emcee/i;
  const debaterScores = scores.filter(s => 
    s.speaker !== winner && !nonDebaterPatterns.test(s.speaker)
  );
  
  // Pick the opponent with highest total score (main competitor)
  const opponentScore = debaterScores.length > 0
    ? debaterScores.reduce((best, s) => s.total > best.total ? s : best, debaterScores[0])
    : scores.find(s => s.speaker !== winner);

  if (!winnerScore || !opponentScore) return null;

  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium mb-6">Score breakdown</h3>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="font-mono text-sm font-medium text-[var(--accent-mint)]">
          {winnerScore.speaker}
        </span>
        <span className="font-mono text-sm font-medium text-secondary">
          {opponentScore.speaker}
        </span>
      </div>

      {/* Dimensions */}
      <div className="space-y-4">
        {DIMENSIONS.map(({ key, label }) => {
          const score1 = winnerScore[key];
          const score2 = opponentScore[key];
          const total = score1 + score2;
          const percent1 = total > 0 ? (score1 / total) * 100 : 50;

          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-xs font-medium">{score1.toFixed(1)}</span>
                <span className="text-sm text-secondary">{label}</span>
                <span className="font-mono text-xs font-medium">{score2.toFixed(1)}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-elevated)]">
                <div 
                  className="bg-[var(--accent-mint)] transition-all duration-500"
                  style={{ width: `${percent1}%` }}
                />
                <div 
                  className="bg-gray-300 transition-all duration-500"
                  style={{ width: `${100 - percent1}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total scores */}
      <div className="mt-6 pt-6 border-t border-subtle">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <span className="block font-mono text-2xl font-medium text-[var(--accent-mint)]">
              {winnerScore.total.toFixed(1)}
            </span>
            <span className="text-xs text-secondary">Total</span>
          </div>
          <span className="text-secondary font-medium">vs</span>
          <div className="text-center">
            <span className="block font-mono text-2xl font-medium">
              {opponentScore.total.toFixed(1)}
            </span>
            <span className="text-xs text-secondary">Total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
