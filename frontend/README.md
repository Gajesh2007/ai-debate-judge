# AI Judge Frontend

Next.js app for the AI debate judge interface.

## Quick Start

```bash
# Install
npm install

# Development
npm run dev

# Production
npm run build && npm start
```

## Environment Variables

Create a `.env.local` file:

```bash
# ===================
# API
# ===================

# Backend API URL (default: http://localhost:3001)
NEXT_PUBLIC_API_URL=http://localhost:3001

# ===================
# Authentication (Clerk)
# ===================

# Required: Clerk API keys (from dashboard.clerk.com)
# Use pk_test_/sk_test_ for development, pk_live_/sk_live_ for production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Optional: Clerk sign-in/sign-up URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# ===================
# Storage
# ===================

# Vercel Blob token (for thumbnail uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

## Features

- **Gallery View** - Browse all past debate analyses
- **Upload Modal** - Submit transcript or audio for analysis
- **Result View** - Detailed verdict with scores and reasoning
- **Signature Verification** - Verify cryptographic signatures
- **Intro Modal** - First-time user onboarding

## Design System

### Typography

- **Untitled Sans** - UI, headings, body text
- **Berkeley Mono** - Scores, code, technical data

### Colors (Light Theme)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#FAFAFA` | Page background |
| `--bg-surface` | `#FFFFFF` | Cards |
| `--accent-mint` | `#059669` | Primary actions |
| `--accent-amber` | `#D97706` | Warnings |

### LLM Colors

| Model | Color |
|-------|-------|
| GPT-5.1 | Sky |
| Claude | Amber |
| Gemini | Blue |
| Grok | Rose |
| DeepSeek | Emerald |
| Kimi | Violet |

## Structure

```
app/
├── page.tsx              # Main gallery page
├── globals.css           # Design tokens & styles
├── types.ts              # TypeScript types
├── layout.tsx            # Root layout
├── api/
│   └── upload/
│       └── route.ts      # Vercel Blob upload
└── components/
    ├── Header.tsx        # App header with nav
    ├── Footer.tsx        # Credits footer
    ├── IntroModal.tsx    # Welcome modal
    ├── EmptyState.tsx    # No debates view
    ├── UploadModal.tsx   # Submit debate form
    ├── VerdictCard.tsx   # Gallery card
    ├── ResultView.tsx    # Full verdict display
    ├── ScoreBreakdown.tsx
    └── JudgeAccordion.tsx
```

## Fonts

Place font files in `public/fonts/`:

```
public/fonts/
├── UntitledSans/
│   ├── test-untitled-sans-regular.woff2
│   ├── test-untitled-sans-medium.woff2
│   └── ...
└── BerkeleyMono/
    └── BerkeleyMonoRegular.woff2
```

## Deployment

### Vercel (Recommended)

1. Connect repo to Vercel
2. Set environment variables
3. Deploy

### Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Vercel Blob (thumbnails)
