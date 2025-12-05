import postgres, { type Sql } from "postgres";

let sqlInstance: Sql | null = null;

/**
 * Initialize SQL connection from DATABASE_URL
 */
function initSql(): Sql | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL not configured");
    return null;
  }

  console.log("Connecting to database...");
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "prefer", // Railway requires SSL
  });
}

/**
 * Get SQL client
 */
export async function getSql(): Promise<Sql | null> {
  if (!sqlInstance) {
    sqlInstance = initSql();
    if (sqlInstance) {
      console.log("Database connected");
    }
  }
  return sqlInstance;
}

export async function closeDb() {
  if (sqlInstance) {
    await sqlInstance.end();
    sqlInstance = null;
  }
}
