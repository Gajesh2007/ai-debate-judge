"use client";

import { useState } from "react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useCredits } from "../contexts/CreditsContext";

interface HeaderProps {
  onNewDebate: () => void;
}

export function Header({ onNewDebate }: HeaderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { isSignedIn, credits } = useCredits();

  return (
    <header className="header sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <a
          href="/"
          className="group flex items-center gap-0 select-none cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* AI badge - monospace, tech feel */}
          <span 
            className="font-mono text-[13px] font-medium tracking-tight bg-[var(--accent-mint)] text-white px-1.5 py-0.5 rounded-md mr-2"
            style={{
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 150ms ease-out',
            }}
          >
            AI
          </span>
          
          {/* Main title with staggered letter animation on hover */}
          <span className="relative">
            <span 
              className="font-semibold text-lg tracking-[-0.02em]"
              style={{
                color: isHovered ? 'transparent' : 'var(--text-primary)',
                backgroundImage: isHovered 
                  ? 'linear-gradient(135deg, var(--accent-mint) 0%, #10b981 100%)' 
                  : 'none',
                backgroundClip: isHovered ? 'text' : 'border-box',
                WebkitBackgroundClip: isHovered ? 'text' : 'border-box',
                transition: 'color 200ms ease-out',
              }}
            >
              Debate Judge
            </span>
            
            {/* Animated underline */}
            <span 
              className="absolute -bottom-0.5 left-0 h-[2px] bg-gradient-to-r from-[var(--accent-mint)] to-[#10b981] rounded-full"
              style={{
                width: isHovered ? '100%' : '0%',
                transition: 'width 250ms ease-out',
              }}
            />
          </span>
          
          {/* Blinking cursor on hover */}
          <span 
            className="font-mono text-[var(--accent-mint)] ml-0.5"
            style={{
              opacity: isHovered ? 1 : 0,
              animation: isHovered ? 'blink 1s step-end infinite' : 'none',
              transition: 'opacity 150ms ease-out',
            }}
          >
            _
          </span>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {isSignedIn ? (
            <>
              {/* Credit balance */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="font-mono font-medium text-[var(--accent-mint)] bg-[var(--accent-mint)]/10 px-2 py-0.5 rounded">
                  {credits} credit{credits !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Action button */}
        <button
          type="button"
          onClick={onNewDebate}
          className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
                {credits > 0 ? "Judge a Debate" : "Get Credits"}
              </button>

              {/* User menu */}
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9",
                  },
                }}
              />
            </>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4"
              >
                Sign In to Start
        </button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
