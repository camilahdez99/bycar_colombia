import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { logAlerta, logError, logInfo, logWarn } from '@/lib/log';
import { closeConnection } from '@/lib/api/connection';

const lineas = (spy) => spy.mock.calls.map(([linea]) => JSON.parse(linea));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('logError', () => {
  test('una línea JSON con evento, contexto y los campos útiles del error', () => {
    const error = Object.assign(new Error('ORA-00001: unique constraint violated'), { errorNum: 1, offset: 0 });
    logError('api_error', error, { route: 'POST /api/x' });

    expect(lineas(console.error)).toEqual([{
      event: 'api_error',
      route: 'POST /api/x',
      error: { name: 'Error', message: 'ORA-00001: unique constraint violated', errorNum: 1 },
    }]);
  });

  test('acepta valores que no son Error', () => {
    logError('api_error', 'texto');
    expect(lineas(console.error)).toEqual([{ event: 'api_error', error: { message: 'texto' } }]);
  });

  test('no incluye el stack', () => {
    logError('api_error', new Error('x'));
    expect(console.error.mock.calls[0][0]).not.toContain('stack');
  });
});

describe('logInfo', () => {
  test('una línea JSON por console.log', () => {
    logInfo('solicitud_actualizada', { solicitudId: 5, rowsAffected: 1 });
    expect(lineas(console.log)).toEqual([{ event: 'solicitud_actualizada', solicitudId: 5, rowsAffected: 1 }]);
  });
});

describe('logWarn', () => {
  test('una línea JSON por console.warn', () => {
    logWarn('session_invalid', { reason: 'ERR_JWT_EXPIRED' });
    expect(lineas(console.warn)).toEqual([{ event: 'session_invalid', reason: 'ERR_JWT_EXPIRED' }]);
  });
});

describe('logAlerta', () => {
  test('una línea JSON por console.error, sin campo error', () => {
    logAlerta('auth_misconfigured', { reason: 'sin secreto' });
    expect(lineas(console.error)).toEqual([{ event: 'auth_misconfigured', reason: 'sin secreto' }]);
  });
});

describe('closeConnection', () => {
  test('sin conexión no hace nada', async () => {
    await expect(closeConnection(undefined, 'GET /api/x')).resolves.toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('cierra la conexión', async () => {
    const connection = { close: vi.fn(async () => {}) };
    await closeConnection(connection, 'GET /api/x');
    expect(connection.close).toHaveBeenCalledOnce();
  });

  test('si el cierre falla, lo registra y no lanza', async () => {
    const connection = { close: vi.fn(async () => { throw new Error('NJS-003'); }) };
    await expect(closeConnection(connection, 'GET /api/x')).resolves.toBeUndefined();
    expect(lineas(console.error)).toEqual([
      { event: 'db_close_failed', route: 'GET /api/x', error: { name: 'Error', message: 'NJS-003' } },
    ]);
  });
});
