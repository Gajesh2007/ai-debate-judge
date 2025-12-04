"use client";

import { useState } from "react";
import type { FormattedTranscript } from "../types";

interface TranscriptViewerProps {
  transcript: FormattedTranscript;
}

// Assign colors to speakers
const SPEAKER_COLORS = [
  "text-emerald-600",
  "text-blue-600",
  "text-purple-600",
  "text-amber-600",
  "text-rose-600",
  "text-cyan-600",
];

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Map speakers to colors
  const speakerColors: Record<string, string> = {};
  transcript.speakers.forEach((speaker, index) => {
    speakerColors[speaker.id] = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
  });

  return (
    <div className="card mt-6 animate-fade-in delay-5">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-medium">Full Transcript</h3>
          <p className="text-sm text-secondary mt-1">
            {transcript.segments.length} segments · Used for evaluation
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

      {/* Transcript content */}
      {isExpanded && (
        <div className="border-t border-subtle">
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {transcript.segments.map((segment, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-24">
                  <span className={`font-mono text-xs font-medium ${speakerColors[segment.speaker] || "text-secondary"}`}>
                    {segment.speaker}
                  </span>
                  {segment.timestamp && (
                    <span className="block text-xs text-secondary mt-0.5">
                      {segment.timestamp}
                    </span>
                  )}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-secondary">
                  {segment.text}
                </p>
              </div>
            ))}
          </div>

          {/* Footer with copy and download buttons */}
          <div className="border-t border-subtle px-6 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const text = transcript.segments
                  .map((s) => `[${s.speaker}]: ${s.text}`)
                  .join("\n\n");
                navigator.clipboard.writeText(text);
              }}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                const text = transcript.segments
                  .map((s) => `[${s.speaker}]: ${s.text}`)
                  .join("\n\n");
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "transcript.txt";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
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

