import { NextFunction, Request, Response } from 'express';
import rateLimit, { Options } from 'express-rate-limit';

import { sendError } from '../utils/apiResponse';

export interface AiRateLimitOptions {
  windowMs?: number;
  limit?: number;
  message?: string;
}

export const DEFAULT_AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const DEFAULT_AI_RATE_LIMIT_MAX = 30;
export const DEFAULT_AI_RATE_LIMIT_MESSAGE =
  'Has superado el límite de solicitudes. Por favor, intenta de nuevo más tarde.';

export function createAiRateLimit(options: AiRateLimitOptions = {}) {
  const windowMs = options.windowMs ?? DEFAULT_AI_RATE_LIMIT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_AI_RATE_LIMIT_MAX;
  const message = options.message ?? DEFAULT_AI_RATE_LIMIT_MESSAGE;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
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

export const aiRateLimit = createAiRateLimit();
