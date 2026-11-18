import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError, logInfo } from '@/lib/log';
import { mensajeDeError } from '@/lib/api/errores';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership } from '@/lib/auth/ownership';
import { JSON_INVALIDO, badRequest, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { enteroPositivo } from '@/lib/domain/validadores';
import { ESTADO_GUARDIAN, ESTADO_SOLICITUD, ESTADO_VIAJE, TIEMPO_GUARDIAN_POR_DEFECTO_MIN } from '@/lib/domain/constantes';
import { enviarAvisoGuardian } from '@/lib/email';

/**
 * Inicia un viaje: lo pasa a "En Curso" y activa automáticamente el guardián de cada pasajero
 * aceptado que haya elegido un contacto de confianza al solicitar el cupo. A cada contacto se le
 * avisa por correo (si hay proveedor configurado; un fallo de correo no corta el inicio).
 * Solo lo puede hacer el conductor dueño del viaje.
 */
export async function POST(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { viajeId } = body ?? {};
    if (!enteroPositivo(viajeId)) return badRequest('ID de viaje inválido');

    connection = await getConnection({ autoCommit: false });

    // Solo el conductor dueño del viaje puede iniciarlo
    const notOwner = await checkOwnership(req, async (userId) => {
      const res = await connection.execute(
        `SELECT USUARIOS_ID_USU as "dueno" FROM VIAJES WHERE ID_VIA = :viajeId`,
        { viajeId: Number(viajeId) },
      );
      const dueno = res.rows?.[0]?.dueno;
      return dueno !== undefined && String(dueno) === String(userId);
    });
    if (notOwner) return notOwner;

    // Pasa a "En Curso" solo desde Disponible o Lleno; si ya estaba iniciado o no existe, 0 filas
    const upd = await connection.execute(
      `UPDATE VIAJES SET ESTADO_VIA_ID_EST_VIA = :enCurso
       WHERE ID_VIA = :viajeId AND ESTADO_VIA_ID_EST_VIA IN (:disponible, :lleno)`,
      { enCurso: ESTADO_VIAJE.EN_CURSO, viajeId: Number(viajeId), disponible: ESTADO_VIAJE.DISPONIBLE, lleno: ESTADO_VIAJE.LLENO },
    );
    if (upd.rowsAffected === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'El viaje no existe o ya fue iniciado' }, { status: 409 });
    }

    // Pasajeros aceptados con contacto de confianza elegido y sin guardián activo todavía
    const pendientes = await connection.execute(
      `SELECT s.USUARIOS_ID_USU as "protegidoId",
              s.CONTACTO_GUARDIAN_ID as "contactoId",
              s.TIEMPO_GUARDIAN_SOL as "tiempo",
              uc.CORREO_USU as "contactoEmail",
              up.NOMBRE_USU || ' ' || up.APELLIDO_USU as "protegido",
              mo.NOMBRE_MUN as "origen", md.NOMBRE_MUN as "destino",
              ucond.NOMBRE_USU || ' ' || ucond.APELLIDO_USU as "conductor",
              vh.PLACA_VEH as "placa", mar.NOMBRE_MAR as "carro",
              TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD HH24:MI') as "salida"
       FROM SOLICITUDES s
       JOIN USUARIOS uc ON s.CONTACTO_GUARDIAN_ID = uc.ID_USU
       JOIN USUARIOS up ON s.USUARIOS_ID_USU = up.ID_USU
       JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
       JOIN USUARIOS ucond ON v.USUARIOS_ID_USU = ucond.ID_USU
       JOIN VEHICULOS vh ON v.VEHICULO_PLACA_VEH = vh.PLACA_VEH
       JOIN MARCAS mar ON vh.MARCA_ID_MAR = mar.ID_MAR
       JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
       JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
       WHERE s.VIAJES_ID_VIA = :viajeId
         AND s.ESTADO_ID_EST = :aceptada
         AND s.CONTACTO_GUARDIAN_ID IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM GUARDIANES g
           WHERE g.VIAJES_ID_VIA = s.VIAJES_ID_VIA
             AND g.USUARIO_ID_USU = s.USUARIOS_ID_USU
             AND g.ESTADO_ID_EST = :activo)`,
      { viajeId: Number(viajeId), aceptada: ESTADO_SOLICITUD.ACEPTADA, activo: ESTADO_GUARDIAN.ACTIVO },
    );
    const filas = pendientes.rows ?? [];

    // Un guardián activo por pasajero (los IDs no colisionan: Date.now() + índice)
    const base = Date.now();
    const creados = [];
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const idGua = base + i;
      const tiempo = enteroPositivo(f.tiempo) || TIEMPO_GUARDIAN_POR_DEFECTO_MIN;
      await connection.execute(
        `INSERT INTO GUARDIANES (ID_GUA, EMAIL_CONFIANZA_GUA, FECHA_INICIO_GUA, VIAJES_ID_VIA, ESTADO_ID_EST, TIEMPO_ESTIMADO_GUA, USUARIO_ID_USU, CONTACTO_ID_USU)
         VALUES (:idGua, :email, CURRENT_TIMESTAMP, :viajeId, :activo, :tiempo, :protegidoId, :contactoId)`,
        {
          idGua, email: f.contactoEmail, viajeId: Number(viajeId), activo: ESTADO_GUARDIAN.ACTIVO,
          tiempo, protegidoId: Number(f.protegidoId), contactoId: Number(f.contactoId),
        },
      );
      creados.push({ idGua, fila: f });
    }

    await connection.commit();
    logInfo('viaje_iniciado', { route: 'POST /api/viajes/iniciar', viajeId, guardianes: creados.length });

    // Avisos por correo, después de confirmar en la BD. El fallo de un correo no afecta la respuesta.
    for (const { idGua, fila } of creados) {
      try {
        const enviado = await enviarAvisoGuardian({
          correo: fila.contactoEmail,
          tipo: 'inicio',
          datos: {
            protegido: fila.protegido, origen: fila.origen, destino: fila.destino,
            conductor: fila.conductor, placa: fila.placa, carro: fila.carro,
            salida: fila.salida, tiempo: enteroPositivo(fila.tiempo) || TIEMPO_GUARDIAN_POR_DEFECTO_MIN,
          },
        });
        if (enviado) {
          await connection.execute(
            `UPDATE GUARDIANES SET NOTIFICADO_INICIO_GUA = CURRENT_TIMESTAMP WHERE ID_GUA = :idGua`,
            { idGua }, { autoCommit: true },
          );
        }
      } catch (error) {
        logError('guardian_aviso_fallido', error, { route: 'POST /api/viajes/iniciar', idGua });
      }
    }

    return NextResponse.json({ message: 'Viaje iniciado', guardianesActivados: creados.length }, { status: 200 });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    logError('api_error', error, { route: 'POST /api/viajes/iniciar', mensaje: 'Error al iniciar el viaje' });
    return NextResponse.json({ error: mensajeDeError(error, 'Error interno del servidor') }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/viajes/iniciar');
  }
}
