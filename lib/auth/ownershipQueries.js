// Consultas de solo lectura para validar pertenencia (IDOR, BUGS S6).
// Solo se ejecutan con AUTH_ENFORCED prendido (ver checkOwnership).

// Ruta relativa con extensión: scripts/verificar-consultas-auth.mjs importa este módulo con Node sin alias
import { ESTADO_SOLICITUD } from '../domain/constantes.js';

const ESTADO_SOLICITUD_ACEPTADA = ESTADO_SOLICITUD.ACEPTADA;

/** { passengerId, driverId } de una solicitud, o null si no existe. */
export async function findSolicitudParticipants(connection, solicitudId) {
  const sql = `
    SELECT s.USUARIOS_ID_USU AS "passengerId", v.USUARIOS_ID_USU AS "driverId"
    FROM SOLICITUDES s
    JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
    WHERE s.ID_SOL = :solicitudId
  `;
  const result = await connection.execute(sql, { solicitudId: Number(solicitudId) });
  return result.rows?.[0] ?? null;
}

/** true si el usuario es el conductor del viaje o un pasajero con solicitud aceptada. */
export async function isViajeParticipant(connection, viajeId, userId) {
  const sql = `
    SELECT COUNT(*) AS "total"
    FROM VIAJES v
    WHERE v.ID_VIA = :viajeId
      AND (v.USUARIOS_ID_USU = :userId
           OR EXISTS (SELECT 1 FROM SOLICITUDES s
                      WHERE s.VIAJES_ID_VIA = v.ID_VIA
                        AND s.USUARIOS_ID_USU = :userId
                        AND s.ESTADO_ID_EST = :aceptada))
  `;
  const result = await connection.execute(sql, {
    viajeId: Number(viajeId),
    userId: Number(userId),
    aceptada: ESTADO_SOLICITUD_ACEPTADA,
  });
  return Number(result.rows?.[0]?.total ?? 0) > 0;
}

/** true si el guardián pertenece a un viaje del que el usuario participa (mismo criterio). */
export async function isGuardianParticipant(connection, guardianId, userId) {
  const sql = `
    SELECT COUNT(*) AS "total"
    FROM GUARDIANES g
    JOIN VIAJES v ON g.VIAJES_ID_VIA = v.ID_VIA
    WHERE g.ID_GUA = :guardianId
      AND (v.USUARIOS_ID_USU = :userId
           OR EXISTS (SELECT 1 FROM SOLICITUDES s
                      WHERE s.VIAJES_ID_VIA = v.ID_VIA
                        AND s.USUARIOS_ID_USU = :userId
                        AND s.ESTADO_ID_EST = :aceptada))
  `;
  const result = await connection.execute(sql, {
    guardianId: Number(guardianId),
    userId: Number(userId),
    aceptada: ESTADO_SOLICITUD_ACEPTADA,
  });
  return Number(result.rows?.[0]?.total ?? 0) > 0;
}

/**
 * { emisorId, receptorId, conductorId, viajeId, estadoId } de una encomienda Xpress, o null si no existe.
 * conductorId es el dueño del viaje o, en una carga de ruta propia (viajeId null), quien la aceptó (null si nadie).
 */
export async function findCargaParticipants(connection, cargaId) {
  const sql = `
    SELECT c.USUARIO_EMISOR_US AS "emisorId",
           c.USUARIO_RECEPTOR_US AS "receptorId",
           COALESCE(v.USUARIOS_ID_USU, c.CONDUCTOR_ID_USU) AS "conductorId",
           c.VIAJE_ID AS "viajeId",
           c.ESTADO_ID_EST_XP AS "estadoId"
    FROM CARGAS c
    LEFT JOIN VIAJES v ON c.VIAJE_ID = v.ID_VIA
    WHERE c.ID_XP = :cargaId
  `;
  const result = await connection.execute(sql, { cargaId: Number(cargaId) });
  return result.rows?.[0] ?? null;
}

/** Correo del usuario, o null si no existe. */
export async function findUserEmail(connection, userId) {
  const sql = `SELECT CORREO_USU AS "correo" FROM USUARIOS WHERE ID_USU = :userId`;
  const result = await connection.execute(sql, { userId: Number(userId) });
  return result.rows?.[0]?.correo ?? null;
}
