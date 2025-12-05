"use client";

interface IntroModalProps {
  onClose: () => void;
}

export function IntroModal({ onClose }: IntroModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="card max-w-lg w-full p-8 animate-scale-in">
        {/* Title */}
        <h2 className="text-2xl font-medium text-center mb-3">
          Welcome to <span className="text-[var(--accent-mint)]">AI Debate Judge</span>
        </h2>

        {/* Subtitle */}
        <p className="text-secondary text-center mb-8">
          Get your debates analyzed by a council of five frontier AI models.
        </p>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sky-600 font-mono text-sm font-medium">5</span>
            </div>
            <div>
              <h3 className="font-medium mb-1">Five AI Models</h3>
              <p className="text-sm text-secondary">
                Grok, Gemini, Claude, GPT, and DeepSeek evaluate independently.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium mb-1">Detailed Scores</h3>
              <p className="text-sm text-secondary">
                Each side scored on argumentation, evidence, delivery, and rebuttal.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium mb-1">Signed Verdicts</h3>
              <p className="text-sm text-secondary">
                Every judgment is cryptographically signed and verifiable.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onClose}
          className="btn-primary w-full"
        >
          Get Started
        </button>

        {/* Skip text */}
        <p className="text-xs text-secondary text-center mt-4">
          You can upload a transcript or audio recording to begin.
        </p>
      </div>
    </div>
  );
}

