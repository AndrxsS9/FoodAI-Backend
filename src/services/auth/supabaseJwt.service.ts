import type { JSONWebKeySet, JWTPayload, JWTVerifyGetKey } from 'jose';

import { env } from '../../config/env';
import type { AuthenticatedUser } from '../../types/auth.types';
import { AppError } from '../../utils/errors';
import { formatSafeErrorForLog } from '../../utils/safeLogger';

type JoseModule = typeof import('jose');

let joseModulePromise: Promise<JoseModule> | null = null;

function loadJose(): Promise<JoseModule> {
  joseModulePromise ??= import('jose');
  return joseModulePromise;
}

export const SUPPORTED_ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'] as const;

export interface SupabaseJwtVerifierOptions {
  supabaseUrl: string;
  supabaseJwtAudience?: string;
  supabaseJwtSecret?: string;
  jwksTimeoutMs?: number;
  jwksCooldownMs?: number;
  jwksCacheMaxAgeMs?: number;
}

export interface SupabaseJwtVerifier {
  verifyAccessToken: (token: string) => Promise<AuthenticatedUser>;
  setCustomJwksForTesting: (jwks: JSONWebKeySet | null) => Promise<void>;
}

function mapPayloadToAuthenticatedUser(
  payload: JWTPayload,
  expectedIssuer: string,
): AuthenticatedUser {
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';

  if (!sub) {
    throw new AppError(
      'El token de autenticación no contiene un identificador de usuario válido.',
      401,
      'INVALID_AUTH_TOKEN',
    );
  }

  if (payload.role !== 'authenticated') {
    throw new AppError(
      'El token de autenticación no corresponde a una sesión de usuario autenticado.',
      401,
      'INVALID_AUTH_TOKEN',
    );
  }

  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new AppError(
      'El token de autenticación no incluye una fecha de expiración válida.',
      401,
      'INVALID_AUTH_TOKEN',
    );
  }

  const email =
    typeof payload.email === 'string' && payload.email.trim().length > 0
      ? payload.email.trim()
      : undefined;

  const sessionId =
    typeof payload.session_id === 'string' &&
    payload.session_id.trim().length > 0
      ? payload.session_id.trim()
      : undefined;

  return {
    id: sub,
    ...(email ? { email } : {}),
    role: 'authenticated',
    ...(sessionId ? { sessionId } : {}),
    aud: payload.aud ?? 'authenticated',
    iss: typeof payload.iss === 'string' ? payload.iss : expectedIssuer,
    exp: payload.exp,
  };
}

