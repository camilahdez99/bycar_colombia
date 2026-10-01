// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET, POST, PUT } from '@/app/api/guardian/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/guardian (caracterización)', () => {
  const get = (query) => GET(makeRequest('/api/guardian', { query }));

  test('400 sin email ni usuarioId, sin abrir conexión (E5)', async () => {
    const conn = createFakeConnection();
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 400, body: { error: 'Faltan parámetros' } });
    expect(conn.execute).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 por email: lista de alertas tal cual vienen de la BD', async () => {
    const rows = [{ id: 1, email: 'a@x.co', estado: 'Activo', pasajero: 'Ana Pérez', tiempo: 30 }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ email: 'A@X.CO' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('por email con rows undefined devuelve []', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get({ email: 'a@x.co' }))).toEqual({ status: 200, body: [] });
  });

  test('email tiene prioridad sobre usuarioId', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ email: 'a@x.co', usuarioId: '42' });
    expect(conn.calls[0].binds).toEqual({ email: 'a@x.co' });
  });

  test('200 por usuarioId: devuelve solo la primera fila (usuarioId como string)', async () => {
    const first = { id: 1, email: 'a@x.co', estado: 'Activo', viajeId: 5, tiempoMin: 30 };
    const conn = createFakeConnection([{ rows: [first, { id: 2 }] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({ status: 200, body: first });
    // el JOIN exige solicitud aceptada del propio usuario: el conductor nunca ve su guardián
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('por usuarioId sin resultados responde null', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{ rows: [] }]));
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({ status: 200, body: null });
  });

  test('por usuarioId, si rows viene undefined responde 200 con null (E4)', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({ status: 200, body: null });
  });

  test('500 sin exponer error.message (S8)', async () => {
    const conn = createFakeConnection([new Error('ORA-00942: table or view does not exist')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ email: 'a@x.co' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla, responde igual y registra el error (E2)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ email: 'a@x.co' }))).status).toBe(200);
  });
});

