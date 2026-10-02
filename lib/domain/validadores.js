// Validadores puros de entrada (BACKLOG DT-31). Devuelven el valor normalizado, o null si no es válido.

/** Entero > 0 a partir de un número o de un texto con solo dígitos ("12"). "12abc", 1.5, 0 o -3 → null. */
export function enteroPositivo(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor > 0 ? valor : null;
  if (typeof valor !== 'string' || !/^\s*\d+\s*$/.test(valor)) return null;
  const numero = Number(valor);
  return numero > 0 ? numero : null;
}

/** Número > 0 a partir de un número o de un texto, aceptando coma como separador de miles ("25,000"). */
export function numeroPositivo(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) && valor > 0 ? valor : null;
  if (typeof valor !== 'string' || !/^\s*\d[\d,]*(\.\d+)?\s*$/.test(valor)) return null;
  const numero = Number(valor.replace(/,/g, ''));
  return numero > 0 ? numero : null;
}

/**
 * Correo con forma válida (algo@dominio.ext), recortado y en minúsculas; si no, null.
 * Que el correo exista de verdad lo prueba el código de verificación, no este chequeo.
 */
export function correoValido(valor) {
  if (typeof valor !== 'string') return null;
  const correo = valor.trim().toLowerCase();
  return correo.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) ? correo : null;
}

/** Texto recortado y no vacío. Cualquier otro tipo → null. */
export function textoNoVacio(valor) {
  if (typeof valor !== 'string') return null;
  const recortado = valor.trim();
  return recortado ? recortado : null;
}
