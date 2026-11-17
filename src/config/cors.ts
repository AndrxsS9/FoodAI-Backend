import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';

import { env } from './env';
import { AppError } from '../utils/errors';

export const DEFAULT_DEV_WEB_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export interface FoodAiCorsConfig {
  nodeEnv?: 'development' | 'test' | 'production';
  allowedOrigins?: string[];
}

export function resolveAllowedWebOrigins(
  config: FoodAiCorsConfig = {},
): Set<string> {
  const nodeEnv = config.nodeEnv ?? env.NODE_ENV;
  const configuredOrigins = config.allowedOrigins ?? env.CORS_ALLOWED_ORIGINS;

  if (nodeEnv === 'production') {
    return new Set(configuredOrigins);
  }

  if (configuredOrigins.length > 0) {
    return new Set(configuredOrigins);
  }

  return new Set(DEFAULT_DEV_WEB_ORIGINS);
}

/**
 * Configura CORS de forma restrictiva para navegadores web sin tratarlo como autenticación.
 * - Solicitudes sin encabezado Origin (APK nativo Android, health checks de Render, clientes servidor)
 *   son permitidas a nivel de transporte; la seguridad en rutas protegidas recae en el JWT de Supabase.
 * - Solicitudes con encabezado Origin (clientes web / preflight) deben coincidir exactamente
 *   con la lista blanca explícita; nunca se permite comodín (*) en producción.
 */
export function createCorsOptions(config: FoodAiCorsConfig = {}): CorsOptions {
  const allowedOrigins = resolveAllowedWebOrigins(config);

  return {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(requestOrigin)) {
        return callback(null, true);
      }

      return callback(
        new AppError(
          'Origen no permitido por la política CORS.',
          403,
          'CORS_ORIGIN_NOT_ALLOWED',
        ),
      );
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'RateLimit-Policy',
      'Retry-After',
    ],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

export function createCorsMiddleware(
  config: FoodAiCorsConfig = {},
): RequestHandler {
  return cors(createCorsOptions(config));
}
