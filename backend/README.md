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
# Required: AI Gateway API Key (for multi-provider LLM access)
AI_GATEWAY_API_KEY=your_gateway_key

# Required: OpenAI API Key (for Whisper transcription if using OpenAI)
OPENAI_API_KEY=sk-...

# Optional: Transcription provider ("openai" or "lemonfox", default: openai)
TRANSCRIPTION_PROVIDER=openai

# Optional: Lemonfox API Key (if using Lemonfox for transcription)
# Lemonfox has speaker diarization and is cheaper ($0.50/3hrs vs OpenAI ~$0.36/hr)
LEMONFOX_API_KEY=...

# Required: Wallet mnemonic for signing verdicts (12 or 24 words)
MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

# Optional: PostgreSQL connection (for persistence)
DATABASE_URL=postgres://user:pass@localhost:5432/aijudge

# Optional: Server port (default 3001)
PORT=3001
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + signer address |
| POST | `/judge` | Full pipeline: audio/transcript → council → signed verdict |
| GET | `/judgments` | List judgments (paginated) |
| GET | `/judgments/:id` | Get full judgment by ID |
| POST | `/verify` | Verify a signed verdict |
| GET | `/signer` | Get expected signer address |
| POST | `/format` | Format transcript only |
| POST | `/transcribe` | Transcribe audio only |

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

## Council Models

Six reasoning models evaluate each debate:

| Model | Provider |
|-------|----------|
| `grok-4.1-fast-reasoning` | xAI |
| `gemini-3-pro-preview` | Google |
| `claude-opus-4.5` | Anthropic |
| `gpt-5.1-thinking` | OpenAI |
| `deepseek-v3.2-thinking` | DeepSeek |
| `kimi-k2-thinking-turbo` | Moonshot |

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
├── config/         # LLM providers, council models
├── db/             # PostgreSQL client, schema, repository
├── schemas/        # Zod schemas for structured outputs
├── services/
│   ├── transcription.ts  # Whisper
│   ├── formatting.ts     # Gemini 2.5 Flash
│   ├── council.ts        # 6 LLMs evaluate in parallel
│   └── signing.ts        # viem wallet signing
├── utils/          # Retry logic
└── index.ts        # Hono server
```

