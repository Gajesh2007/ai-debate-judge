import Stripe from "stripe";
import { stripeConfig } from "../config/index.js";
import { getSql } from "../db/client.js";

// Initialize Stripe
const stripe = new Stripe(stripeConfig.secretKey);

/**
 * Initialize payment-related database tables
 */
export async function initPaymentSchema() {
  const sql = await getSql();
  if (!sql) {
    console.log("Database not configured, skipping payment schema init");
    return;
  }

  console.log("Initializing payment schema...");

  // Users table - clerk_user_id is the identity
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      stripe_customer_id TEXT UNIQUE,
      credits INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)
  `;

  // Credit transactions for audit trail
  await sql`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      judgment_id UUID,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_credit_tx_stripe_session ON credit_transactions(stripe_session_id)
  `;

  // Add user_id to judgments if not exists
  await sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'judgments' AND column_name = 'user_email') THEN
        ALTER TABLE judgments ADD COLUMN user_email TEXT;
      END IF;
    END $$;
  `;

  console.log("Payment schema initialized");
}

/**
 * Get or create a user by Clerk user ID
 */
async function getOrCreateUser(clerkUserId: string, email: string): Promise<{ id: string; credits: number; stripeCustomerId: string | null }> {
  const sql = await getSql();
  if (!sql) throw new Error("Database not configured");

  const normalizedEmail = email.toLowerCase().trim();

  // Try to get existing user
  const [existing] = await sql`
    SELECT id, credits, stripe_customer_id
    FROM users
    WHERE clerk_user_id = ${clerkUserId}
  `;

  if (existing) {
    // Update email if changed
    if (existing.email !== normalizedEmail) {
      await sql`UPDATE users SET email = ${normalizedEmail}, updated_at = NOW() WHERE id = ${existing.id}`;
    }
    return {
      id: existing.id,
      credits: existing.credits,
      stripeCustomerId: existing.stripe_customer_id,
    };
  }

  // Create new user
  const [newUser] = await sql`
    INSERT INTO users (clerk_user_id, email, credits)
    VALUES (${clerkUserId}, ${normalizedEmail}, 0)
    RETURNING id, credits, stripe_customer_id
  `;

  return {
    id: newUser.id,
    credits: newUser.credits,
    stripeCustomerId: newUser.stripe_customer_id,
  };
}

/**
 * Create a Stripe checkout session for purchasing credits
 */
