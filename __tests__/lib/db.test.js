import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Nunca se abre una conexión real: el driver se reemplaza entero
const pg = vi.hoisted(() => {
  const pools = [];
  class Pool {
    constructor(config) {
      this.config = config;
      this.handlers = {};
      this.connect = vi.fn();
      pools.push(this);
    }
    on(evento, handler) {
      this.handlers[evento] = handler;
    }
  }
  return {
    pools,
    Pool,
    types: {
      builtins: { INT8: 20, NUMERIC: 1700, TEXT: 25 },
      getTypeParser: vi.fn(() => 'parser-por-defecto'),
    },
  };
});
vi.mock('pg', () => ({ default: pg }));

const { getConnection } = await import('@/lib/db');
const { ConexionPg } = await import('@/lib/pg/conexion');

const ENV = { DATABASE_URL: 'postgresql://usuario_test:clave-de-prueba@localhost:5432/postgres' };

function poolActual() {
  return pg.pools.at(-1);
}

beforeEach(() => {
  delete globalThis.__bycarPgPool;
  pg.pools.length = 0;
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete globalThis.__bycarPgPool;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('lib/db', () => {
  test('crea un único pool con DATABASE_URL y 5 conexiones por defecto', async () => {
    await getConnection().catch(() => {});
    await getConnection().catch(() => {});

    expect(pg.pools).toHaveLength(1);
    expect(poolActual().config).toMatchObject({ connectionString: ENV.DATABASE_URL, max: 5 });
  });

  test('DB_POOL_MAX cambia el tamaño del pool; un valor inválido usa el de por defecto', async () => {
    vi.stubEnv('DB_POOL_MAX', '12');
    await getConnection().catch(() => {});
    expect(poolActual().config.max).toBe(12);

    delete globalThis.__bycarPgPool;
    vi.stubEnv('DB_POOL_MAX', 'muchas');
    await getConnection().catch(() => {});
    expect(poolActual().config.max).toBe(5);
  });

  test('BIGINT y NUMERIC llegan como número, como NUMBER en Oracle; el resto usa el parser de pg', async () => {
    await getConnection().catch(() => {});
    const { types } = poolActual().config;

    expect(types.getTypeParser(20)('1733000000000')).toBe(1733000000000);
    expect(types.getTypeParser(1700)('15000.50')).toBe(15000.5);
    expect(types.getTypeParser(1700)(null)).toBeNull();
    expect(types.getTypeParser(25)).toBe('parser-por-defecto');
  });

  test('cada cliente nuevo fija la zona horaria de Colombia, o la de DB_TIMEZONE', async () => {
    const cliente = { query: vi.fn(async () => ({})) };
    await getConnection().catch(() => {});
    poolActual().handlers.connect(cliente);
    expect(cliente.query).toHaveBeenCalledWith(`SELECT set_config('TimeZone', $1, false)`, ['America/Bogota']);

    delete globalThis.__bycarPgPool;
    vi.stubEnv('DB_TIMEZONE', 'UTC');
    await getConnection().catch(() => {});
    poolActual().handlers.connect(cliente);
    expect(cliente.query).toHaveBeenLastCalledWith(expect.any(String), ['UTC']);
  });

  test('si fijar la zona horaria falla lo registra sin tumbar el proceso', async () => {
    const cliente = { query: vi.fn(async () => { throw new Error('invalid value for parameter "TimeZone"'); }) };
    await getConnection().catch(() => {});

    poolActual().handlers.connect(cliente);
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(JSON.parse(console.error.mock.calls[0][0])).toMatchObject({ event: 'db_timezone_failed' });
  });

  test('un error de un cliente inactivo del pool se registra', async () => {
    await getConnection().catch(() => {});
    poolActual().handlers.error(new Error('Connection terminated unexpectedly'));
    expect(JSON.parse(console.error.mock.calls[0][0])).toMatchObject({ event: 'db_pool_error' });
  });

  test('getConnection envuelve el cliente del pool con autoCommit por defecto', async () => {
    const cliente = { query: vi.fn(), release: vi.fn() };
    await getConnection().catch(() => {});
    poolActual().connect.mockResolvedValue(cliente);

    const conexion = await getConnection();

    expect(conexion).toBeInstanceOf(ConexionPg);
    expect(conexion.cliente).toBe(cliente);
    expect(conexion.autoCommitPorDefecto).toBe(true);
    expect((await getConnection({ autoCommit: false })).autoCommitPorDefecto).toBe(false);
  });

  test('si el pool no conecta registra db_connect_failed sin credenciales y relanza el mismo error', async () => {
    await getConnection().catch(() => {});
    console.error.mockClear();
    const error = Object.assign(new Error('password authentication failed for user "usuario_test"'), { code: '28P01' });
    poolActual().connect.mockRejectedValue(error);

    await expect(getConnection()).rejects.toBe(error);

    const lineas = console.error.mock.calls.map(([linea]) => linea);
    expect(lineas.map((linea) => JSON.parse(linea))).toEqual([
      { event: 'db_connect_failed', error: { name: 'Error', message: 'password authentication failed for user "usuario_test"', code: '28P01' } },
    ]);
    expect(lineas.join('')).not.toContain('clave-de-prueba');
  });
});
