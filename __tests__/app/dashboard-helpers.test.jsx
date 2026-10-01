import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
}));

const USUARIO = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'PEREZ', CORREO_USU: 'ana@x.co' };

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubApi(overrides = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    // buscarViajes pide con una URL absoluta; el resto con rutas relativas
    const url = String(input).replace(/^https?:\/\/[^/]+/, '');
    for (const [prefix, body] of Object.entries(overrides)) {
      const matches = prefix.endsWith('$') ? url === prefix.slice(0, -1) : url.startsWith(prefix);
      if (matches) return jsonResponse(body);
    }
    if (url.startsWith('/api/municipios')) return jsonResponse([{ id: 1, nombre: 'BOGOTA' }, { id: 2, nombre: 'MEDELLIN' }]);
    if (url.startsWith('/api/viajes/mis-rutas')) return jsonResponse({ publicadas: [], solicitadas: [] });
    if (url.startsWith('/api/guardian')) return jsonResponse(null);
    return jsonResponse([]);
  }));
}

const clickNav = (label) => fireEvent.click(screen.getAllByText(label)[0]);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DashboardPage (caracterización de helpers vía UI)', () => {
  test('formatCurrency: el valor del viaje se muestra con separador de miles y sin otros caracteres', async () => {
    stubApi();
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Crear nueva ruta'));

    const valor = screen.getByPlaceholderText('Valor por persona');
    fireEvent.change(valor, { target: { value: '$1234567abc' } });
    expect(valor.value).toBe('1,234,567');
  });

  test('handleInputChange: los demás campos del formulario pasan a mayúsculas', async () => {
    stubApi();
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Crear nueva ruta'));

    const placa = screen.getByPlaceholderText('Placa (Ej: XYZ123)');
    fireEvent.change(placa, { target: { value: 'abc123' } });
    expect(placa.value).toBe('ABC123');
  });

  test('normalizar: el autocompletado quita tildes, pasa a mayúsculas y filtra municipios', async () => {
    stubApi();
    render(<DashboardPage />);
    const origen = (await screen.findAllByPlaceholderText('Origen'))[0];
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));

    fireEvent.change(origen, { target: { value: 'bogotá' } });
    expect(origen.value).toBe('BOGOTA');
    expect(await screen.findByText('BOGOTA', { selector: 'li' })).toBeTruthy();
    expect(screen.queryByText('MEDELLIN', { selector: 'li' })).toBeNull();
  });

  test('formatTiempo: el guardián activo muestra el tiempo restante como mm:ss', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const inicio = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
    stubApi({
      '/api/guardian?usuarioId': {
        id: 77, inicio, tiempoMin: 45, viajeId: 5, estado: 'Activo', email: 'x@y.co',
        origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', placa: 'ABC123', carro: 'Mazda',
      },
    });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText(/^4[45]:\d\d$/)).toBeTruthy();
  });

  test('getBadgeCount: las solicitudes recibidas se cuentan en el menú', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    stubApi({
      '/api/solicitudes/recibidas': [
        { id: 1, pasajero: 'A', ruta: 'X -> Y', avatar: 'U' },
        { id: 2, pasajero: 'B', ruta: 'X -> Y', avatar: 'U' },
      ],
    });
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      const item = [...container.querySelectorAll('.mobile-item')].find((el) => el.textContent.includes('Solicitudes'));
      expect(item.textContent).toBe('2Solicitudes');
    });
  });

  test('getBadgeCount: cambios de estado de rutas solicitadas cuentan hasta que se visita la pestaña', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    stubApi({
      '/api/viajes/mis-rutas': {
        publicadas: [],
        solicitadas: [
          { id: 1, estado: 'Aceptada', origen: 'A', destino: 'B' },
          { id: 2, estado: 'Rechazada', origen: 'A', destino: 'B' },
          { id: 3, estado: 'Pendiente', origen: 'A', destino: 'B' },
        ],
      },
    });
    const { container } = render(<DashboardPage />);
    const badgeRutas = () =>
      [...container.querySelectorAll('.mobile-item')].find((el) => el.textContent.includes('Mis Rutas')).textContent;

    await waitFor(() => expect(badgeRutas()).toBe('2Mis Rutas'));
    clickNav('Mis Rutas');
    await waitFor(() => expect(badgeRutas()).toBe('Mis Rutas'));
    clickNav('Inicio');
    await waitFor(() => expect(badgeRutas()).toBe('Mis Rutas'));
  });

  test('getUserId: la solicitud de viaje usa ID_USU del usuario guardado', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    stubApi({
      '/api/viajes$': [{ id: 9, origen: 'A', destino: 'B', conductor: 'C', hora: '2026-10-01', valor: 1000 }],
      // Con usuario, los botones de Inicio dependen de sus permisos
      '/api/admin/permisos': [{ menuUrl: '/inicio/buscar' }],
    });
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Buscar rutas disponibles'));
    fireEvent.click(await screen.findByText('Solicitar'));

    await waitFor(() => {
      const post = fetch.mock.calls.find(([url, init]) => url === '/api/solicitudes' && init?.method === 'POST');
      expect(JSON.parse(post[1].body)).toEqual({ viajeId: 9, usuarioId: 7 });
    });
  });

  test('getUserId: sin usuario, no envía la solicitud y avisa que hay que iniciar sesión (F1)', async () => {
    stubApi({ '/api/viajes$': [{ id: 9, origen: 'A', destino: 'B', conductor: 'C', hora: '2026-10-01', valor: 1000 }] });
    render(<DashboardPage />);
    fireEvent.click(await screen.findByText('Buscar rutas disponibles'));
    fireEvent.click(await screen.findByText('Solicitar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Inicia sesión para continuar'));
    expect(fetch.mock.calls.some(([url]) => url === '/api/solicitudes')).toBe(false);
  });
});
