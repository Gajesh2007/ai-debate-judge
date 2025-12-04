import { z } from "zod";

// Schema for formatted transcript with labeled speakers
export const FormattedTranscriptSchema = z.object({
  topic: z.string().describe("The debate topic"),
  speakers: z
    .array(
      z.object({
        id: z.string().describe("Speaker identifier (e.g., 'Speaker A', 'Affirmative')"),
        position: z.string().describe("Their debate position (e.g., 'Pro', 'Con', 'Affirmative', 'Negative')"),
        speakingOrder: z.number().describe("Order in which they speak (1-indexed)"),
      })
    )
    .describe("List of identified speakers"),
  segments: z
    .array(
      z.object({
        speaker: z.string().describe("Speaker identifier matching one from speakers array"),
        text: z.string().describe("What they said"),
        timestamp: z.string().optional().describe("Optional timestamp if available"),
      })
    )
    .describe("Transcript broken into speaker segments"),
  summary: z.string().describe("Brief summary of the debate"),
});

export type FormattedTranscript = z.infer<typeof FormattedTranscriptSchema>;

// Schema for individual judge evaluation - made more lenient for various LLMs
export const JudgeEvaluationSchema = z.object({
  winner: z.string().describe("Speaker ID of the winner"),
  confidence: z.number().min(0).max(100).describe("Confidence in decision (0-100)"),
  scores: z
    .array(
      z.object({
        speaker: z.string().describe("Speaker identifier"),
        argumentation: z.number().describe("Quality of arguments (0-10)"),
        evidence: z.number().describe("Use of evidence and examples (0-10)"),
        delivery: z.number().describe("Clarity and persuasiveness (0-10)"),
        rebuttal: z.number().describe("Effectiveness of rebuttals (0-10)"),
        total: z.number().describe("Total score"),
      })
    )
    .describe("Scores for each speaker"),
  reasoning: z.string().describe("Detailed reasoning for the decision"),
  // Made optional and more lenient - some models struggle with this
  keyMoments: z
    .array(
      z.object({
        speaker: z.string(),
        moment: z.string().describe("Description of key moment"),
        impact: z.string().describe("Impact on their case (positive or negative)"),
      })
    )
    .optional()
    .default([])
    .describe("Key moments that influenced the decision"),
});

export type JudgeEvaluation = z.infer<typeof JudgeEvaluationSchema>;

// Schema for council verdict (aggregated from all judges)
export const CouncilVerdictSchema = z.object({
  finalWinner: z.string().describe("The consensus winner"),
  unanimity: z.boolean().describe("Whether all judges agreed"),
  voteCount: z.record(z.string(), z.number()).describe("Vote count per speaker"),
  averageScores: z
    .array(
      z.object({
        speaker: z.string(),
        argumentation: z.number(),
        evidence: z.number(),
        delivery: z.number(),
        rebuttal: z.number(),
        total: z.number(),
      })
    )
    .describe("Averaged scores across all judges"),
  individualJudgments: z
    .array(
      z.object({
        judge: z.string().describe("Name of the judge model"),
        evaluation: JudgeEvaluationSchema,
      })
    )
    .describe("Individual judgments from each council member"),
  consensusSummary: z.string().describe("Summary of the council's consensus"),
});

export type CouncilVerdict = z.infer<typeof CouncilVerdictSchema>;

// Final signed output
export const SignedVerdictSchema = z.object({
  verdict: CouncilVerdictSchema,
  hash: z.string().describe("Keccak256 hash of the verdict"),
  signature: z.string().describe("Signature from the judge wallet"),
  signerAddress: z.string().describe("Address of the signing wallet"),
  timestamp: z.number().describe("Unix timestamp of signing"),
});

export type SignedVerdict = z.infer<typeof SignedVerdictSchema>;

// Debate metadata for gallery display
export const DebateMetadataSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  description: z.string().optional().describe("Brief description of the debate for gallery display"),
  thumbnail: z.string().url().optional().describe("URL to thumbnail image for gallery"),
});

export type DebateMetadata = z.infer<typeof DebateMetadataSchema>;

// Council model schema for custom model selection
export const CouncilModelSchema = z.object({
  id: z.string().describe("Model identifier in gateway format: provider/model"),
  name: z.string().describe("Display name for the model"),
  supportsReasoningEffort: z.boolean().optional().default(false),
});

export type CouncilModelInput = z.infer<typeof CouncilModelSchema>;

// Request schemas
export const JudgeRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  transcript: z.string().optional(),
  // Optional custom models - if not provided, uses default council
  models: z.array(CouncilModelSchema).optional(),
  // Audio will be handled via multipart form
});

export type JudgeRequest = z.infer<typeof JudgeRequestSchema>;
