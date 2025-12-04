import { generateObject } from "ai";
import { gateway, COUNCIL_MODELS, type CouncilModel } from "../config/index.js";
import {
  JudgeEvaluationSchema,
  type FormattedTranscript,
  type JudgeEvaluation,
  type CouncilVerdict,
  type CouncilModelInput,
} from "../schemas/index.js";
import { withRetry } from "../utils/retry.js";

export const JUDGE_SYSTEM_PROMPT = `You are an expert debate judge with decades of experience evaluating competitive debates. Your role is to provide a fair, thorough, and well-reasoned evaluation of the debate.

Evaluation Criteria (each scored 0-10):
1. ARGUMENTATION: Quality, logic, and structure of arguments
2. EVIDENCE: Use of facts, examples, and supporting evidence
3. DELIVERY: Clarity, persuasiveness, and rhetorical effectiveness
4. REBUTTAL: Effectiveness in addressing opponent's arguments

IMPORTANT: You MUST provide your evaluation in the exact JSON structure requested. Include:
- winner: The speaker ID who won
- confidence: Your confidence level (0-100)
- scores: Array with scores for EACH speaker
- reasoning: Your detailed reasoning
- keyMoments: Array of key moments (can be empty if none stand out)

Your evaluation must be:
- Objective and impartial
- Based solely on the debate content
- Well-reasoned with specific references to the debate
- Clear about which speaker won and why`;

/**
 * Build the user prompt for a judge given a transcript
 */
export function buildJudgePrompt(transcript: FormattedTranscript): string {
  return `Please evaluate the following debate:

Topic: ${transcript.topic}

Speakers:
${transcript.speakers.map((s) => `- ${s.id}: ${s.position}`).join("\n")}

Debate Transcript:
${transcript.segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n\n")}

Summary: ${transcript.summary}

Provide your complete evaluation. Remember to:
1. Set "winner" to one of the speaker IDs: ${transcript.speakers.map((s) => s.id).join(", ")}
2. Set "confidence" to a number between 0 and 100
3. Include scores for EACH speaker with argumentation, evidence, delivery, rebuttal, and total
4. Provide detailed "reasoning"
5. Include "keyMoments" array (can be empty [])`;
}

export type CouncilProgressCallback = (progress: {
  step: "judge_started" | "judge_completed" | "judge_failed" | "aggregating";
  judgeName?: string;
  judgeIndex?: number;
  totalJudges: number;
  completedJudges: number;
  winner?: string;
  confidence?: number;
  error?: string;
}) => void;

// More retries for council (5 attempts instead of 3)
const COUNCIL_MAX_RETRIES = 5;
const COUNCIL_RETRY_DELAY_MS = 2000;

/**
 * Get evaluation from a single judge (LLM) via AI Gateway
 * Uses high reasoning effort for models that support it
 */
