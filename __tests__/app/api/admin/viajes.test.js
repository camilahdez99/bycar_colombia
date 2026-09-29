// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, PUT } from '@/app/api/admin/viajes/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/viajes';
const get = () => GET(makeRequest(RUTA));
const put = (query, body) => PUT(makeRequest(RUTA, { method: 'PUT', query, body }));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/viajes (caracterización)', () => {
  test('200 con las filas tal cual (comportamiento actual: sin autenticación)', async () => {
    const rows = [
      { id: 1, ruta: 'BELLO - ITAGÜÍ', fecha: '2026-01-02', estado: 'Programado', conductor: 'ANA P', pasajeros: null },
    ];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get())).toEqual({ status: 200, body: [] });
  });

  test('500 genérico si falla la consulta', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 500, body: { error: 'Error al obtener viajes' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('DELETE /api/admin/viajes (caracterización)', () => {
  test('400 si falta id', async () => {
    expect(await readResponse(await del({}))).toEqual({ status: 400, body: { error: 'ID requerido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: borra con id string y autoCommit', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '5' }))).toEqual({
      status: 200,
      body: { message: 'Viaje y sus dependencias eliminados' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con el mensaje de Oracle', async () => {
    const conn = createFakeConnection([new Error('ORA-02292')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '5' }))).toEqual({
      status: 500,
      body: { error: 'Error al eliminar viaje: ORA-02292' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('PUT /api/admin/viajes (caracterización)', () => {
  test('400 si falta id', async () => {
    expect(await readResponse(await put({}, { estado: 2 }))).toEqual({ status: 400, body: { error: 'ID requerido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('estado numérico: UPDATE directo con estadoId', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: '5' }, { estado: '3' }))).toEqual({
      status: 200,
      body: { message: 'Viaje actualizado' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('estado texto: UPDATE con subconsulta por los primeros 6 caracteres', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ id: '5' }, { estado: 'Finalizado' }))).status).toBe(200);
    expect(conn.calls).toMatchSnapshot();
  });

  test('sin estado: va por la rama de texto con estadoStr undefined (comportamiento actual: sin validación)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ id: '5' }, {}))).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ id: '5', estadoStr: undefined });
  });

  test.each([
    ['""', ''],
    ['null', null],
  ])('estado %s: se interpreta como estadoId 0 (comportamiento actual: sin validación)', async (_nombre, estado) => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ id: '5' }, { estado }))).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ id: '5', estadoId: 0 });
  });

  test('500 genérico si falla el UPDATE', async () => {
    const conn = createFakeConnection([new Error('ORA-02291')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: '5' }, { estado: 2 }))).toEqual({
      status: 500,
      body: { error: 'Error al actualizar viaje' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si el JSON es inválido (req.json dentro del try)', async () => {
    expect((await readResponse(await put({ id: '5' }, '{no json'))).status).toBe(500);
    expect(getConnection).not.toHaveBeenCalled();
  });
});
