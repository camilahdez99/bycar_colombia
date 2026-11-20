// Estimación del tiempo de viaje del guardián a partir de la ruta (origen → destino), para
// precargar el campo en vez de que el usuario lo invente. Es una aproximación por distancia;
// el valor siempre queda editable. Reglas puras (sin red, sin GPS): se prueban sin dependencias.
import { COORDENADAS_MUNICIPIOS } from './coordenadasMunicipios.js';

// La distancia en línea recta se infla por un factor para acercarla a la de carretera, y se
// divide por una velocidad promedio intermunicipal. Son valores conservadores y ajustables.
export const FACTOR_RUTA = 1.3;
export const VELOCIDAD_PROMEDIO_KMH = 60;
export const TIEMPO_MIN_MINUTOS = 10;
export const TIEMPO_MAX_MINUTOS = 600;
const RADIO_TIERRA_KM = 6371;

const aRadianes = (grados) => (grados * Math.PI) / 180;

/** Distancia en kilómetros entre dos puntos [lat, lon] (fórmula del haversine). */
export function distanciaKm([lat1, lon1], [lat2, lon2]) {
  const dLat = aRadianes(lat2 - lat1);
  const dLon = aRadianes(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLon / 2) ** 2;
  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Redondea a múltiplos de 5 minutos y acota al rango razonable. */
function normalizarMinutos(minutos) {
  const redondeado = Math.round(minutos / 5) * 5;
  return Math.min(Math.max(redondeado, TIEMPO_MIN_MINUTOS), TIEMPO_MAX_MINUTOS);
}

/**
 * Minutos estimados de viaje entre dos municipios (por su ID_MUN / código DIVIPOLA).
 * Devuelve null si falta la coordenada de alguno, para que el llamador use el valor por defecto.
 */
export function estimarTiempoViajeMin(origenId, destinoId) {
  const origen = COORDENADAS_MUNICIPIOS[origenId];
  const destino = COORDENADAS_MUNICIPIOS[destinoId];
  if (!origen || !destino) return null;
  const km = distanciaKm(origen, destino) * FACTOR_RUTA;
  return normalizarMinutos((km / VELOCIDAD_PROMEDIO_KMH) * 60);
}
