export interface Speaker {
  id: string;
  position: string;
  speakingOrder: number;
}

export interface Segment {
  speaker: string;
  text: string;
  timestamp?: string;
}

export interface FormattedTranscript {
  topic: string;
  speakers: Speaker[];
  segments: Segment[];
  summary: string;
}

export interface SpeakerScore {
  speaker: string;
  argumentation: number;
  evidence: number;
  delivery: number;
  rebuttal: number;
  total: number;
}

export interface KeyMoment {
  speaker: string;
  moment: string;
  impact: "positive" | "negative";
}

export interface JudgeEvaluation {
  winner: string;
  confidence: number;
  scores: SpeakerScore[];
  reasoning: string;
  keyMoments: KeyMoment[];
}

export interface IndividualJudgment {
  judge: string;
  evaluation: JudgeEvaluation;
}

export interface CouncilVerdict {
  finalWinner: string;
  unanimity: boolean;
  voteCount: Record<string, number>;
  averageScores: SpeakerScore[];
  individualJudgments: IndividualJudgment[];
  consensusSummary: string;
}

export interface SignedVerdict {
  verdict: CouncilVerdict;
  hash: string;
  signature: string;
  signerAddress: string;
  timestamp: number;
}

export interface JudgmentSummary {
  id: string;
  createdAt: string;
  topic: string;
  description: string | null;
  thumbnail: string | null;
  finalWinner: string;
  unanimity: boolean;
  voteCount: Record<string, number>;
  consensusSummary: string;
}

export interface JudgmentRecord extends JudgmentSummary {
  averageScores: SpeakerScore[];
  formattedTranscript: FormattedTranscript;
  individualJudgments: IndividualJudgment[];
  verdictHash: string;
  signature: string;
  signerAddress: string;
  signedAt: number;
}

export interface JudgePrompts {
  system: string;
  user: string;
}

export interface JudgeResponse {
  success: boolean;
  id: string | null;
  formattedTranscript: FormattedTranscript;
  signedVerdict: SignedVerdict;
  prompts?: JudgePrompts;
}

