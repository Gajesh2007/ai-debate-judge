import { generateObject } from "ai";
import { z } from "zod";
import { gateway } from "../config/index.js";
import { FormattedTranscriptSchema, type FormattedTranscript } from "../schemas/index.js";
import { withRetry } from "../utils/retry.js";

// Moderation result schema
const ModerationSchema = z.object({
  isAppropriate: z.boolean().describe("Whether the content is appropriate for analysis"),
  reason: z.string().optional().describe("Reason if content is inappropriate"),
  flags: z.array(z.string()).optional().describe("Specific content flags if any"),
});

export type ModerationResult = z.infer<typeof ModerationSchema>;

const MODERATION_PROMPT = `You are a content moderator. Analyze the following debate transcript and determine if it's appropriate for AI analysis.

Content should be REJECTED if it contains:
- Explicit sexual content or pornography
- Graphic violence or gore
- Hate speech targeting protected groups
- Content promoting illegal activities (drug manufacturing, terrorism, etc.)
- Child exploitation content
- Doxxing or personal private information

Content should be APPROVED if it:
- Discusses controversial but legitimate debate topics (politics, ethics, etc.)
- Contains mild profanity in context of passionate debate
- Discusses sensitive topics in an educational/analytical manner
- Is a normal debate even if the topic is contentious

Be lenient on legitimate debate content. Only flag truly inappropriate material.`;

const FORMATTING_PROMPT = `You are an expert debate transcript formatter. Your job is to take a raw transcript and make it structured and readable for another AI system to evaluate.

Given a debate transcript and topic, you must:
1. Identify all speakers in the debate
2. Determine each speaker's position (Pro/Con, Affirmative/Negative, etc.)
3. Break the transcript into clearly labeled segments by speaker
4. Preserve all arguments, evidence, and rebuttals
5. Clean up any transcription artifacts (filler words, repetitions) while maintaining accuracy
6. Create a brief summary of the debate

Be precise in speaker identification. If speakers are not explicitly named, use consistent labels like "Speaker A", "Speaker B" or based on their position "Affirmative", "Negative".

The output must be perfectly structured for another LLM to evaluate who won the debate.`;

/**
 * Check if content is appropriate for analysis
 * Uses Gemini 2.5 Flash for fast moderation
 */
export async function moderateContent(
  transcript: string,
  topic: string
): Promise<ModerationResult> {
  console.log("Running content moderation check...");

  const result = await withRetry(
    async () => {
      const { object } = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: ModerationSchema,
        system: MODERATION_PROMPT,
        prompt: `Topic: ${topic}

Transcript (first 5000 chars):
${transcript.slice(0, 5000)}

Is this content appropriate for AI debate analysis?`,
      });

      return object;
    },
    {
      maxRetries: 2,
      onRetry: (attempt, error) => {
        console.log(`Moderation retry ${attempt}: ${error.message}`);
      },
    }
  );

  if (result.isAppropriate) {
    console.log("Content moderation: APPROVED");
  } else {
    console.log(`Content moderation: REJECTED - ${result.reason}`);
    if (result.flags?.length) {
      console.log(`  Flags: ${result.flags.join(", ")}`);
    }
  }

  return result;
}

/**
 * Format raw transcript using Gemini 2.5 Flash via AI Gateway
 * Labels speakers and structures the debate for evaluation
 * Note: Call moderateContent() separately before this for streaming progress
 */
export async function formatTranscript(
  rawTranscript: string,
  topic: string
): Promise<FormattedTranscript> {
  console.log("Formatting transcript with Gemini 2.5 Flash...");

  const result = await withRetry(
    async () => {
      const { object } = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: FormattedTranscriptSchema,
        system: FORMATTING_PROMPT,
        prompt: `Topic: ${topic}

Raw Transcript:
${rawTranscript}

Please format this transcript with proper speaker labels and structure.`,
      });

      return object;
    },
    {
      onRetry: (attempt, error) => {
        console.log(`Formatting retry ${attempt}: ${error.message}`);
      },
    }
  );

  console.log(`Formatted transcript: ${result.speakers.length} speakers, ${result.segments.length} segments`);
  return result;
}

