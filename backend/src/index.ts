import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { config, COUNCIL_MODELS } from "./config/index.js";
import { transcribeAudio } from "./services/transcription.js";
import { formatTranscript, moderateContent } from "./services/formatting.js";
import { runCouncil, JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./services/council.js";
import { signVerdict, getSignerAddress, verifySignedVerdict } from "./services/signing.js";
import { JudgeRequestSchema, type DebateMetadata } from "./schemas/index.js";
import { initSchema, saveJudgment, getJudgment, listJudgments, searchJudgments, getSql } from "./db/index.js";
import {
  initPaymentSchema,
  createCheckoutSession,
  handleStripeWebhook,
  getCredits,
  useCredits,
  refundCredits,
  calculateCost,
  getCreditPacks,
} from "./services/payments.js";
import { requireAuth, getAuth } from "./middleware/auth.js";

const app = new Hono();

// Allowed origins - production domain only (+ localhost for dev)
const ALLOWED_ORIGINS = [
  "https://getjudgedbyai.com",
  "https://www.getjudgedbyai.com",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000"] : []),
];

// Middleware - restricted CORS
app.use("*", cors({
  origin: (origin) => {
    if (!origin) return ALLOWED_ORIGINS[0]; // Allow server-to-server
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  credentials: true,
}));
app.use("*", logger());

// Health check
app.get("/health", async (c) => {
  const sql = await getSql();
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    signerAddress: process.env.MNEMONIC ? getSignerAddress() : "not configured",
    database: sql ? "connected" : "not configured",
  });
});

// Get default council models
app.get("/models", (c) => {
  return c.json({
    success: true,
    models: COUNCIL_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      supportsReasoningEffort: m.supportsReasoningEffort,
    })),
  });
});

