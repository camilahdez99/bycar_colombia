import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Nunca se abre una conexión real: el driver se reemplaza entero
const oracledb = vi.hoisted(() => ({
  OUT_FORMAT_OBJECT: 4002,
  CLOB: 2017,
  outFormat: undefined,
  autoCommit: undefined,
  fetchAsString: undefined,
  getConnection: vi.fn(),
}));
vi.mock('oracledb', () => ({ default: oracledb }));

const { getConnection } = await import('@/lib/db');

const ENV = { DB_USER: 'usuario_test', DB_PASSWORD: 'clave-de-prueba', DB_CONNECTION_STRING: 'localhost/XEPDB1' };

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  oracledb.getConnection.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('lib/db (caracterización)', () => {
  test('al importarse configura el driver global: objetos, autoCommit y CLOB como texto', () => {
    expect(oracledb.outFormat).toBe(oracledb.OUT_FORMAT_OBJECT);
    expect(oracledb.autoCommit).toBe(true);
    expect(oracledb.fetchAsString).toEqual([oracledb.CLOB]);
  });

  test('getConnection abre una conexión nueva por llamada, con las variables de entorno leídas en ese momento', async () => {
    const conexion = { close: vi.fn() };
    oracledb.getConnection.mockResolvedValue(conexion);

    await expect(getConnection()).resolves.toBe(conexion);
    vi.stubEnv('DB_USER', 'otro_usuario');
    await getConnection();

    expect(oracledb.getConnection.mock.calls).toEqual([
      [{ user: 'usuario_test', password: 'clave-de-prueba', connectString: 'localhost/XEPDB1' }],
      [{ user: 'otro_usuario', password: 'clave-de-prueba', connectString: 'localhost/XEPDB1' }],
    ]);
  });

  test('sin variables de entorno pasa undefined al driver (no valida la configuración)', async () => {
    vi.unstubAllEnvs();
    for (const key of Object.keys(ENV)) vi.stubEnv(key, undefined);
    oracledb.getConnection.mockResolvedValue({});

    await getConnection();

    expect(oracledb.getConnection).toHaveBeenCalledWith({ user: undefined, password: undefined, connectString: undefined });
  });

  test('si el driver falla registra db_connect_failed sin credenciales y relanza el mismo error', async () => {
    const error = Object.assign(new Error('ORA-12541: TNS:no listener'), { errorNum: 12541 });
    oracledb.getConnection.mockRejectedValue(error);

    await expect(getConnection()).rejects.toBe(error);

    const lineas = console.error.mock.calls.map(([linea]) => linea);
    expect(lineas.map((linea) => JSON.parse(linea))).toEqual([
      { event: 'db_connect_failed', error: { name: 'Error', message: 'ORA-12541: TNS:no listener', errorNum: 12541 } },
    ]);
    expect(lineas.join('')).not.toContain('clave-de-prueba');
  });
});
