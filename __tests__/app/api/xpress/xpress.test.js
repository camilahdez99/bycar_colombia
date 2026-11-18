// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST, PUT } from '@/app/api/xpress/route';
import { createFakeConnection, makeRequest, oracleError, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const get = (query) => GET(makeRequest('/api/xpress', { query }));
const post = (body) => POST(makeRequest('/api/xpress', { method: 'POST', body }));
const put = (body) => PUT(makeRequest('/api/xpress', { method: 'PUT', body }));
const del = (query) => DELETE(makeRequest('/api/xpress', { method: 'DELETE', query }));

const useConnection = (responses) => {
  const conn = createFakeConnection(responses);
  getConnection.mockResolvedValue(conn);
  return conn;
};

const escrituras = (conn) => conn.calls.filter(({ sql }) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
const CARGA = (estadoId) => ({ rows: [{ emisorId: 7, receptorId: 8, conductorId: 9, estadoId }] });

const NUEVA = { viajeId: 5, usuarioId: 7, receptorEmail: 'Luis@x.co', descripcion: 'Caja con libros', peso: '2.5' };

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/xpress (caracterización)', () => {
  test.each([
    [undefined, 'Falta usuarioId'],
    [{ usuarioId: 'abc' }, 'usuarioId inválido'],
    [{ usuarioId: '7', vista: 'todas' }, 'Vista inválida'],
    [{ usuarioId: '7', viajeId: '5' }, 'viajeId inválido'],
    [{ usuarioId: '7', vista: 'conductor', viajeId: 'x' }, 'viajeId inválido'],
  ])('400 con %j, sin abrir conexión', async (query, error) => {
    expect(await readResponse(await get(query))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('mis envíos (vista por defecto): filtra por emisor y devuelve las filas tal cual', async () => {
    const rows = [{ id: 1, descripcion: 'Caja', estado: 'Pendiente' }];
    const conn = useConnection([{ rows }]);
    expect(await readResponse(await get({ usuarioId: '7' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('recibidos: filtra por receptor', async () => {
    const conn = useConnection([{ rows: [] }]);
    await get({ usuarioId: '8', vista: 'recibidos' });
    expect(conn.calls).toMatchSnapshot();
  });

  test('conductor: filtra por el conductor del viaje y, opcional, por viaje', async () => {
    const conn = useConnection([{ rows: [] }, { rows: [] }]);
    await get({ usuarioId: '9', vista: 'conductor' });
    await get({ usuarioId: '9', vista: 'conductor', viajeId: '5' });
    expect(conn.calls).toMatchSnapshot();
  });

  test('200 con [] si rows viene undefined', async () => {
    useConnection([{}]);
    expect(await readResponse(await get({ usuarioId: '7' }))).toEqual({ status: 200, body: [] });
  });

  test('500 con mensaje seguro si falla la consulta, y cierra la conexión', async () => {
    const conn = useConnection([oracleError(942, 'ORA-00942: table or view does not exist')]);
    expect(await readResponse(await get({ usuarioId: '7' }))).toEqual({
      status: 500,
      body: { error: 'Error al obtener encomiendas' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('POST /api/xpress (caracterización)', () => {
  test('400 si el body no es JSON', async () => {
    expect((await readResponse(await post('{'))).status).toBe(400);
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each([
    [{}, 'Viaje, remitente y receptor son requeridos'],
    [{ ...NUEVA, receptorEmail: undefined }, 'Viaje, remitente y receptor son requeridos'],
    [{ ...NUEVA, viajeId: 'x' }, 'ID de viaje inválido'],
    [{ ...NUEVA, usuarioId: -1 }, 'ID de usuario inválido'],
    [{ ...NUEVA, receptorEmail: 'sin-arroba' }, 'Correo del receptor inválido'],
    [{ ...NUEVA, descripcion: '  ' }, 'La descripción de la encomienda es obligatoria'],
    [{ ...NUEVA, peso: 0 }, 'El peso debe ser un número mayor a 0 y hasta 1000 kg'],
  ])('400 con %j, sin abrir conexión', async (body, error) => {
    expect(await readResponse(await post(body))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: valida el viaje y el receptor, e inserta la carga Pendiente', async () => {
    const conn = useConnection([{ rows: [{ conductorId: 9, estadoId: 1 }] }, { rows: [{ ID_USU: 8 }] }, {}]);
    const { status, body } = await readResponse(await post(NUEVA));
    expect(status).toBe(201);
    expect(body.message).toBe('Encomienda registrada');
    expect(typeof body.id).toBe('number');
    expect(conn.calls.map((c) => ({ ...c, binds: { ...c.binds, idXp: c.binds.idXp && 'ID' } }))).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('404 si el viaje no existe, sin escribir', async () => {
    const conn = useConnection([{ rows: [] }]);
    expect(await readResponse(await post(NUEVA))).toEqual({ status: 404, body: { error: 'Viaje no encontrado' } });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test.each([[4], [5]])('409 si el viaje está en estado %i (finalizado o cancelado)', async (estadoId) => {
    const conn = useConnection([{ rows: [{ conductorId: 9, estadoId }] }]);
    expect((await readResponse(await post(NUEVA))).status).toBe(409);
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('400 si el remitente es el conductor del viaje', async () => {
    const conn = useConnection([{ rows: [{ conductorId: 7, estadoId: 1 }] }]);
    expect(await readResponse(await post(NUEVA))).toEqual({
      status: 400,
      body: { error: 'No puedes enviar una encomienda en tu propio viaje' },
    });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('404 RECEPTOR_NO_REGISTRADO si el correo no es de un usuario de Bycar', async () => {
    const conn = useConnection([{ rows: [{ conductorId: 9, estadoId: 1 }] }, { rows: [] }]);
    const { status, body } = await readResponse(await post(NUEVA));
    expect(status).toBe(404);
    expect(body.codigo).toBe('RECEPTOR_NO_REGISTRADO');
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('400 RECEPTOR_PROPIO si el receptor es el mismo remitente', async () => {
    const conn = useConnection([{ rows: [{ conductorId: 9, estadoId: 1 }] }, { rows: [{ ID_USU: 7 }] }]);
    const { status, body } = await readResponse(await post(NUEVA));
    expect(status).toBe(400);
    expect(body.codigo).toBe('RECEPTOR_PROPIO');
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('500 sin filtrar el texto del error, y cierra la conexión', async () => {
    const conn = useConnection([{ rows: [{ conductorId: 9, estadoId: 1 }] }, { rows: [{ ID_USU: 8 }] }, oracleError(2291, 'violates FK_CARGAS_VIAJE')]);
    expect(await readResponse(await post(NUEVA))).toEqual({
      status: 500,
      body: { error: 'El registro hace referencia a otro que no existe' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('PUT /api/xpress (caracterización)', () => {
  test.each([
    [{}, 'ID de encomienda requerido'],
    [{ id: 'x', estado: 'Aceptada' }, 'ID de encomienda inválido'],
    [{ id: 3 }, 'Nada que actualizar'],
    [{ id: 3, estado: 'Volando' }, 'Estado desconocido: Volando'],
    [{ id: 3, estado: 'Aceptada', descripcion: 'x' }, 'Cambia el estado o edita los datos, no las dos cosas a la vez'],
    [{ id: 3, descripcion: ' ' }, 'La descripción de la encomienda es obligatoria'],
    [{ id: 3, descripcion: 'x', peso: -2 }, 'El peso debe ser un número mayor a 0 y hasta 1000 kg'],
  ])('400 con %j, sin abrir conexión', async (body, error) => {
    expect(await readResponse(await put(body))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('cambio de estado: pasa de Pendiente a Aceptada con el estado actual en el WHERE', async () => {
    const conn = useConnection([CARGA(1), { rowsAffected: 1 }]);
    expect(await readResponse(await put({ id: '3', estado: 'Aceptada' }))).toEqual({
      status: 200,
      body: { message: 'Estado actualizado' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('el estado también se acepta como número', async () => {
    const conn = useConnection([CARGA(2), { rowsAffected: 1 }]);
    expect((await readResponse(await put({ id: 3, estado: 4 }))).status).toBe(200);
    expect(conn.calls[1].binds).toEqual({ estadoNuevo: 4, cargaId: 3, estadoActual: 2 });
  });

  test('409 si la transición no existe (Pendiente → Entregada), sin escribir', async () => {
    const conn = useConnection([CARGA(1)]);
    expect(await readResponse(await put({ id: 3, estado: 'Entregada' }))).toEqual({
      status: 409,
      body: { error: 'Esa encomienda no puede pasar a ese estado' },
    });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('409 si otro cambió el estado mientras tanto (0 filas afectadas)', async () => {
    useConnection([CARGA(1), { rowsAffected: 0 }]);
    expect((await readResponse(await put({ id: 3, estado: 'Aceptada' }))).status).toBe(409);
  });

  test('404 si la encomienda no existe', async () => {
    const conn = useConnection([{ rows: [] }]);
    expect(await readResponse(await put({ id: 3, estado: 'Aceptada' }))).toEqual({
      status: 404,
      body: { error: 'Encomienda no encontrada' },
    });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('edición: actualiza descripción y peso solo si sigue Pendiente', async () => {
    const conn = useConnection([CARGA(1), { rowsAffected: 1 }]);
    expect(await readResponse(await put({ id: 3, descripcion: ' Sobre ', peso: 1 }))).toEqual({
      status: 200,
      body: { message: 'Encomienda actualizada' },
    });
    expect(conn.calls).toMatchSnapshot();
  });

  test('409 si se edita una encomienda que ya no está Pendiente', async () => {
    const conn = useConnection([CARGA(2)]);
    expect(await readResponse(await put({ id: 3, descripcion: 'x' }))).toEqual({
      status: 409,
      body: { error: 'Solo se puede editar una encomienda pendiente' },
    });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('409 si al editar ya cambió de estado (0 filas afectadas)', async () => {
    useConnection([CARGA(1), { rowsAffected: 0 }]);
    expect((await readResponse(await put({ id: 3, descripcion: 'x' }))).status).toBe(409);
  });

  test('500 con mensaje seguro, y cierra la conexión', async () => {
    const conn = useConnection([new Error('boom')]);
    expect(await readResponse(await put({ id: 3, estado: 'Aceptada' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('DELETE /api/xpress (caracterización)', () => {
  test.each([
    [undefined, 'ID de encomienda requerido'],
    [{ id: 'x' }, 'ID de encomienda inválido'],
  ])('400 con %j, sin abrir conexión', async (query, error) => {
    expect(await readResponse(await del(query))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('cancelación lógica: UPDATE a Cancelada, nunca DELETE', async () => {
    const conn = useConnection([CARGA(2), { rowsAffected: 1 }]);
    expect(await readResponse(await del({ id: '3' }))).toEqual({ status: 200, body: { message: 'Encomienda cancelada' } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.calls.some(({ sql }) => /^\s*DELETE\b/i.test(sql))).toBe(false);
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('409 si ya va En camino', async () => {
    const conn = useConnection([CARGA(4)]);
    expect((await readResponse(await del({ id: 3 }))).status).toBe(409);
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('404 si no existe', async () => {
    useConnection([{ rows: [] }]);
    expect((await readResponse(await del({ id: 3 }))).status).toBe(404);
  });

  test('500 con mensaje seguro, y cierra la conexión', async () => {
    const conn = useConnection([new Error('boom')]);
    expect(await readResponse(await del({ id: 3 }))).toEqual({ status: 500, body: { error: 'Error interno del servidor' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
