// @vitest-environment node
// DT-31: las rutas responden 400 ante IDs que no son enteros positivos, sin abrir conexión.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import * as chats from '@/app/api/mensajes/chats/route';
import * as recibidas from '@/app/api/solicitudes/recibidas/route';
import * as mensajes from '@/app/api/mensajes/route';
import * as permisos from '@/app/api/admin/permisos/route';
import * as guardian from '@/app/api/guardian/route';
import { makeRequest, readResponse, silenceConsole } from '../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

const esperar400 = async (respuesta, error) => {
  expect(await readResponse(respuesta)).toEqual({ status: 400, body: { error } });
  expect(getConnection).not.toHaveBeenCalled();
};

describe('GET con usuarioId inválido', () => {
  test.each([
    ['mensajes/chats', chats.GET],
    ['solicitudes/recibidas', recibidas.GET],
  ])('/api/%s', async (ruta, handler) => {
    await esperar400(await handler(makeRequest(`/api/${ruta}`, { query: { usuarioId: '7 OR 1=1' } })), 'usuarioId inválido');
  });

  test('/api/guardian?usuarioId', async () => {
    await esperar400(await guardian.GET(makeRequest('/api/guardian', { query: { usuarioId: 'abc' } })), 'usuarioId inválido');
  });

  test('/api/admin/permisos?usuarioId', async () => {
    await esperar400(await permisos.GET(makeRequest('/api/admin/permisos', { query: { usuarioId: '-1' } })), 'usuarioId inválido');
  });
});

describe('/api/mensajes', () => {
  test('GET con chatId no entero', async () => {
    await esperar400(await mensajes.GET(makeRequest('/api/mensajes', { query: { chatId: '9x' } })), 'chatId inválido');
  });

  test.each([
    { chatId: 'x', senderId: 42, text: 'hola' },
    { chatId: 9, senderId: '42abc', text: 'hola' },
    { chatId: 9, senderId: 42, text: '   ' },
    { chatId: 9, senderId: 42, text: { html: '<b>' } },
  ])('POST con datos inválidos %j', async (body) => {
    await esperar400(await mensajes.POST(makeRequest('/api/mensajes', { method: 'POST', body })), 'Datos inválidos');
  });

  test('POST con JSON inválido (antes 500)', async () => {
    await esperar400(await mensajes.POST(makeRequest('/api/mensajes', { method: 'POST', body: '{no json' })), 'El cuerpo no es un JSON válido');
  });
});

describe('/api/admin/permisos POST y DELETE', () => {
  test('POST con IDs no enteros', async () => {
    const req = makeRequest('/api/admin/permisos', { method: 'POST', body: { usuarioId: 'abc', menuId: 2 } });
    await esperar400(await permisos.POST(req), 'usuarioId y menuId deben ser enteros');
  });

  test('DELETE con IDs no enteros', async () => {
    const req = makeRequest('/api/admin/permisos', { method: 'DELETE', query: { usuarioId: '5', menuId: '2.5' } });
    await esperar400(await permisos.DELETE(req), 'usuarioId y menuId deben ser enteros');
  });
});
