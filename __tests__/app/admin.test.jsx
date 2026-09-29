import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';
import PermisosManager from '@/app/components/admin/PermisosManager';

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const MENUS = [
  { id: 2, label: 'Viajes', url: '/viajes', parentId: null },
  { id: 3, label: 'Mensajes', url: '/mensajes', parentId: null },
];

function respuestaPorDefecto(url) {
  if (url === '/api/admin/tablas?list=1') return jsonResponse(['USUARIOS', 'VIAJES']);
  if (url.startsWith('/api/admin/tablas?metadata=1')) {
    return jsonResponse([{ COLUMN_NAME: 'ID_USU', DATA_TYPE: 'NUMBER', NULLABLE: 'N' }]);
  }
  if (url.startsWith('/api/admin/tablas?tabla=')) return jsonResponse([{ ID_USU: 1 }]);
  if (url === '/api/menus') return jsonResponse(MENUS);
  if (url.startsWith('/api/admin/permisos?usuarioId=')) return jsonResponse([{ menuId: 2 }]);
  return jsonResponse({ ok: true });
}

const llamadas = () => fetch.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET']);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => respuestaPorDefecto(url)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AdminPage (caracterización de la carga inicial)', () => {
  test('pide la lista de tablas y luego metadata y filas de la primera', async () => {
    render(<AdminPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(llamadas()).toEqual([
      ['/api/admin/tablas?list=1', 'GET'],
      ['/api/admin/tablas?metadata=1&tabla=USUARIOS', 'GET'],
      ['/api/admin/tablas?tabla=USUARIOS', 'GET'],
    ]);
  });
});

describe('PermisosManager (caracterización)', () => {
  async function buscarUsuario(id) {
    render(<PermisosManager />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/menus'));
    fireEvent.change(screen.getByPlaceholderText('Ingrese el ID del Usuario...'), { target: { value: id } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('Viajes');
  }

  test('al montar pide los menús; al buscar, los permisos del usuario', async () => {
    await buscarUsuario('5');
    expect(llamadas()).toEqual([
      ['/api/menus', 'GET'],
      ['/api/admin/permisos?usuarioId=5', 'GET'],
    ]);
    expect(screen.getByRole('checkbox', { name: 'Viajes' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Mensajes' }).checked).toBe(false);
  });

  test('asignar un menú hace POST con usuarioId y menuId', async () => {
    await buscarUsuario('5');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mensajes' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    const [url, init] = fetch.mock.calls[2];
    expect([url, init.method, JSON.parse(init.body)]).toEqual(['/api/admin/permisos', 'POST', { usuarioId: '5', menuId: 3 }]);
  });

  test('revocar un menú hace DELETE con usuarioId y menuId', async () => {
    await buscarUsuario('5');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Viajes' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(llamadas()[2]).toEqual(['/api/admin/permisos?usuarioId=5&menuId=2', 'DELETE']);
  });
});
