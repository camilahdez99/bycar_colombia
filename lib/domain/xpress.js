// Reglas puras de las encomiendas Xpress: quién puede hacer qué y por qué estados puede pasar una carga.
import { sameUser } from '@/lib/auth/ownership';
import { ESTADO_XPRESS } from '@/lib/domain/constantes';
import { numeroPositivo, textoNoVacio } from '@/lib/domain/validadores';

export const ROL_XPRESS = Object.freeze({
  EMISOR: 'emisor',
  CONDUCTOR: 'conductor',
  RECEPTOR: 'receptor',
});

export const DESCRIPCION_MAX = 300;
export const PESO_MAX_KG = 1000;

// Transiciones permitidas: estado actual → { estado nuevo: rol que la puede hacer }
const TRANSICIONES = {
  [ESTADO_XPRESS.PENDIENTE]: {
    [ESTADO_XPRESS.ACEPTADA]: ROL_XPRESS.CONDUCTOR,
    [ESTADO_XPRESS.RECHAZADA]: ROL_XPRESS.CONDUCTOR,
    [ESTADO_XPRESS.CANCELADA]: ROL_XPRESS.EMISOR,
  },
  [ESTADO_XPRESS.ACEPTADA]: {
    [ESTADO_XPRESS.EN_CAMINO]: ROL_XPRESS.CONDUCTOR,
    [ESTADO_XPRESS.CANCELADA]: ROL_XPRESS.EMISOR,
  },
  [ESTADO_XPRESS.EN_CAMINO]: {
    [ESTADO_XPRESS.ENTREGADA]: ROL_XPRESS.CONDUCTOR,
  },
};

// Rol al que le toca llevar una carga a cada estado (Pendiente solo se asigna al crearla)
const ROL_POR_ESTADO_DESTINO = {
  [ESTADO_XPRESS.ACEPTADA]: ROL_XPRESS.CONDUCTOR,
  [ESTADO_XPRESS.RECHAZADA]: ROL_XPRESS.CONDUCTOR,
  [ESTADO_XPRESS.EN_CAMINO]: ROL_XPRESS.CONDUCTOR,
  [ESTADO_XPRESS.ENTREGADA]: ROL_XPRESS.CONDUCTOR,
  [ESTADO_XPRESS.CANCELADA]: ROL_XPRESS.EMISOR,
};

const ESTADO_POR_TEXTO = {
  'Pendiente': ESTADO_XPRESS.PENDIENTE,
  'Aceptada': ESTADO_XPRESS.ACEPTADA,
  'Rechazada': ESTADO_XPRESS.RECHAZADA,
  'En camino': ESTADO_XPRESS.EN_CAMINO,
  'Entregada': ESTADO_XPRESS.ENTREGADA,
  'Cancelada': ESTADO_XPRESS.CANCELADA,
};

const ESTADOS_VALIDOS = Object.values(ESTADO_XPRESS);

/**
 * ID de estado a partir del texto ("En camino") o de un número ("4", 4).
 * Texto desconocido o número fuera del catálogo → null.
 */
export function resolverEstadoXpress(estado) {
  if (estado === null || estado === undefined || estado === '') return null;
  const estadoId = isNaN(estado) ? ESTADO_POR_TEXTO[estado] : Number(estado);
  return ESTADOS_VALIDOS.includes(estadoId) ? estadoId : null;
}

/** Roles que tiene el usuario en la carga: { emisorId, receptorId, conductorId }. Puede ser más de uno. */
export function rolesEnCarga(userId, carga) {
  if (!carga) return [];
  const roles = [];
  if (sameUser(userId, carga.emisorId)) roles.push(ROL_XPRESS.EMISOR);
  if (sameUser(userId, carga.conductorId)) roles.push(ROL_XPRESS.CONDUCTOR);
  if (sameUser(userId, carga.receptorId)) roles.push(ROL_XPRESS.RECEPTOR);
  return roles;
}

/** Quien participa de la carga (emisor, conductor del viaje o receptor) puede verla. */
export const puedeVerCarga = (userId, carga) => rolesEnCarga(userId, carga).length > 0;

/** true si el estado nuevo es alcanzable desde el actual, sin mirar quién lo pide. */
export const transicionValida = (estadoActual, estadoNuevo) =>
  Boolean(TRANSICIONES[estadoActual]?.[estadoNuevo]);

/** true si el usuario puede llevar la carga a `estadoNuevo`: la transición existe y le toca a su rol. */
export function puedeCambiarEstado(userId, carga, estadoNuevo) {
  if (!carga) return false;
  const rolRequerido = TRANSICIONES[carga.estadoId]?.[estadoNuevo];
  return Boolean(rolRequerido) && rolesEnCarga(userId, carga).includes(rolRequerido);
}

/**
 * true si el usuario tiene el rol al que le toca pedir ese estado (conductor: aceptar, rechazar, en camino,
 * entregada; emisor: cancelar), sin mirar el estado actual. Separa "no es tu carga" (403) de "ya no se puede" (409).
 */
export function tieneRolParaEstado(userId, carga, estadoNuevo) {
  const rol = ROL_POR_ESTADO_DESTINO[estadoNuevo];
  return Boolean(rol) && rolesEnCarga(userId, carga).includes(rol);
}

/** El emisor edita la descripción y el peso mientras la carga sigue Pendiente. */
export const puedeEditarCarga = (userId, carga) =>
  Boolean(carga) && carga.estadoId === ESTADO_XPRESS.PENDIENTE && sameUser(userId, carga.emisorId);

/** El emisor puede cancelar mientras el conductor no la haya recogido. */
export const puedeCancelarCarga = (userId, carga) => puedeCambiarEstado(userId, carga, ESTADO_XPRESS.CANCELADA);

/**
 * Descripción y peso de una carga, normalizados. El peso es opcional (vacío → null).
 * Devuelve { descripcion, peso } o { error }.
 */
export function validarDatosCarga({ descripcion, peso }) {
  const texto = textoNoVacio(descripcion);
  if (!texto) return { error: 'La descripción de la encomienda es obligatoria' };
  if (texto.length > DESCRIPCION_MAX) return { error: `La descripción no puede superar ${DESCRIPCION_MAX} caracteres` };

  if (peso === undefined || peso === null || peso === '') return { descripcion: texto, peso: null };
  const kilos = numeroPositivo(peso);
  if (!kilos || kilos > PESO_MAX_KG) return { error: `El peso debe ser un número mayor a 0 y hasta ${PESO_MAX_KG} kg` };
  return { descripcion: texto, peso: kilos };
}
