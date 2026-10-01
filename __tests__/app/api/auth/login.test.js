// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST } from '@/app/api/auth/login/route';
import { SESSION_COOKIE, decodeSession } from '@/lib/auth/session';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const post = (body) => POST(makeRequest('/api/auth/login', { method: 'POST', body }));

// Credenciales de admin de prueba: en producción vienen de ADMIN_EMAIL / ADMIN_PASSWORD (S5)
beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.stubEnv('ADMIN_EMAIL', 'admin@bycar.co');
  vi.stubEnv('ADMIN_PASSWORD', 'admin');
});

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/auth/login (caracterización)', () => {
  test.each([
    [{}],
    [{ correo: 'a@b.co' }],
    [{ contrasena: 'x' }],
  ])('400 si faltan campos: %j', async (body) => {
    expect(await readResponse(await post(body))).toEqual({
      status: 400,
      body: { error: 'Faltan campos obligatorios' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('admin configurado: redirige a /admin sin tocar la BD', async () => {
    const res = await readResponse(await post({ correo: 'admin@bycar.co', contrasena: 'admin' }));
    expect(res).toEqual({ status: 200, body: { message: 'Login exitoso', redirect: '/admin' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('admin con correo en mayúsculas NO entra por el atajo (comparación exacta)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    const res = await readResponse(await post({ correo: 'ADMIN@bycar.co', contrasena: 'admin' }));
    expect(res.status).toBe(401);
  });

  test('sin ADMIN_EMAIL / ADMIN_PASSWORD el atajo de admin queda deshabilitado y se consulta la BD', async () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    const res = await readResponse(await post({ correo: 'admin@bycar.co', contrasena: 'admin' }));
    expect(res).toEqual({ status: 401, body: { error: 'Credenciales incorrectas' } });
    expect(getConnection).toHaveBeenCalledOnce();
  });

  test('credenciales válidas: 200 con el usuario y redirect a /dashboard', async () => {
    const user = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'PEREZ', CORREO_USU: 'ana@x.co' };
    const conn = createFakeConnection([{ rows: [user] }]);
    getConnection.mockResolvedValue(conn);

    const res = await readResponse(await post({ correo: '  Ana@X.co ', contrasena: 'secreta' }));

    expect(res).toEqual({ status: 200, body: { message: 'Login exitoso', user, redirect: '/dashboard' } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('credenciales inválidas: 401', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ correo: 'x@x.co', contrasena: 'mal' }))).toEqual({
      status: 401,
      body: { error: 'Credenciales incorrectas' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  describe('cookie de sesión', () => {
    const SECRET = 's'.repeat(32);
    const sessionFrom = (response) => decodeSession(response.cookies.get(SESSION_COOKIE)?.value);

    test('sin SESSION_SECRET no emite cookie (comportamiento previo intacto)', async () => {
      vi.stubEnv('SESSION_SECRET', '');
      const response = await post({ correo: 'admin@bycar.co', contrasena: 'admin' });
      expect(response.status).toBe(200);
      expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
    });

    test('admin: cookie httpOnly con role admin y sin userId', async () => {
      vi.stubEnv('SESSION_SECRET', SECRET);
      const response = await post({ correo: 'admin@bycar.co', contrasena: 'admin' });
      const cookie = response.cookies.get(SESSION_COOKIE);
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800 });
      expect(await sessionFrom(response)).toEqual({ userId: null, role: 'admin' });
      expect(await readResponse(response)).toEqual({
        status: 200,
        body: { message: 'Login exitoso', redirect: '/admin' },
      });
    });

    test('usuario: cookie con su ID_USU y role user; el body no cambia', async () => {
      vi.stubEnv('SESSION_SECRET', SECRET);
      const user = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'P', CORREO_USU: 'a@x.co' };
      getConnection.mockResolvedValue(createFakeConnection([{ rows: [user] }]));
      const response = await post({ correo: 'a@x.co', contrasena: 'x' });
      expect(await sessionFrom(response)).toEqual({ userId: 7, role: 'user' });
      expect((await readResponse(response)).body).toEqual({ message: 'Login exitoso', user, redirect: '/dashboard' });
    });

    test('credenciales inválidas: no emite cookie', async () => {
      vi.stubEnv('SESSION_SECRET', SECRET);
      getConnection.mockResolvedValue(createFakeConnection([{ rows: [] }]));
      const response = await post({ correo: 'a@x.co', contrasena: 'mal' });
      expect(response.status).toBe(401);
      expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
    });
  });

  test('error de BD: 500 genérico', async () => {
    getConnection.mockRejectedValue(new Error('ORA-12541'));
    expect(await readResponse(await post({ correo: 'x@x.co', contrasena: 'x' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
  });

  test('body no JSON: 500 genérico', async () => {
    expect((await readResponse(await post('no-json'))).status).toBe(500);
  });
});
