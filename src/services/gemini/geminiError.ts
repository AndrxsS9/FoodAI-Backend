import { GeminiTimeoutError } from './geminiTimeout';

export type GeminiErrorKind =
  | 'rate_limit'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export function getGeminiErrorStatus(
  error: unknown,
): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
  };

  if (typeof candidate.status === 'number') {
    return candidate.status;
  }

  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode;
  }

  return undefined;
}

export function classifyGeminiError(
  error: unknown,
): GeminiErrorKind {
  if (
    error instanceof GeminiTimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: unknown }).name === 'GeminiTimeoutError')
  ) {
    return 'timeout';
  }

  const status = getGeminiErrorStatus(error);

  if (status === 429) {
    return 'rate_limit';
  }

  if (status === 503) {
    return 'unavailable';
  }

  return 'unknown';
}
