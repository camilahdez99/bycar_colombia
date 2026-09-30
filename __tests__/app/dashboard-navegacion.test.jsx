import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const MENUS = [
  { id: 1, label: 'Inicio', url: '/inicio', parentId: null },
  { id: 2, label: 'Mis Rutas', url: '/mis-rutas', parentId: null },
  { id: 3, label: 'Solicitudes', url: '/solicitudes', parentId: null },
  { id: 4, label: 'Mensajes', url: '/mensajes', parentId: null },
  { id: 5, label: 'Guardian', url: '/guardian', parentId: null },
  { id: 6, label: 'Crear ruta', url: '/inicio/crear', parentId: 1 },
  { id: 7, label: 'Reportes', url: '/reportes-mensuales', parentId: null },
];

const etiquetasMenu = (container) => [...container.querySelectorAll('.nav-item')].map((el) => el.textContent);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · menú según permisos (caracterización)', () => {
  test('sin menús en la BD: skeleton en la barra lateral y menú fijo de 5 ítems en la barra móvil', async () => {
    stubApi();
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    expect(container.querySelectorAll('.nav-skeleton')).toHaveLength(5);
    expect([...container.querySelectorAll('.mobile-item')].map((el) => el.textContent))
      .toEqual(['Inicio', 'Mis Rutas', 'Solicitudes', 'Mensajes', 'Guardian']);
  });

  test('con menús: muestra solo los raíz con permiso; Inicio aparece con cualquier permiso /inicio/*', async () => {
    iniciarSesion();
    stubApi({
      '/api/menus': MENUS,
      '/api/admin/permisos': [{ menuUrl: '/inicio/crear' }, { menuUrl: '/mensajes' }, { menuUrl: '/reportes-mensuales' }],
    });
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(etiquetasMenu(container)).toEqual(['Inicio', 'Mensajes', 'Reportes']));
  });

  test('sin ningún permiso de Inicio, Inicio no aparece en el menú aunque sea la pestaña abierta', async () => {
    iniciarSesion();
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': [{ menuUrl: '/guardian' }] });
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(etiquetasMenu(container)).toEqual(['Guardian']));
    expect(screen.getByText('Crear nueva ruta')).toBeTruthy();
  });

  test('comportamiento actual: sin usuario los permisos quedan en null y se usa el menú fijo aunque haya menús en la BD', async () => {
    stubApi({ '/api/menus': MENUS });
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(etiquetasMenu(container)).toEqual(['Inicio', 'Mis Rutas', 'Solicitudes', 'Mensajes', 'Guardian']));
    expect(screen.getByText('Crear nueva ruta').disabled).toBe(false);
  });

  test('si falla el pedido de permisos, el usuario queda sin permisos', async () => {
    iniciarSesion();
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': () => new Response('{}', { status: 500 }) });
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Crear nueva ruta').disabled).toBe(true));
    expect(etiquetasMenu(container)).toEqual([]);
  });

  test('un menú desconocido abre la vista dinámica con su etiqueta e identificador', async () => {
    iniciarSesion();
    stubApi({ '/api/menus': MENUS, '/api/admin/permisos': [{ menuUrl: '/reportes-mensuales' }] });
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Reportes', { selector: '.nav-item' }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Reportes');
    expect(screen.getByText('reportes-mensuales')).toBeTruthy();
  });

  test('el logo navega a /dashboard', async () => {
    stubApi();
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Bycar'));

    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});

