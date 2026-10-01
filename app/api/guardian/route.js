import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { mensajeDeError } from '@/lib/api/errores';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership, requireSelf } from '@/lib/auth/ownership';
import { findUserEmail, isGuardianParticipant, isViajeParticipant } from '@/lib/auth/ownershipQueries';
import { TIEMPO_GUARDIAN_POR_DEFECTO_MIN } from '@/lib/domain/constantes';
import { JSON_INVALIDO, badRequest, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { enteroPositivo, textoNoVacio } from '@/lib/domain/validadores';

const MENSAJE_TIEMPO_INVALIDO = 'El tiempo debe ser un número entero de minutos mayor a 0';

// Sin filas afectadas el guardián no existe (BUGS F19)
const guardianNoEncontrado = () => NextResponse.json({ error: 'Guardián no encontrado' }, { status: 404 });

// El correo del contacto de confianza se compara igual que en la query: sin distinguir mayúsculas
const sameEmail = (a, b) => a !== null && b !== null && String(a).toUpperCase() === String(b).toUpperCase();

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const usuarioId = searchParams.get('usuarioId');

    // Se valida antes de abrir la conexión (BUGS E5)
    if (!email && !usuarioId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    connection = await getConnection();

    if (email) {
      const notOwner = await checkOwnership(req, async (userId) =>
        sameEmail(await findUserEmail(connection, userId), email)
      );
      if (notOwner) return notOwner;

      // Buscar alertas para este guardián
      const sql = `
        SELECT g.ID_GUA as "id", 
               g.EMAIL_CONFIANZA_GUA as "email",
               es.ESTADO_EST_GUA as "estado",
               TO_CHAR(g.FECHA_INICIO_GUA, 'YYYY-MM-DD HH24:MI:SS') as "inicio",
               mo.NOMBRE_MUN as "origen",
               md.NOMBRE_MUN as "destino",
               COALESCE(
                 (SELECT u_pas.NOMBRE_USU || ' ' || u_pas.APELLIDO_USU 
                  FROM SOLICITUDES s 
                  JOIN USUARIOS u_pas ON s.USUARIOS_ID_USU = u_pas.ID_USU 
                  WHERE s.VIAJES_ID_VIA = v.ID_VIA AND s.ESTADO_ID_EST = 2 AND ROWNUM = 1),
                 u.NOMBRE_USU || ' ' || u.APELLIDO_USU
               ) as "pasajero",
               vh.PLACA_VEH as "placa",
               m.NOMBRE_MAR as "carro",
               u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "conductor",
               g.TIEMPO_ESTIMADO_GUA as "tiempo"
        FROM GUARDIANES g
        JOIN VIAJES v ON g.VIAJES_ID_VIA = v.ID_VIA
        JOIN ESTADOS_GUA es ON g.ESTADO_ID_EST = es.ID_EST_GUA
        JOIN USUARIOS u ON v.USUARIOS_ID_USU = u.ID_USU
        JOIN VEHICULOS vh ON v.VEHICULO_PLACA_VEH = vh.PLACA_VEH
        JOIN MARCAS m ON vh.MARCA_ID_MAR = m.ID_MAR
        JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
        JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
        WHERE UPPER(g.EMAIL_CONFIANZA_GUA) = UPPER(:email) AND g.ESTADO_ID_EST != 2
      `;
      // Estado 2 asume Inactivo/Finalizado según el seed script
      const result = await connection.execute(sql, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return NextResponse.json(result.rows || [], { status: 200 });
    }

    if (usuarioId) {
      const notOwner = await requireSelf(req, usuarioId);
      if (notOwner) return notOwner;

      // Buscar el guardián activo del propio usuario (conductor/creador o pasajero con solicitud aceptada)
      const sql = `
        SELECT g.ID_GUA as "id", 
               g.EMAIL_CONFIANZA_GUA as "email",
               es.ESTADO_EST_GUA as "estado",
               TO_CHAR(g.FECHA_INICIO_GUA, 'YYYY-MM-DD HH24:MI:SS') as "inicio",
               mo.NOMBRE_MUN as "origen",
               md.NOMBRE_MUN as "destino",
               u_cond.NOMBRE_USU || ' ' || u_cond.APELLIDO_USU as "conductor",
               vh.PLACA_VEH as "placa",
               m.NOMBRE_MAR as "carro",
               g.TIEMPO_ESTIMADO_GUA as "tiempoMin",
               v.ID_VIA as "viajeId"
        FROM GUARDIANES g
        JOIN VIAJES v ON g.VIAJES_ID_VIA = v.ID_VIA
        JOIN ESTADOS_GUA es ON g.ESTADO_ID_EST = es.ID_EST_GUA
        JOIN USUARIOS u_cond ON v.USUARIOS_ID_USU = u_cond.ID_USU
        JOIN VEHICULOS vh ON v.VEHICULO_PLACA_VEH = vh.PLACA_VEH
        JOIN MARCAS m ON vh.MARCA_ID_MAR = m.ID_MAR
        JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
        JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
        JOIN SOLICITUDES s ON s.VIAJES_ID_VIA = v.ID_VIA AND s.ESTADO_ID_EST = 2
        WHERE s.USUARIOS_ID_USU = :usuarioId AND g.ESTADO_ID_EST != 2
      `;
      const result = await connection.execute(sql, { usuarioId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return NextResponse.json(result.rows?.[0] || null, { status: 200 });
    }
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/guardian', mensaje: 'Error en GET Guardian' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/guardian');
  }
}

export async function POST(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { viajeId, email, tiempo } = body ?? {};

    if (!viajeId || !email) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }
    if (!enteroPositivo(viajeId)) return badRequest('ID de viaje inválido');
    if (!textoNoVacio(email)) return badRequest('Correo de contacto inválido');
    // Sin tiempo (o con 0) se usa el tiempo por defecto, como antes; cualquier otro valor debe ser válido (BUGS F23)
    if (tiempo && !enteroPositivo(tiempo)) return badRequest(MENSAJE_TIEMPO_INVALIDO);

    connection = await getConnection();

    const notParticipant = await checkOwnership(req, (userId) => isViajeParticipant(connection, viajeId, userId));
    if (notParticipant) return notParticipant;

    // Validar que el correo del contacto exista en la plataforma (insensible a mayúsculas)
    const checkUserSql = `SELECT ID_USU FROM USUARIOS WHERE UPPER(CORREO_USU) = UPPER(:email)`;
    const userRes = await connection.execute(checkUserSql, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (!userRes.rows?.length) {
      return NextResponse.json({ error: 'El correo de contacto no corresponde a un usuario registrado en BYCAR' }, { status: 404 });
    }

    const idGua = Date.now();

    const sql = `
      INSERT INTO GUARDIANES (ID_GUA, EMAIL_CONFIANZA_GUA, FECHA_INICIO_GUA, VIAJES_ID_VIA, ESTADO_ID_EST, TIEMPO_ESTIMADO_GUA)
      VALUES (:idGua, :email, SYSTIMESTAMP, :viajeId, 1, :tiempo)
    `;
    // Estado 1 asume Activo/Iniciado

    await connection.execute(sql, {
      idGua: Number(idGua),
      viajeId: Number(viajeId),
      email,
      tiempo: Number(tiempo || TIEMPO_GUARDIAN_POR_DEFECTO_MIN)
    }, { autoCommit: true });

    return NextResponse.json({ message: 'Guardián activado', id: idGua }, { status: 201 });
  } catch (error) {
    logError('api_error', error, { route: 'POST /api/guardian', mensaje: 'Error en POST Guardian' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/guardian');
  }
}

export async function PUT(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { id, estado, extraTiempo } = body ?? {};
    // extraTiempo: null cuenta como ausente; antes sumaba 0 e ignoraba el estado (BUGS F22)
    const conExtraTiempo = extraTiempo !== undefined && extraTiempo !== null;

    // Se valida antes de abrir la conexión (BUGS E5)
    if (!conExtraTiempo && !estado) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }
    if (!enteroPositivo(id)) return badRequest('ID de guardián inválido');
    if (conExtraTiempo && !enteroPositivo(extraTiempo)) return badRequest(MENSAJE_TIEMPO_INVALIDO);
    if (!conExtraTiempo && !isNaN(estado) && !enteroPositivo(estado)) return badRequest('Estado inválido');

    connection = await getConnection();

    const notParticipant = await checkOwnership(req, (userId) => isGuardianParticipant(connection, id, userId));
    if (notParticipant) return notParticipant;

    if (conExtraTiempo) {
      const sql = `UPDATE GUARDIANES SET TIEMPO_ESTIMADO_GUA = TIEMPO_ESTIMADO_GUA + :extraTiempo WHERE ID_GUA = :id`;
      const result = await connection.execute(sql, { extraTiempo: Number(extraTiempo), id }, { autoCommit: true });
      if (result.rowsAffected === 0) return guardianNoEncontrado();
      return NextResponse.json({ message: 'Tiempo de viaje reajustado' });
    }

    let sql;
    let binds = { id };

    if (isNaN(estado)) {
      // Si el estado es un texto, buscar dinámicamente el ID en la BD
      sql = `
          UPDATE GUARDIANES 
          SET ESTADO_ID_EST = (
            SELECT ID_EST_GUA 
            FROM ESTADOS_GUA 
            WHERE UPPER(SUBSTR(ESTADO_EST_GUA, 1, 6)) = UPPER(SUBSTR(:estadoStr, 1, 6))
            AND ROWNUM = 1
          )
          WHERE ID_GUA = :id
        `;
      binds.estadoStr = estado;
    } else {
      // Si el frontend ya envió el ID numérico
      sql = `UPDATE GUARDIANES SET ESTADO_ID_EST = :estadoId WHERE ID_GUA = :id`;
      binds.estadoId = Number(estado);
    }

    const result = await connection.execute(sql, binds, { autoCommit: true });
    if (result.rowsAffected === 0) return guardianNoEncontrado();
    return NextResponse.json({ message: 'Estado actualizado' });
  } catch (error) {
    logError('api_error', error, { route: 'PUT /api/guardian', mensaje: 'Error en PUT Guardian' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'PUT /api/guardian');
  }
}
