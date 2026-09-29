// @vitest-environment node
// IDOR (BUGS S6): con AUTH_ENFORCED, cada ruta solo opera sobre recursos del usuario de la sesión.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { ROLES, SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../helpers/api';

import * as viajes from '@/app/api/viajes/route';
import * as misRutas from '@/app/api/viajes/mis-rutas/route';
import * as solicitudes from '@/app/api/solicitudes/route';
import * as recibidas from '@/app/api/solicitudes/recibidas/route';
import * as mensajes from '@/app/api/mensajes/route';
import * as chats from '@/app/api/mensajes/chats/route';
import * as guardian from '@/app/api/guardian/route';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const YO = 7;
const OTRO = 8;
const CONDUCTOR = 9;

async function call(handler, method, ruta, { query, body, session = { userId: YO, role: ROLES.USER } } = {}) {
  const req = makeRequest(ruta, { method, query, body });
  req.cookies.set(SESSION_COOKIE, await encodeSession(session));
  return handler(req);
}

const isWrite = (sql) => /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql);
let conn;
const writes = () => conn.calls.filter(({ sql }) => isWrite(sql));

function useConnection(responses = []) {
  conn = createFakeConnection(responses);
  getConnection.mockResolvedValue(conn);
  return conn;
}

async function expect403(response) {
  expect(await readResponse(response)).toEqual({ status: 403, body: { error: 'No autorizado' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.stubEnv('SESSION_SECRET', 'i'.repeat(32));
  vi.stubEnv('AUTH_ENFORCED', 'true');
  useConnection();
});

afterEach(() => vi.unstubAllEnvs());

// Cada handler de usuario debe estar clasificado: si se agrega uno nuevo, este test obliga a decidir su regla
const COBERTURA = {
  'GET /api/viajes': 'sin IDs de recurso: búsqueda de viajes disponibles',
  'POST /api/viajes': 'usuarioId del body = sesión',
  'GET /api/viajes/mis-rutas': 'usuarioId de la query = sesión',
  'POST /api/solicitudes': 'usuarioId del body = sesión',
  'PUT /api/solicitudes': 'conductor acepta/rechaza, pasajero cancela',
  'GET /api/solicitudes/recibidas': 'usuarioId de la query = sesión',
  'GET /api/mensajes': 'participante del chat',
  'POST /api/mensajes': 'senderId = sesión y participante del chat',
  'GET /api/mensajes/chats': 'usuarioId de la query = sesión',
  'GET /api/guardian': 'usuarioId = sesión, o email = correo de la sesión',
  'POST /api/guardian': 'participante del viaje',
  'PUT /api/guardian': 'participante del viaje del guardián',
};

test('todos los handlers de usuario tienen una regla de pertenencia definida', () => {
  const modulos = {
    '/api/viajes': viajes,
    '/api/viajes/mis-rutas': misRutas,
    '/api/solicitudes': solicitudes,
    '/api/solicitudes/recibidas': recibidas,
    '/api/mensajes': mensajes,
    '/api/mensajes/chats': chats,
    '/api/guardian': guardian,
  };
  const exportados = Object.entries(modulos).flatMap(([ruta, modulo]) =>
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter((m) => modulo[m]).map((m) => `${m} ${ruta}`),
  );
  expect(exportados.sort()).toEqual(Object.keys(COBERTURA).sort());
});

describe('Fase A: usuarioId en la query', () => {
  describe.each([
    ['GET /api/viajes/mis-rutas', misRutas.GET, '/api/viajes/mis-rutas'],
    ['GET /api/solicitudes/recibidas', recibidas.GET, '/api/solicitudes/recibidas'],
    ['GET /api/mensajes/chats', chats.GET, '/api/mensajes/chats'],
    ['GET /api/guardian?usuarioId', guardian.GET, '/api/guardian'],
  ])('%s', (_nombre, handler, ruta) => {
    test('propio → pasa', async () => {
      const { status } = await call(handler, 'GET', ruta, { query: { usuarioId: String(YO) } });
      expect(status).toBe(200);
    });

    test('ajeno → 403 sin consultar datos', async () => {
      await expect403(await call(handler, 'GET', ruta, { query: { usuarioId: String(OTRO) } }));
      expect(conn.execute).not.toHaveBeenCalled();
    });

    test('admin → pasa con cualquier usuarioId', async () => {
      const { status } = await call(handler, 'GET', ruta, {
        query: { usuarioId: String(OTRO) },
        session: { userId: null, role: ROLES.ADMIN },
      });
      expect(status).toBe(200);
    });
  });
});

describe('Fase A: usuarioId en el body', () => {
  const VIAJE = {
    origen: '1',
    destino: '2',
    carro: '3',
    placa: 'ABC123',
    fecha: '2026-10-01',
    puestos: 3,
    valor: 20000,
  };

  test('POST /api/viajes a nombre de otro → 403 sin escribir', async () => {
    await expect403(await call(viajes.POST, 'POST', '/api/viajes', { body: { ...VIAJE, usuarioId: OTRO } }));
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('POST /api/viajes propio → pasa', async () => {
    useConnection([{ rows: [{ ID_VEH: 1 }] }]);
    const { status } = await call(viajes.POST, 'POST', '/api/viajes', { body: { ...VIAJE, usuarioId: YO } });
    expect(status).not.toBe(403);
  });

  test('POST /api/solicitudes a nombre de otro → 403 sin escribir', async () => {
    await expect403(await call(solicitudes.POST, 'POST', '/api/solicitudes', { body: { viajeId: 5, usuarioId: OTRO } }));
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('POST /api/solicitudes propio → 201', async () => {
    const { status } = await call(solicitudes.POST, 'POST', '/api/solicitudes', { body: { viajeId: 5, usuarioId: YO } });
    expect(status).toBe(201);
  });
});

describe('Fase B: PUT /api/solicitudes (conductor acepta/rechaza, pasajero cancela)', () => {
  const participantes = (passengerId, driverId) => ({ rows: [{ passengerId, driverId }] });
  const put = (solicitudId, estado, session) =>
    call(solicitudes.PUT, 'PUT', '/api/solicitudes', { body: { solicitudId, estado }, session });

  test.each([
    ['conductor acepta', 'Aceptado', OTRO, YO],
    ['conductor rechaza', 'Rechazada', OTRO, YO],
    ['conductor acepta con ID numérico', 2, OTRO, YO],
    ['pasajero cancela', 'Cancelada', YO, CONDUCTOR],
  ])('%s → 200', async (_caso, estado, passengerId, driverId) => {
    useConnection([participantes(passengerId, driverId), { rowsAffected: 1 }]);
    expect((await put(55, estado)).status).toBe(200);
    expect(writes()).toHaveLength(1);
  });

  test.each([
    ['pasajero se acepta a sí mismo', 'Aceptado', YO, CONDUCTOR],
    ['pasajero rechaza', 'Rechazado', YO, CONDUCTOR],
    ['conductor cancela por el pasajero', 'Cancelado', OTRO, YO],
    ['tercero acepta', 'Aceptado', OTRO, CONDUCTOR],
    ['conductor vuelve a Pendiente', 'Pendiente', OTRO, YO],
    ['estado fuera de catálogo', 99, OTRO, YO],
  ])('%s → 403 sin escribir', async (_caso, estado, passengerId, driverId) => {
    useConnection([participantes(passengerId, driverId)]);
    await expect403(await put(55, estado));
    expect(writes()).toEqual([]);
  });

  test('solicitud inexistente → 403 sin escribir', async () => {
    useConnection([{ rows: [] }]);
    await expect403(await put(404, 'Aceptado'));
    expect(writes()).toEqual([]);
  });

  test('admin → actualiza sin consultar pertenencia', async () => {
    useConnection([{ rowsAffected: 1 }]);
    expect((await put(55, 'Pendiente', { userId: null, role: ROLES.ADMIN })).status).toBe(200);
    expect(conn.execute).toHaveBeenCalledOnce();
  });
});

describe('Fase B: guardian', () => {
  const participa = (si) => ({ rows: [{ total: si ? 1 : 0 }] });

  test('POST en un viaje propio → 201', async () => {
    useConnection([participa(true), { rows: [{ ID_USU: 3 }] }, { rowsAffected: 1 }]);
    const { status } = await call(guardian.POST, 'POST', '/api/guardian', {
      body: { viajeId: 5, email: 'contacto@x.co', tiempo: 30 },
    });
    expect(status).toBe(201);
    expect(conn.calls[0].binds).toEqual({ viajeId: 5, userId: YO, aceptada: 2 });
  });

  test('POST en un viaje ajeno → 403 sin escribir', async () => {
    useConnection([participa(false)]);
    await expect403(
      await call(guardian.POST, 'POST', '/api/guardian', { body: { viajeId: 5, email: 'contacto@x.co' } }),
    );
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(writes()).toEqual([]);
  });

  test.each([
    ['estado', { estado: 'Inactivo' }],
    ['extraTiempo', { extraTiempo: 15 }],
  ])('PUT (%s) de un guardián propio → 200', async (_caso, cambios) => {
    useConnection([participa(true), { rowsAffected: 1 }]);
    expect((await call(guardian.PUT, 'PUT', '/api/guardian', { body: { id: 77, ...cambios } })).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ guardianId: 77, userId: YO, aceptada: 2 });
    expect(writes()).toHaveLength(1);
  });

  test.each([
    ['guardián ajeno', { id: 77, estado: 'Alerta' }],
    ['sin id', { estado: 'Alerta' }],
  ])('PUT con %s → 403 sin escribir', async (_caso, body) => {
    useConnection([participa(false)]);
    await expect403(await call(guardian.PUT, 'PUT', '/api/guardian', { body }));
    expect(writes()).toEqual([]);
  });

  test('GET ?email con el correo propio (sin distinguir mayúsculas) → 200', async () => {
    useConnection([{ rows: [{ correo: 'ana@x.co' }] }, { rows: [] }]);
    const { status } = await call(guardian.GET, 'GET', '/api/guardian', { query: { email: 'ANA@x.co' } });
    expect(status).toBe(200);
    expect(conn.execute).toHaveBeenCalledTimes(2);
  });

  test('GET ?email con un correo ajeno → 403 sin leer alertas', async () => {
    useConnection([{ rows: [{ correo: 'ana@x.co' }] }]);
    await expect403(await call(guardian.GET, 'GET', '/api/guardian', { query: { email: 'otro@x.co' } }));
    expect(conn.execute).toHaveBeenCalledOnce();
  });
});

describe('Fase A: mensajes', () => {
  const chatDe = (passengerId, driverId) => ({ rows: [{ passengerId, driverId }] });

  test.each([
    ['pasajero', YO, CONDUCTOR],
    ['conductor', OTRO, YO],
  ])('GET: como %s del chat → pasa', async (_rol, passengerId, driverId) => {
    useConnection([chatDe(passengerId, driverId), { rows: [] }]);
    const { status } = await call(mensajes.GET, 'GET', '/api/mensajes', { query: { chatId: '55' } });
    expect(status).toBe(200);
    expect(conn.execute).toHaveBeenCalledTimes(2);
  });

  test('GET: chat ajeno → 403 sin leer los mensajes', async () => {
    useConnection([chatDe(OTRO, CONDUCTOR)]);
    await expect403(await call(mensajes.GET, 'GET', '/api/mensajes', { query: { chatId: '55' } }));
    expect(conn.execute).toHaveBeenCalledOnce();
  });

  test('POST: senderId ajeno → 403 sin tocar la BD', async () => {
    await expect403(
      await call(mensajes.POST, 'POST', '/api/mensajes', { body: { chatId: 55, senderId: OTRO, text: 'hola' } }),
    );
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('POST: chat ajeno → 403 sin insertar', async () => {
    useConnection([chatDe(OTRO, CONDUCTOR)]);
    await expect403(
      await call(mensajes.POST, 'POST', '/api/mensajes', { body: { chatId: 55, senderId: YO, text: 'hola' } }),
    );
    expect(writes()).toEqual([]);
  });

  test('POST: participante propio → 201', async () => {
    useConnection([chatDe(YO, CONDUCTOR), { rowsAffected: 1 }]);
    const { status } = await call(mensajes.POST, 'POST', '/api/mensajes', {
      body: { chatId: 55, senderId: YO, text: 'hola' },
    });
    expect(status).toBe(201);
    expect(writes()).toHaveLength(1);
  });
});
