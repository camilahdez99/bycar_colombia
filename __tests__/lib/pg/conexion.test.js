import { describe, expect, test, vi } from 'vitest';
import { ConexionPg } from '@/lib/pg/conexion';

/**
 * Cliente de pg falso: registra cada query y responde según `responder(texto)`.
 * Las sentencias de control (BEGIN, SAVEPOINT…) responden vacío salvo que `responder` diga otra cosa.
 */
function crearCliente(responder = () => ({ command: 'SELECT', fields: [], rows: [] })) {
  const queries = [];
  return {
    queries,
    query: vi.fn(async (texto, valores) => {
      queries.push(valores === undefined ? texto : [texto, valores]);
      const respuesta = responder(texto);
      if (respuesta instanceof Error) throw respuesta;
      return respuesta ?? { command: texto.split(' ')[0], fields: [], rows: [] };
    }),
    release: vi.fn(),
  };
}

const esControl = (texto) => /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(texto);

describe('ConexionPg.execute', () => {
  test('una consulta devuelve { rows } con las claves como en Oracle', async () => {
    const cliente = crearCliente(() => ({
      command: 'SELECT',
      fields: [{ name: 'id_mun' }, { name: 'nextId' }],
      rows: [{ id_mun: 5001, nextId: 2 }],
    }));
    const conexion = new ConexionPg(cliente);

    const resultado = await conexion.execute('SELECT ID_MUN, X as "nextId" FROM M WHERE A = :a', { a: 1 });

    expect(resultado).toEqual({ rows: [{ ID_MUN: 5001, nextId: 2 }] });
    expect(cliente.queries).toEqual([['SELECT ID_MUN, X as "nextId" FROM M WHERE A = $1', [1]]]);
  });

  test('INSERT/UPDATE/DELETE devuelven { rowsAffected }', async () => {
    const cliente = crearCliente(() => ({ command: 'UPDATE', fields: [], rows: [], rowCount: 0 }));
    const resultado = await new ConexionPg(cliente).execute('UPDATE T SET A = 1 WHERE ID = :id', { id: 9 });
    expect(resultado).toEqual({ rowsAffected: 0 });
  });

  test('sin binds pasa un arreglo vacío', async () => {
    const cliente = crearCliente();
    await new ConexionPg(cliente).execute('SELECT 1');
    expect(cliente.queries).toEqual([['SELECT 1', []]]);
  });

  test('con autoCommit (por defecto) no abre transacción', async () => {
    const cliente = crearCliente();
    await new ConexionPg(cliente).execute('INSERT INTO T VALUES (:a)', { a: 1 }, { autoCommit: true });
    expect(cliente.queries.filter((q) => typeof q === 'string')).toEqual([]);
  });

  test('autoCommit=false abre la transacción y commit la confirma, con savepoint por sentencia', async () => {
    const cliente = crearCliente();
    const conexion = new ConexionPg(cliente);

    await conexion.execute('INSERT INTO A VALUES (:a)', { a: 1 }, { autoCommit: false });
    await conexion.execute('INSERT INTO B VALUES (:b)', { b: 2 }, { autoCommit: false });
    await conexion.commit();

    expect(cliente.queries).toEqual([
      'BEGIN',
      'SAVEPOINT bycar_sentencia', ['INSERT INTO A VALUES ($1)', [1]], 'RELEASE SAVEPOINT bycar_sentencia',
      'SAVEPOINT bycar_sentencia', ['INSERT INTO B VALUES ($1)', [2]], 'RELEASE SAVEPOINT bycar_sentencia',
      'COMMIT',
    ]);
  });

  test('una sentencia con autoCommit dentro de la transacción la confirma entera, como oracledb', async () => {
    const cliente = crearCliente();
    const conexion = new ConexionPg(cliente);

    await conexion.execute('INSERT INTO A VALUES (1)', {}, { autoCommit: false });
    await conexion.execute('INSERT INTO B VALUES (2)', {}, { autoCommit: true });

    expect(cliente.queries.filter((q) => typeof q === 'string').at(-1)).toBe('COMMIT');
    expect(conexion.enTransaccion).toBe(false);
  });

  test('un error dentro de la transacción deshace solo esa sentencia y la transacción sigue', async () => {
    const duplicado = Object.assign(new Error('duplicate key value violates unique constraint "pk_permisos"'), { code: '23505' });
    const cliente = crearCliente((texto) => (texto.startsWith('INSERT INTO PERMISOS') ? duplicado : undefined));
    const conexion = new ConexionPg(cliente);

    await conexion.execute('INSERT INTO MENUS VALUES (1)', {}, { autoCommit: false });
    await expect(conexion.execute('INSERT INTO PERMISOS VALUES (1, 1)', {}, { autoCommit: false })).rejects.toBe(duplicado);
    await conexion.commit();

    expect(cliente.queries.filter((q) => typeof q === 'string' && esControl(q))).toEqual([
      'BEGIN',
      'SAVEPOINT bycar_sentencia', 'RELEASE SAVEPOINT bycar_sentencia',
      'SAVEPOINT bycar_sentencia', 'ROLLBACK TO SAVEPOINT bycar_sentencia',
      'COMMIT',
    ]);
  });

  test('a los errores de Postgres les agrega el errorNum de Oracle equivalente', async () => {
    const error = Object.assign(new Error('duplicate key'), { code: '23505' });
    const conexion = new ConexionPg(crearCliente(() => error));

    await expect(conexion.execute('INSERT INTO T VALUES (1)')).rejects.toMatchObject({ errorNum: 1, code: '23505' });
  });

  test('un error sin equivalente se relanza sin errorNum', async () => {
    const error = Object.assign(new Error('relation "x" does not exist'), { code: '42P01' });
    const conexion = new ConexionPg(crearCliente(() => error));

    const rechazo = await conexion.execute('SELECT * FROM X').catch((e) => e);
    expect(rechazo).toBe(error);
    expect(rechazo).not.toHaveProperty('errorNum');
  });

  test('autoCommit=false como opción de la conexión deja todo en una transacción', async () => {
    const cliente = crearCliente();
    const conexion = new ConexionPg(cliente, { autoCommit: false });

    await conexion.execute('SET TRANSACTION READ ONLY');
    await conexion.execute('SELECT 1');
    await conexion.rollback();

    // SET TRANSACTION va sin savepoint: Postgres descarta READ ONLY al liberar un savepoint
    expect(cliente.queries).toEqual([
      'BEGIN',
      ['SET TRANSACTION READ ONLY', []],
      'SAVEPOINT bycar_sentencia', ['SELECT 1', []], 'RELEASE SAVEPOINT bycar_sentencia',
      'ROLLBACK',
    ]);
  });
});

describe('ConexionPg commit/rollback/close', () => {
  test('commit y rollback sin transacción abierta no hacen nada', async () => {
    const cliente = crearCliente();
    const conexion = new ConexionPg(cliente);
    await conexion.commit();
    await conexion.rollback();
    expect(cliente.query).not.toHaveBeenCalled();
  });

  test('close descarta lo no confirmado y devuelve el cliente al pool', async () => {
    const cliente = crearCliente();
    const conexion = new ConexionPg(cliente);
    await conexion.execute('INSERT INTO T VALUES (1)', {}, { autoCommit: false });

    await conexion.close();

    expect(cliente.queries.at(-1)).toBe('ROLLBACK');
    expect(cliente.release).toHaveBeenCalledWith(undefined);
  });

  test('si el rollback al cerrar falla, el cliente se descarta y el error se propaga', async () => {
    const caida = new Error('Connection terminated');
    const cliente = crearCliente((texto) => (texto === 'ROLLBACK' ? caida : undefined));
    const conexion = new ConexionPg(cliente);
    await conexion.execute('INSERT INTO T VALUES (1)', {}, { autoCommit: false });

    await expect(conexion.close()).rejects.toBe(caida);
    expect(cliente.release).toHaveBeenCalledWith(caida);
  });
});