// Main judge endpoint - accepts multipart form with optional audio files
app.post("/judge", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";

    let topic: string;
    let description: string | undefined;
    let thumbnail: string | undefined;
    let transcript: string | undefined;
    let audioBuffers: Buffer[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data with audio files
      const formData = await c.req.formData();

      topic = formData.get("topic") as string;
      description = (formData.get("description") as string) || undefined;
      thumbnail = (formData.get("thumbnail") as string) || undefined;
      transcript = (formData.get("transcript") as string) || undefined;

      // Get all audio files
      const audioFiles = formData.getAll("audio");
      for (const file of audioFiles) {
        if (file instanceof File) {
          const buffer = Buffer.from(await file.arrayBuffer());
          audioBuffers.push(buffer);
        }
      }
    } else {
      // Handle JSON body
      const body = await c.req.json();
      const parsed = JudgeRequestSchema.parse(body);
      topic = parsed.topic;
      description = parsed.description;
      thumbnail = parsed.thumbnail;
      transcript = parsed.transcript;
    }

    if (!topic) {
      return c.json({ error: "Topic is required" }, 400);
    }

    if (!transcript && audioBuffers.length === 0) {
      return c.json({ error: "Either transcript or audio files are required" }, 400);
    }

    // Build metadata for gallery
    const metadata: DebateMetadata = { topic, description, thumbnail };

    console.log(`\n${"=".repeat(60)}`);
    console.log(`NEW JUDGMENT REQUEST`);
    console.log(`Topic: ${topic}`);
    console.log(`Description: ${description || "(none)"}`);
    console.log(`Audio files: ${audioBuffers.length}`);
    console.log(`Transcript provided: ${!!transcript}`);
    console.log(`${"=".repeat(60)}\n`);

    // Step 1: Transcribe audio if provided
    let rawTranscript = transcript;
    if (audioBuffers.length > 0) {
      console.log("Step 1: Transcribing audio files...");
      const transcriptionResult = await transcribeAudio(audioBuffers);
      rawTranscript = transcriptionResult.text;
      console.log(`Transcription complete: ${rawTranscript.length} characters`);
    } else {
      console.log("Step 1: Using provided transcript");
    }

    if (!rawTranscript) {
      return c.json({ error: "Failed to obtain transcript" }, 500);
    }

    // Step 2: Content moderation
    console.log("\nStep 2: Checking content moderation...");
    const moderation = await moderateContent(rawTranscript, topic);
    if (!moderation.isAppropriate) {
      const reason = moderation.reason || "Inappropriate content";
      const flags = moderation.flags?.length ? ` (${moderation.flags.join(", ")})` : "";
      return c.json({ error: `Content rejected: ${reason}${flags}` }, 400);
    }

    // Step 3: Format transcript with Gemini
    console.log("\nStep 3: Formatting transcript...");
    const formattedTranscript = await formatTranscript(rawTranscript, topic);

    // Step 4: Run council evaluation
    console.log("\nStep 4: Running council of LLMs...");
    const verdict = await runCouncil(formattedTranscript);

    // Step 5: Sign the verdict
    console.log("\nStep 5: Signing verdict...");
    const signedVerdict = await signVerdict(verdict);

    // Step 5: Save to database
    console.log("\nStep 5: Saving to database...");
    const judgmentId = await saveJudgment(metadata, formattedTranscript, signedVerdict);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`JUDGMENT COMPLETE`);
    console.log(`ID: ${judgmentId || "not saved"}`);
    console.log(`Winner: ${signedVerdict.verdict.finalWinner}`);
    console.log(`Unanimous: ${signedVerdict.verdict.unanimity}`);
    console.log(`Signed by: ${signedVerdict.signerAddress}`);
    console.log(`${"=".repeat(60)}\n`);

    return c.json({
      success: true,
      id: judgmentId,
      formattedTranscript,
      signedVerdict,
    });
  } catch (error) {
    console.error("Judge error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Streaming judge endpoint with progress updates via SSE
// REQUIRES: Clerk auth with valid credits
app.post("/judge/stream", requireAuth, async (c) => {
  const auth = getAuth(c);
  const contentType = c.req.header("content-type") || "";

  let topic: string;
  let description: string | undefined;
  let thumbnail: string | undefined;
  let transcript: string | undefined;
  let customModels: { id: string; name: string; supportsReasoningEffort?: boolean }[] | undefined;
  let creditCost = 1; // Default cost, will be recalculated

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      topic = formData.get("topic") as string;
      description = (formData.get("description") as string) || undefined;
      thumbnail = (formData.get("thumbnail") as string) || undefined;
      transcript = (formData.get("transcript") as string) || undefined;
      const modelsJson = formData.get("models") as string;
      if (modelsJson) {
        customModels = JSON.parse(modelsJson);
      }
    } else {
      const body = await c.req.json();
      const parsed = JudgeRequestSchema.parse(body);
      topic = parsed.topic;
      description = parsed.description;
      thumbnail = parsed.thumbnail;
      transcript = parsed.transcript;
      customModels = parsed.models;
    }

    if (!topic) {
      return c.json({ error: "Topic is required" }, 400);
    }

    if (!transcript) {
      return c.json({ error: "Transcript is required (use /transcribe first for audio)" }, 400);
    }

    // Calculate cost: default council = 1 credit, custom models = 1 credit per model
    creditCost = calculateCost(customModels?.length);
    const modelDescription = customModels?.length 
      ? `Custom analysis (${customModels.length} models)` 
      : "Council analysis (5 models)";

    // Check and use credits
    const creditResult = await useCredits(auth.userId, auth.email, creditCost, undefined, modelDescription);
    if (!creditResult.success) {
      return c.json({ 
        error: "Insufficient credits", 
        credits: creditResult.remaining,
        required: creditCost,
        message: `This analysis costs ${creditCost} credit${creditCost > 1 ? "s" : ""}. Purchase more to continue.`,
      }, 402);
    }

    console.log(`${creditCost} credit(s) used, remaining: ${creditResult.remaining}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }

  const metadata: DebateMetadata = { topic, description, thumbnail };
  const rawTranscript = transcript;
  const userAuth = auth;
  const costToRefund = creditCost;

  // Use custom models or default council
  const modelsToUse = customModels?.length ? customModels : COUNCIL_MODELS;

  return streamSSE(c, async (stream) => {
    const sendProgress = async (data: Record<string, unknown>) => {
      await stream.writeSSE({ data: JSON.stringify(data), event: "progress" });
    };

    try {
      // Step 1: Content moderation
      await sendProgress({
        step: "moderating",
        message: "Checking content for appropriateness...",
        progress: 5,
        estimatedTimeRemaining: 95,
      });

      const moderation = await moderateContent(rawTranscript, topic);

      await sendProgress({
        step: "moderation_complete",
        message: moderation.isAppropriate 
          ? "Content approved ✓" 
          : `Content rejected: ${moderation.reason}`,
        progress: 10,
        estimatedTimeRemaining: 90,
        moderation: {
          approved: moderation.isAppropriate,
          reason: moderation.reason,
          flags: moderation.flags,
        },
      });

      if (!moderation.isAppropriate) {
        throw new Error(`Content rejected: ${moderation.reason || "Inappropriate content"}${moderation.flags?.length ? ` (${moderation.flags.join(", ")})` : ""}`);
      }

      // Step 2: Formatting
      await sendProgress({
        step: "formatting",
        message: "Analyzing transcript and identifying speakers...",
        progress: 15,
        estimatedTimeRemaining: 85,
      });

      const formattedTranscript = await formatTranscript(rawTranscript, topic);

      await sendProgress({
        step: "formatting_complete",
        message: `Identified ${formattedTranscript.speakers.length} speakers`,
        progress: 20,
        estimatedTimeRemaining: 80,
      });

      // Step 3: Council evaluation
      await sendProgress({
        step: "council_starting",
        message: `Starting evaluation with ${modelsToUse.length} AI judges...`,
        progress: 25,
        estimatedTimeRemaining: 75,
        judges: modelsToUse.map((m) => ({ name: m.name, status: "pending" })),
      });

      const judgeStatuses: Record<string, { status: string; winner?: string; confidence?: number }> = {};
      modelsToUse.forEach((m) => {
        judgeStatuses[m.name] = { status: "pending" };
      });

      const verdict = await runCouncil(
        formattedTranscript,
        async (progress) => {
          if (progress.step === "judge_started" && progress.judgeName) {
            judgeStatuses[progress.judgeName] = { status: "evaluating" };
          } else if (progress.step === "judge_completed" && progress.judgeName) {
            judgeStatuses[progress.judgeName] = {
              status: "completed",
              winner: progress.winner,
              confidence: progress.confidence,
            };
          }

          const completedCount = progress.completedJudges;
          const totalCount = progress.totalJudges;
          const councilProgress = 25 + Math.round((completedCount / totalCount) * 60);
          const estimatedRemaining = Math.max(5, Math.round((totalCount - completedCount) * 12));

          await sendProgress({
            step: progress.step,
            message:
              progress.step === "judge_completed"
                ? `${progress.judgeName} voted for ${progress.winner} (${progress.confidence}% confidence)`
                : progress.step === "judge_started"
                  ? `${progress.judgeName} is evaluating...`
                  : "Aggregating results...",
            progress: councilProgress,
            estimatedTimeRemaining: estimatedRemaining,
            completedJudges: completedCount,
            totalJudges: totalCount,
            judges: Object.entries(judgeStatuses).map(([name, s]) => ({ name, ...s })),
          });
        },
        customModels?.map(m => ({
          id: m.id,
          name: m.name,
          supportsReasoningEffort: m.supportsReasoningEffort ?? false,
        }))
      );

      // Step 3: Signing
      await sendProgress({
        step: "signing",
        message: "Signing verdict with cryptographic signature...",
        progress: 90,
        estimatedTimeRemaining: 5,
      });

      const signedVerdict = await signVerdict(verdict);

      // Step 4: Saving
      await sendProgress({
        step: "saving",
        message: "Saving judgment to database...",
        progress: 95,
        estimatedTimeRemaining: 2,
      });

      const judgmentId = await saveJudgment(metadata, formattedTranscript, signedVerdict);

      // Complete - include prompts for transparency
      const prompts = {
        system: JUDGE_SYSTEM_PROMPT,
        user: buildJudgePrompt(formattedTranscript),
      };

      await stream.writeSSE({
        data: JSON.stringify({
          step: "complete",
          message: "Analysis complete!",
          progress: 100,
          result: {
            success: true,
            id: judgmentId,
            formattedTranscript,
            signedVerdict,
            prompts,
          },
        }),
        event: "complete",
      });
    } catch (error) {
      console.error("Streaming judge error:", error);
      
      // Refund the credits on failure
      if (userAuth) {
        try {
          await refundCredits(userAuth.userId, costToRefund);
          console.log(`${costToRefund} credit(s) refunded due to error`);
        } catch (refundError) {
          console.error("Failed to refund credit:", refundError);
        }
      }
      
      await stream.writeSSE({
        data: JSON.stringify({
          step: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          creditRefunded: true,
        }),
        event: "error",
      });
    }
  });
});

// Get a judgment by ID
app.get("/judgments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const judgment = await getJudgment(id);

    if (!judgment) {
      return c.json({ error: "Judgment not found" }, 404);
    }

    // Reconstruct prompts from the transcript for transparency
    const prompts = judgment.formattedTranscript ? {
      system: JUDGE_SYSTEM_PROMPT,
      user: buildJudgePrompt(judgment.formattedTranscript),
    } : null;

    return c.json({ success: true, judgment, prompts });
  } catch (error) {
    console.error("Get judgment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// List judgments with pagination
app.get("/judgments", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);
    const search = c.req.query("search");

    if (search) {
      const judgments = await searchJudgments(search, limit);
      return c.json({ success: true, judgments, total: judgments.length });
    }

    const result = await listJudgments(limit, offset);
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error("List judgments error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Get just the transcript formatting (for debugging)
app.post("/format", async (c) => {
  try {
    const { topic, transcript } = await c.req.json();

    if (!topic || !transcript) {
      return c.json({ error: "Topic and transcript are required" }, 400);
    }

    const formatted = await formatTranscript(transcript, topic);
    return c.json({ success: true, formatted });
  } catch (error) {
    console.error("Format error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Get signer address
app.get("/signer", (c) => {
  try {
    const address = process.env.MNEMONIC ? getSignerAddress() : null;
    return c.json({
      success: true,
      address,
      configured: !!address,
    });
  } catch (error) {
    console.error("Signer error:", error);
    return c.json({ success: false, address: null, configured: false });
  }
});

// Verify a signed verdict
app.post("/verify", async (c) => {
  try {
    const { verdict, hash, signature, signerAddress } = await c.req.json();

    if (!verdict || !hash || !signature || !signerAddress) {
      return c.json({ error: "Missing required fields: verdict, hash, signature, signerAddress" }, 400);
    }

    const result = await verifySignedVerdict(
      verdict,
      hash as `0x${string}`,
      signature as `0x${string}`,
      signerAddress
    );

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Verify error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Transcribe audio only (requires auth to prevent abuse)
// Accepts either: { audioUrl: "https://..." } or { audioUrls: ["https://...", ...] }
app.post("/transcribe", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { audioUrl, audioUrls } = body;

    // Support single URL or array of URLs
    const urls: string[] = audioUrls || (audioUrl ? [audioUrl] : []);

    if (urls.length === 0) {
      return c.json({ error: "No audio URLs provided" }, 400);
    }

    // Validate URLs (only allow Vercel Blob URLs for security)
    for (const url of urls) {
      if (!url.includes("blob.vercel-storage.com") && !url.includes("public.blob.vercel-storage.com")) {
        return c.json({ error: "Invalid audio URL - must be from Vercel Blob" }, 400);
      }
    }

    console.log(`Fetching ${urls.length} audio file(s) from Vercel Blob...`);

    // Fetch audio files from URLs
    const audioBuffers: Buffer[] = [];
    for (const url of urls) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio from ${url}: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
      console.log(`Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB from Vercel Blob`);
    }

    const result = await transcribeAudio(audioBuffers);
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error("Transcribe error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ============================================
// PAYMENT ENDPOINTS
// ============================================

// Get available credit packs
app.get("/credits/packs", (c) => {
  return c.json({
    success: true,
    packs: getCreditPacks(),
  });
});

// Get own credit balance (requires auth)
app.get("/credits/me", requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const result = await getCredits(auth.userId);
    
    return c.json({
      success: true,
      email: result?.email || auth.email,
      credits: result?.credits || 0,
    });
  } catch (error) {
    console.error("Get credits error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Create Stripe checkout session (requires auth)
app.post("/checkout", requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { packId } = await c.req.json();

    if (!packId) {
      return c.json({ error: "packId is required" }, 400);
    }

    const result = await createCheckoutSession(auth.userId, auth.email, packId);
    
    return c.json({
      success: true,
      url: result.url,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Stripe webhook handler
app.post("/webhooks/stripe", async (c) => {
  try {
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      return c.json({ error: "Missing stripe-signature header" }, 400);
    }

    // Get raw body for signature verification
    const payload = await c.req.text();
    
    const result = await handleStripeWebhook(payload, signature);
    
    if (!result.received) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ received: true, type: result.type });
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Initialize and start server
async function start() {
  // Initialize database schemas
  await initSchema();
  await initPaymentSchema();

  console.log(`Starting AI Judge backend on port ${config.port}...`);
  console.log(`CORS restricted to: ${ALLOWED_ORIGINS.join(", ")}`);
  serve({
    fetch: app.fetch,
    port: config.port,
  });
  console.log(`Server running at http://localhost:${config.port}`);
}

start().catch(console.error);
