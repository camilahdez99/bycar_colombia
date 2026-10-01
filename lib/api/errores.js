// Mensajes para el cliente a partir de errores de Oracle. El texto original (con nombres de
// tablas, columnas y constraints) nunca se devuelve: queda solo en el log (BUGS S8).
const MENSAJES_POR_CODIGO = {
  1: 'Ya existe un registro con esos datos',
  1400: 'Falta un campo obligatorio',
  1722: 'Un valor numérico no es válido',
  2291: 'El registro hace referencia a otro que no existe',
  2292: 'El registro tiene otros asociados y no se puede borrar',
  12899: 'Un valor supera el largo permitido',
};

/** Mensaje seguro para el body de error: uno conocido según `errorNum`, o `porDefecto`. */
export function mensajeDeError(error, porDefecto) {
  return MENSAJES_POR_CODIGO[error?.errorNum] ?? porDefecto;
}
