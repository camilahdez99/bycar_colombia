// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET } from '@/app/api/guardian/ultimo-contacto/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const get = (query) => GET(makeRequest('/api/guardian/ultimo-contacto', { query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/guardian/ultimo-contacto', () => {
  test('400 sin usuarioId, sin abrir conexión', async () => {
    expect(await readResponse(await get())).toEqual({ status: 400, body: { error: 'Falta usuarioId' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('400 con usuarioId inválido', async () => {
    expect((await readResponse(await get({ usuarioId: 'x' }))).body).toEqual({ error: 'usuarioId inválido' });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 con el último contacto; trae el más reciente (ORDER BY id DESC, LIMIT 1)', async () => {
    const fila = { id: 55, nombre: 'MAMÁ PÉREZ', correo: 'mama@x.co' };
    const conn = createFakeConnection([{ rows: [fila] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '7' }))).toEqual({ status: 200, body: fila });
    expect(conn.calls[0].sql).toMatch(/ORDER BY g\.ID_GUA DESC/);
    expect(conn.calls[0].sql).toContain('LIMIT 1');
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con null si el usuario nunca activó un guardián', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{ rows: [] }]));
    expect(await readResponse(await get({ usuarioId: '7' }))).toEqual({ status: 200, body: null });
  });

  test('500 si falla la consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ usuarioId: '7' }))).status).toBe(500);
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
