import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

export const DEFAULT_TEST_SUPABASE_URL = 'https://test-project.supabase.co';

const DISALLOWED_PRODUCTION_SUPABASE_PLACEHOLDERS = [
  'tu-proyecto',
  'placeholder',
  'test-project.supabase.co',
  'example.supabase.co',
];

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

export interface ParsedEnv {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_AUDIENCE: string;
  SUPABASE_JWT_SECRET?: string;
  CORS_ALLOWED_ORIGINS: string[];
  TRUST_PROXY_HOPS: number;
  AI_RATE_LIMIT_WINDOW_MS: number;
  AI_RATE_LIMIT_MAX: number;
  AI_USER_RATE_LIMIT_MAX: number;
  AI_MAX_CONCURRENT_REQUESTS: number;
}

const rawEnvSchema = z
  .object({
    PORT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(65535).default(3000),
    ),

    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(['development', 'test', 'production']).default('development'),
    ),

    GEMINI_API_KEY: z
      .string()
      .trim()
      .min(1, 'GEMINI_API_KEY es obligatoria'),

    SUPABASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().trim().optional(),
    ),

    SUPABASE_JWT_AUDIENCE: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default('authenticated'),
    ),

    SUPABASE_JWT_SECRET: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(
          32,
          'SUPABASE_JWT_SECRET debe tener al menos 32 caracteres cuando se configura.',
        )
        .optional(),
    ),

    CORS_ALLOWED_ORIGINS: z.preprocess(
      emptyToUndefined,
      z.string().trim().optional(),
    ),

    TRUST_PROXY_HOPS: z.preprocess(
      emptyToUndefined,
      z.string().trim().optional(),
    ),

    AI_RATE_LIMIT_WINDOW_MS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1000).default(60_000),
    ),

    AI_RATE_LIMIT_MAX: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).default(30),
    ),

    AI_USER_RATE_LIMIT_MAX: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).default(20),
    ),

    AI_MAX_CONCURRENT_REQUESTS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100).default(10),
    ),
  })
  .transform((data, ctx): ParsedEnv => {
    // 1. Validar y normalizar SUPABASE_URL según entorno
    const candidateSupabaseUrl =
      data.SUPABASE_URL ??
      (data.NODE_ENV === 'test' ? DEFAULT_TEST_SUPABASE_URL : undefined);

    let normalizedSupabaseUrl = '';

    if (!candidateSupabaseUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL es obligatoria para verificar tokens de Supabase.',
      });
    } else {
      try {
        const parsed = new URL(candidateSupabaseUrl);
        const isHttpOrHttps =
          parsed.protocol === 'https:' || parsed.protocol === 'http:';

        if (!isHttpOrHttps || !parsed.hostname) {
          ctx.addIssue({
            code: 'custom',
            path: ['SUPABASE_URL'],
            message: 'SUPABASE_URL debe ser una URL HTTP/HTTPS válida.',
          });
        } else if (
          data.NODE_ENV === 'production' &&
          parsed.protocol !== 'https:'
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['SUPABASE_URL'],
            message: 'En producción, SUPABASE_URL debe utilizar HTTPS.',
          });
        } else if (
          data.NODE_ENV === 'production' &&
          DISALLOWED_PRODUCTION_SUPABASE_PLACEHOLDERS.some((placeholder) =>
            parsed.hostname.toLowerCase().includes(placeholder),
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['SUPABASE_URL'],
            message:
              'SUPABASE_URL contiene un valor de ejemplo no permitido en producción.',
          });
        } else {
          normalizedSupabaseUrl = candidateSupabaseUrl.replace(/\/+$/, '');
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_URL'],
          message: 'SUPABASE_URL no tiene un formato de URL válido.',
        });
      }
    }

    // 2. Validar y normalizar CORS_ALLOWED_ORIGINS
    const normalizedOrigins: string[] = [];
    if (data.CORS_ALLOWED_ORIGINS) {
      const rawItems = data.CORS_ALLOWED_ORIGINS.split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      for (const rawOrigin of rawItems) {
        if (rawOrigin === '*') {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ALLOWED_ORIGINS'],
            message:
              'No se permite comodín (*) en CORS_ALLOWED_ORIGINS. Especifica orígenes explícitos.',
          });
          continue;
        }

        try {
          const parsedOrigin = new URL(rawOrigin);
          if (
            (parsedOrigin.protocol !== 'http:' &&
              parsedOrigin.protocol !== 'https:') ||
            parsedOrigin.pathname !== '/' ||
            parsedOrigin.search ||
            parsedOrigin.hash
          ) {
            // Normalizamos a parsedOrigin.origin solo si no trae rutas inesperadas
            if (
              parsedOrigin.pathname !== '/' ||
              parsedOrigin.search ||
              parsedOrigin.hash
            ) {
              ctx.addIssue({
                code: 'custom',
                path: ['CORS_ALLOWED_ORIGINS'],
                message: `El origen CORS "${rawOrigin}" no debe incluir rutas, query ni hash.`,
              });
              continue;
            }
          }

          if (
            data.NODE_ENV === 'production' &&
            parsedOrigin.protocol !== 'https:'
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['CORS_ALLOWED_ORIGINS'],
              message: `En producción, los orígenes CORS deben usar HTTPS: "${rawOrigin}".`,
            });
            continue;
          }

          if (!normalizedOrigins.includes(parsedOrigin.origin)) {
            normalizedOrigins.push(parsedOrigin.origin);
          }
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ALLOWED_ORIGINS'],
            message: `Origen CORS inválido: "${rawOrigin}".`,
          });
        }
      }
    }

    // 3. Validar TRUST_PROXY_HOPS (estrictamente numérico y acotado; nunca booleano true)
    let trustProxyHops = data.NODE_ENV === 'production' ? 1 : 0;

    if (data.TRUST_PROXY_HOPS !== undefined) {
      const normalizedProxy = data.TRUST_PROXY_HOPS.toLowerCase();
      if (
        normalizedProxy === 'true' ||
        normalizedProxy === 'false' ||
        normalizedProxy === '*' ||
        !/^\d+$/.test(normalizedProxy)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUST_PROXY_HOPS'],
          message:
            'TRUST_PROXY_HOPS debe ser un entero entre 0 y 5 (nunca "true" ni "*").',
        });
      } else {
        const parsedHops = Number.parseInt(normalizedProxy, 10);
        if (parsedHops < 0 || parsedHops > 5) {
          ctx.addIssue({
            code: 'custom',
            path: ['TRUST_PROXY_HOPS'],
            message: 'TRUST_PROXY_HOPS debe estar entre 0 y 5.',
          });
        } else {
          trustProxyHops = parsedHops;
        }
      }
    }

    return {
      PORT: data.PORT,
      NODE_ENV: data.NODE_ENV,
      GEMINI_API_KEY: data.GEMINI_API_KEY,
      SUPABASE_URL: normalizedSupabaseUrl,
      SUPABASE_JWT_AUDIENCE: data.SUPABASE_JWT_AUDIENCE,
      SUPABASE_JWT_SECRET: data.SUPABASE_JWT_SECRET,
      CORS_ALLOWED_ORIGINS: normalizedOrigins,
      TRUST_PROXY_HOPS: trustProxyHops,
      AI_RATE_LIMIT_WINDOW_MS: data.AI_RATE_LIMIT_WINDOW_MS,
      AI_RATE_LIMIT_MAX: data.AI_RATE_LIMIT_MAX,
      AI_USER_RATE_LIMIT_MAX: data.AI_USER_RATE_LIMIT_MAX,
      AI_MAX_CONCURRENT_REQUESTS: data.AI_MAX_CONCURRENT_REQUESTS,
    };
  });

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env) {
  return rawEnvSchema.safeParse(rawEnv);
}

const result = parseEnv(process.env);

if (!result.success) {
  console.error('❌ Variables de entorno inválidas');
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env: ParsedEnv = result.data;
