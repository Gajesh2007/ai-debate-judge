"use client";

interface EmptyStateProps {
  onNewDebate: () => void;
}

export function EmptyState({ onNewDebate }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>

      {/* Text */}
      <h3 className="text-xl font-medium mb-2">No debates yet</h3>
      <p className="text-secondary mb-8 max-w-md mx-auto">
        Upload a debate transcript or audio recording to get it analyzed by six AI models.
      </p>

      {/* CTA */}
      <button
        type="button"
        onClick={onNewDebate}
        className="btn-primary inline-flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Judge a Debate
      </button>
    </div>
  );
}

