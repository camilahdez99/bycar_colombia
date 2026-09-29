
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';

const sanitizeTable = (name) => {
  if (!/^[A-Z0-9_]+$/i.test(name)) {
    throw new Error('Nombre de tabla inválido');
  }

  return name.toUpperCase();
};

const getPrimaryKey = async (connection, tabla) => {
  const pkSql = `
    SELECT cols.column_name
    FROM user_constraints cons
    JOIN user_cons_columns cols
      ON cons.constraint_name = cols.constraint_name
    WHERE cons.constraint_type = 'P'
      AND cons.table_name = :tabla
  `;

  const res = await connection.execute(
    pkSql,
    { tabla },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return res.rows[0]?.COLUMN_NAME;
};

const getColumnsInfo = async (connection, tabla) => {
  const sql = `
    SELECT column_name, data_type, nullable
    FROM user_tab_columns
    WHERE table_name = :tabla
  `;

  const result = await connection.execute(
    sql,
    { tabla },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows;
};

export async function GET(req) {
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

      const result = await connection.execute(
        sql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

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

    if (metadata) {
      const cols = await getColumnsInfo(connection, t);
      return NextResponse.json(cols);
    }

    const id = searchParams.get('id');

    const sql = id
      ? `SELECT * FROM ${t} WHERE ${await getPrimaryKey(connection, t)} = :id`
      : `SELECT * FROM ${t}`;

    const result = await connection.execute(
      sql,
      id ? { id: Number(id) } : {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return NextResponse.json(result.rows);

  } catch (e) {
    console.error('Error API tablas:', e);

    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

export async function POST(req) {
  const { searchParams } = new URL(req.url);

  const tabla = searchParams.get('tabla');

  if (!tabla) {
    return NextResponse.json(
      { error: 'tabla requerida' },
      { status: 400 }
    );
  }

  const t = sanitizeTable(tabla);
  const data = await req.json();

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
            console.error('Error insertando permiso por defecto:', permError);
          }
        }
        await connection.commit();
      }
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
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error('POST tabla error:', e);

    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

export async function PUT(req) {
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
  const data = await req.json();

  let connection;

  try {
    connection = await getConnection();

    const pk = await getPrimaryKey(connection, t);

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

    const setClause = cols
      .map((c) => `${c.toUpperCase()} = :${c}`)
      .join(', ');

    const sql = `
      UPDATE ${t}
      SET ${setClause}
      WHERE ${pk} = :id
    `;

    await connection.execute(
      sql,
      bindData,
      { autoCommit: true }
    );

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error('PUT tabla error:', e);

    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

export async function DELETE(req) {
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

  let connection;

  try {
    connection = await getConnection();

    const pk = await getPrimaryKey(connection, t);

    const sql = `
      DELETE FROM ${t}
      WHERE ${pk} = :id
    `;

    await connection.execute(
      sql,
      { id: Number(id) },
      { autoCommit: true }
    );

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error('DELETE tabla error:', e);

    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

