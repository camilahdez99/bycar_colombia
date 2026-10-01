// Reglas puras del guardián de ruta.

const normalizarCorreo = (correo) => (typeof correo === 'string' ? correo.trim().toUpperCase() : '');

/** true si el contacto de confianza es el mismo usuario: mismo correo, sin importar mayúsculas ni espacios. */
export function esContactoPropio(correoContacto, correoUsuario) {
  const contacto = normalizarCorreo(correoContacto);
  return contacto !== '' && contacto === normalizarCorreo(correoUsuario);
}
