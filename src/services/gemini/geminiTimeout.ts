/**
 * Límite de tiempo por defecto para solicitudes estándar a Gemini.
 */
export const GEMINI_TIMEOUT_MS = 20_000;

/**
 * Límite de tiempo específico para el análisis de imágenes de ingredientes con Gemini (45 segundos).
 * El frontend soporta hasta 75 segundos, por lo que 45s otorga tiempo suficiente
 * para la tokenización multimodal y el análisis sin agotar el timeout del cliente.
 */
export const GEMINI_INGREDIENT_TIMEOUT_MS = 45_000;

/**
 * Límite de tiempo específico para la generación de recetas con Gemini (60 segundos).
 * El frontend soporta hasta 75 segundos, por lo que 60s garantiza responder antes
 * de que el cliente agote su tiempo de espera y evita acumular latencias excesivas.
 */
export const GEMINI_RECIPE_TIMEOUT_MS = 60_000;

export class GeminiTimeoutError extends Error {
  constructor(
    message = `La solicitud a Gemini excedió el tiempo límite de ${GEMINI_TIMEOUT_MS}ms.`,
  ) {
    super(message);
    this.name = 'GeminiTimeoutError';
    Object.setPrototypeOf(this, GeminiTimeoutError.prototype);
  }
}

/**
 * Ejecuta una operación asíncrona garantizando que no supere el tiempo límite indicado.
 *
 * NOTA DE ARQUITECTURA SOBRE CANCELACIÓN:
 * `Promise.race` no cancela automáticamente la operación asíncrona remota en curso
 * ejecutada por el SDK cuando el temporizador expira; únicamente descarta o ignora
 * la resolución tardía en favor del rechazo por `GeminiTimeoutError` en el hilo de Node.js.
 * En el SDK de Google GenAI (`@google/genai`), las operaciones basadas en AbortSignal
 * son exclusivamente client-only y no cancelan la ejecución ni el consumo en los servidores
 * de Gemini una vez despachadas.
 *
 * El temporizador (`timer`) se limpia de manera determinista en el bloque `finally` para evitar
 * fugas de memoria o procesos colgados.
 */
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