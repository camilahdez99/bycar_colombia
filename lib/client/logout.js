import { fetchConSesion } from './sessionFetch';

const HOME_URL = '/';

// Borra la cookie de sesión en el servidor; si la red falla, igual se cierra la sesión local
export async function logout() {
  try {
    await fetchConSesion('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Error al cerrar sesión en el servidor:', error);
  }
  localStorage.removeItem('user');
  // Recarga completa a propósito: descarta el estado en memoria y los intervalos de la sesión
  // cerrada; useRouter().push() los conservaría (DT-51)
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(HOME_URL);
}
