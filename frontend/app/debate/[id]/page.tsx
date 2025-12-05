import type { Metadata } from "next";
import { DebateClient } from "./DebateClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = "https://getjudgedbyai.com";

interface JudgmentData {
  topic?: string;
  finalWinner?: string;
  consensusSummary?: string;
  thumbnail?: string;
  voteCount?: string | Record<string, number>;
}

async function getJudgment(id: string): Promise<JudgmentData | null> {
  try {
    const res = await fetch(`${API_URL}/judgments/${id}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.success ? data.judgment : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}): Promise<Metadata> {
  const { id } = await params;
  const judgment = await getJudgment(id);
  
  if (!judgment) {
    return {
      title: "Debate Not Found | AI Judge",
      description: "This debate could not be found.",
    };
  }

  // Parse vote count if needed
  const voteCount = typeof judgment.voteCount === "string" 
    ? JSON.parse(judgment.voteCount) 
    : judgment.voteCount || {};
  
  const totalVotes = Object.values(voteCount).reduce((a: number, b) => a + (b as number), 0);
  const winnerVotes = voteCount[judgment.finalWinner || ""] || 0;

  const title = judgment.topic 
    ? `${judgment.topic} | AI Judge Verdict` 
    : "Debate Verdict | AI Judge";
  
  const description = judgment.consensusSummary 
    || `${judgment.finalWinner} wins ${winnerVotes}-${totalVotes - winnerVotes}. Judged by 5 AI models.`;

  // Use thumbnail or default OG image
  const ogImage = judgment.thumbnail || `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/debate/${id}`,
      siteName: "AI Debate Judge",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: judgment.topic || "AI Debate Verdict",
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function DebatePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  return <DebateClient id={id} />;
}