describe('POST /api/guardian (caracterización)', () => {
  const post = (body) => POST(makeRequest('/api/guardian', { method: 'POST', body }));
  const usuarioExiste = { rows: [{ ID_USU: 3 }] };

  test.each(['viajeId', 'email'])('400 si falta %s', async (campo) => {
    const body = { viajeId: 5, email: 'a@x.co', tiempo: 45, [campo]: undefined };
    expect(await readResponse(await post(body))).toEqual({ status: 400, body: { error: 'Faltan campos' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: valida que el correo exista e inserta el guardián activo', async () => {
    const conn = createFakeConnection([usuarioExiste, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: '5', email: 'a@x.co', tiempo: '45' }))).toEqual({
      status: 201,
      body: { message: 'Guardián activado', id: NOW },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('sin tiempo usa 30 minutos', async () => {
    const conn = createFakeConnection([usuarioExiste, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await post({ viajeId: 5, email: 'a@x.co' });
    expect(conn.calls[1].binds.tiempo).toBe(30);
  });

  test('tiempo 0 usa los 30 minutos por defecto, como antes', async () => {
    const conn = createFakeConnection([usuarioExiste, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await post({ viajeId: 5, email: 'a@x.co', tiempo: 0 });
    expect(conn.calls[1].binds.tiempo).toBe(30);
  });

  test.each([
    [{ tiempo: 'mucho' }, 'El tiempo debe ser un número entero de minutos mayor a 0'],
    [{ tiempo: -10 }, 'El tiempo debe ser un número entero de minutos mayor a 0'],
    [{ tiempo: '12.5' }, 'El tiempo debe ser un número entero de minutos mayor a 0'],
    [{ viajeId: 'abc' }, 'ID de viaje inválido'],
    [{ email: 42 }, 'Correo de contacto inválido'],
    [{ email: '   ' }, 'Correo de contacto inválido'],
  ])('400 con datos inválidos %j, sin abrir conexión (F23, DT-31)', async (cambio, mensaje) => {
    expect(await readResponse(await post({ viajeId: 5, email: 'a@x.co', tiempo: 45, ...cambio }))).toEqual({
      status: 400,
      body: { error: mensaje },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('400 si el body no es JSON válido', async () => {
    expect((await readResponse(await post('no-json'))).status).toBe(400);
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('404 si la consulta del correo viene sin rows, sin insertar (E4)', async () => {
    const conn = createFakeConnection([{}]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ viajeId: 5, email: 'nadie@x.co' }))).status).toBe(404);
    expect(conn.execute).toHaveBeenCalledOnce();
  });

  test('404 si el correo no es de un usuario registrado', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5, email: 'nadie@x.co' }))).toEqual({
      status: 404,
      body: { error: 'El correo de contacto no corresponde a un usuario registrado en BYCAR' },
    });
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 sin exponer error.message (S8) si falla el insert', async () => {
    const conn = createFakeConnection([usuarioExiste, new Error('ORA-02291: parent key not found')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5, email: 'a@x.co' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('PUT /api/guardian (caracterización)', () => {
  const put = (body) => PUT(makeRequest('/api/guardian', { method: 'PUT', body }));

  test('200 con extraTiempo: suma minutos (id sin convertir)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: '11', extraTiempo: '15' }))).toEqual({
      status: 200,
      body: { message: 'Tiempo de viaje reajustado' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('extraTiempo tiene prioridad sobre estado', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await put({ id: 11, extraTiempo: 5, estado: 'Finalizado' });
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.calls[0].binds).toEqual({ extraTiempo: 5, id: 11 });
  });

  test('extraTiempo null cuenta como ausente: se aplica el estado (F22)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ id: 11, extraTiempo: null, estado: '2' }))).body).toEqual({
      message: 'Estado actualizado',
    });
    expect(conn.calls[0].binds).toEqual({ id: 11, estadoId: 2 });
  });

  test('extraTiempo null y sin estado → 400 Nada que actualizar (F22)', async () => {
    expect((await readResponse(await put({ id: 11, extraTiempo: null }))).status).toBe(400);
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each([
    [{ id: 11, extraTiempo: 'mucho' }, 'El tiempo debe ser un número entero de minutos mayor a 0'],
    [{ id: 11, extraTiempo: -15 }, 'El tiempo debe ser un número entero de minutos mayor a 0'],
    [{ id: 11, estado: '2.5' }, 'Estado inválido'],
    [{ id: 'x', estado: 'Alerta' }, 'ID de guardián inválido'],
  ])('400 con datos inválidos %j, sin abrir conexión (DT-31)', async (body, mensaje) => {
    expect(await readResponse(await put(body))).toEqual({ status: 400, body: { error: mensaje } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 con estado de texto: resuelve el ID por los primeros 6 caracteres', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: 11, estado: 'Finalizado' }))).toEqual({
      status: 200,
      body: { message: 'Estado actualizado' },
    });
    expect(conn.calls).toMatchSnapshot();
  });

  test('200 con estado numérico: usa el ID directo', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: 11, estado: '2' }))).toEqual({
      status: 200,
      body: { message: 'Estado actualizado' },
    });
    expect(conn.calls).toMatchSnapshot();
  });

  test('400 sin id, sin abrir conexión (DT-31)', async () => {
    expect(await readResponse(await put({ estado: 2 }))).toEqual({
      status: 400,
      body: { error: 'ID de guardián inválido' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each([
    ['estado', { id: 11, estado: '2' }],
    ['extraTiempo', { id: 11, extraTiempo: 15 }],
  ])('404 si el guardián no existe al cambiar %s: rowsAffected = 0 (F19)', async (_caso, body) => {
    getConnection.mockResolvedValue(createFakeConnection([{ rowsAffected: 0 }]));
    expect(await readResponse(await put(body))).toEqual({ status: 404, body: { error: 'Guardián no encontrado' } });
  });

  test('400 si no hay nada que actualizar, sin abrir conexión (E5)', async () => {
    const conn = createFakeConnection();
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: 11 }))).toEqual({ status: 400, body: { error: 'Nada que actualizar' } });
    expect(conn.execute).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('500 sin exponer error.message (S8) si falla el update', async () => {
    const conn = createFakeConnection([new Error('ORA-01407: cannot update to NULL')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: 11, estado: 'Xyzabc' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('400 si el body no es JSON válido, sin conexión (antes 500)', async () => {
    const res = await readResponse(await put('no-json'));
    expect(res).toEqual({ status: 400, body: { error: 'El cuerpo no es un JSON válido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });
});
