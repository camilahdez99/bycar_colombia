import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';

async function getOrCreateMunicipio(connection, name) {
  if (!name) return 1;
  const cleanName = String(name).trim().toUpperCase();
  
  const idNum = parseInt(cleanName, 10);
  if (!isNaN(idNum)) {
    return idNum;
  }
  
  const res = await connection.execute(
    `SELECT ID_MUN FROM MUNICIPIOS WHERE UPPER(NOMBRE_MUN) = :cleanName`,
    { cleanName }
  );
  
  if (res.rows && res.rows.length > 0) {
    return res.rows[0].ID_MUN;
  }
  
  const maxRes = await connection.execute(`SELECT NVL(MAX(ID_MUN), 0) + 1 as "nextId" FROM MUNICIPIOS`);
  const nextId = maxRes.rows[0].nextId || 1;
  
  await connection.execute(
    `INSERT INTO MUNICIPIOS (ID_MUN, NOMBRE_MUN, DEPARTAMENTO_ID_DEP) VALUES (:nextId, :name, 1)`,
    { nextId, name: name.trim() },
    { autoCommit: true }
  );
  
  return nextId;
}

async function getOrCreateMarca(connection, carroInput) {
  if (!carroInput) return 1;
  
  const idNum = parseInt(carroInput, 10);
  if (!isNaN(idNum)) {
    return idNum;
  }

  const brandName = String(carroInput).trim().split(/\s+/)[0].toUpperCase();
  
  const res = await connection.execute(
    `SELECT ID_MAR FROM MARCAS WHERE UPPER(NOMBRE_MAR) = :brandName`,
    { brandName }
  );
  
  if (res.rows && res.rows.length > 0) {
    return res.rows[0].ID_MAR;
  }
  
  const fullRes = await connection.execute(
    `SELECT ID_MAR FROM MARCAS WHERE UPPER(NOMBRE_MAR) = :fullInput`,
    { fullInput: String(carroInput).trim().toUpperCase() }
  );
  
  if (fullRes.rows && fullRes.rows.length > 0) {
    return fullRes.rows[0].ID_MAR;
  }
  
  const maxRes = await connection.execute(`SELECT NVL(MAX(ID_MAR), 0) + 1 as "nextId" FROM MARCAS`);
  const nextId = maxRes.rows[0].nextId || 1;
  
  const formattedBrand = brandName.charAt(0) + brandName.slice(1).toLowerCase();
  await connection.execute(
    `INSERT INTO MARCAS (ID_MAR, NOMBRE_MAR) VALUES (:nextId, :formattedBrand)`,
    { nextId, formattedBrand },
    { autoCommit: true }
  );
  
  return nextId;
}

export async function GET(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const origenId = searchParams.get('origen');
    const destinoId = searchParams.get('destino');

    connection = await getConnection();

    let sql = `
      SELECT v.ID_VIA as "id", 
             mo.NOMBRE_MUN as "origen", 
             md.NOMBRE_MUN as "destino", 
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD') as "hora", 
             v.COSTO_PERSONA_VIA as "valor",
             v.COMENTARIOS_VIA as "comentarios", 
             v.CUPOS_DISPONIBLES_VIA as "puestos",
             u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "conductor",
             m.NOMBRE_MAR as "carro",
             vh.PLACA_VEH as "placa"
      FROM VIAJES v
      INNER JOIN USUARIOS u ON v.USUARIOS_ID_USU = u.ID_USU
      INNER JOIN VEHICULOS vh ON v.VEHICULO_PLACA_VEH = vh.PLACA_VEH
      INNER JOIN MARCAS m ON vh.MARCA_ID_MAR = m.ID_MAR
      INNER JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      INNER JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE v.ESTADO_VIA_ID_EST_VIA = 1 AND v.TIEMPO_SALIDA_VIA >= TRUNC(SYSDATE)
    `;

    const binds = {};
    if (origenId) {
      if (!isNaN(origenId)) {
        sql += ` AND v.MUNICIPIO_ORIGEN_ID = :origenId`;
        binds.origenId = Number(origenId);
      } else {
        sql += ` AND UPPER(mo.NOMBRE_MUN) = UPPER(:origenName)`;
        binds.origenName = origenId.trim();
      }
    }
    if (destinoId) {
      if (!isNaN(destinoId)) {
        sql += ` AND v.MUNICIPIOS_DESTINO_ID = :destinoId`;
        binds.destinoId = Number(destinoId);
      } else {
        sql += ` AND UPPER(md.NOMBRE_MUN) = UPPER(:destinoName)`;
        binds.destinoName = destinoId.trim();
      }
    }

    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener viajes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

export async function POST(req) {
  let connection;
  try {
    const body = await req.json();
    const { origen, destino, carro, placa, fecha, puestos, valor, comentarios, usuarioId } = body;

    if (!origen || !destino || !placa || !fecha || !puestos || !valor || !usuarioId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const cleanPlaca = placa.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
    const numPuestos = parseInt(puestos, 10);
    const cleanComentarios = comentarios ? String(comentarios).substring(0, 500) : null;

    connection = await getConnection();

    // Resolve or create Municipio IDs and Marca ID dynamically
    const origenId = await getOrCreateMunicipio(connection, origen);
    const destinoId = await getOrCreateMunicipio(connection, destino);
    const marcaId = await getOrCreateMarca(connection, carro);

    // 1. Verificar si el vehículo existe
    const checkVehiculo = await connection.execute(
      `SELECT PLACA_VEH FROM VEHICULOS WHERE PLACA_VEH = :cleanPlaca`,
      { cleanPlaca }
    );

    if (!checkVehiculo.rows || checkVehiculo.rows.length === 0) {
       await connection.execute(
         `INSERT INTO VEHICULOS (PLACA_VEH, CAPACIDAD_VEH, CONDUCTOR_ID_USU, MARCA_ID_MAR)
          VALUES (:cleanPlaca, :capacidad, :usuarioId, :marcaId)`,
         { cleanPlaca, capacidad: numPuestos, usuarioId, marcaId },
         { autoCommit: true }
       );
    }

    const idViaje = Date.now();
    const valorNum = parseFloat(String(valor).replace(/,/g, ''));

    // Estado 1 = Disponible
    const sql = `
      INSERT INTO VIAJES (ID_VIA, MUNICIPIO_ORIGEN_ID, MUNICIPIOS_DESTINO_ID, TIEMPO_SALIDA_VIA, CUPOS_DISPONIBLES_VIA, COSTO_PERSONA_VIA, COMENTARIOS_VIA, USUARIOS_ID_USU, VEHICULO_PLACA_VEH, ESTADO_VIA_ID_EST_VIA)
      VALUES (:idViaje, :origenId, :destinoId, TO_DATE(:fecha, 'YYYY-MM-DD'), :numPuestos, :valorNum, :cleanComentarios, :usuarioId, :cleanPlaca, 1)
    `;

    await connection.execute(sql, { idViaje, origenId, destinoId, fecha, numPuestos, valorNum, cleanComentarios, usuarioId, cleanPlaca }, { autoCommit: true });

    return NextResponse.json({ message: 'Viaje publicado correctamente', id: idViaje }, { status: 201 });
  } catch (error) {
    console.error('Error al publicar viaje:', error);
    return NextResponse.json({ error: 'Error BD: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
