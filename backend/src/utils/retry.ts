import { config } from "../config/index.js";

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = "RetryError";
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoff?: "linear" | "exponential";
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = config.maxRetries,
    delayMs = config.retryDelayMs,
    backoff = "exponential",
    onRetry,
  } = options;

  let lastError: Error = new Error("No attempts made");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw new RetryError(
          `Failed after ${maxRetries} attempts: ${lastError.message}`,
          attempt,
          lastError
        );
      }

      const delay =
        backoff === "exponential" ? delayMs * Math.pow(2, attempt - 1) : delayMs * attempt;

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, lastError.message);
      onRetry?.(attempt, lastError);

      await sleep(delay);
    }
  }

  throw new RetryError(`Failed after ${maxRetries} attempts`, maxRetries, lastError);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

