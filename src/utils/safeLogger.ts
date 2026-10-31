const REDACTED_BEARER = 'Bearer [REDACTED]';
const REDACTED_JWT = '[REDACTED_JWT]';
const REDACTED_API_KEY = '[REDACTED_API_KEY]';
const REDACTED_SUPABASE_KEY = '[REDACTED_SUPABASE_KEY]';
const REDACTED_SECRET = '[REDACTED_SECRET]';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRuntimeSecrets(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.SUPABASE_JWT_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];

  return candidates
    .filter((val): val is string => typeof val === 'string')
    .map((val) => val.trim())
    .filter((val) => val.length >= 6);
}

/**
 * Redacta tokens JWT, encabezados Bearer, claves de Gemini/Google,
 * claves de Supabase y cualquier secreto de entorno presente en cadenas de log.
 */
export function redactSensitiveText(
  input: string,
  extraSecrets: string[] = [],
): string {
  if (!input) {
    return input;
  }

  let sanitized = input;

  // 1. Encabezados o fragmentos Bearer <token>
  sanitized = sanitized.replace(
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    REDACTED_BEARER,
  );

  // 2. Patrones de JWT (3 segmentos Base64URL que inician con eyJ)
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g,
    REDACTED_JWT,
  );

  // 3. Claves de API de Google / Gemini (AIza...)
  sanitized = sanitized.replace(
    /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    REDACTED_API_KEY,
  );

  // 4. Claves modernas de Supabase (sb_secret_..., sb_publishable_..., sbp_...)
  sanitized = sanitized.replace(
    /\b(?:sb_secret|sb_publishable|sbp)_[A-Za-z0-9_-]{8,}\b/g,
    REDACTED_SUPABASE_KEY,
  );

  // 5. Parámetros sensibles en URLs o mensajes (key=, api_key=, access_token=, token=)
  sanitized = sanitized.replace(
    /\b(api[_-]?key|key|access_token|refresh_token|token|authorization)=([^\s&"']+)/gi,
    '$1=[REDACTED]',
  );

  // 6. Valores exactos de secretos configurados en tiempo de ejecución
  const secrets = [...getRuntimeSecrets(), ...extraSecrets].filter(
    (s) => s.length >= 6,
  );

  for (const secret of secrets) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegExp(secret), 'g'),
      REDACTED_SECRET,
    );
  }

  return sanitized;
}

export interface SafeErrorLogOptions {
  includeStack?: boolean;
  extraSecrets?: string[];
}

/**
 * Extrae metadatos diagnósticos seguros de un error evitando volcar
 * encabezados HTTP, cuerpos crudos, buffers de imágenes o credenciales en logs.
 */
export function formatSafeErrorForLog(
  error: unknown,
  options: SafeErrorLogOptions = {},
): Record<string, unknown> {
  const { includeStack = false, extraSecrets = [] } = options;

  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };

    const safeSummary: Record<string, unknown> = {
      name: candidate.name,
      message: redactSensitiveText(candidate.message, extraSecrets),
    };

    if (typeof candidate.code === 'string' || typeof candidate.code === 'number') {
      safeSummary.code = candidate.code;
    }

    if (typeof candidate.status === 'number') {
      safeSummary.status = candidate.status;
    } else if (typeof candidate.statusCode === 'number') {
      safeSummary.statusCode = candidate.statusCode;
    }

    if (includeStack && typeof candidate.stack === 'string') {
      safeSummary.stack = redactSensitiveText(candidate.stack, extraSecrets);
    }

    return safeSummary;
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    const safeSummary: Record<string, unknown> = {
      name: typeof obj.name === 'string' ? obj.name : 'NonErrorObject',
    };

    if (typeof obj.message === 'string') {
      safeSummary.message = redactSensitiveText(obj.message, extraSecrets);
    }
    if (typeof obj.code === 'string' || typeof obj.code === 'number') {
      safeSummary.code = obj.code;
    }
    if (typeof obj.status === 'number') {
      safeSummary.status = obj.status;
    } else if (typeof obj.statusCode === 'number') {
      safeSummary.statusCode = obj.statusCode;
    }

    return safeSummary;
  }

  return {
    message: redactSensitiveText(String(error), extraSecrets),
  };
}
