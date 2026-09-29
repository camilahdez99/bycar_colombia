// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET } from '@/app/api/mensajes/chats/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const get = (query) => GET(makeRequest('/api/mensajes/chats', { query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/mensajes/chats (caracterización)', () => {
  test('400 si falta usuarioId', async () => {
    expect(await readResponse(await get())).toEqual({
      status: 400,
      body: { error: 'ID de usuario es requerido' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 con los chats aceptados tal cual vienen de la BD (usuarioId convertido a número)', async () => {
    const rows = [{ chatId: 9, nombre: 'Ana Pérez', ruta: 'BELLO - ENVIGADO', fecha: '2026-10-01' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({ status: 200, body: [] });
  });

  test('500 si falla la consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({
      status: 500,
      body: { error: 'Error al obtener chats' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ usuarioId: '42' }))).status).toBe(200);
  });
});
