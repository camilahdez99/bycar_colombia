// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  ROLES,
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  isSessionConfigured,
  sessionCookieOptions,
} from '@/lib/auth/session';
import { authorize, getSession, isAuthEnforced } from '@/lib/auth/guard';
import { makeRequest, readResponse, silenceConsole } from '../helpers/api';

const SECRET = 'a'.repeat(32);

function requestWithCookie(token) {
  const req = makeRequest('/api/x');
  if (token) req.cookies.set(SESSION_COOKIE, token);
  return req;
}

beforeEach(() => {
  silenceConsole();
  vi.stubEnv('SESSION_SECRET', SECRET);
  vi.stubEnv('AUTH_ENFORCED', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('session', () => {
  test('isSessionConfigured exige al menos 32 caracteres', () => {
    expect(isSessionConfigured()).toBe(true);
    vi.stubEnv('SESSION_SECRET', 'corto');
    expect(isSessionConfigured()).toBe(false);
    vi.stubEnv('SESSION_SECRET', '');
    expect(isSessionConfigured()).toBe(false);
  });

  test('encode/decode ida y vuelta conserva userId y role', async () => {
    const token = await encodeSession({ userId: 7, role: ROLES.USER });
    expect(await decodeSession(token)).toEqual({ userId: 7, role: 'user' });
  });

  test('admin sin userId se decodifica con userId null', async () => {
    const token = await encodeSession({ role: ROLES.ADMIN });
    expect(await decodeSession(token)).toEqual({ userId: null, role: 'admin' });
  });

  test('encodeSession falla si no hay secreto', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    await expect(encodeSession({ userId: 1, role: ROLES.USER })).rejects.toThrow('SESSION_SECRET');
  });

  test.each([
    ['vacío', ''],
    ['basura', 'no.es.jwt'],
  ])('token %s → null', async (_caso, token) => {
    expect(await decodeSession(token)).toBeNull();
  });

  test('token firmado con otro secreto → null', async () => {
    const token = await encodeSession({ userId: 1, role: ROLES.ADMIN });
    vi.stubEnv('SESSION_SECRET', 'b'.repeat(32));
    expect(await decodeSession(token)).toBeNull();
  });

  test('token con alg "none" → null', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 1, role: 'admin' })).toString('base64url');
    expect(await decodeSession(`${header}.${payload}.`)).toBeNull();
  });

  test('token expirado → null', async () => {
    const token = await new SignJWT({ userId: 1, role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET));
    expect(await decodeSession(token)).toBeNull();
  });

  test('sin secreto configurado, cualquier token → null', async () => {
    const token = await encodeSession({ userId: 1, role: ROLES.USER });
    vi.stubEnv('SESSION_SECRET', '');
    expect(await decodeSession(token)).toBeNull();
  });

  test('opciones de cookie: httpOnly, lax, 7 días; secure solo en producción', () => {
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    });
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions().secure).toBe(true);
  });
});

describe('guard', () => {
  test('isAuthEnforced solo con AUTH_ENFORCED="true"', () => {
    expect(isAuthEnforced()).toBe(false);
    vi.stubEnv('AUTH_ENFORCED', '1');
    expect(isAuthEnforced()).toBe(false);
    vi.stubEnv('AUTH_ENFORCED', 'true');
    expect(isAuthEnforced()).toBe(true);
  });

  test('getSession lee la cookie de sesión', async () => {
    const token = await encodeSession({ userId: 3, role: ROLES.USER });
    expect(await getSession(requestWithCookie(token))).toEqual({ userId: 3, role: 'user' });
    expect(await getSession(requestWithCookie())).toBeNull();
  });

  test('flag apagado: authorize deja pasar todo', async () => {
    expect(await authorize(requestWithCookie(), { role: ROLES.ADMIN })).toBeNull();
  });

  describe('flag prendido', () => {
    beforeEach(() => vi.stubEnv('AUTH_ENFORCED', 'true'));

    test('sin cookie → 401', async () => {
      expect(await readResponse(await authorize(requestWithCookie()))).toEqual({
        status: 401,
        body: { error: 'No autenticado' },
      });
    });

    test('usuario en ruta de admin → 403', async () => {
      const token = await encodeSession({ userId: 3, role: ROLES.USER });
      expect(await readResponse(await authorize(requestWithCookie(token), { role: ROLES.ADMIN }))).toEqual({
        status: 403,
        body: { error: 'No autorizado' },
      });
    });

    test('sesión válida sin rol requerido → pasa', async () => {
      const token = await encodeSession({ userId: 3, role: ROLES.USER });
      expect(await authorize(requestWithCookie(token))).toBeNull();
    });

    test('admin en ruta de admin → pasa', async () => {
      const token = await encodeSession({ role: ROLES.ADMIN });
      expect(await authorize(requestWithCookie(token), { role: ROLES.ADMIN })).toBeNull();
    });
  });
});
