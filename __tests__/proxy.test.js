// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { proxy, config } from '@/proxy';
import { ROLES, SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { makeRequest, silenceConsole } from './helpers/api';

async function visit(path, session) {
  const req = makeRequest(path);
  if (session) req.cookies.set(SESSION_COOKIE, await encodeSession(session));
  return proxy(req);
}

const redirectsToLogin = (res) => res.status === 307 && res.headers.get('location') === 'http://localhost/login';
const passes = (res) => res.headers.get('x-middleware-next') === '1';

beforeEach(() => {
  silenceConsole();
  vi.stubEnv('SESSION_SECRET', 'p'.repeat(32));
});

afterEach(() => vi.unstubAllEnvs());

test('matcher cubre solo /admin y /dashboard', () => {
  expect(config.matcher).toEqual(['/admin/:path*', '/dashboard/:path*']);
});

test('flag apagado: deja pasar sin sesión', async () => {
  expect(passes(await visit('/admin'))).toBe(true);
  expect(passes(await visit('/dashboard'))).toBe(true);
});

describe('AUTH_ENFORCED=true', () => {
  beforeEach(() => vi.stubEnv('AUTH_ENFORCED', 'true'));

  test.each(['/admin', '/dashboard'])('%s sin sesión → redirige a /login', async (path) => {
    expect(redirectsToLogin(await visit(path))).toBe(true);
  });

  test('/admin con usuario común → redirige a /login', async () => {
    expect(redirectsToLogin(await visit('/admin', { userId: 1, role: ROLES.USER }))).toBe(true);
  });

  test('/admin con admin → pasa', async () => {
    expect(passes(await visit('/admin', { userId: null, role: ROLES.ADMIN }))).toBe(true);
  });

  test('/dashboard con usuario → pasa', async () => {
    expect(passes(await visit('/dashboard', { userId: 1, role: ROLES.USER }))).toBe(true);
  });
});
