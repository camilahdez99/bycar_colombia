import { SignJWT, jwtVerify } from 'jose';
import { logWarn } from '@/lib/log';

export const SESSION_COOKIE = 'bycar_session';
export const ROLES = Object.freeze({ ADMIN: 'admin', USER: 'user' });

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ALGORITHM = 'HS256';
const MIN_SECRET_LENGTH = 32;

// La sesión solo se emite si SESSION_SECRET está configurado y es suficientemente largo
export function isSessionConfigured() {
  return (process.env.SESSION_SECRET ?? '').length >= MIN_SECRET_LENGTH;
}

function secretKey() {
  if (!isSessionConfigured()) {
    throw new Error(`SESSION_SECRET no configurado (mínimo ${MIN_SECRET_LENGTH} caracteres)`);
  }
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function encodeSession({ userId, role }) {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Devuelve { userId, role } o null si el token falta, es inválido o expiró. */
export async function decodeSession(token) {
  if (!token || !isSessionConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] });
    return { userId: payload.userId ?? null, role: payload.role };
  } catch (error) {
    logWarn('session_invalid', { reason: error.code ?? error.name });
    return null;
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});
