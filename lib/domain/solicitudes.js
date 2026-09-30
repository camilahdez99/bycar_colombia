import { sameUser } from '@/lib/auth/ownership';

// Mapa directo de texto → ID de estado (según ESTADOS_SOL)
const ESTADO_POR_TEXTO = {
  'Pendiente': 1,
  'Aceptado': 2,
  'Aceptada': 2,
  'Rechazado': 3,
  'Rechazada': 3,
  'Cancelado': 4,
  'Cancelada': 4,
};

// Quién puede llevar una solicitud a cada estado (1 = Pendiente no se asigna por API)
const ESTADOS_DEL_CONDUCTOR = [2, 3]; // Aceptada, Rechazada
const ESTADOS_DEL_PASAJERO = [4]; // Cancelada

/**
 * ID de estado a partir del texto ("Aceptado") o de un número ("2", 2).
 * Texto desconocido → null. Cualquier número pasa sin validar el rango (BUGS F20).
 */
export function resolverEstadoSolicitud(estado) {
  return isNaN(estado)
    ? (ESTADO_POR_TEXTO[estado] ?? null)
    : Number(estado);
}

export function canChangeSolicitud(userId, estadoId, participants) {
  if (!participants) return false;
  if (ESTADOS_DEL_CONDUCTOR.includes(estadoId)) return sameUser(userId, participants.driverId);
  if (ESTADOS_DEL_PASAJERO.includes(estadoId)) return sameUser(userId, participants.passengerId);
  return false;
}
