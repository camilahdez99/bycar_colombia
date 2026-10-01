// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST, PUT } from '@/app/api/admin/vehiculos/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/vehiculos';
const validPost = { placa: 'abc123', marcaId: '3', capacidad: '4', idConductor: 7 };
const get = () => GET(makeRequest(RUTA));
const post = (body) => POST(makeRequest(RUTA, { method: 'POST', body }));
const put = (query, body) => PUT(makeRequest(RUTA, { method: 'PUT', query, body }));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/vehiculos (caracterización)', () => {
  test('200 con las filas tal cual (comportamiento actual: sin autenticación)', async () => {
    const rows = [{ placa: 'ABC123', marca: 'MAZDA', capacidad: 4, idConductor: 7, conductor: 'ANA P' }];
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
    expect(await readResponse(await get())).toEqual({ status: 500, body: { error: 'Error al obtener vehículos' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('POST /api/admin/vehiculos (caracterización)', () => {
  test.each(['placa', 'marcaId', 'capacidad', 'idConductor'])('400 si falta %s', async (campo) => {
    expect(await readResponse(await post({ ...validPost, [campo]: '' }))).toEqual({
      status: 400,
      body: { error: 'Todos los campos obligatorios deben ser proporcionados' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('400 si la placa tiene más de 6 caracteres', async () => {
    expect(await readResponse(await post({ ...validPost, placa: 'ABC1234' }))).toEqual({
      status: 400,
      body: { error: 'La placa no puede tener más de 6 caracteres' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('404 si el conductor no existe (no inserta)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validPost))).toEqual({
      status: 404,
      body: { error: 'El usuario/conductor no existe' },
    });
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('201: verifica el conductor e inserta con placa en mayúsculas y números parseados', async () => {
    const conn = createFakeConnection([{ rows: [[7]] }, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validPost))).toEqual({
      status: 201,
      // la respuesta devuelve la placa tal como llegó, no la normalizada
      body: { message: 'Vehículo registrado exitosamente', placa: 'abc123' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('409 si el error menciona PK_VEHICULOS', async () => {
    getConnection.mockResolvedValue(
      createFakeConnection([{ rows: [[7]] }, new Error('ORA-00001: unique constraint (BYCAR.PK_VEHICULOS) violated')]),
    );
    expect(await readResponse(await post(validPost))).toEqual({
      status: 409,
      body: { error: 'Ya existe un vehículo con esa placa' },
    });
  });

  test('500 con un mensaje seguro, sin el texto de Oracle (S8) ante otro error', async () => {
    const conn = createFakeConnection([{ rows: [[7]] }, new Error('ORA-02291')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validPost))).toEqual({
      status: 500,
      body: { error: 'Error al crear vehículo' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('PUT /api/admin/vehiculos (caracterización)', () => {
  test('400 si falta placa', async () => {
    expect(await readResponse(await put({}, { marcaId: 1, capacidad: 4 }))).toEqual({
      status: 400,
      body: { error: 'Placa requerida' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(['marcaId', 'capacidad'])('400 si falta %s', async (campo) => {
    expect(await readResponse(await put({ placa: 'ABC123' }, { marcaId: 1, capacidad: 4, [campo]: '' }))).toEqual({
      status: 400,
      body: { error: 'Marca y capacidad son obligatorios' },
    });
  });

  test('200: actualiza con la placa tal cual llega (comportamiento actual: no se pasa a mayúsculas)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ placa: 'abc123' }, { marcaId: '2', capacidad: '5' }))).toEqual({
      status: 200,
      body: { message: 'Vehículo actualizado exitosamente' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 genérico si falla el UPDATE', async () => {
    getConnection.mockResolvedValue(createFakeConnection([new Error('ORA-02291')]));
    expect(await readResponse(await put({ placa: 'ABC123' }, { marcaId: 2, capacidad: 5 }))).toEqual({
      status: 500,
      body: { error: 'Error al actualizar vehículo' },
    });
  });
});

describe('DELETE /api/admin/vehiculos (caracterización)', () => {
  test('400 si falta placa', async () => {
    expect(await readResponse(await del({}))).toEqual({ status: 400, body: { error: 'Placa requerida' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: borra por placa tal cual llega con autoCommit', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ placa: 'abc123' }))).toEqual({
      status: 200,
      body: { message: 'Vehículo eliminado correctamente' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con un mensaje seguro, sin el texto de Oracle (S8)', async () => {
    const conn = createFakeConnection([new Error('ORA-02292')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ placa: 'ABC123' }))).toEqual({
      status: 500,
      body: { error: 'Error al eliminar vehículo' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
