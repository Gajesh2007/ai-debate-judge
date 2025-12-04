import { getSql } from "./client.js";

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
export async function initSchema() {
  const sql = await getSql();
  if (!sql) {
    console.log("Database not configured, skipping schema init");
    return;
  }

  console.log("Initializing database schema...");

  await sql`
    CREATE TABLE IF NOT EXISTS judgments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Debate metadata (for gallery)
      topic TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      
      -- Verdict summary
      final_winner TEXT NOT NULL,
      unanimity BOOLEAN NOT NULL,
      vote_count JSONB NOT NULL,
      average_scores JSONB NOT NULL,
      consensus_summary TEXT NOT NULL,
      
      -- Full data
      formatted_transcript JSONB NOT NULL,
      individual_judgments JSONB NOT NULL,
      
      -- Signature
      verdict_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_address TEXT NOT NULL,
      signed_at BIGINT NOT NULL
    )
  `;

  // Add columns if they don't exist (for existing databases)
  await sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'judgments' AND column_name = 'description') THEN
        ALTER TABLE judgments ADD COLUMN description TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'judgments' AND column_name = 'thumbnail') THEN
        ALTER TABLE judgments ADD COLUMN thumbnail TEXT;
      END IF;
    END $$;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_judgments_created_at ON judgments(created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_judgments_topic ON judgments(topic)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_judgments_winner ON judgments(final_winner)
  `;

  console.log("Database schema initialized");
}
