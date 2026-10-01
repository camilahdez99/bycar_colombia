import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { mensajeDeError } from '@/lib/api/errores';
import { JSON_INVALIDO, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { authorize } from '@/lib/auth/guard';
import { ROLES } from '@/lib/auth/session';

/** Nombre de tabla en mayúsculas si es un identificador seguro para interpolar, o null. */
const sanitizeTable = (name) => (/^[A-Z0-9_]+$/i.test(name) ? name.toUpperCase() : null);

const invalidTableResponse = () =>
  NextResponse.json({ error: 'Nombre de tabla inválido' }, { status: 400 });

const ERROR_PK_COMPUESTA = 'La tabla tiene clave primaria compuesta: no se puede modificar por id';

const getPrimaryKeyColumns = async (connection, tabla) => {
  const pkSql = `
    SELECT cols.column_name
    FROM user_constraints cons
    JOIN user_cons_columns cols
      ON cons.constraint_name = cols.constraint_name
    WHERE cons.constraint_type = 'P'
      AND cons.table_name = :tabla
  `;

  const res = await connection.execute(pkSql, { tabla });

  return res.rows.map((row) => row.COLUMN_NAME);
};

// Con PK compuesta un único "id" no identifica una fila: PUT/DELETE afectarían varias (F11)
const compositeKeyResponse = () =>
  NextResponse.json({ error: ERROR_PK_COMPUESTA }, { status: 400 });

// Sin PK se armaba "WHERE undefined = :id" (BUGS F13)
const noPrimaryKeyResponse = () =>
  NextResponse.json({ error: 'La tabla no tiene clave primaria: no se puede operar por id' }, { status: 400 });

// Sin columnas válidas se armaba "INSERT … () VALUES ()" o un SET vacío (BUGS F15)
const noColumnsResponse = () =>
  NextResponse.json({ error: 'Ninguna columna del cuerpo coincide con la tabla' }, { status: 400 });

// rowsAffected = 0: el registro no existe (BUGS F19)
const notFoundResponse = () => NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

const getColumnsInfo = async (connection, tabla) => {
  const sql = `
    SELECT column_name, data_type, nullable
    FROM user_tab_columns
    WHERE table_name = :tabla
  `;

  const result = await connection.execute(sql, { tabla });

  return result.rows;
};

export async function GET(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const tabla = searchParams.get('tabla');
  const list = searchParams.get('list');
  const metadata = searchParams.get('metadata');

  let connection;

  try {
    connection = await getConnection();

    if (list) {
      const sql = `
        SELECT table_name
        FROM user_tables
        ORDER BY table_name
      `;

      const result = await connection.execute(sql, {});

      return NextResponse.json(
        result.rows.map((r) => r.TABLE_NAME)
      );
    }

    if (!tabla) {
      return NextResponse.json(
        { error: 'tabla requerida' },
        { status: 400 }
      );
    }

    const t = sanitizeTable(tabla);
    if (!t) return invalidTableResponse();

    if (metadata) {
      const cols = await getColumnsInfo(connection, t);
      return NextResponse.json(cols);
    }

    const id = searchParams.get('id');

    // Con PK compuesta, GET usa la primera columna (a diferencia de PUT/DELETE, que responden 400)
    const [pk] = id ? await getPrimaryKeyColumns(connection, t) : [];
    if (id && !pk) return noPrimaryKeyResponse();

    const sql = id
      ? `SELECT * FROM ${t} WHERE ${pk} = :id`
      : `SELECT * FROM ${t}`;

    // El id viaja como texto, igual que en PUT: Oracle lo convierte y las claves de texto (placa) funcionan (F14)
    const result = await connection.execute(sql, id ? { id } : {});

    return NextResponse.json(result.rows);

  } catch (e) {
    logError('api_error', e, { route: 'GET /api/admin/tablas', mensaje: 'Error API tablas' });

    return NextResponse.json(
      { error: mensajeDeError(e, 'Error interno del servidor') },
      { status: 500 }
    );

  } finally {
    await closeConnection(connection, 'GET /api/admin/tablas');
  }
}

export async function POST(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const tabla = searchParams.get('tabla');

  if (!tabla) {
    return NextResponse.json(
      { error: 'tabla requerida' },
      { status: 400 }
    );
  }

  const t = sanitizeTable(tabla);
  if (!t) return invalidTableResponse();
  const data = await readJson(req);
  if (data === JSON_INVALIDO) return invalidJsonResponse();

  let connection;

  try {
    connection = await getConnection();

    const colsInfo = await getColumnsInfo(connection, t);
    
    const bindData = {};
    const cols = [];
    for (const k of Object.keys(data)) {
      const info = colsInfo.find(c => c.COLUMN_NAME === k.toUpperCase());
      if (info) {
        if (data[k] === '') {
          continue; // omit empty fields so default values / sequences work
        }
        let val = data[k];
        if (info.DATA_TYPE.includes('DATE') || info.DATA_TYPE.includes('TIMESTAMP')) {
          val = new Date(val);
        }
        cols.push(k);
        bindData[k] = val;
      }
    }

    if (!cols.length) return noColumnsResponse();

    const placeholders = cols.map((c) => `:${c}`);

    const sql = `
      INSERT INTO ${t}
      (${cols.map((c) => c.toUpperCase()).join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    await connection.execute(
      sql,
      bindData,
      { autoCommit: t !== 'MENUS' }
    );

    if (t === 'MENUS') {
      const idKey = Object.keys(bindData).find(k => k.toUpperCase() === 'ID_ENU');
      const newMenuId = idKey ? bindData[idKey] : null;

      if (newMenuId) {
        const usersRes = await connection.execute(`SELECT ID_USU FROM USUARIOS`);
        for (const u of usersRes.rows) {
          try {
            await connection.execute(
              `INSERT INTO PERMISOS (USUARIO_ID_USU, MENU_ID_ENU) VALUES (:usuarioId, :menuId)`,
              { usuarioId: u.ID_USU, menuId: Number(newMenuId) },
              { autoCommit: false }
            );
          } catch (permError) {
            logError('permiso_por_defecto_fallido', permError, { route: 'POST /api/admin/tablas' });
          }
        }
      }
      // El INSERT en MENUS corre sin autoCommit: se confirma siempre, haya o no ID_ENU (BUGS F12)
      await connection.commit();
    }

    return NextResponse.json(
      { ok: true },
      { status: 201 }
    );

  } catch (e) {
    if (connection && t === 'MENUS') {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError('db_rollback_failed', rollbackError, { route: 'POST /api/admin/tablas' });
      }
    }
    logError('api_error', e, { route: 'POST /api/admin/tablas', mensaje: 'POST tabla error' });

    return NextResponse.json(
      { error: mensajeDeError(e, 'Error interno del servidor') },
      { status: 500 }
    );

  } finally {
    await closeConnection(connection, 'POST /api/admin/tablas');
  }
}

export async function PUT(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const tabla = searchParams.get('tabla');
  const id = searchParams.get('id');

  if (!tabla || !id) {
    return NextResponse.json(
      { error: 'tabla e id requeridos' },
      { status: 400 }
    );
  }

  const t = sanitizeTable(tabla);
  if (!t) return invalidTableResponse();
  const data = await readJson(req);
  if (data === JSON_INVALIDO) return invalidJsonResponse();

  let connection;

  try {
    connection = await getConnection();

    const pkColumns = await getPrimaryKeyColumns(connection, t);
    if (pkColumns.length > 1) return compositeKeyResponse();
    const [pk] = pkColumns;
    if (!pk) return noPrimaryKeyResponse();

    const colsInfo = await getColumnsInfo(connection, t);

    const bindData = { id }; // id string is fine, Oracle will cast
    const cols = [];
    for (const k of Object.keys(data)) {
      const info = colsInfo.find(c => c.COLUMN_NAME === k.toUpperCase());
      if (info && k.toUpperCase() !== pk) { // no actualizar la llave primaria
        let val = data[k];
        if (val === '') {
          val = null;
        } else if (info.DATA_TYPE.includes('DATE') || info.DATA_TYPE.includes('TIMESTAMP')) {
          val = new Date(val);
        }
        cols.push(k);
        bindData[k] = val;
      }
    }

    if (!cols.length) return noColumnsResponse();

    const setClause = cols
      .map((c) => `${c.toUpperCase()} = :${c}`)
      .join(', ');

    const sql = `
      UPDATE ${t}
      SET ${setClause}
      WHERE ${pk} = :id
    `;

    const result = await connection.execute(
      sql,
      bindData,
      { autoCommit: true }
    );
    if (result.rowsAffected === 0) return notFoundResponse();

    return NextResponse.json({ ok: true });

  } catch (e) {
    logError('api_error', e, { route: 'PUT /api/admin/tablas', mensaje: 'PUT tabla error' });

    return NextResponse.json(
      { error: mensajeDeError(e, 'Error interno del servidor') },
      { status: 500 }
    );

  } finally {
    await closeConnection(connection, 'PUT /api/admin/tablas');
  }
}

export async function DELETE(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const tabla = searchParams.get('tabla');
  const id = searchParams.get('id');

  if (!tabla || !id) {
    return NextResponse.json(
      { error: 'tabla e id requeridos' },
      { status: 400 }
    );
  }

  const t = sanitizeTable(tabla);
  if (!t) return invalidTableResponse();

  let connection;

  try {
    connection = await getConnection();

    const pkColumns = await getPrimaryKeyColumns(connection, t);
    if (pkColumns.length > 1) return compositeKeyResponse();
    const [pk] = pkColumns;
    if (!pk) return noPrimaryKeyResponse();

    const sql = `
      DELETE FROM ${t}
      WHERE ${pk} = :id
    `;

    // El id viaja como texto, igual que en PUT (F14)
    const result = await connection.execute(
      sql,
      { id },
      { autoCommit: true }
    );
    if (result.rowsAffected === 0) return notFoundResponse();

    return NextResponse.json({ ok: true });

  } catch (e) {
    logError('api_error', e, { route: 'DELETE /api/admin/tablas', mensaje: 'DELETE tabla error' });

    return NextResponse.json(
      { error: mensajeDeError(e, 'Error interno del servidor') },
      { status: 500 }
    );

  } finally {
    await closeConnection(connection, 'DELETE /api/admin/tablas');
  }
}

