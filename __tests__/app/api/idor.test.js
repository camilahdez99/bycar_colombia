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
