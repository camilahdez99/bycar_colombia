import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const USUARIO = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'PEREZ', CORREO_USU: 'ana@x.co' };

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function respuestaPorDefecto(url) {
  if (url.startsWith('/api/viajes/mis-rutas')) return jsonResponse({ publicadas: [], solicitadas: [] });
  if (url.startsWith('/api/guardian')) return jsonResponse(null);
  return jsonResponse([]);
}

const urlsPedidas = () => fetch.mock.calls.map(([url]) => url);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => respuestaPorDefecto(url)));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  push.mockClear();
});

describe('DashboardPage (caracterización de la carga inicial)', () => {
  test('sin usuario en localStorage: solo pide los catálogos', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(urlsPedidas()).toEqual(['/api/menus', '/api/marcas', '/api/municipios']);
  });

  test('con usuario: catálogos, datos del usuario y refresco inicial, cada uno una sola vez (DT-13)', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    render(<DashboardPage />);
    await waitFor(() => expect(urlsPedidas()).toContain('/api/mensajes/chats?usuarioId=7'));
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(8));
    // Margen para que aparezca un pedido duplicado si lo hubiera
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect([...urlsPedidas()].sort()).toEqual(
      [
        '/api/menus',
        '/api/marcas',
        '/api/municipios',
        '/api/viajes/mis-rutas?usuarioId=7',
        '/api/solicitudes/recibidas?usuarioId=7',
        '/api/mensajes/chats?usuarioId=7',
        '/api/guardian?usuarioId=7',
        '/api/admin/permisos?usuarioId=7',
      ].sort(),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
