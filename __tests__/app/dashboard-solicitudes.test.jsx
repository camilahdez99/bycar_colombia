import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const RECIBIDAS = [
  { id: 31, pasajero: 'JUAN GOMEZ', ruta: 'BOGOTA → TUNJA', avatar: 'J' },
  { id: 32, pasajero: 'MARIA DIAZ', ruta: 'BOGOTA → TUNJA', avatar: 'M' },
];

async function abrirSolicitudes() {
  render(<DashboardPage />);
  clickNav('Solicitudes');
  await screen.findByText('JUAN GOMEZ');
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

describe('Dashboard · solicitudes recibidas (caracterización)', () => {
  test('lista pasajero, ruta y avatar de cada solicitud', async () => {
    stubApi({ '/api/solicitudes/recibidas': RECIBIDAS });
    await abrirSolicitudes();

    expect(screen.getByText('MARIA DIAZ')).toBeTruthy();
    expect(screen.getAllByText('Ruta: BOGOTA → TUNJA')).toHaveLength(2);
    expect(screen.getByText('J')).toBeTruthy();
  });

  test('una respuesta que no es lista se muestra como lista vacía', async () => {
    stubApi({ '/api/solicitudes/recibidas': { error: 'x' } });
    render(<DashboardPage />);
    clickNav('Solicitudes');

    await screen.findByText('Solicitudes Recibidas');
    await waitFor(() => expect(llamadas('GET', '/api/solicitudes/recibidas').length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText('Aceptar')).toBeNull();
  });

  test('aceptar: PUT con estado "Aceptado", la quita de la lista, avisa y vuelve a pedir los chats', async () => {
    stubApi({ '/api/solicitudes/recibidas': RECIBIDAS, 'PUT /api/solicitudes': { message: 'ok' } });
    await abrirSolicitudes();
    const chatsAntes = llamadas('GET', '/api/mensajes/chats').length;

    fireEvent.click(screen.getAllByText('Aceptar')[0]);

    await waitFor(() => expect(screen.queryByText('JUAN GOMEZ')).toBeNull());
    expect(llamadas('PUT', '/api/solicitudes').map((c) => c.body)).toEqual([{ solicitudId: 31, estado: 'Aceptado' }]);
    expect(toast.loading).toHaveBeenCalledWith('Aceptando solicitud...');
    expect(toast.success).toHaveBeenCalledWith('Solicitud aceptada', { id: 'toast-id' });
    await waitFor(() => expect(llamadas('GET', '/api/mensajes/chats').length).toBe(chatsAntes + 1));
    expect(screen.getByText('MARIA DIAZ')).toBeTruthy();
  });

  test('rechazar: PUT con estado "Rechazado" y no vuelve a pedir los chats', async () => {
    stubApi({ '/api/solicitudes/recibidas': RECIBIDAS, 'PUT /api/solicitudes': { message: 'ok' } });
    await abrirSolicitudes();
    const chatsAntes = llamadas('GET', '/api/mensajes/chats').length;

    fireEvent.click(screen.getAllByText('Rechazar')[1]);

    await waitFor(() => expect(screen.queryByText('MARIA DIAZ')).toBeNull());
    expect(llamadas('PUT', '/api/solicitudes').map((c) => c.body)).toEqual([{ solicitudId: 32, estado: 'Rechazado' }]);
    expect(toast.loading).toHaveBeenCalledWith('Rechazando solicitud...');
    expect(toast.success).toHaveBeenCalledWith('Solicitud rechazada', { id: 'toast-id' });
    expect(llamadas('GET', '/api/mensajes/chats').length).toBe(chatsAntes);
  });

  test('error de la API: avisa y la solicitud sigue en la lista', async () => {
    stubApi({ '/api/solicitudes/recibidas': RECIBIDAS, 'PUT /api/solicitudes': () => new Response('{}', { status: 403 }) });
    await abrirSolicitudes();
    fireEvent.click(screen.getAllByText('Aceptar')[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al actualizar solicitud', { id: 'toast-id' }));
    expect(screen.getByText('JUAN GOMEZ')).toBeTruthy();
  });

  test('falla de red: "Error de conexión"', async () => {
    stubApi({ '/api/solicitudes/recibidas': RECIBIDAS, 'PUT /api/solicitudes': () => { throw new TypeError('Failed to fetch'); } });
    await abrirSolicitudes();
    fireEvent.click(screen.getAllByText('Rechazar')[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión', { id: 'toast-id' }));
  });
});
