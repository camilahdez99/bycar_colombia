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

  test('200: chats de guardián primero y después los de viaje, con tipo y clave (usuarioId convertido a número)', async () => {
    const viaje = { chatId: 9, nombre: 'Ana Pérez', ruta: 'BELLO - ENVIGADO', fecha: '2026-10-01', vigente: true };
    const guardian = { guardianId: 77, nombre: 'Mamá Pérez', ruta: 'BELLO - ENVIGADO', fecha: '2026-10-01', vigente: true };
    const conn = createFakeConnection([{ rows: [viaje] }, { rows: [guardian] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ usuarioId: '42' }))).toEqual({
      status: 200,
      body: [
        { ...guardian, tipo: 'guardian', clave: 'guardian-77' },
        { ...viaje, tipo: 'viaje', clave: 'viaje-9' },
      ],
    });
    // El historial no se filtra por fecha: cada chat trae "vigente" (se puede escribir) y hay tope de 50
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200: los chats pasados (vigente = false) siguen en la lista, después de los vigentes', async () => {
    const pasado = { chatId: 5, nombre: 'Luis', ruta: 'A - B', fecha: '2026-09-01', vigente: false };
    const actual = { chatId: 9, nombre: 'Ana', ruta: 'A - B', fecha: '2026-10-01', vigente: true };
    getConnection.mockResolvedValue(createFakeConnection([{ rows: [pasado, actual] }, { rows: [] }]));
    const { body } = await readResponse(await get({ usuarioId: '42' }));
    expect(body.map((c) => [c.clave, c.vigente])).toEqual([['viaje-9', true], ['viaje-5', false]]);
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}, {}]));
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
    const conn = createFakeConnection([{ rows: [] }, { rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ usuarioId: '42' }))).status).toBe(200);
  });
});
