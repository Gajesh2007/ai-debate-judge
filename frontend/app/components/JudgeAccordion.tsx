"use client";

import { useState } from "react";
import type { IndividualJudgment } from "../types";

interface JudgeAccordionProps {
  judgments: IndividualJudgment[];
  winner: string;
}

// Assign consistent light colors to each model
const MODEL_COLORS: Record<string, string> = {
  "Grok 4.1 Fast Reasoning": "text-rose-600 bg-rose-50",
  "Gemini 3 Pro": "text-blue-600 bg-blue-50",
  "Claude Opus 4.5": "text-amber-600 bg-amber-50",
  "GPT-5.1 Thinking": "text-sky-600 bg-sky-50",
  "DeepSeek V3.2 Thinking": "text-emerald-600 bg-emerald-50",
  "Kimi K2 Thinking": "text-violet-600 bg-violet-50",
};

function getModelColor(name: string): { text: string; bg: string } {
  // Try exact match first
  const exact = MODEL_COLORS[name];
  if (exact) {
    const [text, bg] = exact.split(" ");
    return { text, bg };
  }
  
  // Try partial matches
  const lowerName = name.toLowerCase();
  if (lowerName.includes("grok")) return { text: "text-rose-600", bg: "bg-rose-50" };
  if (lowerName.includes("gemini")) return { text: "text-blue-600", bg: "bg-blue-50" };
  if (lowerName.includes("claude")) return { text: "text-amber-600", bg: "bg-amber-50" };
  if (lowerName.includes("gpt") || lowerName.includes("openai")) return { text: "text-sky-600", bg: "bg-sky-50" };
  if (lowerName.includes("deepseek")) return { text: "text-emerald-600", bg: "bg-emerald-50" };
  if (lowerName.includes("kimi") || lowerName.includes("moonshot")) return { text: "text-violet-600", bg: "bg-violet-50" };
  
  // Default
  return { text: "text-purple-600", bg: "bg-purple-50" };
}

export function JudgeAccordion({ judgments, winner }: JudgeAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Safety check
  if (!judgments || judgments.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-medium mb-2">Council reasoning</h3>
        <p className="text-secondary">No judge evaluations available.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <h3 className="text-lg font-medium p-6 pb-4">Council reasoning</h3>
      
      <div className="divide-y divide-[var(--border)]">
        {judgments.map((judgment, index) => {
          const isOpen = openIndex === index;
          const favorsWinner = judgment.evaluation.winner === winner;
          const colors = getModelColor(judgment.judge);
          
          return (
            <div key={index}>
              {/* Header */}
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`font-mono text-sm font-medium px-2 py-1 rounded-md ${colors.text} ${colors.bg}`}>
                    {judgment.judge}
                  </span>
                  <span className={`chip ${favorsWinner ? "chip-mint" : "chip-amber"}`}>
                    {judgment.evaluation.winner}
                  </span>
                  <span className="font-mono text-xs text-secondary">
                    {judgment.evaluation.confidence}%
                  </span>
                </div>
                <svg 
                  className={`w-5 h-5 text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Content */}
              {isOpen && (
                <div className="px-6 pb-6 animate-fade-in">
                  {/* Reasoning */}
                  <p className="text-secondary leading-relaxed mb-6">
                    {judgment.evaluation.reasoning}
                  </p>

                  {/* Key moments */}
                  {judgment.evaluation.keyMoments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Key moments</h4>
                      <div className="space-y-2">
                        {judgment.evaluation.keyMoments.map((moment, i) => (
                          <div 
                            key={i}
                            className="flex items-start gap-3 text-sm"
                          >
                            <span className={`chip text-xs ${moment.impact === "positive" ? "chip-mint" : "chip-amber"}`}>
                              {moment.speaker}
                            </span>
                            <span className="text-secondary">{moment.moment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual scores */}
                  <div className="mt-6 pt-4 border-t border-subtle">
                    <h4 className="text-sm font-medium mb-3">Scores</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {judgment.evaluation.scores.map((score) => (
                        <div 
                          key={score.speaker}
                          className={`p-3 rounded-lg bg-[var(--bg-elevated)] ${
                            score.speaker === judgment.evaluation.winner ? "ring-2 ring-[var(--accent-mint)]" : ""
                          }`}
                        >
                          <span className="font-medium text-sm block mb-2">{score.speaker}</span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-secondary">Arg:</span>{" "}
                              <span className="font-mono font-medium">{score.argumentation}</span>
                            </div>
                            <div>
                              <span className="text-secondary">Evi:</span>{" "}
                              <span className="font-mono font-medium">{score.evidence}</span>
                            </div>
                            <div>
                              <span className="text-secondary">Del:</span>{" "}
                              <span className="font-mono font-medium">{score.delivery}</span>
                            </div>
                            <div>
                              <span className="text-secondary">Reb:</span>{" "}
                              <span className="font-mono font-medium">{score.rebuttal}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-subtle">
                            <span className="text-secondary text-xs">Total:</span>{" "}
                            <span className="font-mono font-medium text-[var(--accent-mint)]">{score.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
