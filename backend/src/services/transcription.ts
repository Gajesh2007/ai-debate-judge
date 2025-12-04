import { experimental_transcribe as transcribe } from "ai";
import { openai, config, transcriptionConfig } from "../config/index.js";
import { withRetry } from "../utils/retry.js";

export interface TranscriptionResult {
  text: string;
  duration?: number;
  chunks?: number;
  provider: string;
  speakerLabels?: boolean;
}

const OPENAI_CHUNK_SIZE_BYTES = config.whisperChunkSizeMb * 1024 * 1024; // 24MB
const LEMONFOX_CHUNK_SIZE_BYTES = 50 * 1024 * 1024; // 50MB chunks for Lemonfox
const MAX_PARALLEL_CHUNKS = 4; // Limit parallel requests to avoid rate limits

/**
 * Split a large audio buffer into smaller chunks
 */
function splitAudioIntoChunks(audioBuffer: Buffer, chunkSizeBytes: number): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < audioBuffer.length) {
    const end = Math.min(offset + chunkSizeBytes, audioBuffer.length);
    chunks.push(audioBuffer.subarray(offset, end));
    offset = end;
  }

  return chunks;
}

// ============================================
// LEMONFOX PROVIDER
// ============================================

interface LemonfoxSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface LemonfoxResponse {
  text: string;
  duration?: number;
  segments?: LemonfoxSegment[];
}

/**
 * Transcribe a single chunk using Lemonfox API
 */
