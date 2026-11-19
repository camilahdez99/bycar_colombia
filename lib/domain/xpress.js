// Reglas puras de las encomiendas Xpress: quién puede hacer qué y por qué estados puede pasar una carga.
import { sameUser } from '@/lib/auth/ownership';
import { ESTADO_XPRESS } from '@/lib/domain/constantes';
import { enteroPositivo, numeroPositivo, textoNoVacio } from '@/lib/domain/validadores';

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

/**
 * Una carga es de ruta propia cuando no está en ningún viaje (viajeId null): trae su propio origen y destino,
 * y su conductor es quien la acepta. Si no, el conductor es el dueño del viaje.
 */
export const esCargaRutaPropia = (carga) => Boolean(carga) && carga.viajeId === null;

/**
 * Roles que tiene el usuario en la carga: { emisorId, receptorId, conductorId, viajeId }. Puede ser más de uno.
 * `conductorId` ya viene resuelto por la consulta: dueño del viaje, o quien aceptó la carga de ruta propia.
 */
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

/**
 * Una carga de ruta propia Pendiente y sin conductor la puede aceptar cualquier usuario que no sea
 * su remitente ni su receptor. Al aceptarla queda como responsable (CONDUCTOR_ID_USU) y pasa a Aceptada.
 */
export const puedeAceptarRutaPropia = (userId, carga) =>
  esCargaRutaPropia(carga) &&
  carga.estadoId === ESTADO_XPRESS.PENDIENTE &&
  (carga.conductorId === null || carga.conductorId === undefined) &&
  userId !== null && userId !== undefined &&
  !sameUser(userId, carga.emisorId) &&
  !sameUser(userId, carga.receptorId);

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

/**
 * Modo de creación de una encomienda según lo que trae el body: en un viaje (viajeId) o con ruta propia
 * (origenId + destinoId). Son excluyentes. Devuelve { modo: 'viaje' | 'ruta' } o { error }.
 */
export function resolverModoCarga({ viajeId, origenId, destinoId }) {
  const hayValor = (v) => v !== undefined && v !== null && v !== '';
  const conViaje = hayValor(viajeId);
  const conRuta = hayValor(origenId) || hayValor(destinoId);
  if (conViaje && conRuta) return { error: 'Elige un viaje o una ruta propia, no las dos cosas' };
  if (conViaje) return enteroPositivo(viajeId) ? { modo: 'viaje' } : { error: 'ID de viaje inválido' };
  if (!conRuta) return { error: 'Viaje, remitente y receptor son requeridos' };
  if (!hayValor(origenId) || !hayValor(destinoId)) return { error: 'El origen y el destino son requeridos' };
  if (!enteroPositivo(origenId) || !enteroPositivo(destinoId)) return { error: 'Origen o destino inválido' };
  if (String(origenId) === String(destinoId)) return { error: 'El origen y el destino no pueden ser el mismo' };
  return { modo: 'ruta' };
}

// Fecha de hoy en Colombia (UTC-5, sin horario de verano) como YYYY-MM-DD
const hoyColombia = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Fecha opcional de una encomienda de ruta propia (YYYY-MM-DD, no pasada). Vacía → null.
 * Devuelve { fecha } o { error }.
 */
export function validarFechaXp(fechaXp, hoy = hoyColombia()) {
  if (fechaXp === undefined || fechaXp === null || fechaXp === '') return { fecha: null };
  const texto = String(fechaXp);
  const instante = new Date(`${texto}T00:00:00Z`);
  const real = /^\d{4}-\d{2}-\d{2}$/.test(texto) && !isNaN(instante) && instante.toISOString().slice(0, 10) === texto;
  if (!real) return { error: 'La fecha es inválida' };
  if (texto < hoy) return { error: 'La fecha no puede ser anterior a hoy' };
  return { fecha: texto };
}
