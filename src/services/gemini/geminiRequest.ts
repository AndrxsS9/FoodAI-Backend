import {
  executeWithGeminiRetry,
  type GeminiRetryOptions,
} from './geminiRetry';
import {
  executeWithGeminiTimeout,
  GEMINI_TIMEOUT_MS,
} from './geminiTimeout';

export interface GeminiRequestOptions extends GeminiRetryOptions {
  timeoutMs?: number;
}

export async function executeGeminiRequest<T>(
  operation: () => Promise<T>,
  options: GeminiRequestOptions = {},
): Promise<T> {
  const { timeoutMs = GEMINI_TIMEOUT_MS, ...retryOptions } = options;

  return executeWithGeminiRetry(
    () => executeWithGeminiTimeout(operation, timeoutMs),
    retryOptions,
  );
}
