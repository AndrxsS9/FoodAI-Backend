import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';

import { env } from '../config/env';
import { sendError } from '../utils/apiResponse';

export interface AiRateLimitOptions {
  windowMs?: number;
  limit?: number;
  message?: string;
}

export const DEFAULT_AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const DEFAULT_AI_RATE_LIMIT_MAX = 30;
export const DEFAULT_AI_USER_RATE_LIMIT_MAX = 20;
export const DEFAULT_AI_RATE_LIMIT_MESSAGE =
  'Has superado el límite de solicitudes. Por favor, intenta de nuevo más tarde.';
export const DEFAULT_AI_USER_RATE_LIMIT_MESSAGE =
  'Has superado el límite de solicitudes de IA para tu cuenta. Intenta nuevamente en un minuto.';

export function createAiRateLimit(options: AiRateLimitOptions = {}) {
  const windowMs = options.windowMs ?? DEFAULT_AI_RATE_LIMIT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_AI_RATE_LIMIT_MAX;
  const message = options.message ?? DEFAULT_AI_RATE_LIMIT_MESSAGE;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      trustProxy: true,
      xForwardedForHeader: false,
    },
    handler: (
      _req: Request,
      res: Response,
      _next: NextFunction,
      _options: Options,
    ) => {
      sendError(res, message, 'RATE_LIMIT_EXCEEDED', 429);
    },
  });
}

/**
 * Limitador secundario por usuario autenticado (sub verificado de Supabase).
 * Evita que un mismo usuario consuma cuota excesiva de Gemini rotando redes o IPs.
 */
export function createAiUserRateLimit(options: AiRateLimitOptions = {}) {
  const windowMs = options.windowMs ?? DEFAULT_AI_RATE_LIMIT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_AI_USER_RATE_LIMIT_MAX;
  const message = options.message ?? DEFAULT_AI_USER_RATE_LIMIT_MESSAGE;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: false,
    legacyHeaders: false,
    validate: {
      trustProxy: true,
      xForwardedForHeader: false,
    },
    keyGenerator: (req: Request) => {
      if (req.user?.id) {
        return `user:${req.user.id}`;
      }

      return `ip:${ipKeyGenerator(req.ip ?? '127.0.0.1')}`;
    },
    handler: (
      _req: Request,
      res: Response,
      _next: NextFunction,
      _options: Options,
    ) => {
      sendError(res, message, 'RATE_LIMIT_EXCEEDED', 429);
    },
  });
}

export const aiRateLimit = createAiRateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_RATE_LIMIT_MAX,
});

export const aiUserRateLimit = createAiUserRateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_USER_RATE_LIMIT_MAX,
});
