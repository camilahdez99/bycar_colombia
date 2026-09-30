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
  window.location.assign(HOME_URL);
}
