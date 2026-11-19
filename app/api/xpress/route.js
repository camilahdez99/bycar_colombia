import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError, logInfo } from '@/lib/log';
import { mensajeDeError } from '@/lib/api/errores';
import { JSON_INVALIDO, badRequest, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership, requireSelf, sameUser } from '@/lib/auth/ownership';
import { findCargaParticipants } from '@/lib/auth/ownershipQueries';
import { ESTADO_VIAJE, ESTADO_XPRESS, RECEPTOR_NO_REGISTRADO, RECEPTOR_PROPIO } from '@/lib/domain/constantes';
import { correoValido, enteroPositivo } from '@/lib/domain/validadores';
import {
  ROL_XPRESS,
  puedeAceptarRutaPropia,
  resolverEstadoXpress,
  resolverModoCarga,
  rolesEnCarga,
  tieneRolParaEstado,
  transicionValida,
  validarDatosCarga,
  validarFechaXp,
} from '@/lib/domain/xpress';

const VISTAS = ['enviados', 'recibidos', 'conductor', 'disponibles'];

// Filtro de cada vista: son fragmentos fijos, nunca texto del cliente
const FILTRO_POR_VISTA = {
  enviados: 'c.USUARIO_EMISOR_US = :usuarioId',
  recibidos: 'c.USUARIO_RECEPTOR_US = :usuarioId',
  conductor: 'COALESCE(v.USUARIOS_ID_USU, c.CONDUCTOR_ID_USU) = :usuarioId',
  // Ruta propia, Pendiente, sin conductor y vigente; nunca las propias ni las que el usuario va a recibir
  disponibles: `c.VIAJE_ID IS NULL AND c.CONDUCTOR_ID_USU IS NULL AND c.ESTADO_ID_EST_XP = :pendiente
      AND (c.FECHA_XP IS NULL OR c.FECHA_XP >= CURRENT_DATE)
      AND c.USUARIO_EMISOR_US <> :usuarioId AND c.USUARIO_RECEPTOR_US <> :usuarioId`,
};

const cargaNoEncontrada = () => NextResponse.json({ error: 'Encomienda no encontrada' }, { status: 404 });
const noDisponible = () =>
  NextResponse.json({ error: 'La encomienda ya no está disponible. Actualiza la lista e intenta de nuevo.' }, { status: 409 });
const estadoCambio = () =>
  NextResponse.json({ error: 'La encomienda ya cambió de estado. Actualiza la lista e intenta de nuevo.' }, { status: 409 });

/** Cambia el estado de la carga ya cargada y autorizada; devuelve la respuesta HTTP. */
async function aplicarEstado(connection, carga, cargaId, estadoNuevo, route, mensajeOk) {
  if (!transicionValida(carga.estadoId, estadoNuevo)) {
    return NextResponse.json({ error: 'Esa encomienda no puede pasar a ese estado' }, { status: 409 });
  }
  // El estado actual va en el WHERE: si otro lo cambió mientras tanto, no se pisa
  const sql = `UPDATE CARGAS SET ESTADO_ID_EST_XP = :estadoNuevo WHERE ID_XP = :cargaId AND ESTADO_ID_EST_XP = :estadoActual`;
  const result = await connection.execute(
    sql,
    { estadoNuevo, cargaId: Number(cargaId), estadoActual: Number(carga.estadoId) },
    { autoCommit: true }
  );
  logInfo('xpress_estado', { route, cargaId, estadoNuevo, rowsAffected: result.rowsAffected });
  if (result.rowsAffected === 0) return estadoCambio();
  return NextResponse.json({ message: mensajeOk }, { status: 200 });
}

const SQL_INSERT_EN_VIAJE = `
  INSERT INTO CARGAS (ID_XP, DESCRIPCION_XP, PESO_XP, USUARIO_EMISOR_US, USUARIO_RECEPTOR_US, VIAJE_ID, ESTADO_ID_EST_XP, FECHA_CREACION_XP)
  VALUES (:idXp, :descripcion, :peso, :usuarioId, :receptorId, :viajeId, :estadoId, CURRENT_TIMESTAMP)
`;

const SQL_INSERT_RUTA_PROPIA = `
  INSERT INTO CARGAS (ID_XP, DESCRIPCION_XP, PESO_XP, USUARIO_EMISOR_US, USUARIO_RECEPTOR_US, ORIGEN_ID, DESTINO_ID, FECHA_XP, ESTADO_ID_EST_XP, FECHA_CREACION_XP)
  VALUES (:idXp, :descripcion, :peso, :usuarioId, :receptorId, :origenId, :destinoId, :fechaXp, :estadoId, CURRENT_TIMESTAMP)
`;

