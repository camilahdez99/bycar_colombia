import { sameUser } from '@/lib/auth/ownership';
import { ESTADO_SOLICITUD } from '@/lib/domain/constantes';

// Mapa directo de texto → ID de estado (según ESTADOS_SOL)
const ESTADO_POR_TEXTO = {
  'Pendiente': ESTADO_SOLICITUD.PENDIENTE,
  'Aceptado': ESTADO_SOLICITUD.ACEPTADA,
  'Aceptada': ESTADO_SOLICITUD.ACEPTADA,
  'Rechazado': ESTADO_SOLICITUD.RECHAZADA,
  'Rechazada': ESTADO_SOLICITUD.RECHAZADA,
  'Cancelado': ESTADO_SOLICITUD.CANCELADA,
  'Cancelada': ESTADO_SOLICITUD.CANCELADA,
};

// Quién puede llevar una solicitud a cada estado (Pendiente no se asigna por API)
const ESTADOS_DEL_CONDUCTOR = [ESTADO_SOLICITUD.ACEPTADA, ESTADO_SOLICITUD.RECHAZADA];
const ESTADOS_DEL_PASAJERO = [ESTADO_SOLICITUD.CANCELADA];

const ESTADOS_VALIDOS = Object.values(ESTADO_SOLICITUD);

/**
 * ID de estado a partir del texto ("Aceptado") o de un número ("2", 2).
 * Texto desconocido o número fuera del catálogo (99, 0, 2.5) → null (BUGS F20).
 */
export function resolverEstadoSolicitud(estado) {
  const estadoId = isNaN(estado) ? ESTADO_POR_TEXTO[estado] : Number(estado);
  return ESTADOS_VALIDOS.includes(estadoId) ? estadoId : null;
}

export function canChangeSolicitud(userId, estadoId, participants) {
  if (!participants) return false;
  if (ESTADOS_DEL_CONDUCTOR.includes(estadoId)) return sameUser(userId, participants.driverId);
  if (ESTADOS_DEL_PASAJERO.includes(estadoId)) return sameUser(userId, participants.passengerId);
  return false;
}
