import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { isSessionConfigured } from './session';
import { VERIFICACION } from '@/lib/domain/verificacionRegistro';

/** Código numérico aleatorio (criptográficamente seguro) de 6 dígitos, con ceros a la izquierda. */
export function generarCodigo() {
  return String(randomInt(0, 10 ** VERIFICACION.DIGITOS)).padStart(VERIFICACION.DIGITOS, '0');
}

/**
 * Hash del código que se guarda en la BD: HMAC-SHA256 con SESSION_SECRET sobre "correo:código".
 * Sin el secreto, un volcado de la tabla no alcanza para probar los 10^6 códigos posibles.
 */
export function hashCodigo(correo, codigo) {
  if (!isSessionConfigured()) {
    throw new Error('SESSION_SECRET no configurado: hace falta para la verificación del correo');
  }
  return createHmac('sha256', process.env.SESSION_SECRET).update(`${correo}:${codigo}`).digest('hex');
}

/** Compara dos hashes en tiempo constante. */
export function mismoHash(a, b) {
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  return bufA.length === bufB.length && bufA.length > 0 && timingSafeEqual(bufA, bufB);
}
