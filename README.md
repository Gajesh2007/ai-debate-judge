# AI Judge

**Many models. One clear verdict.**

Upload a debate transcript or audio recording. Five frontier AI models independently evaluate both sides, then deliver a signed verdict with detailed reasoning.

![AI Judge](frontend/public/logo.png)

## How It Works

1. **Upload** - Paste transcript or upload audio (up to 300MB)
2. **Transcribe** - Audio is transcribed via OpenAI Whisper (auto-chunked)
3. **Format** - Gemini 2.5 Flash structures the debate and identifies speakers
4. **Evaluate** - Five reasoning models score independently:
   - GPT-5.1 Thinking (OpenAI)
   - Claude Opus 4.5 (Anthropic)
   - Gemini 3 Pro (Google)
   - Grok 4.1 Fast Reasoning (xAI)
   - DeepSeek V3.2 Thinking
5. **Verdict** - Votes aggregated, scores averaged, consensus generated
6. **Sign** - Result cryptographically signed with wallet

## Scoring Criteria

Each speaker is scored 0-10 on:

- **Argumentation** - Quality, logic, and structure of arguments
- **Evidence** - Use of facts, examples, and supporting evidence
- **Delivery** - Clarity, persuasiveness, and rhetorical effectiveness
- **Rebuttal** - Effectiveness in addressing opponent's arguments

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm (backend) / npm (frontend)
- PostgreSQL (optional, for persistence)

### Environment Variables

**Backend** (`.env`):
```bash
# AI & Transcription
AI_GATEWAY_API_KEY=...        # Vercel AI Gateway
OPENAI_API_KEY=...            # For Whisper transcription
MNEMONIC=...                  # 12/24 word seed phrase for signing
DATABASE_URL=...              # PostgreSQL connection

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_...  # From Clerk dashboard
CLERK_PUBLISHABLE_KEY=pk_test_...

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_test_... # From Stripe dashboard
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret

# Optional
PORT=3001
NODE_ENV=development
```

**Frontend** (`.env.local`):
```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Storage
BLOB_READ_WRITE_TOKEN=...     # For thumbnail uploads
```

### Run Locally

```bash
# Backend
cd backend
pnpm install
pnpm dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
AIJudge/
├── backend/                 # Hono API server
│   ├── src/
│   │   ├── config/          # LLM providers
│   │   ├── db/              # PostgreSQL
│   │   ├── schemas/         # Zod schemas
│   │   ├── services/
│   │   │   ├── transcription.ts   # Whisper
│   │   │   ├── formatting.ts      # Gemini
│   │   │   ├── council.ts         # 6 LLMs
│   │   │   └── signing.ts         # viem
│   │   └── index.ts         # API routes
│   ├── Dockerfile
│   └── README.md
│
├── frontend/                # Next.js app
│   ├── app/
│   │   ├── components/      # React components
│   │   ├── api/upload/      # Blob uploads
│   │   └── page.tsx         # Gallery
│   ├── public/fonts/        # Untitled Sans, Berkeley Mono
│   └── README.md
│
└── README.md                # This file
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/judge/stream` | Yes | Analyze a debate (SSE) |
| `GET` | `/judgments` | No | List all judgments |
| `GET` | `/judgments/:id` | No | Get judgment details |
| `POST` | `/verify` | No | Verify signature |
| `GET` | `/credits` | Yes | Get user's credit balance |
| `GET` | `/credits/packs` | No | List credit packs |
| `POST` | `/checkout` | Yes | Create Stripe checkout session |
| `POST` | `/webhooks/stripe` | No | Stripe webhook handler |

## Pricing

| Mode | Cost | Description |
|------|------|-------------|
| **Default Council** | 1 credit ($5) | 5 frontier AI models judge your debate |
| **Custom Models** | 1 credit/model | Pick specific models ($1 each) |

**Credit Packs:**
- 1 Analysis: $5
- 5 Analyses: $20 ($4/each)
- 10 Analyses: $35 ($3.50/each)

Payments via Stripe. Coupons supported.

## Tech Stack

**Backend:**
- Hono (API framework)
- Vercel AI SDK + AI Gateway
- PostgreSQL + postgres.js
- viem (Ethereum signing)
- Clerk (authentication)
- Stripe (payments)
- Zod (validation)

**Frontend:**
- Next.js 16 + React 19
- Tailwind CSS 4
- Clerk (auth UI)
- Vercel Blob (thumbnails)

## Deployment

### Docker

```bash
# Backend
cd backend
docker build -t ai-judge-backend .
docker run -p 3001:3001 -e ... ai-judge-backend
```

### Vercel

Frontend deploys automatically with Vercel. Set environment variables in project settings.

## Credits

- **Powered by** [EigenCloud](https://eigencloud.com)
- **Hack by** [Gajesh](https://x.com/gajesh)

## License

MIT

