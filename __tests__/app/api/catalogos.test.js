// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET as getMarcas } from '@/app/api/marcas/route';
import { GET as getMunicipios } from '@/app/api/municipios/route';
import { GET as getMenus } from '@/app/api/menus/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe.each([
  ['marcas', getMarcas, [{ id: 1, nombre: 'MAZDA' }], 'Error al obtener marcas'],
  ['municipios', getMunicipios, [{ id: 1, nombre: 'BELLO', departamento: 'ANTIOQUIA' }], 'Error al obtener municipios'],
  ['menus', getMenus, [{ id: 1, label: 'Viajes', url: '/v', parentId: null }], 'Error al obtener menús'],
])('GET /api/%s (caracterización)', (nombre, handler, rows, mensajeError) => {
  const call = () => handler(makeRequest(`/api/${nombre}`));

  test('200 con las filas tal cual vienen de la BD', async () => {
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await call())).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await call())).toEqual({ status: 200, body: [] });
  });

  test('500 si falla la consulta', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await call())).toEqual({ status: 500, body: { error: mensajeError } });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se registra)', async () => {
    const conn = createFakeConnection([{ rows }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await call())).status).toBe(200);
  });

  describe('caché (feature flag CATALOG_CACHE_SECONDS)', () => {
    afterEach(() => vi.unstubAllEnvs());

    test.each([undefined, '', '0', '-5', 'abc', '1.5'])('con %j no envía Cache-Control', async (valor) => {
      if (valor !== undefined) vi.stubEnv('CATALOG_CACHE_SECONDS', valor);
      getConnection.mockResolvedValue(createFakeConnection([{ rows }]));
      expect((await call()).headers.get('cache-control')).toBeNull();
    });

    test('con un entero positivo envía Cache-Control público', async () => {
      vi.stubEnv('CATALOG_CACHE_SECONDS', '300');
      getConnection.mockResolvedValue(createFakeConnection([{ rows }]));
      expect((await call()).headers.get('cache-control')).toBe('public, max-age=300');
    });

    test('las respuestas de error nunca se cachean', async () => {
      vi.stubEnv('CATALOG_CACHE_SECONDS', '300');
      getConnection.mockResolvedValue(createFakeConnection([new Error('ORA-00942')]));
      expect((await call()).headers.get('cache-control')).toBeNull();
    });
  });
});