export function createSupabaseJwtVerifier(
  options: SupabaseJwtVerifierOptions,
): SupabaseJwtVerifier {
  const normalizedSupabaseUrl = options.supabaseUrl.replace(/\/+$/, '');
  const expectedIssuer = `${normalizedSupabaseUrl}/auth/v1`;
  const expectedAudience = options.supabaseJwtAudience ?? 'authenticated';
  const jwksUrl = new URL(`${expectedIssuer}/.well-known/jwks.json`);

  const jwksTimeoutMs = options.jwksTimeoutMs ?? 5_000;
  const jwksCooldownMs = options.jwksCooldownMs ?? 30_000;
  const jwksCacheMaxAgeMs = options.jwksCacheMaxAgeMs ?? 600_000;

  const encodedHs256Secret =
    typeof options.supabaseJwtSecret === 'string' &&
    options.supabaseJwtSecret.trim().length >= 32
      ? new TextEncoder().encode(options.supabaseJwtSecret.trim())
      : null;

  let remoteJwks: JWTVerifyGetKey | null = null;
  let customLocalJwks: JWTVerifyGetKey | null = null;

  async function getAsymmetricKeyResolver(
    jose: JoseModule,
  ): Promise<JWTVerifyGetKey> {
    if (customLocalJwks) {
      return customLocalJwks;
    }

    if (!remoteJwks) {
      remoteJwks = jose.createRemoteJWKSet(jwksUrl, {
        timeoutDuration: jwksTimeoutMs,
        cooldownDuration: jwksCooldownMs,
        cacheMaxAge: jwksCacheMaxAgeMs,
      });
    }

    return remoteJwks;
  }

  async function setCustomJwksForTesting(
    jwks: JSONWebKeySet | null,
  ): Promise<void> {
    if (!jwks) {
      customLocalJwks = null;
      return;
    }

    const jose = await loadJose();
    customLocalJwks = jose.createLocalJWKSet(jwks);
  }

  async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const jose = await loadJose();

    let alg: string | undefined;
    try {
      const protectedHeader = jose.decodeProtectedHeader(token);
      alg = protectedHeader.alg;
    } catch {
      throw new AppError(
        'El token de autenticación no es válido.',
        401,
        'INVALID_AUTH_TOKEN',
      );
    }

    if (!alg || alg.toLowerCase() === 'none') {
      throw new AppError(
        'El token de autenticación utiliza un algoritmo no permitido.',
        401,
        'INVALID_AUTH_TOKEN',
      );
    }

    const verifyOptions = {
      issuer: expectedIssuer,
      audience: expectedAudience,
      requiredClaims: ['exp', 'sub', 'iss', 'aud'],
    };

    try {
      if (
        (SUPPORTED_ASYMMETRIC_ALGORITHMS as readonly string[]).includes(alg)
      ) {
        const keyResolver = await getAsymmetricKeyResolver(jose);
        const { payload } = await jose.jwtVerify(token, keyResolver, {
          ...verifyOptions,
          algorithms: [...SUPPORTED_ASYMMETRIC_ALGORITHMS],
        });

        return mapPayloadToAuthenticatedUser(payload, expectedIssuer);
      }

      if (alg === 'HS256') {
        if (!encodedHs256Secret) {
          throw new AppError(
            'El algoritmo de firma del token no está habilitado para este proyecto.',
            401,
            'INVALID_AUTH_TOKEN',
          );
        }

        const { payload } = await jose.jwtVerify(token, encodedHs256Secret, {
          ...verifyOptions,
          algorithms: ['HS256'],
        });

        return mapPayloadToAuthenticatedUser(payload, expectedIssuer);
      }

      throw new AppError(
        'El algoritmo de firma del token no es compatible.',
        401,
        'INVALID_AUTH_TOKEN',
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof jose.errors.JWTExpired) {
        throw new AppError(
          'La sesión ha expirado. Inicia sesión nuevamente.',
          401,
          'AUTH_TOKEN_EXPIRED',
        );
      }

      const isJwksUpstreamFailure =
        error instanceof jose.errors.JWKSTimeout ||
        (error instanceof jose.errors.JOSEError &&
          error.code === 'ERR_JOSE_GENERIC' &&
          error.message.includes('JSON Web Key Set HTTP response')) ||
        !(error instanceof jose.errors.JOSEError);

      if (isJwksUpstreamFailure) {
        console.error(
          '⚠️ No fue posible consultar las claves JWKS de Supabase:',
          formatSafeErrorForLog(error),
        );

        throw new AppError(
          'No fue posible verificar la sesión en este momento. Intenta nuevamente.',
          503,
          'AUTH_VERIFICATION_UNAVAILABLE',
        );
      }

      throw new AppError(
        'El token de autenticación no es válido.',
        401,
        'INVALID_AUTH_TOKEN',
      );
    }
  }

  return {
    verifyAccessToken,
    setCustomJwksForTesting,
  };
}

export const defaultSupabaseJwtVerifier = createSupabaseJwtVerifier({
  supabaseUrl: env.SUPABASE_URL,
  supabaseJwtAudience: env.SUPABASE_JWT_AUDIENCE,
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET,
});

export function verifySupabaseAccessToken(
  token: string,
): Promise<AuthenticatedUser> {
  return defaultSupabaseJwtVerifier.verifyAccessToken(token);
}

export function setSupabaseJwksForTesting(
  jwks: JSONWebKeySet | null,
): Promise<void> {
  return defaultSupabaseJwtVerifier.setCustomJwksForTesting(jwks);
}
