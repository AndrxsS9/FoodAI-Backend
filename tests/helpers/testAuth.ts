import type { JSONWebKeySet, JWK } from 'jose';

import { env } from '../../src/config/env';
import { setSupabaseJwksForTesting } from '../../src/services/auth/supabaseJwt.service';

type JoseModule = typeof import('jose');
type CryptoKeyPairResult = Awaited<ReturnType<JoseModule['generateKeyPair']>>;

export const TEST_JWT_KID = 'test-supabase-es256-key-1';
export const DEFAULT_TEST_USER_ID = '11111111-2222-4333-8444-555555555555';

let cachedJosePromise: Promise<JoseModule> | null = null;
let trustedKeyPairPromise: Promise<{
  privateKey: CryptoKeyPairResult['privateKey'];
  publicJwk: JWK;
  jwks: JSONWebKeySet;
}> | null = null;
let untrustedKeyPairPromise: Promise<CryptoKeyPairResult> | null = null;

function getJose(): Promise<JoseModule> {
  cachedJosePromise ??= import('jose');
  return cachedJosePromise;
}

async function getTrustedKeyMaterial() {
  if (!trustedKeyPairPromise) {
    trustedKeyPairPromise = (async () => {
      const jose = await getJose();
      const { privateKey, publicKey } = await jose.generateKeyPair('ES256');
      const exportedPublicJwk = await jose.exportJWK(publicKey);
      const publicJwk: JWK = {
        ...exportedPublicJwk,
        kid: TEST_JWT_KID,
        alg: 'ES256',
        use: 'sig',
      };

      return {
        privateKey,
        publicJwk,
        jwks: {
          keys: [publicJwk],
        },
      };
    })();
  }

  return trustedKeyPairPromise;
}

async function getUntrustedKeyPair() {
  if (!untrustedKeyPairPromise) {
    untrustedKeyPairPromise = (async () => {
      const jose = await getJose();
      return jose.generateKeyPair('ES256');
    })();
  }

  return untrustedKeyPairPromise;
}

export async function setupTestSupabaseJwks(): Promise<JSONWebKeySet> {
  const { jwks } = await getTrustedKeyMaterial();
  await setSupabaseJwksForTesting(jwks);
  return jwks;
}

export async function teardownTestSupabaseJwks(): Promise<void> {
  await setSupabaseJwksForTesting(null);
}

export interface SignTestJwtOptions {
  sub?: string;
  omitSub?: boolean;
  role?: string | null;
  email?: string;
  iss?: string;
  aud?: string | string[];
  expiresInSeconds?: number;
  kid?: string;
  supabaseUrl?: string;
}

export async function signTestSupabaseJwt(
  options: SignTestJwtOptions = {},
): Promise<string> {
  const jose = await getJose();
  const { privateKey } = await getTrustedKeyMaterial();

  const baseSupabaseUrl = (options.supabaseUrl ?? env.SUPABASE_URL).replace(
    /\/+$/,
    '',
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + (options.expiresInSeconds ?? 3600);

  const claims: Record<string, unknown> = {};
  if (options.role !== null) {
    claims.role = options.role ?? 'authenticated';
  }
  if (options.email !== undefined) {
    claims.email = options.email;
  } else {
    claims.email = 'usuario.prueba@foodai.co';
  }
  claims.session_id = 'test-session-id-001';

  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: options.kid ?? TEST_JWT_KID,
    })
    .setIssuer(options.iss ?? `${baseSupabaseUrl}/auth/v1`)
    .setAudience(options.aud ?? env.SUPABASE_JWT_AUDIENCE)
    .setIssuedAt(nowSeconds - 10)
    .setExpirationTime(expSeconds);

  if (!options.omitSub) {
    builder.setSubject(options.sub ?? DEFAULT_TEST_USER_ID);
  }

  return builder.sign(privateKey);
}

export async function signUntrustedSupabaseJwt(
  options: SignTestJwtOptions = {},
): Promise<string> {
  const jose = await getJose();
  const { privateKey } = await getUntrustedKeyPair();

  const baseSupabaseUrl = (options.supabaseUrl ?? env.SUPABASE_URL).replace(
    /\/+$/,
    '',
  );
  const nowSeconds = Math.floor(Date.now() / 1000);

  return new jose.SignJWT({
    role: options.role ?? 'authenticated',
    email: 'atacante@ejemplo.com',
  })
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: options.kid ?? TEST_JWT_KID,
    })
    .setSubject(options.sub ?? DEFAULT_TEST_USER_ID)
    .setIssuer(options.iss ?? `${baseSupabaseUrl}/auth/v1`)
    .setAudience(options.aud ?? env.SUPABASE_JWT_AUDIENCE)
    .setIssuedAt(nowSeconds - 10)
    .setExpirationTime(nowSeconds + (options.expiresInSeconds ?? 3600))
    .sign(privateKey);
}

export async function signHs256SupabaseJwt(
  secret: string,
  options: SignTestJwtOptions = {},
): Promise<string> {
  const jose = await getJose();
  const encodedSecret = new TextEncoder().encode(secret);

  const baseSupabaseUrl = (options.supabaseUrl ?? env.SUPABASE_URL).replace(
    /\/+$/,
    '',
  );
  const nowSeconds = Math.floor(Date.now() / 1000);

  return new jose.SignJWT({
    role: options.role ?? 'authenticated',
    email: 'hs256@foodai.co',
  })
    .setProtectedHeader({
      alg: 'HS256',
      typ: 'JWT',
    })
    .setSubject(options.sub ?? DEFAULT_TEST_USER_ID)
    .setIssuer(options.iss ?? `${baseSupabaseUrl}/auth/v1`)
    .setAudience(options.aud ?? env.SUPABASE_JWT_AUDIENCE)
    .setIssuedAt(nowSeconds - 10)
    .setExpirationTime(nowSeconds + (options.expiresInSeconds ?? 3600))
    .sign(encodedSecret);
}

export function buildUnsignedAlgNoneJwt(
  sub: string = DEFAULT_TEST_USER_ID,
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      role: 'authenticated',
      iss: `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`,
      aud: env.SUPABASE_JWT_AUDIENCE,
      iat: nowSeconds - 10,
      exp: nowSeconds + 3600,
    }),
  ).toString('base64url');

  return `${header}.${payload}.unsigned`;
}
