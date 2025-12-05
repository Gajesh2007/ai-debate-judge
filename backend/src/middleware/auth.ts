import { createClerkClient } from "@clerk/backend";
import type { Context, Next } from "hono";

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

export interface AuthContext {
  userId: string;
  email: string;
}

/**
 * Middleware to verify Clerk JWT and extract user info
 * Adds userId and email to the context
 */
export async function requireAuth(c: Context, next: Next) {
  try {
    // Debug: check if auth header exists (don't log token content - PII)
    const authHeader = c.req.header("Authorization");
    console.log("[Auth] Authorization header:", authHeader ? "present" : "MISSING");
    
    // Use authenticateRequest to verify the session
    // clockSkewInMs: Allow 5 minutes of clock drift between server and Clerk
    const requestState = await clerk.authenticateRequest(c.req.raw, {
      clockSkewInMs: 300000, // 5 minutes tolerance
    });

    if (!requestState.isSignedIn) {
      console.log("Auth failed: not signed in", { 
        reason: requestState.reason,
        status: requestState.status 
      });
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { userId } = requestState.toAuth();
    
    if (!userId) {
      return c.json({ error: "Invalid token: no user ID" }, 401);
    }

    // Get user details to get email
    const user = await clerk.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress;

    if (!email) {
      return c.json({ error: "User has no email address" }, 401);
    }

    // Store auth info in context
    c.set("auth", {
      userId,
      email: email.toLowerCase(),
    } as AuthContext);

    await next();
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

/**
 * Get auth context from request (use after requireAuth middleware)
 */
export function getAuth(c: Context): AuthContext {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) {
    throw new Error("Auth context not found - ensure requireAuth middleware is used");
  }
  return auth;
}

