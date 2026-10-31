import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { verifySupabaseAccessToken } from '../services/auth/supabaseJwt.service';
import type { AuthenticatedUser } from '../types/auth.types';
import { AppError } from '../utils/errors';

const MAX_BEARER_TOKEN_LENGTH = 8192;
const COMPACT_JWS_PATTERN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type BearerTokenExtractionResult =
  | { status: 'missing' }
  | { status: 'malformed' }
  | { status: 'valid'; token: string };

/**
 * Extrae estrictamente el token Bearer del encabezado HTTP Authorization.
 * Nunca acepta tokens desde query params, cuerpo o encabezados personalizados.
 */
export function extractBearerToken(
  authorizationHeader?: string,
): BearerTokenExtractionResult {
  if (
    typeof authorizationHeader !== 'string' ||
    authorizationHeader.trim().length === 0
  ) {
    return { status: 'missing' };
  }

  const trimmed = authorizationHeader.trim();
  const bearerPrefixMatch = /^Bearer(?:\s+(.*))?$/i.exec(trimmed);

  if (!bearerPrefixMatch) {
    return { status: 'malformed' };
  }

  const rawToken = (bearerPrefixMatch[1] ?? '').trim();

  if (rawToken.length === 0) {
    return { status: 'missing' };
  }

  if (
    rawToken.length > MAX_BEARER_TOKEN_LENGTH ||
    /\s/.test(rawToken) ||
    !COMPACT_JWS_PATTERN.test(rawToken)
  ) {
    return { status: 'malformed' };
  }

  return {
    status: 'valid',
    token: rawToken,
  };
}

export type TokenVerifierFn = (token: string) => Promise<AuthenticatedUser>;

export function createSupabaseAuthMiddleware(
  verifyFn: TokenVerifierFn = verifySupabaseAccessToken,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Nunca confiar en identidades preexistentes o enviadas por el cliente
    req.user = undefined;

    const extraction = extractBearerToken(req.headers.authorization);

    if (extraction.status === 'missing') {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return next(
        new AppError(
          'Se requiere autenticación mediante Bearer token.',
          401,
          'AUTH_TOKEN_REQUIRED',
        ),
      );
    }

    if (extraction.status === 'malformed') {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return next(
        new AppError(
          'El formato del token de autenticación no es válido.',
          401,
          'INVALID_AUTH_TOKEN',
        ),
      );
    }

    try {
      const authenticatedUser = await verifyFn(extraction.token);
      req.user = authenticatedUser;
      return next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        res.setHeader('WWW-Authenticate', 'Bearer');
      }
      return next(error);
    }
  };
}

export const requireSupabaseAuth = createSupabaseAuthMiddleware();
