export const GEMINI_TIMEOUT_MS = 20_000;

export class GeminiTimeoutError extends Error {
  constructor(
    message = `La solicitud a Gemini excedió el tiempo límite de ${GEMINI_TIMEOUT_MS}ms.`,
  ) {
    super(message);
    this.name = 'GeminiTimeoutError';
    Object.setPrototypeOf(this, GeminiTimeoutError.prototype);
  }
}

export async function executeWithGeminiTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new GeminiTimeoutError(
          `La solicitud a Gemini excedió el tiempo límite de ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
