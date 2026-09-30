import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';
import PermisosManager from '@/app/components/admin/PermisosManager';
import { toast } from 'react-hot-toast';

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
  vi.restoreAllMocks();
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

describe('AdminPage: cerrar sesión', () => {
  test('el botón llama al endpoint de logout y vuelve al inicio', async () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ assign });
    render(<AdminPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(llamadas().at(-1)).toEqual(['/api/auth/logout', 'POST']);
  });
});

describe('AdminPage ante errores de la API (F27)', () => {
  const errorResponse = (status) => jsonResponse({ error: 'ORA-00942' }, status);

  test('si falla la lista de tablas: avisa, no se rompe y no pide metadata', async () => {
    fetch.mockImplementation(async (url) => (url === '/api/admin/tablas?list=1' ? errorResponse(500) : respuestaPorDefecto(url)));
    render(<AdminPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al obtener lista de tablas'));
    expect(screen.getByText('Bycar ADMIN')).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
  });

  test('si falla la metadata al cambiar de tabla: avisa y no deja filas de la tabla anterior', async () => {
    fetch.mockImplementation(async (url) =>
      url === '/api/admin/tablas?metadata=1&tabla=VIAJES' ? errorResponse(500) : respuestaPorDefecto(url),
    );
    render(<AdminPage />);
    await screen.findByRole('columnheader', { name: 'ID_USU' });

    fireEvent.click(screen.getByRole('button', { name: 'VIAJES' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar datos de VIAJES'));
    expect(screen.queryByRole('columnheader', { name: 'ID_USU' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith('/api/admin/tablas?tabla=VIAJES');
  });

  test('si falla la metadata, abrir "Nuevo" no rompe el formulario', async () => {
    fetch.mockImplementation(async (url) =>
      url.startsWith('/api/admin/tablas?metadata=1') ? errorResponse(500) : respuestaPorDefecto(url),
    );
    render(<AdminPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar datos de USUARIOS'));
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
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
