// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { checkOwnership, requireSelf, sameUser } from '@/lib/auth/ownership';
import { ROLES, SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { makeRequest, readResponse } from '../helpers/api';

async function requestAs(session) {
  const req = makeRequest('/api/recurso');
  if (session) req.cookies.set(SESSION_COOKIE, await encodeSession(session));
  return req;
}

const USUARIO_7 = { userId: 7, role: ROLES.USER };
const ADMIN = { userId: null, role: ROLES.ADMIN };

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'o'.repeat(32));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('sameUser', () => {
  test.each([
    [7, 7, true],
    [7, '7', true],
    ['7', 7, true],
    [7, 8, false],
    [7, '07', false],
    [null, null, false],
    [undefined, 7, false],
    [7, undefined, false],
    [7, '', false],
  ])('sameUser(%j, %j) → %s', (a, b, esperado) => {
    expect(sameUser(a, b)).toBe(esperado);
  });
});

describe('checkOwnership', () => {
  test('flag apagado: no llama a isOwner y deja pasar', async () => {
    const isOwner = vi.fn();
    expect(await checkOwnership(await requestAs(), isOwner)).toBeNull();
    expect(isOwner).not.toHaveBeenCalled();
  });

  describe('AUTH_ENFORCED=true', () => {
    beforeEach(() => vi.stubEnv('AUTH_ENFORCED', 'true'));

    test('sin sesión → 401 sin llamar a isOwner', async () => {
      const isOwner = vi.fn();
      expect((await readResponse(await checkOwnership(await requestAs(), isOwner))).status).toBe(401);
      expect(isOwner).not.toHaveBeenCalled();
    });

    test('admin → pasa sin llamar a isOwner', async () => {
      const isOwner = vi.fn();
      expect(await checkOwnership(await requestAs(ADMIN), isOwner)).toBeNull();
      expect(isOwner).not.toHaveBeenCalled();
    });

    test('isOwner recibe el userId de la sesión; true → pasa', async () => {
      const isOwner = vi.fn(async () => true);
      expect(await checkOwnership(await requestAs(USUARIO_7), isOwner)).toBeNull();
      expect(isOwner).toHaveBeenCalledWith(7);
    });

    test('isOwner false → 403 y log estructurado sin datos sensibles', async () => {
      const res = await checkOwnership(await requestAs(USUARIO_7), async () => false);
      expect(await readResponse(res)).toEqual({ status: 403, body: { error: 'No autorizado' } });
      expect(JSON.parse(console.warn.mock.calls[0][0])).toEqual({
        event: 'ownership_denied',
        path: '/api/recurso',
        userId: 7,
      });
    });

    test('si isOwner lanza, el error se propaga (lo maneja el catch del handler)', async () => {
      await expect(
        checkOwnership(await requestAs(USUARIO_7), async () => {
          throw new Error('ORA-03113');
        }),
      ).rejects.toThrow('ORA-03113');
    });
  });
});

describe('requireSelf', () => {
  beforeEach(() => vi.stubEnv('AUTH_ENFORCED', 'true'));

  test('mismo usuario (string de query) → pasa', async () => {
    expect(await requireSelf(await requestAs(USUARIO_7), '7')).toBeNull();
  });

  test('otro usuario → 403', async () => {
    expect((await requireSelf(await requestAs(USUARIO_7), '8')).status).toBe(403);
  });

  test('usuarioId ausente → 403', async () => {
    expect((await requireSelf(await requestAs(USUARIO_7), null)).status).toBe(403);
  });
});
