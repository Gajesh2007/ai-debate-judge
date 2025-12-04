"use client";

import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-subtle mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Tagline */}
          <p className="text-sm text-secondary">
            Many models. One clear verdict.
          </p>

          {/* Credits */}
          <div className="flex items-center gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1.5">
              Powered by{" "}
              <a 
                href="https://docs.eigencloud.xyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <Image 
                  src="/eigencloud.png" 
                  alt="EigenCloud" 
                  width={80} 
                  height={20}
                  className="inline-block"
                />
              </a>
            </span>
            <span className="text-[var(--border)]">·</span>
            <span>
              Hack by{" "}
              <a 
                href="https://x.com/gajesh" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-mint)] transition-colors"
              >
                Gajesh
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
