// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST, PUT } from '@/app/api/admin/tablas/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/tablas';

// Respuestas falsas de los diccionarios de Oracle (user_constraints / user_tab_columns)
const pk = (columna) => ({ rows: columna ? [{ COLUMN_NAME: columna }] : [] });
const columnas = (...defs) => ({
  rows: defs.map(([COLUMN_NAME, DATA_TYPE, NULLABLE = 'Y']) => ({ COLUMN_NAME, DATA_TYPE, NULLABLE })),
});
const COLS_VIAJES = columnas(
  ['ID_VIA', 'NUMBER', 'N'],
  ['CUPOS_DISPONIBLES_VIA', 'NUMBER'],
  ['TIEMPO_SALIDA_VIA', 'DATE'],
  ['CREADO_VIA', 'TIMESTAMP(6)'],
  ['NOTA_VIA', 'VARCHAR2'],
);
const COLS_MENUS = columnas(['ID_ENU', 'NUMBER', 'N'], ['CAMPO_ENU', 'VARCHAR2'], ['URL_ENU', 'VARCHAR2']);

const get = (query) => GET(makeRequest(RUTA, { query }));
const post = (query, body) => POST(makeRequest(RUTA, { method: 'POST', query, body }));
const put = (query, body) => PUT(makeRequest(RUTA, { method: 'PUT', query, body }));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/tablas (caracterización)', () => {
  test('list: devuelve solo los nombres de user_tables (ignora tabla)', async () => {
    const conn = createFakeConnection([{ rows: [{ TABLE_NAME: 'MENUS' }, { TABLE_NAME: 'USUARIOS' }] }]);
    getConnection.mockResolvedValue(conn);

    expect(await readResponse(await get({ list: '1', tabla: 'no válida!' }))).toEqual({
      status: 200,
      body: ['MENUS', 'USUARIOS'],
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('400 si falta tabla (la conexión ya se abrió y se cierra)', async () => {
    const conn = createFakeConnection();
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({}))).toEqual({ status: 400, body: { error: 'tabla requerida' } });
    expect(conn.execute).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con nombre de tabla inválido (sanitizeTable dentro del try en GET)', async () => {
    const conn = createFakeConnection();
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ tabla: 'USUARIOS; DROP TABLE X' }))).toEqual({
      status: 500,
      body: { error: 'Nombre de tabla inválido' },
    });
    expect(conn.execute).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('metadata=true: devuelve las columnas de user_tab_columns (nombre en mayúsculas)', async () => {
    const conn = createFakeConnection([COLS_MENUS]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ tabla: 'menus', metadata: 'true' }))).toEqual({
      status: 200,
      body: COLS_MENUS.rows,
    });
    expect(conn.calls).toMatchSnapshot();
  });

  test('sin id: SELECT * de la tabla completa (comportamiento actual: sin autenticación, expone contraseñas)', async () => {
    const rows = [{ ID_USU: 1, CORREO_USU: 'a@x.co', CONTRASENA_USU: 'plano' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ tabla: 'usuarios' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
  });

  test('con id: busca la PK y filtra por ella con id numérico', async () => {
    const rows = [{ ID_ENU: 3, CAMPO_ENU: 'Viajes' }];
    const conn = createFakeConnection([pk('ID_ENU'), { rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ tabla: 'MENUS', id: '3' }))).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
  });

  test('con id en tabla sin PK: arma "WHERE undefined = :id" (comportamiento actual)', async () => {
    const conn = createFakeConnection([pk(null), { rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ tabla: 'LOGS', id: '1' });
    expect(conn.calls[1].sql).toBe('SELECT * FROM LOGS WHERE undefined = :id');
  });

  test('con id no numérico: se bindea NaN (comportamiento actual: rompe PK de texto como PLACA_VEH)', async () => {
    const conn = createFakeConnection([pk('PLACA_VEH'), { rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ tabla: 'VEHICULOS', id: 'ABC123' });
    expect(conn.calls[1].binds).toEqual({ id: NaN });
  });

  test('500 con el mensaje de Oracle si falla la consulta', async () => {
    const conn = createFakeConnection([new Error('ORA-00942: table or view does not exist')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get({ tabla: 'NOEXISTE' }))).toEqual({
      status: 500,
      body: { error: 'ORA-00942: table or view does not exist' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si no hay conexión', async () => {
    getConnection.mockRejectedValue(new Error('sin red'));
    expect(await readResponse(await get({ tabla: 'MENUS' }))).toEqual({ status: 500, body: { error: 'sin red' } });
  });

  test('si close() falla, la promesa se rechaza (close sin try)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    await expect(get({ tabla: 'MENUS' })).rejects.toThrow('close');
  });
});

describe('POST /api/admin/tablas (caracterización)', () => {
  test('400 si falta tabla', async () => {
    expect(await readResponse(await post({}, { a: 1 }))).toEqual({ status: 400, body: { error: 'tabla requerida' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('nombre inválido: la promesa se rechaza (sanitizeTable fuera del try)', async () => {
    await expect(post({ tabla: 'A-B' }, { a: 1 })).rejects.toThrow('Nombre de tabla inválido');
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('JSON inválido: la promesa se rechaza (req.json fuera del try)', async () => {
    await expect(post({ tabla: 'VIAJES' }, '{no json')).rejects.toThrow();
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: filtra columnas contra la metadata, omite vacíos y convierte DATE/TIMESTAMP', async () => {
    const conn = createFakeConnection([COLS_VIAJES, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);

    const res = await readResponse(
      await post(
        { tabla: 'viajes' },
        {
          id_via: 10,
          CUPOS_DISPONIBLES_VIA: 3,
          tiempo_salida_via: '2026-01-02T03:04:05.000Z',
          CREADO_VIA: '2026-01-01T00:00:00.000Z',
          NOTA_VIA: '',
          COLUMNA_INEXISTENTE: 'x',
        },
      ),
    );

    expect(res).toEqual({ status: 201, body: { ok: true } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.calls[1].binds.tiempo_salida_via).toBeInstanceOf(Date);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('sin columnas válidas: arma "INSERT ... () VALUES ()" y lo ejecuta igual (comportamiento actual)', async () => {
    const conn = createFakeConnection([COLS_VIAJES, { rowsAffected: 0 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ tabla: 'VIAJES' }, { OTRA: 1 }))).status).toBe(201);
    expect(conn.calls[1].sql).toMatch(/INSERT INTO VIAJES\s+\(\)\s+VALUES \(\)/);
  });

  test('MENUS con ID_ENU: inserta sin autoCommit, da permiso a todos los usuarios y hace commit', async () => {
    const conn = createFakeConnection([
      COLS_MENUS,
      { rowsAffected: 1 },
      { rows: [{ ID_USU: 1 }, { ID_USU: 2 }] },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);

    const res = await readResponse(await post({ tabla: 'MENUS' }, { id_enu: '9', CAMPO_ENU: 'Nuevo', URL_ENU: '/n' }));

    expect(res).toEqual({ status: 201, body: { ok: true } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.commit).toHaveBeenCalledOnce();
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  test('MENUS: si falla un permiso se loguea y sigue; igual hace commit', async () => {
    const conn = createFakeConnection([
      COLS_MENUS,
      { rowsAffected: 1 },
      { rows: [{ ID_USU: 1 }, { ID_USU: 2 }] },
      new Error('ORA-00001'),
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ tabla: 'MENUS' }, { ID_ENU: 9 }))).status).toBe(201);
    expect(conn.execute).toHaveBeenCalledTimes(5);
    expect(conn.commit).toHaveBeenCalledOnce();
  });

  test('MENUS sin ID_ENU: no hace commit ni asigna permisos (comportamiento actual: el INSERT queda sin confirmar)', async () => {
    const conn = createFakeConnection([COLS_MENUS, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ tabla: 'MENUS' }, { ID_ENU: '', CAMPO_ENU: 'X' }))).toEqual({
      status: 201,
      body: { ok: true },
    });
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.calls[1].options).toEqual({ autoCommit: false });
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con rollback si falla el INSERT en MENUS', async () => {
    const conn = createFakeConnection([COLS_MENUS, new Error('ORA-01400')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ tabla: 'MENUS' }, { ID_ENU: 1 }))).toEqual({
      status: 500,
      body: { error: 'ORA-01400' },
    });
    expect(conn.rollback).toHaveBeenCalledOnce();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 sin rollback si falla el INSERT en otra tabla', async () => {
    const conn = createFakeConnection([COLS_VIAJES, new Error('ORA-02291')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ tabla: 'VIAJES' }, { ID_VIA: 1 }))).toEqual({
      status: 500,
      body: { error: 'ORA-02291' },
    });
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  test('si close() falla, la promesa se rechaza (close sin try)', async () => {
    const conn = createFakeConnection([COLS_VIAJES, { rowsAffected: 1 }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    await expect(post({ tabla: 'VIAJES' }, { ID_VIA: 1 })).rejects.toThrow('close');
  });
});

describe('PUT /api/admin/tablas (caracterización)', () => {
  test.each([
    ['tabla', { id: '1' }],
    ['id', { tabla: 'VIAJES' }],
  ])('400 si falta %s', async (_campo, query) => {
    expect(await readResponse(await put(query, {}))).toEqual({ status: 400, body: { error: 'tabla e id requeridos' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('nombre inválido: la promesa se rechaza (sanitizeTable fuera del try)', async () => {
    await expect(put({ tabla: 'x y', id: '1' }, {})).rejects.toThrow('Nombre de tabla inválido');
  });

  test('JSON inválido: la promesa se rechaza (req.json fuera del try)', async () => {
    await expect(put({ tabla: 'VIAJES', id: '1' }, '{no json')).rejects.toThrow();
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: excluye la PK y columnas desconocidas, "" pasa a null, fechas a Date, id queda string', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), COLS_VIAJES, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);

    const res = await readResponse(
      await put(
        { tabla: 'viajes', id: '10' },
        {
          ID_VIA: 99,
          cupos_disponibles_via: 2,
          TIEMPO_SALIDA_VIA: '2026-01-02T03:04:05.000Z',
          NOTA_VIA: '',
          OTRA: 'x',
        },
      ),
    );

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('sin columnas válidas: arma "SET  WHERE" y lo ejecuta igual (comportamiento actual)', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), COLS_VIAJES, { rowsAffected: 0 }]);
    getConnection.mockResolvedValue(conn);
    await put({ tabla: 'VIAJES', id: '1' }, { ID_VIA: 2 });
    expect(conn.calls[2].sql).toMatch(/UPDATE VIAJES\s+SET \s+WHERE ID_VIA = :id/);
  });

  test('500 con el mensaje de Oracle si falla el UPDATE', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), COLS_VIAJES, new Error('ORA-01722')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ tabla: 'VIAJES', id: '1' }, { NOTA_VIA: 'a' }))).toEqual({
      status: 500,
      body: { error: 'ORA-01722' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla, la promesa se rechaza (close sin try)', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), COLS_VIAJES, { rowsAffected: 1 }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    await expect(put({ tabla: 'VIAJES', id: '1' }, { NOTA_VIA: 'a' })).rejects.toThrow('close');
  });
});

describe('DELETE /api/admin/tablas (caracterización)', () => {
  test.each([
    ['tabla', { id: '1' }],
    ['id', { tabla: 'VIAJES' }],
  ])('400 si falta %s', async (_campo, query) => {
    expect(await readResponse(await del(query))).toEqual({ status: 400, body: { error: 'tabla e id requeridos' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('nombre inválido: la promesa se rechaza (sanitizeTable fuera del try)', async () => {
    await expect(del({ tabla: 'a.b', id: '1' })).rejects.toThrow('Nombre de tabla inválido');
  });

  test('200: borra por PK con id numérico y autoCommit (comportamiento actual: sin autenticación)', async () => {
    const conn = createFakeConnection([pk('ID_USU'), { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ tabla: 'usuarios', id: '7' }))).toEqual({ status: 200, body: { ok: true } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('PK compuesta: usa solo la primera columna (comportamiento actual: puede borrar varias filas)', async () => {
    const conn = createFakeConnection([
      { rows: [{ COLUMN_NAME: 'USUARIO_ID_USU' }, { COLUMN_NAME: 'MENU_ID_ENU' }] },
      { rowsAffected: 5 },
    ]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await del({ tabla: 'PERMISOS', id: '1' }))).status).toBe(200);
    expect(conn.calls[1].sql).toMatch(/DELETE FROM PERMISOS\s+WHERE USUARIO_ID_USU = :id/);
  });

  test('200 aunque no se borre ninguna fila', async () => {
    getConnection.mockResolvedValue(createFakeConnection([pk('ID_VIA'), { rowsAffected: 0 }]));
    expect((await readResponse(await del({ tabla: 'VIAJES', id: '404' }))).status).toBe(200);
  });

  test('500 con el mensaje de Oracle si falla el DELETE', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), new Error('ORA-02292')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ tabla: 'VIAJES', id: '1' }))).toEqual({
      status: 500,
      body: { error: 'ORA-02292' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla, la promesa se rechaza (close sin try)', async () => {
    const conn = createFakeConnection([pk('ID_VIA'), { rowsAffected: 1 }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    await expect(del({ tabla: 'VIAJES', id: '1' })).rejects.toThrow('close');
  });
});