export async function createCheckoutSession(
  clerkUserId: string,
  email: string,
  packId: string
): Promise<{ url: string; sessionId: string }> {
  const pack = stripeConfig.packs.find((p) => p.id === packId);
  if (!pack) {
    throw new Error(`Invalid pack: ${packId}`);
  }

  const user = await getOrCreateUser(clerkUserId, email);

  // Create or get Stripe customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: email.toLowerCase().trim(),
      metadata: { userId: user.id, clerkUserId },
    });
    stripeCustomerId = customer.id;

    // Update user with Stripe customer ID
    const sql = await getSql();
    if (sql) {
      await sql`
        UPDATE users SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
        WHERE id = ${user.id}
      `;
    }
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "payment",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.price,
          product_data: {
            name: pack.name,
            description: `${pack.credits} debate ${pack.credits === 1 ? "analysis" : "analyses"} credit${pack.credits === 1 ? "" : "s"}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      clerkUserId,
      email: email.toLowerCase().trim(),
      packId: pack.id,
      credits: pack.credits.toString(),
    },
    success_url: `${stripeConfig.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: stripeConfig.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<{ received: boolean; type?: string; error?: string }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeConfig.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return { received: false, error: message };
  }

  console.log(`Stripe webhook received: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Filter: Only process sessions from THIS app (has our metadata)
    const { userId, email, packId, credits } = session.metadata || {};
    
    if (!userId || !credits || !packId) {
      // Not our session - ignore (could be from another product on this Stripe account)
      console.log("Ignoring checkout.session.completed - not a credit purchase");
      return { received: true, type: event.type };
    }
    
    if (session.payment_status === "paid") {
      await addCredits(
        userId,
        parseInt(credits, 10),
        "purchase",
        session.id,
        session.payment_intent as string | null,
        `Purchased ${packId}`
      );
      console.log(`Added ${credits} credits via webhook`);
    }
  }

  return { received: true, type: event.type };
}

/**
 * Add credits to a user
 */
async function addCredits(
  userId: string,
  amount: number,
  type: string,
  sessionId?: string | null,
  paymentIntent?: string | null,
  description?: string
): Promise<number> {
  const sql = await getSql();
  if (!sql) throw new Error("Database not configured");

  // Update user credits
  const [updated] = await sql`
    UPDATE users 
    SET credits = credits + ${amount}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING credits
  `;

  // Record transaction
  await sql`
    INSERT INTO credit_transactions (user_id, amount, type, stripe_session_id, stripe_payment_intent, description)
    VALUES (${userId}, ${amount}, ${type}, ${sessionId || null}, ${paymentIntent || null}, ${description || null})
  `;

  return updated.credits;
}

/**
 * Get user's credit balance by Clerk user ID
 */
export async function getCredits(clerkUserId: string): Promise<{ credits: number; email: string } | null> {
  const sql = await getSql();
  if (!sql) return null;

  const [user] = await sql`
    SELECT email, credits FROM users WHERE clerk_user_id = ${clerkUserId}
  `;

  if (!user) {
    return { credits: 0, email: "" };
  }

  return { credits: user.credits, email: user.email };
}

/**
 * Calculate cost for an analysis
 * Default council = 1 credit, custom models = 1 credit per model
 */
export function calculateCost(customModelCount?: number): number {
  if (customModelCount && customModelCount > 0) {
    return customModelCount; // $1 per custom model
  }
  return 1; // Flat rate for default council
}

/**
 * Use credits for an analysis
 * Returns true if successful, false if insufficient credits
 */
export async function useCredits(
  clerkUserId: string, 
  email: string, 
  cost: number,
  judgmentId?: string,
  description?: string
): Promise<{ success: boolean; remaining: number; cost: number }> {
  const sql = await getSql();
  if (!sql) throw new Error("Database not configured");

  // Get or create user (ensures user exists)
  const user = await getOrCreateUser(clerkUserId, email);

  if (user.credits < cost) {
    return { success: false, remaining: user.credits, cost };
  }

  // Deduct credits atomically
  const [updated] = await sql`
    UPDATE users 
    SET credits = credits - ${cost}, updated_at = NOW()
    WHERE id = ${user.id} AND credits >= ${cost}
    RETURNING credits
  `;

  if (!updated) {
    return { success: false, remaining: 0, cost };
  }

  // Record transaction
  await sql`
    INSERT INTO credit_transactions (user_id, amount, type, judgment_id, description)
    VALUES (${user.id}, ${-cost}, ${"usage"}, ${judgmentId || null}, ${description || "Debate analysis"})
  `;

  return { success: true, remaining: updated.credits, cost };
}

/**
 * Refund credits (e.g., if analysis fails)
 */
export async function refundCredits(clerkUserId: string, cost: number, judgmentId?: string): Promise<number> {
  const sql = await getSql();
  if (!sql) throw new Error("Database not configured");

  const [user] = await sql`
    SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}
  `;

  if (!user) {
    throw new Error("User not found");
  }

  const [updated] = await sql`
    UPDATE users 
    SET credits = credits + ${cost}, updated_at = NOW()
    WHERE id = ${user.id}
    RETURNING credits
  `;

  // Record refund transaction
  await sql`
    INSERT INTO credit_transactions (user_id, amount, type, judgment_id, description)
    VALUES (${user.id}, ${cost}, ${"refund"}, ${judgmentId || null}, ${"Analysis failed - credits refunded"})
  `;

  return updated.credits;
}

/**
 * Get credit packs available for purchase
 */
export function getCreditPacks() {
  return stripeConfig.packs.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price / 100, // Convert cents to dollars
    credits: p.credits,
    pricePerCredit: Math.round((p.price / p.credits) / 100 * 100) / 100,
  }));
}