async function getJudgeEvaluation(
  council: CouncilModel,
  transcript: FormattedTranscript
): Promise<{ judge: string; evaluation: JudgeEvaluation } | null> {
  console.log(`Getting evaluation from ${council.name}...`);

  try {
    const evaluation = await withRetry(
      async () => {
        const { object } = await generateObject({
          model: gateway(council.id),
          schema: JudgeEvaluationSchema,
          system: JUDGE_SYSTEM_PROMPT,
          prompt: buildJudgePrompt(transcript),
          // Enable high reasoning effort for OpenAI models that support it
          ...(council.supportsReasoningEffort && {
            providerOptions: {
              openai: {
                reasoningEffort: "high" as const,
              },
            },
          }),
        });

        // Validate the object has required fields
        if (!object.winner || typeof object.confidence !== "number" || !object.scores || !object.reasoning) {
          throw new Error("Invalid response structure");
        }

        return object;
      },
      {
        maxRetries: COUNCIL_MAX_RETRIES,
        delayMs: COUNCIL_RETRY_DELAY_MS,
        onRetry: (attempt, error) => {
          console.log(`Judge ${council.name} retry ${attempt}/${COUNCIL_MAX_RETRIES}: ${error.message}`);
        },
      }
    );

    console.log(`${council.name} verdict: ${evaluation.winner} (confidence: ${evaluation.confidence}%)`);

    return {
      judge: council.name,
      evaluation,
    };
  } catch (error) {
    console.error(`${council.name} FAILED after ${COUNCIL_MAX_RETRIES} retries:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Run the council of LLMs to evaluate the debate
 * All judges evaluate in parallel via AI Gateway, then results are aggregated
 * Continues even if some judges fail (requires at least 2 successful)
 * 
 * @param transcript - The formatted debate transcript
 * @param onProgress - Optional callback for progress updates
 * @param customModels - Optional custom models to use instead of default council
 */
export async function runCouncil(
  transcript: FormattedTranscript,
  onProgress?: CouncilProgressCallback,
  customModels?: CouncilModelInput[]
): Promise<CouncilVerdict> {
  // Use custom models if provided, otherwise use default council
  const models: CouncilModel[] = customModels?.length 
    ? customModels.map(m => ({
        id: m.id,
        name: m.name,
        supportsReasoningEffort: m.supportsReasoningEffort ?? false,
      }))
    : [...COUNCIL_MODELS];

  console.log(`Running council with ${models.length} reasoning models via AI Gateway...`);
  if (customModels?.length) {
    console.log(`Using custom models: ${models.map(m => m.name).join(", ")}`);
  }

  const totalJudges = models.length;
  let completedJudges = 0;
  let failedJudges = 0;

  // Run all judges in parallel, but track progress
  const judgmentPromises = models.map(async (model, index) => {
    onProgress?.({
      step: "judge_started",
      judgeName: model.name,
      judgeIndex: index,
      totalJudges,
      completedJudges,
    });

    const result = await getJudgeEvaluation(model, transcript);
    
    if (result) {
      completedJudges++;
      onProgress?.({
        step: "judge_completed",
        judgeName: model.name,
        judgeIndex: index,
        totalJudges,
        completedJudges,
        winner: result.evaluation.winner,
        confidence: result.evaluation.confidence,
      });
    } else {
      failedJudges++;
      onProgress?.({
        step: "judge_failed",
        judgeName: model.name,
        judgeIndex: index,
        totalJudges,
        completedJudges,
        error: "Failed after retries",
      });
    }

    return result;
  });

  const results = await Promise.all(judgmentPromises);
  
  // Filter out failed judges
  const judgments = results.filter((r): r is { judge: string; evaluation: JudgeEvaluation } => r !== null);

  if (judgments.length < 2) {
    throw new Error(`Not enough judges succeeded. Only ${judgments.length} of ${totalJudges} completed. Need at least 2.`);
  }

  if (failedJudges > 0) {
    console.log(`Warning: ${failedJudges} judge(s) failed, proceeding with ${judgments.length} verdicts`);
  }

  onProgress?.({
    step: "aggregating",
    totalJudges,
    completedJudges: judgments.length,
  });

  // Aggregate results
  const voteCount: Record<string, number> = {};
  const scoresBySpeak: Record<
    string,
    { argumentation: number[]; evidence: number[]; delivery: number[]; rebuttal: number[]; total: number[] }
  > = {};

  for (const { evaluation } of judgments) {
    // Count votes
    voteCount[evaluation.winner] = (voteCount[evaluation.winner] || 0) + 1;

    // Collect scores for averaging
    for (const score of evaluation.scores) {
      if (!scoresBySpeak[score.speaker]) {
        scoresBySpeak[score.speaker] = {
          argumentation: [],
          evidence: [],
          delivery: [],
          rebuttal: [],
          total: [],
        };
      }
      scoresBySpeak[score.speaker].argumentation.push(score.argumentation);
      scoresBySpeak[score.speaker].evidence.push(score.evidence);
      scoresBySpeak[score.speaker].delivery.push(score.delivery);
      scoresBySpeak[score.speaker].rebuttal.push(score.rebuttal);
      scoresBySpeak[score.speaker].total.push(score.total);
    }
  }

  // Find winner by votes
  const finalWinner = Object.entries(voteCount).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const unanimity = Object.values(voteCount).some((v) => v === judgments.length);

  // Calculate average scores
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const averageScores = Object.entries(scoresBySpeak).map(([speaker, scores]) => ({
    speaker,
    argumentation: Math.round(avg(scores.argumentation) * 10) / 10,
    evidence: Math.round(avg(scores.evidence) * 10) / 10,
    delivery: Math.round(avg(scores.delivery) * 10) / 10,
    rebuttal: Math.round(avg(scores.rebuttal) * 10) / 10,
    total: Math.round(avg(scores.total) * 10) / 10,
  }));

  // Generate consensus summary
  const winnerVotes = voteCount[finalWinner];
  const totalVotes = judgments.length;
  const failedNote = failedJudges > 0 ? ` (${failedJudges} judge(s) failed to respond)` : "";
  
  const consensusSummary = unanimity
    ? `The council unanimously voted for ${finalWinner} as the winner of this debate.${failedNote}`
    : `The council voted ${winnerVotes}-${totalVotes - winnerVotes} in favor of ${finalWinner}. The decision was based on superior ${
        averageScores.find((s) => s.speaker === finalWinner)?.argumentation ?? 0 >
        (averageScores.find((s) => s.speaker !== finalWinner)?.argumentation ?? 0)
          ? "argumentation"
          : "overall performance"
      } across the evaluated criteria.${failedNote}`;

  const verdict: CouncilVerdict = {
    finalWinner,
    unanimity,
    voteCount,
    averageScores,
    individualJudgments: judgments,
    consensusSummary,
  };

  console.log(`Council verdict: ${finalWinner} wins (${unanimity ? "unanimous" : "split decision"}) - ${judgments.length}/${totalJudges} judges responded`);

  return verdict;
}
