import postgres, { type Sql } from "postgres";
import { mnemonicToAccount } from "viem/accounts";

// ECDSA signatures expire after 300s, so we need to refresh connections
const ECDSA_SIGNATURE_TTL_MS = 240_000; // Refresh before 300s expiry

let sqlInstance: Sql | null = null;
let lastConnectionTime: number = 0;
let isEcdsaConnection = false;

/**
 * Create a postgres connection with ECDSA authentication
 * Signs a timestamp with the wallet derived from MNEMONIC
 */
async function createEcdsaConnection(): Promise<Sql | null> {
  const host = process.env.PG_HOST;
  const port = parseInt(process.env.PG_PORT || "5433", 10);
  const database = process.env.PG_DATABASE || "postgres";
  const mnemonic = process.env.MNEMONIC;

  if (!host || !mnemonic) {
    return null;
  }

  const account = mnemonicToAccount(mnemonic);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await account.signMessage({ message: timestamp });
  const password = `${timestamp}:${signature}`;

  console.log(`Connecting to pg-ecdsa-proxy as ${account.address}`);

  return postgres({
    host,
    port,
    user: account.address,
    password,
    database,
    max: 1, // Single connection to avoid stale pool connections
    idle_timeout: 60,
    connect_timeout: 10,
  });
}

/**
 * Create a postgres connection from DATABASE_URL
 */
function createUrlConnection(): Sql | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/**
 * Initialize or refresh the SQL connection
 */
async function initSql(): Promise<Sql | null> {
  // Prefer ECDSA auth (pg-ecdsa-proxy) over direct DATABASE_URL
  const ecdsaSql = await createEcdsaConnection();
  if (ecdsaSql) {
    console.log("Database connected via pg-ecdsa-proxy");
    isEcdsaConnection = true;
    lastConnectionTime = Date.now();
    return ecdsaSql;
  }

  const urlSql = createUrlConnection();
  if (urlSql) {
    console.log("Database connected via DATABASE_URL");
    isEcdsaConnection = false;
    return urlSql;
  }

  console.warn("No database configured (set PG_HOST+MNEMONIC or DATABASE_URL)");
  return null;
}

/**
 * Check if ECDSA connection needs refresh (signature about to expire)
 */
function needsRefresh(): boolean {
  if (!isEcdsaConnection) return false;
  return Date.now() - lastConnectionTime > ECDSA_SIGNATURE_TTL_MS;
}

/**
 * Get SQL client, refreshing if needed for ECDSA connections
 */
export async function getSql(): Promise<Sql | null> {
  // Refresh ECDSA connection if signature is about to expire
  if (sqlInstance && needsRefresh()) {
    console.log("Refreshing ECDSA database connection (signature expiring)...");
    try {
      await sqlInstance.end();
    } catch (e) {
      // Ignore close errors
    }
    sqlInstance = null;
  }

  if (!sqlInstance) {
    sqlInstance = await initSql();
  }
  
  return sqlInstance;
}

// Synchronous getter for backward compatibility (returns null until initialized)
export const sql: Sql | null = null;

export async function closeDb() {
  if (sqlInstance) {
    await sqlInstance.end();
    sqlInstance = null;
  }
}
