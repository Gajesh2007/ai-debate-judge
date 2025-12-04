import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { config, COUNCIL_MODELS } from "./config/index.js";
import { transcribeAudio } from "./services/transcription.js";
import { formatTranscript, moderateContent } from "./services/formatting.js";
import { runCouncil } from "./services/council.js";
import { signVerdict, getSignerAddress, verifySignedVerdict } from "./services/signing.js";
import { JudgeRequestSchema, type DebateMetadata } from "./schemas/index.js";
import { initSchema, saveJudgment, getJudgment, listJudgments, searchJudgments, getSql } from "./db/index.js";

const app = new Hono();

// Middleware
app.use("*", cors());
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
app.post("/judge/stream", async (c) => {
  const contentType = c.req.header("content-type") || "";

  let topic: string;
  let description: string | undefined;
  let thumbnail: string | undefined;
  let transcript: string | undefined;
  let customModels: { id: string; name: string; supportsReasoningEffort?: boolean }[] | undefined;

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }

  const metadata: DebateMetadata = { topic, description, thumbnail };
  const rawTranscript = transcript;

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

      // Complete
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
          },
        }),
        event: "complete",
      });
    } catch (error) {
      console.error("Streaming judge error:", error);
      await stream.writeSSE({
        data: JSON.stringify({
          step: "error",
          error: error instanceof Error ? error.message : "Unknown error",
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

    return c.json({ success: true, judgment });
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

// Transcribe audio only
app.post("/transcribe", async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFiles = formData.getAll("audio");

    if (audioFiles.length === 0) {
      return c.json({ error: "No audio files provided" }, 400);
    }

    const audioBuffers: Buffer[] = [];
    for (const file of audioFiles) {
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        audioBuffers.push(buffer);
      }
    }

    const result = await transcribeAudio(audioBuffers);
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error("Transcribe error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Initialize and start server
async function start() {
  // Initialize database schema
  await initSchema();

  console.log(`Starting AI Judge backend on port ${config.port}...`);
  serve({
    fetch: app.fetch,
    port: config.port,
  });
  console.log(`Server running at http://localhost:${config.port}`);
}

start().catch(console.error);
