// @vitest-environment node
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
import * as tablas from '@/app/api/admin/tablas/route';
import * as usuarios from '@/app/api/admin/usuarios/route';
import * as conductores from '@/app/api/admin/conductores/route';
import * as vehiculos from '@/app/api/admin/vehiculos/route';
import * as adminViajes from '@/app/api/admin/viajes/route';
import * as permisos from '@/app/api/admin/permisos/route';
import * as marcas from '@/app/api/marcas/route';
import * as municipios from '@/app/api/municipios/route';
import * as menus from '@/app/api/menus/route';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const handlersOf = (ruta, modulo) =>
  ['GET', 'POST', 'PUT', 'DELETE'].filter((m) => modulo[m]).map((m) => [`${m} ${ruta}`, modulo[m], m, ruta]);

const RUTAS_USUARIO = [
  ...handlersOf('/api/viajes', viajes),
  ...handlersOf('/api/viajes/mis-rutas', misRutas),
  ...handlersOf('/api/solicitudes', solicitudes),
  ...handlersOf('/api/solicitudes/recibidas', recibidas),
  ...handlersOf('/api/mensajes', mensajes),
  ...handlersOf('/api/mensajes/chats', chats),
  ...handlersOf('/api/guardian', guardian),
];

const RUTAS_ADMIN = [
  ...handlersOf('/api/admin/tablas', tablas),
  ...handlersOf('/api/admin/usuarios', usuarios),
  ...handlersOf('/api/admin/conductores', conductores),
  ...handlersOf('/api/admin/vehiculos', vehiculos),
  ...handlersOf('/api/admin/viajes', adminViajes),
  ['POST /api/admin/permisos', permisos.POST, 'POST', '/api/admin/permisos'],
  ['DELETE /api/admin/permisos', permisos.DELETE, 'DELETE', '/api/admin/permisos'],
];

const RUTAS_PUBLICAS = [
  ...handlersOf('/api/marcas', marcas),
  ...handlersOf('/api/municipios', municipios),
  ...handlersOf('/api/menus', menus),
];

async function request(method, ruta, { session, query } = {}) {
  const body = ['POST', 'PUT'].includes(method) ? {} : undefined;
  const req = makeRequest(ruta, { method, query, body });
  if (session) req.cookies.set(SESSION_COOKIE, await encodeSession(session));
  return req;
}

const USUARIO = { userId: 7, role: ROLES.USER };
const ADMIN = { userId: null, role: ROLES.ADMIN };

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.stubEnv('SESSION_SECRET', 'k'.repeat(32));
  getConnection.mockImplementation(async () => createFakeConnection());
});

afterEach(() => vi.unstubAllEnvs());

describe('AUTH_ENFORCED=true', () => {
  beforeEach(() => vi.stubEnv('AUTH_ENFORCED', 'true'));

  test('cubre todos los handlers exportados', () => {
    expect(RUTAS_USUARIO.length + RUTAS_ADMIN.length + RUTAS_PUBLICAS.length + 1).toBe(36);
  });

  test.each([...RUTAS_USUARIO, ...RUTAS_ADMIN, ['GET /api/admin/permisos', permisos.GET, 'GET', '/api/admin/permisos']])(
    '%s sin sesión → 401 sin tocar la BD',
    async (_nombre, handler, method, ruta) => {
      expect(await readResponse(await handler(await request(method, ruta)))).toEqual({
        status: 401,
        body: { error: 'No autenticado' },
      });
      expect(getConnection).not.toHaveBeenCalled();
    },
  );

  test.each(RUTAS_ADMIN)('%s con sesión de usuario → 403', async (_nombre, handler, method, ruta) => {
    expect(await readResponse(await handler(await request(method, ruta, { session: USUARIO })))).toEqual({
      status: 403,
      body: { error: 'No autorizado' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(RUTAS_ADMIN)('%s con sesión de admin → pasa el guard', async (_nombre, handler, method, ruta) => {
    const { status } = await handler(await request(method, ruta, { session: ADMIN }));
    expect([401, 403]).not.toContain(status);
  });

  test.each(RUTAS_USUARIO)('%s con sesión de usuario → pasa el guard', async (_nombre, handler, method, ruta) => {
    const { status } = await handler(await request(method, ruta, { session: USUARIO }));
    expect([401, 403]).not.toContain(status);
  });

  test.each(RUTAS_PUBLICAS)('%s es público: responde sin sesión', async (_nombre, handler, method, ruta) => {
    expect((await handler(await request(method, ruta))).status).toBe(200);
  });

  describe('GET /api/admin/permisos (lo usa el dashboard)', () => {
    const get = async (session, usuarioId) =>
      permisos.GET(await request('GET', '/api/admin/permisos', { session, query: { usuarioId } }));

    test('usuario consultando sus propios permisos → pasa', async () => {
      expect((await get(USUARIO, '7')).status).toBe(200);
    });

    test('usuario consultando permisos ajenos → 403', async () => {
      expect(await readResponse(await get(USUARIO, '8'))).toEqual({ status: 403, body: { error: 'No autorizado' } });
      expect(getConnection).not.toHaveBeenCalled();
    });

    test('usuario sin usuarioId (listado completo) → 403', async () => {
      expect((await get(USUARIO, undefined)).status).toBe(403);
    });

    test('admin consultando cualquier usuario → pasa', async () => {
      expect((await get(ADMIN, '8')).status).toBe(200);
    });
  });
});

describe('AUTH_ENFORCED apagado', () => {
  test.each([...RUTAS_USUARIO, ...RUTAS_ADMIN])('%s sin sesión no responde 401/403', async (_n, handler, method, ruta) => {
    const { status } = await handler(await request(method, ruta));
    expect([401, 403]).not.toContain(status);
  });
});
