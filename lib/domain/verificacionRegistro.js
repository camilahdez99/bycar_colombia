// Reglas puras de la verificación del correo al registrarse (feature flag EMAIL_VERIFICATION).

export const VERIFICACION = Object.freeze({
  /** El código vence a los 5 minutos de enviado. */
  VIGENCIA_SEG: 5 * 60,
  /** Al segundo código incorrecto el registro se descarta. */
  MAX_INTENTOS: 2,
  /** Reenvíos permitidos por registro; cada uno da un código nuevo con 5 minutos e intentos nuevos. */
  MAX_REENVIOS: 3,
  /** Espera mínima entre dos envíos al mismo correo. */
  ESPERA_REENVIO_SEG: 60,
  DIGITOS: 6,
});

/** Códigos que la API devuelve en `codigo` para que la pantalla sepa qué mostrar. */
export const RESULTADO_VERIFICACION = Object.freeze({
  PENDIENTE: 'VERIFICACION_PENDIENTE',
  INCORRECTO: 'CODIGO_INCORRECTO',
  VENCIDO: 'CODIGO_VENCIDO',
  DESCARTADO: 'REGISTRO_DESCARTADO',
  NO_ENCONTRADO: 'REGISTRO_NO_ENCONTRADO',
  ESPERA: 'REENVIO_EN_ESPERA',
  SIN_REENVIOS: 'SIN_REENVIOS',
});

/** El código tal como lo escribió la persona, sin espacios, si son exactamente 6 dígitos; si no, null. */
export function codigoConFormato(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const codigo = String(valor).replace(/\s/g, '');
  return new RegExp(`^\\d{${VERIFICACION.DIGITOS}}$`).test(codigo) ? codigo : null;
}

/**
 * Qué pasa con un intento de verificación.
 * - `vencido`: pasaron los 5 minutos; el registro se descarta.
 * - `verificado`: el código es correcto.
 * - `descartado`: fue el segundo error; el registro se descarta.
 * - `incorrecto`: le quedan `intentosRestantes`.
 */
export function resultadoDelIntento({ vencido, intentosPrevios, correcto }) {
  if (vencido) return { estado: 'vencido' };
  if (correcto) return { estado: 'verificado' };
  const fallidos = Number(intentosPrevios) + 1;
  if (fallidos >= VERIFICACION.MAX_INTENTOS) return { estado: 'descartado' };
  return { estado: 'incorrecto', intentosRestantes: VERIFICACION.MAX_INTENTOS - fallidos };
}

/** Si se puede reenviar el código: hay un límite de reenvíos y una espera entre envíos. */
export function permisoDeReenvio({ reenvios, segundosDesdeEnvio }) {
  if (Number(reenvios) >= VERIFICACION.MAX_REENVIOS) return { permitido: false, motivo: 'limite' };
  const faltan = Math.ceil(VERIFICACION.ESPERA_REENVIO_SEG - Number(segundosDesdeEnvio));
  if (faltan > 0) return { permitido: false, motivo: 'espera', segundos: faltan };
  return { permitido: true };
}
