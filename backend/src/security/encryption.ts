import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt, SignJWT, jwtVerify } from 'jose';
import { config } from '../config/index.js';

/** Derive a fixed 32-byte key from the configured secret (A256GCM requires 256 bits). */
const secretKey = createHash('sha256').update(config.JWE_SECRET_KEY).digest();
const sessionKey = createHash('sha256').update(config.ADMIN_SESSION_SECRET).digest();

/** Encrypt an object as a JWE compact string (A256GCM). */
export async function encryptPayload(payload: Record<string, unknown>): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .encrypt(secretKey);
}

/** Decrypt a JWE compact string back into an object. */
export async function decryptPayload<T>(jwe: string): Promise<T> {
  const { payload } = await jwtDecrypt(jwe, secretKey);
  return payload as T;
}

/** Sign a compact JWS token for admin sessions. */
export async function signSession(sub: string, email: string, role: string): Promise<string> {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(sessionKey);
}

/** Verify a compact JWS token for admin sessions. */
export async function verifySession<T extends { email?: string; role?: string }>(
  token: string,
): Promise<T> {
  const { payload } = await jwtVerifyStrict(token);
  return payload as T;
}

async function jwtVerifyStrict(token: string): Promise<{ payload: Record<string, unknown> }> {
  const { payload } = await jwtVerify(token, sessionKey);
  return { payload: payload as Record<string, unknown> };
}
