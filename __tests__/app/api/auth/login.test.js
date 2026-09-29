// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST } from '@/app/api/auth/login/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const post = (body) => POST(makeRequest('/api/auth/login', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

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

  test('admin hardcodeado: redirige a /admin sin tocar la BD', async () => {
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
