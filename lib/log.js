// Logs estructurados: una línea JSON por evento, con el mismo formato que lib/auth.
// Nunca pasar en `context` contraseñas, tokens, cookies ni documentos de identidad.

/** Solo los campos del error que sirven para diagnosticar; no se vuelca el objeto completo. */
function describeError(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  const { name, message, code, errorNum } = error;
  return { name, message, ...(code !== undefined && { code }), ...(errorNum !== undefined && { errorNum }) };
}

export function logError(event, error, context = {}) {
  console.error(JSON.stringify({ event, ...context, error: describeError(error) }));
}

export function logInfo(event, context = {}) {
  console.log(JSON.stringify({ event, ...context }));
}

/** Algo inesperado pero manejado (token inválido, acceso denegado). */
export function logWarn(event, context = {}) {
  console.warn(JSON.stringify({ event, ...context }));
}

/** Falla que hay que atender y no viene de una excepción (por ejemplo, configuración rota). */
export function logAlerta(event, context = {}) {
  console.error(JSON.stringify({ event, ...context }));
}
