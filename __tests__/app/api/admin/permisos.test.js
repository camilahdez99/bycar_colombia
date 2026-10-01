// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST } from '@/app/api/admin/permisos/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/permisos';
const get = (query) => GET(makeRequest(RUTA, { query }));
const post = (body) => POST(makeRequest(RUTA, { method: 'POST', body }));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/permisos (caracterización)', () => {
  test('sin usuarioId: todos los permisos (comportamiento actual: sin autenticación)', async () => {
    const rows = [{ usuarioId: 1, usuarioNombre: 'ANA', menuId: 2, menuNombre: 'Viajes', menuUrl: '/v' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({}))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('con usuarioId: menús del usuario con id numérico', async () => {
    const rows = [{ usuarioId: 5, menuId: 2, menuNombre: 'Viajes', menuUrl: '/v' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '5' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get({}))).toEqual({ status: 200, body: [] });
  });

  test('500 con un mensaje seguro, sin el texto de Oracle (S8)', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '1' }))).toEqual({ status: 500, body: { error: 'Error interno del servidor' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({}))).status).toBe(200);
  });
});

describe('POST /api/admin/permisos (caracterización)', () => {
  test.each([
    ['usuarioId', { menuId: 2 }],
    ['menuId', { usuarioId: 1 }],
  ])('400 si falta %s', async (_campo, body) => {
    expect(await readResponse(await post(body))).toEqual({
      status: 400,
      body: { error: 'usuarioId y menuId son requeridos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: inserta con ids numéricos y autoCommit', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ usuarioId: '1', menuId: '2' }))).toEqual({
      status: 201,
      body: { message: 'Permiso asignado' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('409 si el mensaje contiene ORA-00001', async () => {
    const conn = createFakeConnection([new Error('ORA-00001: unique constraint violated')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ usuarioId: 1, menuId: 2 }))).toEqual({
      status: 409,
      body: { error: 'Este permiso ya existe' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con un mensaje seguro, sin el texto de Oracle (S8) ante otro error', async () => {
    getConnection.mockResolvedValue(createFakeConnection([new Error('ORA-02291')]));
    expect(await readResponse(await post({ usuarioId: 1, menuId: 2 }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
  });

  test('400 si el JSON es inválido, sin abrir conexión (DT-31)', async () => {
    const res = await readResponse(await post('{no json'));
    expect(res).toEqual({ status: 400, body: { error: 'El cuerpo no es un JSON válido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/permisos (caracterización)', () => {
  test.each([
    ['usuarioId', { menuId: '2' }],
    ['menuId', { usuarioId: '1' }],
  ])('400 si falta %s', async (_campo, query) => {
    expect(await readResponse(await del(query))).toEqual({
      status: 400,
      body: { error: 'usuarioId y menuId son requeridos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: borra con ids numéricos y autoCommit', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ usuarioId: '1', menuId: '2' }))).toEqual({
      status: 200,
      body: { message: 'Permiso revocado' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con un mensaje seguro, sin el texto de Oracle (S8)', async () => {
    const conn = createFakeConnection([new Error('ORA-01722')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ usuarioId: '1', menuId: '2' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
