"use client";

import { useState } from "react";
import type { JudgePrompts } from "../types";

interface PromptsViewerProps {
  prompts: JudgePrompts;
}

export function PromptsViewer({ prompts }: PromptsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"system" | "user">("system");

  const downloadPrompts = () => {
    const text = `=== SYSTEM PROMPT ===\n\n${prompts.system}\n\n=== USER PROMPT ===\n\n${prompts.user}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-judge-prompts.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPrompts = () => {
    const text = `=== SYSTEM PROMPT ===\n\n${prompts.system}\n\n=== USER PROMPT ===\n\n${prompts.user}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="card mt-6 animate-fade-in delay-5">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-medium">AI Prompts</h3>
          <p className="text-sm text-secondary mt-1">
            See the exact prompts given to the AI judges
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Prompts content */}
      {isExpanded && (
        <div className="border-t border-subtle">
          {/* Tabs */}
          <div className="flex border-b border-subtle">
            <button
              type="button"
              onClick={() => setActiveTab("system")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "system"
                  ? "text-[var(--accent-mint)] border-b-2 border-[var(--accent-mint)]"
                  : "text-secondary hover:text-primary"
              }`}
            >
              System Prompt
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("user")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "user"
                  ? "text-[var(--accent-mint)] border-b-2 border-[var(--accent-mint)]"
                  : "text-secondary hover:text-primary"
              }`}
            >
              User Prompt
            </button>
          </div>

          {/* Prompt content */}
          <div className="p-6 max-h-[500px] overflow-y-auto">
            <pre className="font-mono text-sm text-secondary whitespace-pre-wrap leading-relaxed">
              {activeTab === "system" ? prompts.system : prompts.user}
            </pre>
          </div>

          {/* Footer with copy and download buttons */}
          <div className="border-t border-subtle px-6 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={copyPrompts}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            <button
              type="button"
              onClick={downloadPrompts}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

