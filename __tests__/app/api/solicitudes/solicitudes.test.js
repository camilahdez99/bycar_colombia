// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST, PUT } from '@/app/api/solicitudes/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/solicitudes (caracterización)', () => {
  const post = (body) => POST(makeRequest('/api/solicitudes', { method: 'POST', body }));

  test.each(['viajeId', 'usuarioId'])('400 si falta %s', async (campo) => {
    const body = { viajeId: 5, usuarioId: 42, [campo]: undefined };
    expect(await readResponse(await post(body))).toEqual({
      status: 400,
      body: { error: 'ID de viaje y usuario son requeridos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: inserta la solicitud en estado 1 con ID = Date.now() (comportamiento actual: no valida cupos, duplicados ni auto-solicitud)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5, usuarioId: 42 }))).toEqual({
      status: 201,
      body: { message: 'Solicitud enviada', id: NOW },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('los IDs se envían tal como llegan, sin convertir a número', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await post({ viajeId: '5', usuarioId: '42' });
    expect(conn.calls[0].binds).toEqual({ idSol: NOW, viajeId: '5', usuarioId: '42' });
  });

  test('500 si falla el insert, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-02291')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5, usuarioId: 42 }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor al crear solicitud' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si el body no es JSON válido', async () => {
    expect((await readResponse(await post('no-json'))).status).toBe(500);
  });
});

describe('PUT /api/solicitudes (caracterización)', () => {
  const put = (body) => PUT(makeRequest('/api/solicitudes', { method: 'PUT', body }));

  test.each(['solicitudId', 'estado'])('400 si falta %s', async (campo) => {
    const body = { solicitudId: 9, estado: 'Aceptada', [campo]: undefined };
    expect(await readResponse(await put(body))).toEqual({
      status: 400,
      body: { error: 'ID de solicitud y estado son requeridos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200 al aceptar: estado 2 (comportamiento actual: no descuenta cupos)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ solicitudId: '9', estado: 'Aceptada' }))).toEqual({
      status: 200,
      body: { message: 'Solicitud actualizada' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test.each([
    ['Pendiente', 1],
    ['Aceptado', 2],
    ['Aceptada', 2],
    ['Rechazado', 3],
    ['Rechazada', 3],
    ['Cancelado', 4],
    ['Cancelada', 4],
    ['3', 3],
    [2, 2],
  ])('estado %j se traduce a %i', async (estado, estadoId) => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ solicitudId: 9, estado }))).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ estadoId, solicitudId: 9 });
  });

  test('400 con estado de texto desconocido (tras abrir conexión, que se cierra)', async () => {
    const conn = createFakeConnection();
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ solicitudId: 9, estado: 'aceptada' }))).toEqual({
      status: 400,
      body: { error: 'Estado desconocido: aceptada' },
    });
    expect(conn.execute).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('400 con estado "0"', async () => {
    getConnection.mockResolvedValue(createFakeConnection());
    expect(await readResponse(await put({ solicitudId: 9, estado: '0' }))).toEqual({
      status: 400,
      body: { error: 'Estado desconocido: 0' },
    });
  });

  test('estado numérico fuera de catálogo se acepta (comportamiento actual: no valida el rango)', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await put({ solicitudId: 9, estado: 99 }))).status).toBe(200);
    expect(conn.calls[0].binds.estadoId).toBe(99);
  });

  test('200 aunque no exista la solicitud (comportamiento actual: ignora rowsAffected = 0)', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{ rowsAffected: 0 }]));
    expect(await readResponse(await put({ solicitudId: 9, estado: 'Rechazada' }))).toEqual({
      status: 200,
      body: { message: 'Solicitud actualizada' },
    });
  });

  test('500 si falla el update, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00001')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ solicitudId: 9, estado: 'Aceptada' }))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
