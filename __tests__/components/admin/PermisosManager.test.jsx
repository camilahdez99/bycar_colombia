import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import PermisosManager from '@/components/admin/PermisosManager';
import { llamadas, stubApi } from '../../helpers/dashboard';

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
}));

const MENUS = [
  { id: 1, label: 'Inicio', url: '/inicio', parentId: null },
  { id: 2, label: 'Mis Rutas', url: '/mis-rutas', parentId: null },
  { id: 3, label: 'Guardian', url: '/guardian', parentId: null },
  { id: 6, label: 'Crear ruta', url: '/inicio/crear', parentId: 1 },
  { id: 7, label: 'Buscar ruta', url: '/inicio/buscar', parentId: 1 },
  { id: 8, label: 'Sub de otro', url: '/guardian/x', parentId: 3 },
];

async function buscarUsuario(id) {
  await waitFor(() => expect(llamadas('GET', '/api/menus')).toHaveLength(1));
  fireEvent.change(screen.getByPlaceholderText('Ingrese el ID del Usuario...'), { target: { value: id } });
  fireEvent.click(screen.getByText('Buscar'));
}

const casilla = (label) => screen.getByText(label).previousElementSibling;

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('PermisosManager (caracterización ampliada)', () => {
  test('separa menús principales (sin Inicio) y acciones de Inicio; los submenús de otros padres no aparecen', async () => {
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': [{ menuId: 2 }, { menuId: 7 }] });
    render(<PermisosManager />);
    await buscarUsuario('12');

    await screen.findByText('MENÚS PRINCIPALES');
    expect(screen.getByText('ACCIONES DE INICIO')).toBeTruthy();
    const etiquetas = [...document.querySelectorAll('label span')].map((el) => el.textContent);
    expect(etiquetas).toEqual(['Mis Rutas', 'Guardian', 'Crear ruta', 'Buscar ruta']);
    expect([casilla('Mis Rutas').checked, casilla('Guardian').checked, casilla('Crear ruta').checked, casilla('Buscar ruta').checked])
      .toEqual([true, false, false, true]);
    expect(screen.getByText('12').tagName).toBe('STRONG');
  });

  test('sin submenús de Inicio no muestra esa sección', async () => {
    stubApi({ '/api/menus': MENUS.slice(0, 3), '/api/admin/permisos': [] });
    render(<PermisosManager />);
    await buscarUsuario('12');

    await screen.findByText('MENÚS PRINCIPALES');
    expect(screen.queryByText('ACCIONES DE INICIO')).toBeNull();
  });

  test('un ID vacío no busca', async () => {
    stubApi({ '/api/menus': MENUS });
    render(<PermisosManager />);
    await waitFor(() => expect(llamadas('GET', '/api/menus')).toHaveLength(1));
    fireEvent.submit(screen.getByText('Buscar').closest('form'));

    expect(llamadas('GET', '/api/admin/permisos')).toEqual([]);
    expect(screen.queryByText('MENÚS PRINCIPALES')).toBeNull();
  });

  test('comportamiento actual: el usuarioId se envía como texto en el POST', async () => {
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': [], 'POST /api/admin/permisos': { message: 'ok' } });
    render(<PermisosManager />);
    await buscarUsuario('12');
    fireEvent.click(await screen.findByText('Crear ruta'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Permiso asignado'));
    expect(llamadas('POST', '/api/admin/permisos').map((c) => c.body)).toEqual([{ usuarioId: '12', menuId: 6 }]);
    expect(casilla('Crear ruta').checked).toBe(true);
  });

  test('si falla la carga de menús por red avisa; si responde con error queda sin menús y sin aviso', async () => {
    stubApi({ '/api/menus': () => { throw new TypeError('Failed to fetch'); } });
    render(<PermisosManager />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar menús'));
    cleanup();
    vi.clearAllMocks();

    stubApi({ '/api/menus': () => new Response('{}', { status: 500 }), '/api/admin/permisos': [] });
    render(<PermisosManager />);
    await buscarUsuario('12');
    await screen.findByText('MENÚS PRINCIPALES');
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(toast.error).not.toHaveBeenCalled();
  });

  test('si falla la carga de permisos por red avisa y deja todo sin marcar; con error HTTP no avisa', async () => {
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': () => { throw new TypeError('Failed to fetch'); } });
    render(<PermisosManager />);
    await buscarUsuario('12');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar permisos del usuario'));
    await screen.findByText('MENÚS PRINCIPALES');
    expect(casilla('Mis Rutas').checked).toBe(false);
    cleanup();
    vi.clearAllMocks();

    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': () => new Response('{}', { status: 403 }) });
    render(<PermisosManager />);
    await buscarUsuario('12');
    await screen.findByText('MENÚS PRINCIPALES');
    expect(toast.error).not.toHaveBeenCalled();
  });

  test('buscar otro usuario reemplaza los permisos marcados', async () => {
    stubApi({
      '/api/menus': MENUS,
      '/api/admin/permisos?usuarioId=12': [{ menuId: 2 }],
      '/api/admin/permisos?usuarioId=13': [{ menuId: 3 }],
    });
    render(<PermisosManager />);
    await buscarUsuario('12');
    await waitFor(() => expect(casilla('Mis Rutas').checked).toBe(true));

    await buscarUsuario('13');
    await waitFor(() => expect(casilla('Guardian').checked).toBe(true));
    expect(casilla('Mis Rutas').checked).toBe(false);
  });

  test('error al asignar o revocar: avisa con el mensaje y la casilla no cambia', async () => {
    stubApi({
      '/api/menus': MENUS,
      '/api/admin/permisos': [{ menuId: 2 }],
      'POST /api/admin/permisos': () => new Response('{}', { status: 500 }),
      'DELETE /api/admin/permisos': () => new Response('{}', { status: 500 }),
    });
    render(<PermisosManager />);
    await buscarUsuario('12');
    await waitFor(() => expect(casilla('Mis Rutas').checked).toBe(true));

    fireEvent.click(screen.getByText('Guardian'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al asignar permiso'));
    fireEvent.click(screen.getByText('Mis Rutas'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al revocar permiso'));

    expect(llamadas('DELETE', '/api/admin/permisos').map((c) => c.url)).toEqual(['/api/admin/permisos?usuarioId=12&menuId=2']);
    expect(casilla('Guardian').checked).toBe(false);
    expect(casilla('Mis Rutas').checked).toBe(true);
  });

  test('comportamiento actual: ante una falla de red muestra el mensaje técnico del navegador', async () => {
    stubApi({
      '/api/menus': MENUS,
      '/api/admin/permisos': [],
      'POST /api/admin/permisos': () => { throw new TypeError('Failed to fetch'); },
    });
    render(<PermisosManager />);
    await buscarUsuario('12');
    fireEvent.click(await screen.findByText('Guardian'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to fetch'));
  });
});
