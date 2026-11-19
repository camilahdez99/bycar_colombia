// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET, POST } from '@/app/api/mensajes/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;
const participantes = { rows: [{ passengerId: 42, driverId: 7 }] };

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/mensajes (caracterización)', () => {
  const get = (query) => GET(makeRequest('/api/mensajes', { query }));

  test('400 si falta chatId', async () => {
    expect(await readResponse(await get())).toEqual({ status: 400, body: { error: 'Falta chatId' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: busca el par pasajero/conductor y mapea los mensajes a { senderId, text }', async () => {
    const conn = createFakeConnection([
      participantes,
      { rows: [{ content: 'hola', senderId: 42 }, { content: null, senderId: 7 }] },
    ]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ chatId: '9' }))).toEqual({
      status: 200,
      body: [
        { senderId: 42, text: 'hola' },
        { senderId: 7, text: '' },
      ],
    });
    // chatId se envía como string; los mensajes se filtran por su solicitud (BUGS F4)
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con guardianId: participantes del guardián y mensajes de ese guardián', async () => {
    const conn = createFakeConnection([participantes, { rows: [{ content: 'llegué', senderId: 42 }] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ guardianId: '77' }))).toEqual({
      status: 200,
      body: [{ senderId: 42, text: 'llegué' }],
    });
    expect(conn.calls[0].sql).toContain('FROM GUARDIANES');
    expect(conn.calls[1].sql).toContain('GUARDIAN_ID_GUA = :chatId');
    expect(conn.calls[1].binds).toEqual({ chatId: '77' });
  });

  test('400 con chatId y guardianId a la vez, sin abrir conexión', async () => {
    expect(await readResponse(await get({ chatId: '9', guardianId: '77' }))).toEqual({
      status: 400,
      body: { error: 'Indica chatId o guardianId, no ambos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('400 con guardianId inválido', async () => {
    expect((await readResponse(await get({ guardianId: 'abc' }))).body).toEqual({ error: 'guardianId inválido' });
  });

  test('200 con [] si la solicitud no existe o su día ya pasó (sin consultar mensajes)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ chatId: '9' }))).toEqual({ status: 200, body: [] });
    expect(conn.execute).toHaveBeenCalledOnce();
  });

  test('200 con [] si los mensajes vienen sin rows', async () => {
    getConnection.mockResolvedValue(createFakeConnection([participantes, {}]));
    expect(await readResponse(await get({ chatId: '9' }))).toEqual({ status: 200, body: [] });
  });

  test('si la primera consulta viene sin rows se trata como chat inexistente: 200 [] (E4)', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get({ chatId: '9' }))).toEqual({ status: 200, body: [] });
  });

  test('500 si falla la consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ chatId: '9' }))).toEqual({
      status: 500,
      body: { error: 'Error al obtener mensajes' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('POST /api/mensajes (caracterización)', () => {
  const post = (body) => POST(makeRequest('/api/mensajes', { method: 'POST', body }));
  const validBody = { chatId: 9, senderId: '42', text: 'hola' };

  test.each(['chatId', 'senderId', 'text'])('400 si falta %s', async (campo) => {
    expect(await readResponse(await post({ ...validBody, [campo]: '' }))).toEqual({
      status: 400,
      body: { error: 'Datos incompletos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('404 si la consulta del chat viene sin rows, sin insertar (E4)', async () => {
    const conn = createFakeConnection([{}]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({ status: 404, body: { error: 'Chat no encontrado' } });
    expect(conn.execute).toHaveBeenCalledOnce();
  });

  test('201: el pasajero escribe → receptor es el conductor', async () => {
    const conn = createFakeConnection([participantes, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({ status: 201, body: { success: true } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.calls[1].binds).toEqual({
      idMen: NOW, contenido: 'hola', receptorId: 7, emisorId: 42, solicitudId: 9, guardianId: null,
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('201: el conductor escribe → receptor es el pasajero', async () => {
    const conn = createFakeConnection([participantes, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, senderId: 7 });
    expect(conn.calls[1].binds).toMatchObject({ receptorId: 42, emisorId: 7 });
  });

  test('201: un tercero ajeno al chat puede escribir y el receptor es el pasajero (comportamiento actual: no valida emisor)', async () => {
    const conn = createFakeConnection([participantes, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ ...validBody, senderId: 999 }))).status).toBe(201);
    expect(conn.calls[1].binds).toMatchObject({ receptorId: 42, emisorId: 999 });
  });

  test('201 con guardianId: el mensaje queda en el chat del guardián', async () => {
    const conn = createFakeConnection([participantes, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    const res = await post({ guardianId: '77', senderId: 7, text: 'voy en camino' });
    expect(res.status).toBe(201);
    expect(conn.calls[0].sql).toContain('FROM GUARDIANES');
    expect(conn.calls[1].binds).toMatchObject({ receptorId: 42, emisorId: 7, solicitudId: null, guardianId: 77 });
  });

  test('400 con chatId y guardianId a la vez, sin abrir conexión', async () => {
    expect(await readResponse(await post({ ...validBody, guardianId: 77 }))).toEqual({
      status: 400,
      body: { error: 'Indica chatId o guardianId, no ambos' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('404 si el chat no existe', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({ status: 404, body: { error: 'Chat no encontrado' } });
    expect(conn.execute).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si falla el insert, y cierra la conexión', async () => {
    const conn = createFakeConnection([participantes, new Error('ORA-12899')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({ status: 500, body: { error: 'Error interno' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
