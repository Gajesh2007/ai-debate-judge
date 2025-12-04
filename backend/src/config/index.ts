import { createGateway, type GatewayProvider } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";

// AI Gateway configuration for multi-provider access
export const gateway: GatewayProvider = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// OpenAI provider for transcription (Whisper doesn't go through gateway)
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Council model type
export interface CouncilModel {
  id: string;
  name: string;
  supportsReasoningEffort: boolean;
}

// Default council LLM configuration - reasoning models for judging debates
// Using gateway format: provider/model
export const COUNCIL_MODELS: CouncilModel[] = [
  { id: "xai/grok-4.1-fast-reasoning", name: "Grok 4.1 Fast Reasoning", supportsReasoningEffort: false },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro", supportsReasoningEffort: false },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", supportsReasoningEffort: false },
  { id: "openai/gpt-5.1-thinking", name: "GPT-5.1 Thinking", supportsReasoningEffort: true },
  { id: "deepseek/deepseek-v3.2-thinking", name: "DeepSeek V3.2 Thinking", supportsReasoningEffort: false },
];

// Transcription provider configuration
export type TranscriptionProvider = "openai" | "lemonfox";

export const transcriptionConfig = {
  // Provider: "openai" (Whisper) or "lemonfox" (Whisper v3 with speaker diarization)
  provider: (process.env.TRANSCRIPTION_PROVIDER || "openai") as TranscriptionProvider,
  
  // Lemonfox API config
  lemonfox: {
    apiKey: process.env.LEMONFOX_API_KEY,
    apiUrl: process.env.LEMONFOX_API_URL || "https://api.lemonfox.ai/v1/audio/transcriptions",
    // Chunk size for Lemonfox (50MB, will be processed in parallel)
    chunkSizeMb: 50,
    // Enable speaker diarization (great for debates!)
    speakerLabels: true,
  },
  
  // OpenAI Whisper config
  openai: {
    // Whisper API limit is 25MB, use 24MB for safety
    chunkSizeMb: 24,
  },
};

export const config = {
  maxRetries: 3,
  retryDelayMs: 1000,
  maxAudioFileSizeMb: 300, // Max upload size
  whisperChunkSizeMb: transcriptionConfig.openai.chunkSizeMb,
  port: parseInt(process.env.PORT || "3001", 10),
};
