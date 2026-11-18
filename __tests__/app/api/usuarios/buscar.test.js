// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET } from '@/app/api/usuarios/buscar/route';
import { ROLES, SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

async function get(query, session) {
  const req = makeRequest('/api/usuarios/buscar', { query });
  if (session) req.cookies.set(SESSION_COOKIE, await encodeSession(session));
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/usuarios/buscar', () => {
  test('400 si q tiene menos de 3 caracteres, sin abrir conexión', async () => {
    expect(await readResponse(await get({ q: 'ab' }))).toEqual({
      status: 400,
      body: { error: 'Escribe al menos 3 caracteres' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('400 si falta q', async () => {
    expect((await readResponse(await get({}))).status).toBe(400);
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: devuelve id, nombre y correo con el patrón %q% y el tope de 10', async () => {
    const rows = [{ id: 3, nombre: 'ANA PÉREZ', correo: 'ana@x.co' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ q: 'ana' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls[0].binds.patron).toBe('%ana%');
    expect(conn.calls[0].sql).toContain('LIMIT 10');
    // Nunca expone la contraseña
    expect(conn.calls[0].sql).not.toMatch(/CONTRASENA|CONTRASEÑA|PASSWORD/i);
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('con AUTH_ENFORCED excluye al propio usuario de la sesión', async () => {
    vi.stubEnv('SESSION_SECRET', 'k'.repeat(32));
    vi.stubEnv('AUTH_ENFORCED', 'true');
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ q: 'ana' }, { userId: 7, role: ROLES.USER });
    expect(conn.calls[0].binds.propioId).toBe(7);
  });

  test('sin sesión (flag apagado) no excluye a nadie: propioId null', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ q: 'ana' });
    expect(conn.calls[0].binds.propioId).toBeNull();
  });

  test('500 si falla la consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ q: 'ana' }))).status).toBe(500);
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
