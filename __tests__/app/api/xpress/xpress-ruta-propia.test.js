// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST, PUT } from '@/app/api/xpress/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

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

const CON_VIAJE = { viajeId: 5, usuarioId: 7, receptorEmail: 'Luis@x.co', descripcion: 'Caja con libros', peso: '2.5' };
const RUTA = { origenId: 11, destinoId: 22, fechaXp: '2999-01-31', usuarioId: 7, receptorEmail: 'Luis@x.co', descripcion: 'Caja con libros', peso: '2.5' };
const MUNICIPIOS = { rows: [{ ID_MUN: 11 }, { ID_MUN: 22 }] };
const RECEPTOR = { rows: [{ ID_USU: 8 }] };
const rutaPropia = (extra) => ({ rows: [{ emisorId: 7, receptorId: 8, conductorId: null, viajeId: null, estadoId: 1, ...extra }] });
const aceptar = (body) => put({ id: 3, aceptar: true, usuarioId: 9, ...body });

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/xpress?vista=disponibles', () => {
  test('lista las de ruta propia Pendientes sin conductor, sin las propias ni las que va a recibir', async () => {
    const rows = [{ id: 1, descripcion: 'Caja', origen: 'BOGOTA', destino: 'TUNJA', viajeId: null, conductorId: null }];
    const conn = useConnection([{ rows }]);
    expect(await readResponse(await get({ usuarioId: '9', vista: 'disponibles' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('viajeId no aplica a esa vista', async () => {
    expect(await readResponse(await get({ usuarioId: '9', vista: 'disponibles', viajeId: '5' }))).toEqual({
      status: 400,
      body: { error: 'viajeId inválido' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe('POST /api/xpress con ruta propia', () => {
  test.each([
    [{ ...CON_VIAJE, origenId: 11, destinoId: 22 }, 'Elige un viaje o una ruta propia, no las dos cosas'],
    [{ ...RUTA, destinoId: undefined }, 'El origen y el destino son requeridos'],
    [{ ...RUTA, origenId: undefined }, 'El origen y el destino son requeridos'],
    [{ ...RUTA, origenId: 'x' }, 'Origen o destino inválido'],
    [{ ...RUTA, destinoId: 11 }, 'El origen y el destino no pueden ser el mismo'],
    [{ ...RUTA, fechaXp: '2020-01-01' }, 'La fecha no puede ser anterior a hoy'],
    [{ ...RUTA, fechaXp: 'pronto' }, 'La fecha es inválida'],
    [{ ...RUTA, descripcion: '' }, 'La descripción de la encomienda es obligatoria'],
    [{ usuarioId: 7, receptorEmail: 'luis@x.co', descripcion: 'x' }, 'Viaje, remitente y receptor son requeridos'],
  ])('400 con %j, sin abrir conexión', async (body, error) => {
    expect(await readResponse(await post(body))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: valida los municipios y el receptor, e inserta la carga Pendiente sin viaje ni conductor', async () => {
    const conn = useConnection([MUNICIPIOS, RECEPTOR, {}]);
    const { status, body } = await readResponse(await post(RUTA));
    expect(status).toBe(201);
    expect(body.message).toBe('Encomienda registrada');
    expect(conn.calls.map((c) => ({ ...c, binds: { ...c.binds, idXp: c.binds.idXp && 'ID' } }))).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('la fecha es opcional', async () => {
    const conn = useConnection([MUNICIPIOS, RECEPTOR, {}]);
    expect((await readResponse(await post({ ...RUTA, fechaXp: undefined }))).status).toBe(201);
    expect(conn.calls[2].binds.fechaXp).toBeNull();
  });

  test('404 si el origen o el destino no existen, sin escribir', async () => {
    const conn = useConnection([{ rows: [{ ID_MUN: 11 }] }]);
    expect(await readResponse(await post(RUTA))).toEqual({ status: 404, body: { error: 'Origen o destino no encontrado' } });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('400 RECEPTOR_PROPIO también en ruta propia', async () => {
    const conn = useConnection([MUNICIPIOS, { rows: [{ ID_USU: 7 }] }]);
    expect((await readResponse(await post(RUTA))).body.codigo).toBe('RECEPTOR_PROPIO');
    expect(escrituras(conn)).toHaveLength(0);
  });
});

describe('PUT /api/xpress con aceptar', () => {
  test.each([
    [{ id: undefined }, 'ID de encomienda requerido'],
    [{ id: 'x' }, 'ID de encomienda inválido'],
    [{ usuarioId: undefined }, 'Falta usuarioId'],
    [{ usuarioId: 'x' }, 'ID de usuario inválido'],
    [{ estado: 'Aceptada' }, 'Aceptar una encomienda no se combina con otros cambios'],
    [{ descripcion: 'x' }, 'Aceptar una encomienda no se combina con otros cambios'],
  ])('400 con %j, sin abrir conexión', async (cambio, error) => {
    expect(await readResponse(await aceptar(cambio))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('un conductor ajeno la acepta: queda como responsable y pasa a Aceptada, con las guardas en el WHERE', async () => {
    const conn = useConnection([rutaPropia(), { rowsAffected: 1 }]);
    expect(await readResponse(await aceptar())).toEqual({ status: 200, body: { message: 'Encomienda aceptada' } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('404 si no existe', async () => {
    const conn = useConnection([{ rows: [] }]);
    expect((await readResponse(await aceptar())).status).toBe(404);
    expect(escrituras(conn)).toHaveLength(0);
  });

  test.each([[7], [8]])('403 si quien acepta es el remitente o el receptor (%i)', async (usuarioId) => {
    const conn = useConnection([rutaPropia()]);
    expect((await readResponse(await aceptar({ usuarioId }))).status).toBe(403);
    expect(escrituras(conn)).toHaveLength(0);
  });

  test.each([
    ['ya tiene conductor', { conductorId: 5 }],
    ['ya no está Pendiente', { estadoId: 6 }],
    ['es de un viaje', { viajeId: 5, conductorId: 4 }],
  ])('409 si %s', async (_caso, extra) => {
    const conn = useConnection([rutaPropia(extra)]);
    expect(await readResponse(await aceptar())).toEqual({
      status: 409,
      body: { error: 'La encomienda ya no está disponible. Actualiza la lista e intenta de nuevo.' },
    });
    expect(escrituras(conn)).toHaveLength(0);
  });

  test('409 si otro conductor la aceptó mientras tanto (0 filas afectadas)', async () => {
    useConnection([rutaPropia(), { rowsAffected: 0 }]);
    expect((await readResponse(await aceptar())).status).toBe(409);
  });

  test('500 con mensaje seguro, y cierra la conexión', async () => {
    const conn = useConnection([new Error('boom')]);
    expect(await readResponse(await aceptar())).toEqual({ status: 500, body: { error: 'Error interno del servidor' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('ciclo de una encomienda de ruta propia', () => {
  test('el conductor que la aceptó la marca En camino', async () => {
    const conn = useConnection([rutaPropia({ conductorId: 9, estadoId: 2 }), { rowsAffected: 1 }]);
    expect((await readResponse(await put({ id: 3, estado: 'En camino' }))).status).toBe(200);
    expect(conn.calls[1].binds).toEqual({ estadoNuevo: 4, cargaId: 3, estadoActual: 2 });
  });

  test('el remitente la cancela mientras sigue Pendiente y sin conductor', async () => {
    const conn = useConnection([rutaPropia(), { rowsAffected: 1 }]);
    expect((await readResponse(await del({ id: '3' }))).status).toBe(200);
    expect(conn.calls[1].binds.estadoNuevo).toBe(6);
  });
});
