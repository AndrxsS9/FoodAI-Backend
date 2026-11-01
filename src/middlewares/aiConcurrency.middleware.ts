import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '../config/env';
import { AppError } from '../utils/errors';

export interface AiConcurrencyGuard extends RequestHandler {
  getActiveCount: () => number;
}

/**
 * Limita el número máximo de solicitudes simultáneas en vuelo hacia endpoints de IA
 * para proteger la memoria del contenedor (Render) y evitar ráfagas descontroladas hacia Gemini.
 */
export function createAiConcurrencyGuard(
  maxConcurrent: number = env.AI_MAX_CONCURRENT_REQUESTS,
): AiConcurrencyGuard {
  let activeRequests = 0;

  const middleware: RequestHandler = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (activeRequests >= maxConcurrent) {
      return next(
        new AppError(
          'El servicio de IA está procesando demasiadas solicitudes simultáneas. Intenta nuevamente en unos segundos.',
          503,
          'AI_SERVER_BUSY',
        ),
      );
    }

    activeRequests += 1;
    let released = false;

    const release = () => {
      if (!released) {
        released = true;
        activeRequests = Math.max(0, activeRequests - 1);
        res.removeListener('finish', release);
        res.removeListener('close', release);
      }
    };

    res.once('finish', release);
    res.once('close', release);

    return next();
  };

  const guard = middleware as AiConcurrencyGuard;
  guard.getActiveCount = () => activeRequests;

  return guard;
}

export const aiConcurrencyGuard = createAiConcurrencyGuard(
  env.AI_MAX_CONCURRENT_REQUESTS,
);
