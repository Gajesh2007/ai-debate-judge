"use client";

interface JudgeStatus {
  name: string;
  status: "pending" | "evaluating" | "completed";
  winner?: string;
  confidence?: number;
}

interface ModerationStatus {
  approved: boolean;
  reason?: string;
  flags?: string[];
}

interface ProgressModalProps {
  message: string;
  progress: number;
  estimatedTimeRemaining?: number;
  judges?: JudgeStatus[];
  completedJudges?: number;
  totalJudges?: number;
  moderation?: ModerationStatus;
}

export function ProgressModal({
  message,
  progress,
  estimatedTimeRemaining,
  judges,
  completedJudges,
  totalJudges,
  moderation,
}: ProgressModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="card max-w-lg w-full animate-scale-in">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h3 className="text-xl font-medium mb-2">Analyzing Debate</h3>
            <p className="text-secondary">{message}</p>
          </div>

          {/* Moderation status */}
          {moderation && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              moderation.approved 
                ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" 
                : "bg-red-50 text-red-600"
            }`}>
              {moderation.approved ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {moderation.approved ? "Content approved" : "Content rejected"}
                </div>
                {moderation.reason && !moderation.approved && (
                  <div className="text-xs opacity-80 truncate">{moderation.reason}</div>
                )}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-mint)] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-secondary font-mono">
              <span>{progress}%</span>
              {estimatedTimeRemaining !== undefined && (
                <span>~{estimatedTimeRemaining}s remaining</span>
              )}
            </div>
          </div>

          {/* Judge statuses */}
          {judges && judges.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Council Progress ({completedJudges || 0}/{totalJudges || judges.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {judges.map((judge) => (
                  <div
                    key={judge.name}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                      judge.status === "completed"
                        ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"
                        : judge.status === "evaluating"
                          ? "bg-[var(--bg-elevated)]"
                          : "bg-[var(--bg-elevated)] text-secondary"
                    }`}
                  >
                    {judge.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border-2 border-current opacity-30" />
                    )}
                    {judge.status === "evaluating" && (
                      <svg
                        className="w-4 h-4 animate-spin text-[var(--accent-mint)]"
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
                    )}
                    {judge.status === "completed" && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    <span className="truncate font-mono text-xs">{judge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-secondary">
            <span className={progress >= 5 ? "text-[var(--accent-mint)]" : ""}>
              Check
            </span>
            <span>→</span>
            <span className={progress >= 15 ? "text-[var(--accent-mint)]" : ""}>
              Format
            </span>
            <span>→</span>
            <span className={progress >= 25 ? "text-[var(--accent-mint)]" : ""}>
              Council
            </span>
            <span>→</span>
            <span className={progress >= 90 ? "text-[var(--accent-mint)]" : ""}>
              Sign
            </span>
            <span>→</span>
            <span className={progress >= 95 ? "text-[var(--accent-mint)]" : ""}>
              Save
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
