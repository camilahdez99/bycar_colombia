// Archivo propio: fetchConSesion guarda estado a nivel de módulo (expira una sola vez por carga de página)
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('si la API responde 401, limpia el usuario y redirige a /login una sola vez', async () => {
  localStorage.setItem('user', JSON.stringify({ ID_USU: 7 }));
  const assign = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ assign });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      ['/api/menus', '/api/marcas', '/api/municipios'].includes(url)
        ? new Response('[]', { status: 200 })
        : new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 }),
    ),
  );

  render(<DashboardPage />);

  await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
  await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(8));
  expect(assign).toHaveBeenCalledOnce();
  expect(localStorage.getItem('user')).toBeNull();
});