/** Modo A: el viaje existe, sigue vigente y el remitente no es su conductor. Devuelve la respuesta de error, o null. */
async function validarViaje(connection, viajeId, usuarioId) {
  const viajeRes = await connection.execute(
    `SELECT USUARIOS_ID_USU AS "conductorId", ESTADO_VIA_ID_EST_VIA AS "estadoId" FROM VIAJES WHERE ID_VIA = :viajeId`,
    { viajeId: Number(viajeId) }
  );
  const viaje = viajeRes.rows?.[0];
  if (!viaje) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  if ([ESTADO_VIAJE.FINALIZADO, ESTADO_VIAJE.CANCELADO].includes(Number(viaje.estadoId))) {
    return NextResponse.json({ error: 'El viaje ya no admite encomiendas' }, { status: 409 });
  }
  if (sameUser(viaje.conductorId, usuarioId)) {
    return badRequest('No puedes enviar una encomienda en tu propio viaje');
  }
  return null;
}

/** Modo B: origen y destino son municipios que existen. Devuelve la respuesta de error, o null. */
async function validarMunicipios(connection, origenId, destinoId) {
  const res = await connection.execute(
    `SELECT ID_MUN FROM MUNICIPIOS WHERE ID_MUN IN (:origenId, :destinoId)`,
    { origenId: Number(origenId), destinoId: Number(destinoId) }
  );
  if ((res.rows?.length ?? 0) < 2) return NextResponse.json({ error: 'Origen o destino no encontrado' }, { status: 404 });
  return null;
}

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');
    const vista = searchParams.get('vista') || 'enviados';
    const viajeId = searchParams.get('viajeId');

    // Se valida antes de abrir la conexión
    if (!usuarioId) return badRequest('Falta usuarioId');
    if (!enteroPositivo(usuarioId)) return badRequest('usuarioId inválido');
    if (!VISTAS.includes(vista)) return badRequest('Vista inválida');
    if (viajeId && (vista !== 'conductor' || !enteroPositivo(viajeId))) return badRequest('viajeId inválido');

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();

    const filtroViaje = viajeId ? ' AND c.VIAJE_ID = :viajeId' : '';
    const sql = `
      SELECT c.ID_XP AS "id",
             c.DESCRIPCION_XP AS "descripcion",
             c.PESO_XP AS "peso",
             c.ESTADO_ID_EST_XP AS "estadoId",
             es.ESTADO_EST_XP AS "estado",
             TO_CHAR(c.FECHA_CREACION_XP, 'YYYY-MM-DD HH24:MI') AS "fecha",
             v.ID_VIA AS "viajeId",
             mo.NOMBRE_MUN AS "origen",
             md.NOMBRE_MUN AS "destino",
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD HH24:MI') AS "salida",
             TO_CHAR(c.FECHA_XP, 'YYYY-MM-DD') AS "fechaXp",
             c.USUARIO_EMISOR_US AS "emisorId",
             ue.NOMBRE_USU || ' ' || ue.APELLIDO_USU AS "emisor",
             c.USUARIO_RECEPTOR_US AS "receptorId",
             ur.NOMBRE_USU || ' ' || ur.APELLIDO_USU AS "receptor",
             uc.ID_USU AS "conductorId",
             uc.NOMBRE_USU || ' ' || uc.APELLIDO_USU AS "conductor"
      FROM CARGAS c
      JOIN ESTADOS_XPRESS es ON c.ESTADO_ID_EST_XP = es.ID_EST_XP
      LEFT JOIN VIAJES v ON c.VIAJE_ID = v.ID_VIA
      JOIN MUNICIPIOS mo ON COALESCE(v.MUNICIPIO_ORIGEN_ID, c.ORIGEN_ID) = mo.ID_MUN
      JOIN MUNICIPIOS md ON COALESCE(v.MUNICIPIOS_DESTINO_ID, c.DESTINO_ID) = md.ID_MUN
      JOIN USUARIOS ue ON c.USUARIO_EMISOR_US = ue.ID_USU
      JOIN USUARIOS ur ON c.USUARIO_RECEPTOR_US = ur.ID_USU
      LEFT JOIN USUARIOS uc ON COALESCE(v.USUARIOS_ID_USU, c.CONDUCTOR_ID_USU) = uc.ID_USU
      WHERE ${FILTRO_POR_VISTA[vista]}${filtroViaje}
      ORDER BY c.FECHA_CREACION_XP DESC
    `;
    const binds = { usuarioId: Number(usuarioId) };
    if (viajeId) binds.viajeId = Number(viajeId);
    if (vista === 'disponibles') binds.pendiente = ESTADO_XPRESS.PENDIENTE;

    const result = await connection.execute(sql, binds);
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/xpress', mensaje: 'Error al obtener encomiendas' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error al obtener encomiendas') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/xpress');
  }
}