describe('Dashboard · carga inicial (caracterización)', () => {
  test('saluda con NOMBRE_USU, nombre_usu o "Pasajero"', async () => {
    iniciarSesion({ id_usu: 8, nombre_usu: 'beto' });
    stubApi();
    render(<DashboardPage />);
    expect(await screen.findByText('¡Hola, beto! 👋')).toBeTruthy();
    cleanup();
    localStorage.clear();

    render(<DashboardPage />);
    expect(await screen.findByText('¡Hola, Pasajero! 👋')).toBeTruthy();
  });

  test('un usuario corrupto en localStorage se registra y se sigue sin usuario', async () => {
    localStorage.setItem('user', '{no es json');
    stubApi();
    render(<DashboardPage />);

    expect(await screen.findByText('¡Hola, Pasajero! 👋')).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith('Usuario guardado inválido en localStorage:', expect.any(SyntaxError));
  });

  test('los municipios aceptan las columnas de Oracle (ID_MUN / NOMBRE_MUN)', async () => {
    stubApi({ '/api/municipios': [{ ID_MUN: 3, NOMBRE_MUN: 'PEREIRA' }] });
    render(<DashboardPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    fireEvent.change((await screen.findAllByPlaceholderText('Origen'))[0], { target: { value: 'pere' } });

    expect(await screen.findByText('PEREIRA', { selector: 'li' })).toBeTruthy();
  });

  test('comportamiento actual: un municipio sin nombre rompe el autocompletado al escribir (F34)', async () => {
    stubApi({ '/api/municipios': [{ ID_MUN: 3, NOMBRE_MUN: 'PEREIRA' }, { ID_MUN: 4, NOMBRE_MUN: null }] });
    render(<DashboardPage />);
    const origen = (await screen.findAllByPlaceholderText('Origen'))[0];
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    // Esperar a que los municipios estén en el estado: el filtro recién corre al re-renderizar
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(() => fireEvent.change(origen, { target: { value: 'pere' } })).toThrow('str.normalize is not a function');
  });

  test('un catálogo con error se toma como lista vacía', async () => {
    stubApi({ '/api/municipios': () => new Response('{}', { status: 500 }) });
    render(<DashboardPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    fireEvent.change((await screen.findAllByPlaceholderText('Origen'))[0], { target: { value: 'bog' } });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('BOGOTA', { selector: 'li' })).toBeNull();
  });

  test('Mis Rutas se ordena por id descendente y muestra el estado de las solicitadas', async () => {
    iniciarSesion();
    stubApi({
      '/api/viajes/mis-rutas': {
        publicadas: [{ id: 1, origen: 'A', destino: 'B' }, { id: 3, origen: 'C', destino: 'D' }],
        solicitadas: [{ id: 2, origen: 'E', destino: 'F', conductor: 'LUIS', fecha: '2026-10-01', estado: 'Rechazada' }, { id: 5, origen: 'G', destino: 'H', estado: 'Aceptada' }],
      },
    });
    render(<DashboardPage />);
    clickNav('Mis Rutas');

    await waitFor(() => expect(screen.getAllByText(/→/).map((el) => el.textContent)).toEqual(['C → D', 'A → B', 'G → H', 'E → F']));
    expect(screen.getByText('Rechazada').className).toBe('badge-status Rechazada');
  });
});

describe('Dashboard · refresco periódico (caracterización, DT-33)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));

  const urlsTrasTick = async () => {
    const antes = fetch.mock.calls.length;
    act(() => { vi.advanceTimersByTime(10000); });
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(antes));
    return llamadas('GET', '/api/').slice(antes).map((c) => c.url.split('?')[0]).sort();
  };

  test('cada 10 s pide mis rutas y chats; suma recibidas en Solicitudes y alertas en Guardián', async () => {
    iniciarSesion();
    stubApi();
    render(<DashboardPage />);
    await waitFor(() => expect(llamadas('GET', '/api/mensajes/chats')).toHaveLength(1));

    expect(await urlsTrasTick()).toEqual(['/api/mensajes/chats', '/api/viajes/mis-rutas']);

    clickNav('Solicitudes');
    await waitFor(() => expect(llamadas('GET', '/api/mensajes/chats')).toHaveLength(3));
    expect(await urlsTrasTick()).toEqual(['/api/mensajes/chats', '/api/solicitudes/recibidas', '/api/viajes/mis-rutas']);

    clickNav('Guardian');
    await waitFor(() => expect(llamadas('GET', '/api/mensajes/chats')).toHaveLength(5));
    expect(await urlsTrasTick()).toEqual(['/api/guardian', '/api/mensajes/chats', '/api/viajes/mis-rutas']);
  });

  test('sin usuario no hay refresco periódico', async () => {
    stubApi();
    render(<DashboardPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    act(() => { vi.advanceTimersByTime(30000); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('un chat nuevo que llega por refresco suma al contador de Mensajes hasta que se abre la pestaña', async () => {
    iniciarSesion();
    let chats = [];
    stubApi({ '/api/mensajes/chats': () => chats });
    const { container } = render(<DashboardPage />);
    const badgeMensajes = () =>
      [...container.querySelectorAll('.mobile-item')].find((el) => el.textContent.includes('Mensajes')).textContent;
    await waitFor(() => expect(llamadas('GET', '/api/mensajes/chats')).toHaveLength(1));

    chats = [{ chatId: 1, nombre: 'LUIS', ruta: 'A → B', fecha: 'x' }];
    act(() => { vi.advanceTimersByTime(10000); });
    await waitFor(() => expect(badgeMensajes()).toBe('1Mensajes'));

    clickNav('Mensajes');
    await waitFor(() => expect(badgeMensajes()).toBe('Mensajes'));
  });
});
