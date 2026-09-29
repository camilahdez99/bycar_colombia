const LOGIN_URL = '/login';

// Sesión vencida o inexistente: limpia el usuario local y fuerza una navegación completa,
// que además corta los intervalos de refresco del dashboard
export function expireSession() {
  localStorage.removeItem('user');
  window.location.assign(LOGIN_URL);
}

/**
 * fetch que avisa una sola vez cuando la API responde 401.
 * Devuelve siempre la respuesta original, así el código que lo llama no cambia.
 */
export function createSessionFetch({ fetchImpl = (...args) => fetch(...args), onExpired = expireSession } = {}) {
  let expired = false;
  return async (...args) => {
    const response = await fetchImpl(...args);
    if (response.status === 401 && !expired) {
      expired = true;
      onExpired();
    }
    return response;
  };
}

export const fetchConSesion = createSessionFetch();