async function transcribeChunkWithLemonfox(
  audioBuffer: Buffer,
  chunkIndex: number,
  totalChunks: number
): Promise<{ text: string; duration?: number; segments?: LemonfoxSegment[]; index: number }> {
  const { apiKey, apiUrl, speakerLabels } = transcriptionConfig.lemonfox;
  
  if (!apiKey) {
    throw new Error("LEMONFOX_API_KEY is required for Lemonfox transcription");
  }

  console.log(`  Transcribing chunk ${chunkIndex + 1}/${totalChunks} (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB) with Lemonfox...`);

  const formData = new FormData();
  const uint8Array = new Uint8Array(audioBuffer);
  formData.append("file", new Blob([uint8Array]), "audio.mp3");
  formData.append("language", "english");
  formData.append("response_format", speakerLabels ? "verbose_json" : "json");
  
  if (speakerLabels) {
    formData.append("speaker_labels", "true");
  }

  const response = await withRetry(
    async () => {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Lemonfox API error: ${res.status} - ${errorText}`);
      }

      return res.json() as Promise<LemonfoxResponse>;
    },
    {
      onRetry: (attempt, error) => {
        console.log(`  Chunk ${chunkIndex + 1} Lemonfox retry ${attempt}: ${error.message}`);
      },
    }
  );

  console.log(`  ✓ Chunk ${chunkIndex + 1}/${totalChunks} complete`);

  return {
    text: response.text,
    duration: response.duration,
    segments: response.segments,
    index: chunkIndex,
  };
}

/**
 * Process Lemonfox chunks in parallel batches
 */
async function transcribeLemonfoxChunksParallel(
  chunks: Buffer[]
): Promise<{ texts: string[]; totalDuration: number; allSegments: LemonfoxSegment[] }> {
  const results: { text: string; duration?: number; segments?: LemonfoxSegment[]; index: number }[] = [];
  
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_CHUNKS);
    const batchStartIndex = i;
    
    console.log(`  Processing batch ${Math.floor(i / MAX_PARALLEL_CHUNKS) + 1}/${Math.ceil(chunks.length / MAX_PARALLEL_CHUNKS)} (${batch.length} chunks in parallel)...`);
    
    const batchResults = await Promise.all(
      batch.map((chunk, batchIndex) =>
        transcribeChunkWithLemonfox(chunk, batchStartIndex + batchIndex, chunks.length)
      )
    );
    
    results.push(...batchResults);
  }

  // Sort by index to maintain order
  results.sort((a, b) => a.index - b.index);

  const texts = results.map((r) => r.text);
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const allSegments = results.flatMap((r) => r.segments || []);

  return { texts, totalDuration, allSegments };
}

/**
 * Transcribe using Lemonfox API (Whisper v3 with speaker diarization)
 * Supports chunking for files > 50MB
 */
async function transcribeWithLemonfox(audioBuffer: Buffer): Promise<TranscriptionResult> {
  const { speakerLabels } = transcriptionConfig.lemonfox;
  const fileSizeMb = audioBuffer.length / 1024 / 1024;
  
  console.log(`Transcribing with Lemonfox (${fileSizeMb.toFixed(1)}MB)...`);
  if (speakerLabels) {
    console.log("  Speaker diarization enabled");
  }

  let text: string;
  let duration = 0;
  let chunks = 1;
  let hasSpeakerLabels = false;

  // Check if file needs chunking (>50MB)
  if (audioBuffer.length > LEMONFOX_CHUNK_SIZE_BYTES) {
    console.log(`  File exceeds 50MB, splitting into chunks...`);
    
    const chunkBuffers = splitAudioIntoChunks(audioBuffer, LEMONFOX_CHUNK_SIZE_BYTES);
    chunks = chunkBuffers.length;
    console.log(`  Split into ${chunks} chunks (processing ${MAX_PARALLEL_CHUNKS} in parallel)`);

    const { texts, totalDuration, allSegments } = await transcribeLemonfoxChunksParallel(chunkBuffers);
    
    // Format with speaker labels if available
    if (speakerLabels && allSegments.some((s) => s.speaker)) {
      const speakerSegments = allSegments
        .filter((s) => s.speaker)
        .map((s) => `[${s.speaker}]: ${s.text.trim()}`)
        .join("\n\n");
      
      if (speakerSegments) {
        text = speakerSegments;
        hasSpeakerLabels = true;
        console.log("  Speaker-labeled transcript generated from chunks");
      } else {
        text = texts.join(" ");
      }
    } else {
      text = texts.join(" ");
    }
    
    duration = totalDuration;
  } else {
    // Single chunk
    const result = await transcribeChunkWithLemonfox(audioBuffer, 0, 1);
    
    // Format with speaker labels if available
    if (speakerLabels && result.segments?.some((s) => s.speaker)) {
      const speakerSegments = result.segments
        .filter((s) => s.speaker)
        .map((s) => `[${s.speaker}]: ${s.text.trim()}`)
        .join("\n\n");
      
      if (speakerSegments) {
        text = speakerSegments;
        hasSpeakerLabels = true;
        console.log("  Speaker-labeled transcript generated");
      } else {
        text = result.text;
      }
    } else {
      text = result.text;
    }
    
    duration = result.duration || 0;
  }

  console.log(`Lemonfox transcription complete: ${text.length} characters from ${chunks} chunk(s)`);

  return {
    text,
    duration: duration > 0 ? duration : undefined,
    chunks,
    provider: "lemonfox",
    speakerLabels: hasSpeakerLabels,
  };
}

// ============================================
// OPENAI WHISPER PROVIDER
// ============================================

/**
 * Transcribe a single audio chunk with OpenAI Whisper
 */
async function transcribeChunkWithOpenAI(
  chunk: Buffer,
  chunkIndex: number,
  totalChunks: number
): Promise<{ text: string; durationInSeconds?: number; index: number }> {
  console.log(`  Transcribing chunk ${chunkIndex + 1}/${totalChunks} (${(chunk.length / 1024 / 1024).toFixed(1)}MB) with OpenAI...`);

  const result = await withRetry(
    async () => {
      const uint8Array = new Uint8Array(chunk);

      const transcription = await transcribe({
        model: openai.transcription("whisper-1"),
        audio: uint8Array,
        providerOptions: {
          openai: {
            language: "en",
            timestampGranularities: ["segment"],
          },
        },
      });

      return {
        text: transcription.text,
        durationInSeconds: transcription.durationInSeconds,
      };
    },
    {
      onRetry: (attempt, error) => {
        console.log(`  Chunk ${chunkIndex + 1} OpenAI retry ${attempt}: ${error.message}`);
      },
    }
  );

  console.log(`  ✓ Chunk ${chunkIndex + 1}/${totalChunks} complete`);

  return {
    ...result,
    index: chunkIndex,
  };
}

/**
 * Process OpenAI chunks in batches with limited parallelism
 */
async function transcribeOpenAIChunksParallel(
  chunks: Buffer[]
): Promise<{ texts: string[]; totalDuration: number }> {
  const results: { text: string; durationInSeconds?: number; index: number }[] = [];
  
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_CHUNKS);
    const batchStartIndex = i;
    
    console.log(`  Processing batch ${Math.floor(i / MAX_PARALLEL_CHUNKS) + 1}/${Math.ceil(chunks.length / MAX_PARALLEL_CHUNKS)} (${batch.length} chunks in parallel)...`);
    
    const batchResults = await Promise.all(
      batch.map((chunk, batchIndex) =>
        transcribeChunkWithOpenAI(chunk, batchStartIndex + batchIndex, chunks.length)
      )
    );
    
    results.push(...batchResults);
  }

  results.sort((a, b) => a.index - b.index);

  const texts = results.map((r) => r.text);
  const totalDuration = results.reduce((sum, r) => sum + (r.durationInSeconds || 0), 0);

  return { texts, totalDuration };
}

/**
 * Transcribe using OpenAI Whisper with chunking for large files
 */
async function transcribeWithOpenAI(audioBuffer: Buffer): Promise<TranscriptionResult> {
  const fileSizeMb = audioBuffer.length / 1024 / 1024;
  console.log(`Transcribing with OpenAI Whisper (${fileSizeMb.toFixed(1)}MB)...`);

  let text: string;
  let duration = 0;
  let chunks = 1;

  if (audioBuffer.length > OPENAI_CHUNK_SIZE_BYTES) {
    console.log(`  File exceeds ${config.whisperChunkSizeMb}MB, splitting into chunks...`);
    
    const chunkBuffers = splitAudioIntoChunks(audioBuffer, OPENAI_CHUNK_SIZE_BYTES);
    chunks = chunkBuffers.length;
    console.log(`  Split into ${chunks} chunks (processing ${MAX_PARALLEL_CHUNKS} in parallel)`);

    const { texts, totalDuration } = await transcribeOpenAIChunksParallel(chunkBuffers);
    text = texts.join(" ");
    duration = totalDuration;
  } else {
    const result = await transcribeChunkWithOpenAI(audioBuffer, 0, 1);
    text = result.text;
    duration = result.durationInSeconds || 0;
  }

  console.log(`OpenAI transcription complete: ${text.length} characters from ${chunks} chunk(s)`);

  return {
    text,
    duration: duration > 0 ? duration : undefined,
    chunks,
    provider: "openai",
    speakerLabels: false,
  };
}

// ============================================
// MAIN TRANSCRIPTION FUNCTION
// ============================================

/**
 * Transcribe audio file(s) using configured provider
 * - OpenAI Whisper: 24MB chunks, reliable
 * - Lemonfox: 50MB chunks, speaker diarization, cheaper
 */
export async function transcribeAudio(audioFiles: Buffer[]): Promise<TranscriptionResult> {
  const provider = transcriptionConfig.provider;
  console.log(`Using transcription provider: ${provider}`);

  // Concatenate all audio files into one buffer
  const totalBuffer = audioFiles.length === 1 
    ? audioFiles[0] 
    : Buffer.concat(audioFiles);

  const totalSizeMb = totalBuffer.length / 1024 / 1024;
  console.log(`Total audio size: ${totalSizeMb.toFixed(1)}MB from ${audioFiles.length} file(s)`);

  // Route to appropriate provider
  if (provider === "lemonfox") {
    return transcribeWithLemonfox(totalBuffer);
  }

  // Default to OpenAI Whisper
  return transcribeWithOpenAI(totalBuffer);
}
