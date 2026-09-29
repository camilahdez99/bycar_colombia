// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST } from '@/app/api/admin/conductores/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/conductores';
const get = () => GET(makeRequest(RUTA));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/conductores (caracterización)', () => {
  test('200 con las filas tal cual (comportamiento actual: sin autenticación)', async () => {
    const rows = [{ id: 1, idUsuario: 1, nombre: 'ANA', apellido: 'P', correo: 'a@x.co', totalVehiculos: 1, totalViajes: 0 }];
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
    expect(await readResponse(await get())).toEqual({ status: 500, body: { error: 'Error al obtener conductores' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get())).status).toBe(200);
  });
});

describe('POST /api/admin/conductores (caracterización)', () => {
  test('200 informativo sin tocar la BD (no crea nada)', async () => {
    expect(await readResponse(await POST(makeRequest(RUTA, { method: 'POST', body: { x: 1 } })))).toEqual({
      status: 200,
      body: {
        message:
          'En el esquema actual, un usuario se convierte en conductor al registrar un vehículo o publicar un viaje.',
      },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/conductores (caracterización)', () => {
  test('400 si falta id', async () => {
    expect(await readResponse(await del({}))).toEqual({ status: 400, body: { error: 'ID requerido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: borra vehículos (sin autoCommit) y luego viajes (con autoCommit)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 2 }, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '4' }))).toEqual({
      status: 200,
      body: { message: 'Datos de conductor eliminados correctamente' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si falla el borrado de viajes, sin rollback explícito', async () => {
    const conn = createFakeConnection([{ rowsAffected: 2 }, new Error('ORA-02292')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '4' }))).toEqual({
      status: 500,
      body: { error: 'Error al eliminar conductor: ORA-02292' },
    });
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
