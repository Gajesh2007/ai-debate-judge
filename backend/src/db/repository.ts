import { getSql } from "./client.js";
import type { FormattedTranscript, SignedVerdict, DebateMetadata } from "../schemas/index.js";

export interface JudgmentRecord {
  id: string;
  createdAt: Date;
  // Metadata for gallery
  topic: string;
  description: string | null;
  thumbnail: string | null;
  // Verdict
  finalWinner: string;
  unanimity: boolean;
  voteCount: Record<string, number>;
  averageScores: Array<{
    speaker: string;
    argumentation: number;
    evidence: number;
    delivery: number;
    rebuttal: number;
    total: number;
  }>;
  consensusSummary: string;
  formattedTranscript: FormattedTranscript;
  individualJudgments: SignedVerdict["verdict"]["individualJudgments"];
  verdictHash: string;
  signature: string;
  signerAddress: string;
  signedAt: number;
}

// Lighter record for gallery listing
export interface JudgmentSummary {
  id: string;
  createdAt: Date;
  topic: string;
  description: string | null;
  thumbnail: string | null;
  finalWinner: string;
  unanimity: boolean;
  voteCount: Record<string, number>;
  consensusSummary: string;
}

/**
 * Save a judgment to the database
 */
export async function saveJudgment(
  metadata: DebateMetadata,
  formattedTranscript: FormattedTranscript,
  signedVerdict: SignedVerdict
): Promise<string | null> {
  const sql = await getSql();
  if (!sql) {
    console.log("Database not configured, skipping save");
    return null;
  }

  const { verdict, hash, signature, signerAddress, timestamp } = signedVerdict;

  const [result] = await sql`
    INSERT INTO judgments (
      topic,
      description,
      thumbnail,
      final_winner,
      unanimity,
      vote_count,
      average_scores,
      consensus_summary,
      formatted_transcript,
      individual_judgments,
      verdict_hash,
      signature,
      signer_address,
      signed_at
    ) VALUES (
      ${metadata.topic},
      ${metadata.description || null},
      ${metadata.thumbnail || null},
      ${verdict.finalWinner},
      ${verdict.unanimity},
      ${JSON.stringify(verdict.voteCount)},
      ${JSON.stringify(verdict.averageScores)},
      ${verdict.consensusSummary},
      ${JSON.stringify(formattedTranscript)},
      ${JSON.stringify(verdict.individualJudgments)},
      ${hash},
      ${signature},
      ${signerAddress},
      ${timestamp}
    )
    RETURNING id
  `;

  console.log(`Saved judgment to database: ${result.id}`);
  return result.id;
}

/**
 * Get a judgment by ID (full details)
 */
export async function getJudgment(id: string): Promise<JudgmentRecord | null> {
  const sql = await getSql();
  if (!sql) return null;

  const [row] = await sql`
    SELECT 
      id,
      created_at,
      topic,
      description,
      thumbnail,
      final_winner,
      unanimity,
      vote_count,
      average_scores,
      consensus_summary,
      formatted_transcript,
      individual_judgments,
      verdict_hash,
      signature,
      signer_address,
      signed_at
    FROM judgments
    WHERE id = ${id}
  `;

  if (!row) return null;

  return mapRowToRecord(row);
}

/**
 * List judgments with pagination (summary only for gallery)
 */
export async function listJudgments(
  limit = 20,
  offset = 0
): Promise<{ judgments: JudgmentSummary[]; total: number }> {
  const sql = await getSql();
  if (!sql) return { judgments: [], total: 0 };

  const [countResult] = await sql`SELECT COUNT(*) as count FROM judgments`;
  const total = parseInt(countResult.count, 10);

  const rows = await sql`
    SELECT 
      id,
      created_at,
      topic,
      description,
      thumbnail,
      final_winner,
      unanimity,
      vote_count,
      consensus_summary
    FROM judgments
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const judgments = rows.map(mapRowToSummary);

  return { judgments, total };
}

/**
 * Search judgments by topic
 */
export async function searchJudgments(
  query: string,
  limit = 20
): Promise<JudgmentSummary[]> {
  const sql = await getSql();
  if (!sql) return [];

  const rows = await sql`
    SELECT 
      id,
      created_at,
      topic,
      description,
      thumbnail,
      final_winner,
      unanimity,
      vote_count,
      consensus_summary
    FROM judgments
    WHERE topic ILIKE ${"%" + query + "%"}
       OR description ILIKE ${"%" + query + "%"}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(mapRowToSummary);
}

// Helper to map DB row to full record
function mapRowToRecord(row: Record<string, unknown>): JudgmentRecord {
  return {
    id: row.id as string,
    createdAt: row.created_at as Date,
    topic: row.topic as string,
    description: row.description as string | null,
    thumbnail: row.thumbnail as string | null,
    finalWinner: row.final_winner as string,
    unanimity: row.unanimity as boolean,
    voteCount: row.vote_count as Record<string, number>,
    averageScores: row.average_scores as JudgmentRecord["averageScores"],
    consensusSummary: row.consensus_summary as string,
    formattedTranscript: row.formatted_transcript as FormattedTranscript,
    individualJudgments: row.individual_judgments as JudgmentRecord["individualJudgments"],
    verdictHash: row.verdict_hash as string,
    signature: row.signature as string,
    signerAddress: row.signer_address as string,
    signedAt: Number(row.signed_at),
  };
}

// Helper to map DB row to summary
function mapRowToSummary(row: Record<string, unknown>): JudgmentSummary {
  return {
    id: row.id as string,
    createdAt: row.created_at as Date,
    topic: row.topic as string,
    description: row.description as string | null,
    thumbnail: row.thumbnail as string | null,
    finalWinner: row.final_winner as string,
    unanimity: row.unanimity as boolean,
    voteCount: row.vote_count as Record<string, number>,
    consensusSummary: row.consensus_summary as string,
  };
}
