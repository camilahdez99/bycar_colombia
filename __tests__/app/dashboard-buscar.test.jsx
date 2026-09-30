import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const VIAJES = [
  { id: 9, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', hora: '2026-10-01', valor: 25000, puestos: 3, carro: 'MAZDA', comentarios: 'SIN MASCOTAS' },
  { id: 10, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'EVA', hora: '2026-10-02', valor: '30,000', puestos: 1 },
];

async function buscar({ origen, destino } = {}) {
  await screen.findAllByPlaceholderText('Origen');
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
  if (origen) fireEvent.change(screen.getAllByPlaceholderText('Origen')[0], { target: { value: origen } });
  if (destino) fireEvent.change(screen.getAllByPlaceholderText('Destino')[0], { target: { value: destino } });
  fireEvent.click(screen.getByText('Buscar rutas disponibles'));
  await screen.findByText('Resultados de búsqueda');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · buscar viajes (caracterización)', () => {
  test('arma la URL con origen y destino normalizados (sin tildes, en mayúsculas)', async () => {
    stubApi({ '/api/viajes?': VIAJES });
    render(<DashboardPage />);
    await buscar({ origen: 'bogotá', destino: 'tunja' });

    await waitFor(() => expect(llamadas('GET', '/api/viajes?')).toHaveLength(1));
    expect(llamadas('GET', '/api/viajes?')[0].url).toBe('/api/viajes?origen=BOGOTA&destino=TUNJA');
  });

  test('sin filtros pide /api/viajes sin query', async () => {
    stubApi({ '/api/viajes$': [] });
    render(<DashboardPage />);
    await buscar();

    const busquedas = () => llamadas('GET', '/api/viajes').filter((c) => !c.url.startsWith('/api/viajes/'));
    await waitFor(() => expect(busquedas()).toHaveLength(1));
    expect(busquedas()[0].url).toBe('/api/viajes');
    expect(await screen.findByText('No se encontraron viajes con esos criterios.')).toBeTruthy();
  });

  test('muestra cada viaje con el valor tal como llega (sin formatear) y avisa cuántos encontró', async () => {
    stubApi({ '/api/viajes$': VIAJES });
    render(<DashboardPage />);
    await buscar();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Se encontraron 2 viajes', { id: 'toast-id' }));
    expect(toast.loading).toHaveBeenCalledWith('Buscando viajes...');
    expect(screen.getByText('$25000')).toBeTruthy();
    expect(screen.getByText('$30,000')).toBeTruthy();
    expect(screen.getByText('Conductor: LUIS • 2026-10-01')).toBeTruthy();
  });

  test('error de la API: avisa y vacía los resultados', async () => {
    stubApi({ '/api/viajes$': () => new Response('{"error":"x"}', { status: 500 }) });
    render(<DashboardPage />);
    await buscar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al buscar viajes', { id: 'toast-id' }));
    expect(screen.getByText('No se encontraron viajes con esos criterios.')).toBeTruthy();
  });

  test('falla de red: "Error de conexión"', async () => {
    stubApi({ '/api/viajes$': () => { throw new TypeError('Failed to fetch'); } });
    render(<DashboardPage />);
    await buscar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión', { id: 'toast-id' }));
  });

  test('"Volver" regresa a Inicio', async () => {
    stubApi({ '/api/viajes$': [] });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click(screen.getByText('Volver'));

    expect(await screen.findByText('Crear nueva ruta')).toBeTruthy();
  });

  test('sin el permiso /inicio/buscar el botón queda deshabilitado', async () => {
    stubApi({ '/api/admin/permisos': [{ menuUrl: '/inicio/crear' }] });
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Buscar rutas disponibles').disabled).toBe(true));
  });
});

describe('Dashboard · solicitar cupo (caracterización)', () => {
  test('solicitud aceptada por la API: el botón pasa a "Pendiente" deshabilitado', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': { message: 'ok' } });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click((await screen.findAllByText('Solicitar'))[0]);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Solicitud enviada al conductor', { id: 'toast-id' }));
    expect(toast.loading).toHaveBeenCalledWith('Enviando solicitud...');
    expect(screen.getByText('Pendiente').disabled).toBe(true);
    expect(screen.getByText('Solicitar').disabled).toBe(false);
    expect(llamadas('POST', '/api/solicitudes').map((c) => c.body)).toEqual([{ viajeId: 9, usuarioId: 7 }]);
  });

  test('error de la API: avisa y el botón sigue disponible', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': () => new Response('{}', { status: 403 }) });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click((await screen.findAllByText('Solicitar'))[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al enviar solicitud', { id: 'toast-id' }));
    expect(screen.getAllByText('Solicitar')).toHaveLength(2);
  });

  test('falla de red: "Error de conexión"', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': () => { throw new TypeError('Failed to fetch'); } });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click((await screen.findAllByText('Solicitar'))[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión', { id: 'toast-id' }));
  });

  test('las solicitudes enviadas se recuerdan en la sesión de la página aunque se repita la búsqueda', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': { message: 'ok' } });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click((await screen.findAllByText('Solicitar'))[0]);
    await screen.findByText('Pendiente');

    fireEvent.click(screen.getByText('Volver'));
    await buscar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(3));
    expect(screen.getByText('Pendiente').disabled).toBe(true);
  });

  test('"Ver Detalles" muestra los datos del viaje, con valores por defecto para carro y comentarios', async () => {
    stubApi({ '/api/viajes$': VIAJES });
    render(<DashboardPage />);
    await buscar();

    fireEvent.click((await screen.findAllByText('Ver Detalles'))[1]);
    const modal = screen.getByText('Detalles del Viaje').parentElement;
    expect(modal.textContent).toContain('Conductor: EVA');
    expect(modal.textContent).toContain('Vehículo: N/A');
    expect(modal.textContent).toContain('Fecha: 2026-10-02');
    expect(modal.textContent).toContain('Puestos Disp: 1');
    expect(modal.textContent).toContain('Valor: $30,000');
    expect(modal.textContent).toContain('Sin comentarios adicionales.');

    fireEvent.click(modal.querySelector('button'));
    expect(screen.queryByText('Detalles del Viaje')).toBeNull();
  });

  test('"Solicitar Cupo" desde el detalle cierra el modal y envía la solicitud; al reabrirlo dice "Solicitud Pendiente"', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': { message: 'ok' } });
    render(<DashboardPage />);
    await buscar();

    fireEvent.click((await screen.findAllByText('Ver Detalles'))[0]);
    expect(screen.getByText('SIN MASCOTAS')).toBeTruthy();
    fireEvent.click(screen.getByText('Solicitar Cupo'));

    expect(screen.queryByText('Detalles del Viaje')).toBeNull();
    await waitFor(() => expect(llamadas('POST', '/api/solicitudes')).toHaveLength(1));
    await screen.findByText('Pendiente');

    fireEvent.click(screen.getAllByText('Ver Detalles')[0]);
    expect(screen.getByText('Solicitud Pendiente').disabled).toBe(true);
  });
});
