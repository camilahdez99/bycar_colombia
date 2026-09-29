// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET } from '@/app/api/viajes/mis-rutas/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const get = (query) => GET(makeRequest('/api/viajes/mis-rutas', { query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/viajes/mis-rutas (caracterización)', () => {
  test('400 si falta usuarioId', async () => {
    expect(await readResponse(await get())).toEqual({ status: 400, body: { error: 'Falta usuarioId' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 con publicadas y solicitadas (usuarioId convertido a número)', async () => {
    const publicadas = [{ id: 1, origen: 'BELLO', destino: 'ENVIGADO', fecha: '2026-10-01', placa: 'ABC123', estado: 'Disponible' }];
    const solicitadas = [{ id: 9, viajeId: 2, origen: 'ITAGUI', destino: 'SABANETA', conductor: 'Ana Pérez', estado: 'Pendiente' }];
    const conn = createFakeConnection([{ rows: publicadas }, { rows: solicitadas }]);
    getConnection.mockResolvedValue(conn);

    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({
      status: 200,
      body: { publicadas, solicitadas },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con listas vacías si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}, {}]));
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({
      status: 200,
      body: { publicadas: [], solicitadas: [] },
    });
  });

  test('usuarioId no numérico se envía como NaN (comportamiento actual: no valida)', async () => {
    const conn = createFakeConnection([{ rows: [] }, { rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ usuarioId: 'abc' }))).status).toBe(200);
    expect(conn.calls[0].binds.usuarioId).toBeNaN();
  });

  test('500 si falla la segunda consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([{ rows: [] }, new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({
      status: 500,
      body: { error: 'Error al obtener rutas' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows: [] }, { rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ usuarioId: '42' }))).status).toBe(200);
  });
});
