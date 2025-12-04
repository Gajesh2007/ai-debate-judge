# AI Judge Backend

Council of LLMs for debate evaluation with cryptographic signing.

## Quick Start

```bash
# Install
pnpm install

# Development
pnpm dev

# Production
pnpm build && pnpm start
```

## Environment Variables

Create a `.env` file:

```bash
# ===================
# AI & Transcription
# ===================

# Required: AI Gateway API Key (for multi-provider LLM access)
AI_GATEWAY_API_KEY=your_gateway_key

# Required: OpenAI API Key (for Whisper transcription if using OpenAI)
OPENAI_API_KEY=sk-...

# Optional: Transcription provider ("openai" or "lemonfox", default: openai)
TRANSCRIPTION_PROVIDER=openai

# Optional: Lemonfox API Key (if using Lemonfox for transcription)
# Lemonfox has speaker diarization and is cheaper ($0.50/3hrs vs OpenAI ~$0.36/hr)
LEMONFOX_API_KEY=...

# ===================
# Cryptographic Signing
# ===================

# Required: Wallet mnemonic for signing verdicts (12 or 24 words)
MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

# ===================
# Database
# ===================

# Required: PostgreSQL connection
DATABASE_URL=postgres://user:pass@localhost:5432/aijudge

# ===================
# Authentication (Clerk)
# ===================

# Required: Clerk API keys (from dashboard.clerk.com)
# Use sk_test_/pk_test_ for development, sk_live_/pk_live_ for production
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx

# ===================
# Payments (Stripe)
# ===================

# Required: Stripe API keys (from dashboard.stripe.com)
# Use sk_test_ for development, sk_live_ for production
STRIPE_SECRET_KEY=sk_test_xxxxx

# Required: Stripe webhook signing secret
# Get this when creating webhook endpoint in Stripe dashboard
# For local dev, use: stripe listen --forward-to localhost:3001/webhooks/stripe
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Optional: Custom success/cancel URLs (defaults to getjudgedbyai.com)
STRIPE_SUCCESS_URL=https://getjudgedbyai.com/credits/success
STRIPE_CANCEL_URL=https://getjudgedbyai.com/credits/cancel

# ===================
# Server
# ===================

# Optional: Server port (default 3001)
PORT=3001

# Optional: Environment (development/production)
NODE_ENV=development
```

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + signer address |
| GET | `/models` | List available council models |
| GET | `/judgments` | List judgments (paginated) |
| GET | `/judgments/:id` | Get full judgment by ID |
| GET | `/judgments/search` | Search judgments |
| POST | `/verify` | Verify a signed verdict |
| GET | `/signer` | Get expected signer address |
| GET | `/credits/packs` | List available credit packs |

### Authenticated (Clerk JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/judge/stream` | Full pipeline with SSE progress |
| POST | `/transcribe` | Transcribe audio only |
| GET | `/credits` | Get user's credit balance |
| POST | `/checkout` | Create Stripe checkout session |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/stripe` | Stripe payment webhooks |

### POST `/judge`

**JSON body:**
```json
{
  "topic": "Should AI be regulated?",
  "description": "Tech leaders debate AI governance",
  "thumbnail": "https://...",
  "transcript": "Speaker A: We need AI laws..."
}
```

**Multipart form (for audio):**
```bash
curl -X POST http://localhost:3001/judge \
  -F "topic=Should AI be regulated?" \
  -F "description=Tech leaders debate" \
  -F "audio=@debate.mp3"
```

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "formattedTranscript": { ... },
  "signedVerdict": {
    "verdict": {
      "finalWinner": "Speaker A",
      "unanimity": false,
      "voteCount": { "Speaker A": 4, "Speaker B": 2 },
      "averageScores": [ ... ],
      "individualJudgments": [ ... ],
      "consensusSummary": "..."
    },
    "hash": "0x...",
    "signature": "0x...",
    "signerAddress": "0x...",
    "timestamp": 1234567890
  }
}
```

## Pricing Model

| Mode | Cost | Description |
|------|------|-------------|
| Default Council | 1 credit | 5 frontier AI models |
| Custom Models | 1 credit/model | Pick specific models |

Credit packs configured in `src/config/index.ts`:
- 1 Analysis: $5.00
- 5 Analyses: $20.00 ($4.00/each)
- 10 Analyses: $35.00 ($3.50/each)

Coupons can be created in Stripe Dashboard and are automatically available at checkout.

## Council Models

Five reasoning models evaluate each debate:

| Model | Provider |
|-------|----------|
| `grok-4.1-fast-reasoning` | xAI |
| `gemini-3-pro-preview` | Google |
| `claude-opus-4.5` | Anthropic |
| `gpt-5.1-thinking` | OpenAI |
| `deepseek-v3.2-thinking` | DeepSeek |

## Stripe Webhook Setup

### Production

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL:** `https://api.getjudgedbyai.com/webhooks/stripe`
4. **Events to listen to:** `checkout.session.completed`
5. Copy the **Signing secret** to `STRIPE_WEBHOOK_SECRET`

### Local Development

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Copy the webhook signing secret from the CLI output.

## Docker

```bash
# Build
docker build -t ai-judge-backend .

# Run
docker run -p 3001:3001 \
  -e AI_GATEWAY_API_KEY=... \
  -e OPENAI_API_KEY=... \
  -e MNEMONIC="..." \
  -e DATABASE_URL=... \
  -e CLERK_SECRET_KEY=... \
  -e CLERK_PUBLISHABLE_KEY=... \
  -e STRIPE_SECRET_KEY=... \
  -e STRIPE_WEBHOOK_SECRET=... \
  ai-judge-backend
```

## Audio Processing

- **Max upload size:** 300MB per file
- **Auto-chunking:** Files >24MB are split into chunks for Whisper
- **Supported formats:** MP3, WAV, M4A, FLAC, OGG

Large audio files are automatically chunked and transcribed in sequence, then concatenated.

## Database

PostgreSQL is optional but recommended for persistence. The schema is auto-created on startup.

```sql
-- Tables created automatically:
-- judgments: stores all debate evaluations with signatures
```

## Architecture

```
src/
├── config/           # LLM providers, council models, pricing
├── db/               # PostgreSQL client, schema, repository
├── middleware/
│   └── auth.ts       # Clerk JWT verification
├── schemas/          # Zod schemas for structured outputs
├── services/
│   ├── transcription.ts  # Whisper / Lemonfox
│   ├── formatting.ts     # Gemini 2.5 Flash
│   ├── council.ts        # 5 LLMs evaluate in parallel
│   ├── signing.ts        # viem wallet signing
│   └── payments.ts       # Stripe + credit management
├── utils/            # Retry logic
└── index.ts          # Hono server + routes
```

