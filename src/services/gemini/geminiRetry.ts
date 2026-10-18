import { classifyGeminiError } from './geminiError';

export interface GeminiRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function executeWithGeminiRetry<T>(
  operation: () => Promise<T>,
  options: GeminiRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await operation();
    } catch (error) {
      const errorKind = classifyGeminiError(error);
      const isRetryable =
        errorKind === 'rate_limit' || errorKind === 'unavailable';

      if (!isRetryable || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs,
      );

      await sleep(delayMs);
    }
  }
}