export async function POST(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { viajeId, origenId, destinoId, fechaXp, usuarioId, receptorEmail, descripcion, peso } = body ?? {};

    // Se valida antes de abrir la conexión
    if (!usuarioId || !receptorEmail) {
      return NextResponse.json({ error: 'Viaje, remitente y receptor son requeridos' }, { status: 400 });
    }
    const modo = resolverModoCarga({ viajeId, origenId, destinoId });
    if (modo.error) return badRequest(modo.error);
    if (!enteroPositivo(usuarioId)) return badRequest('ID de usuario inválido');
    const correo = correoValido(receptorEmail);
    if (!correo) return badRequest('Correo del receptor inválido');
    const datos = validarDatosCarga({ descripcion, peso });
    if (datos.error) return badRequest(datos.error);
    const fecha = modo.modo === 'ruta' ? validarFechaXp(fechaXp) : { fecha: null };
    if (fecha.error) return badRequest(fecha.error);

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();

    const falla = modo.modo === 'viaje'
      ? await validarViaje(connection, viajeId, usuarioId)
      : await validarMunicipios(connection, origenId, destinoId);
    if (falla) return falla;

    // El receptor debe ser un usuario de la plataforma (insensible a mayúsculas)
    const receptorRes = await connection.execute(
      `SELECT ID_USU FROM USUARIOS WHERE UPPER(CORREO_USU) = UPPER(:email)`,
      { email: correo }
    );
    if (!receptorRes.rows?.length) {
      return NextResponse.json(
        { error: RECEPTOR_NO_REGISTRADO.mensaje, codigo: RECEPTOR_NO_REGISTRADO.codigo },
        { status: 404 }
      );
    }
    const receptorId = receptorRes.rows[0].ID_USU;
    if (sameUser(receptorId, usuarioId)) {
      return NextResponse.json({ error: RECEPTOR_PROPIO.mensaje, codigo: RECEPTOR_PROPIO.codigo }, { status: 400 });
    }

    const idXp = Date.now();
    const base = {
      idXp,
      descripcion: datos.descripcion,
      peso: datos.peso,
      usuarioId: Number(usuarioId),
      receptorId: Number(receptorId),
      estadoId: ESTADO_XPRESS.PENDIENTE,
    };
    if (modo.modo === 'viaje') {
      await connection.execute(SQL_INSERT_EN_VIAJE, { ...base, viajeId: Number(viajeId) }, { autoCommit: true });
    } else {
      const binds = { ...base, origenId: Number(origenId), destinoId: Number(destinoId), fechaXp: fecha.fecha };
      await connection.execute(SQL_INSERT_RUTA_PROPIA, binds, { autoCommit: true });
    }
    logInfo('xpress_registrada', { route: 'POST /api/xpress', cargaId: idXp, modo: modo.modo });

    return NextResponse.json({ message: 'Encomienda registrada', id: idXp }, { status: 201 });
  } catch (error) {
    logError('api_error', error, { route: 'POST /api/xpress', mensaje: 'Error al registrar encomienda' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/xpress');
  }
}

/**
 * Un conductor acepta una encomienda de ruta propia: queda como su responsable y pasa a Aceptada.
 * Es lo único que hace un PUT con `aceptar: true`; `usuarioId` es el conductor que acepta.
 */
async function aceptarRutaPropia(req, { id, usuarioId, estado, descripcion }) {
  // Se valida antes de abrir la conexión
  if (!id) return NextResponse.json({ error: 'ID de encomienda requerido' }, { status: 400 });
  if (!enteroPositivo(id)) return badRequest('ID de encomienda inválido');
  if (!usuarioId) return badRequest('Falta usuarioId');
  if (!enteroPositivo(usuarioId)) return badRequest('ID de usuario inválido');
  if ((estado !== undefined && estado !== null) || descripcion !== undefined) {
    return badRequest('Aceptar una encomienda no se combina con otros cambios');
  }
  const notOwner = await requireSelf(req, usuarioId);
  if (notOwner) return notOwner;

  let connection;
  try {
    connection = await getConnection();
    const carga = await findCargaParticipants(connection, id);
    if (!carga) return cargaNoEncontrada();
    if (sameUser(usuarioId, carga.emisorId) || sameUser(usuarioId, carga.receptorId)) {
      return NextResponse.json({ error: 'No puedes aceptar una encomienda que enviaste o que vas a recibir' }, { status: 403 });
    }
    if (!puedeAceptarRutaPropia(usuarioId, carga)) return noDisponible();

    // Pendiente y sin conductor van en el WHERE: si otro conductor la aceptó antes, no se pisa
    const sql = `
      UPDATE CARGAS SET CONDUCTOR_ID_USU = :usuarioId, ESTADO_ID_EST_XP = :aceptada
      WHERE ID_XP = :cargaId AND VIAJE_ID IS NULL AND CONDUCTOR_ID_USU IS NULL AND ESTADO_ID_EST_XP = :pendiente
    `;
    const result = await connection.execute(
      sql,
      { usuarioId: Number(usuarioId), aceptada: ESTADO_XPRESS.ACEPTADA, cargaId: Number(id), pendiente: ESTADO_XPRESS.PENDIENTE },
      { autoCommit: true }
    );
    logInfo('xpress_aceptada', { route: 'PUT /api/xpress', cargaId: id, conductorId: usuarioId, rowsAffected: result.rowsAffected });
    if (result.rowsAffected === 0) return noDisponible();
    return NextResponse.json({ message: 'Encomienda aceptada' }, { status: 200 });
  } finally {
    await closeConnection(connection, 'PUT /api/xpress');
  }
}

export async function PUT(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    if (body?.aceptar === true) return await aceptarRutaPropia(req, body);
    const { id, estado, descripcion, peso } = body ?? {};

    // Se valida antes de abrir la conexión
    if (!id) return NextResponse.json({ error: 'ID de encomienda requerido' }, { status: 400 });
    if (!enteroPositivo(id)) return badRequest('ID de encomienda inválido');
    const cambiaEstado = estado !== undefined && estado !== null;
    if (cambiaEstado && descripcion !== undefined) return badRequest('Cambia el estado o edita los datos, no las dos cosas a la vez');
    if (!cambiaEstado && descripcion === undefined) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

    let estadoNuevo = null;
    let datos = null;
    if (cambiaEstado) {
      estadoNuevo = resolverEstadoXpress(estado);
      if (!estadoNuevo) return badRequest(`Estado desconocido: ${estado}`);
    } else {
      datos = validarDatosCarga({ descripcion, peso });
      if (datos.error) return badRequest(datos.error);
    }

    connection = await getConnection();
    const carga = await findCargaParticipants(connection, id);

    // Quién puede pedirlo se decide por su rol; si la carga ya no admite el cambio, es un 409 aparte
    const notAllowed = await checkOwnership(req, (userId) =>
      cambiaEstado
        ? tieneRolParaEstado(userId, carga, estadoNuevo)
        : rolesEnCarga(userId, carga).includes(ROL_XPRESS.EMISOR)
    );
    if (notAllowed) return notAllowed;
    if (!carga) return cargaNoEncontrada();

    if (cambiaEstado) {
      return await aplicarEstado(connection, carga, id, estadoNuevo, 'PUT /api/xpress', 'Estado actualizado');
    }

    if (Number(carga.estadoId) !== ESTADO_XPRESS.PENDIENTE) {
      return NextResponse.json({ error: 'Solo se puede editar una encomienda pendiente' }, { status: 409 });
    }
    const sql = `
      UPDATE CARGAS SET DESCRIPCION_XP = :descripcion, PESO_XP = :peso
      WHERE ID_XP = :cargaId AND ESTADO_ID_EST_XP = :pendiente
    `;
    const result = await connection.execute(
      sql,
      { descripcion: datos.descripcion, peso: datos.peso, cargaId: Number(id), pendiente: ESTADO_XPRESS.PENDIENTE },
      { autoCommit: true }
    );
    logInfo('xpress_editada', { route: 'PUT /api/xpress', cargaId: id, rowsAffected: result.rowsAffected });
    if (result.rowsAffected === 0) return estadoCambio();
    return NextResponse.json({ message: 'Encomienda actualizada' }, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'PUT /api/xpress', mensaje: 'Error al actualizar encomienda' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'PUT /api/xpress');
  }
}

// Cancelación lógica: la fila no se borra, pasa al estado Cancelada (queda en el historial)
export async function DELETE(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const id = new URL(req.url).searchParams.get('id');

    // Se valida antes de abrir la conexión
    if (!id) return NextResponse.json({ error: 'ID de encomienda requerido' }, { status: 400 });
    if (!enteroPositivo(id)) return badRequest('ID de encomienda inválido');

    connection = await getConnection();
    const carga = await findCargaParticipants(connection, id);

    const notAllowed = await checkOwnership(req, (userId) =>
      tieneRolParaEstado(userId, carga, ESTADO_XPRESS.CANCELADA)
    );
    if (notAllowed) return notAllowed;
    if (!carga) return cargaNoEncontrada();

    return await aplicarEstado(connection, carga, id, ESTADO_XPRESS.CANCELADA, 'DELETE /api/xpress', 'Encomienda cancelada');
  } catch (error) {
    logError('api_error', error, { route: 'DELETE /api/xpress', mensaje: 'Error al cancelar encomienda' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'DELETE /api/xpress');
  }
}
