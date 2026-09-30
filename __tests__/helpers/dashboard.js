import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

export const USUARIO = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'PEREZ', CORREO_USU: 'ana@x.co' };

export const PERMISOS_INICIO = [{ menuUrl: '/inicio/crear' }, { menuUrl: '/inicio/buscar' }];

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// buscarViajes pide con una URL absoluta; el resto con rutas relativas
export const rutaDe = (input) => String(input).replace(/^https?:\/\/[^/]+/, '');

function respuestaPorDefecto(url) {
  if (url.startsWith('/api/municipios')) return jsonResponse([{ id: 1, nombre: 'BOGOTA' }, { id: 2, nombre: 'MEDELLIN' }]);
  if (url.startsWith('/api/marcas')) return jsonResponse([{ id: 1, nombre: 'MAZDA' }, { id: 2, nombre: 'RENAULT' }]);
  if (url.startsWith('/api/viajes/mis-rutas')) return jsonResponse({ publicadas: [], solicitadas: [] });
  if (url.startsWith('/api/guardian?usuarioId')) return jsonResponse(null);
  if (url.startsWith('/api/admin/permisos')) return jsonResponse(PERMISOS_INICIO);
  return jsonResponse([]);
}

/**
 * Reemplaza fetch. Cada clave es un prefijo de URL, opcionalmente precedido del método
 * ("PUT /api/solicitudes"); una clave sin método responde a cualquier método que no tenga
 * la suya. Con "$" al final la URL tiene que coincidir exacta.
 * El valor es el body JSON, una Response, o una función (url, init) => body | Response.
 */
export function stubApi(rutas = {}) {
  const entradas = Object.entries(rutas).map(([clave, valor]) => {
    const [metodo, patron] = clave.includes(' ') ? clave.split(' ') : [null, clave];
    return { metodo, patron, valor };
  });
  const coincide = (patron, url) => (patron.endsWith('$') ? url === patron.slice(0, -1) : url.startsWith(patron));

  const mock = vi.fn(async (input, init = {}) => {
    const url = rutaDe(input);
    const metodo = init.method || 'GET';
    // Una clave con método gana sobre una sin método, sin importar el orden en que se declaren
    const entrada = entradas.find((e) => e.metodo === metodo && coincide(e.patron, url))
      ?? entradas.find((e) => !e.metodo && coincide(e.patron, url));
    if (!entrada) return respuestaPorDefecto(url);
    const valor = typeof entrada.valor === 'function' ? await entrada.valor(url, init) : entrada.valor;
    return valor instanceof Response ? valor : jsonResponse(valor);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Llamadas a fetch filtradas por método y prefijo de URL, con el body ya parseado. */
export function llamadas(metodo, prefijo) {
  return fetch.mock.calls
    .map(([input, init = {}]) => ({ url: rutaDe(input), metodo: init.method || 'GET', body: init.body && JSON.parse(init.body) }))
    .filter((c) => c.metodo === metodo && c.url.startsWith(prefijo));
}

export const iniciarSesion = (usuario = USUARIO) => localStorage.setItem('user', JSON.stringify(usuario));

/** Navega con la barra móvil, que siempre está en el DOM (la lateral muestra un skeleton sin menús). */
export const clickNav = (label) => fireEvent.click(screen.getAllByText(label)[0]);

/** Fecha local de hoy en el formato que compara la pestaña Guardián (YYYY-MM-DD). */
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
