import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

function setOculta(oculta) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculta });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

const pasarSegundos = (s) => act(() => { vi.advanceTimersByTime(s * 1000); });
const pedidos = () => llamadas('GET', '/api/viajes/mis-rutas').length + llamadas('GET', '/api/mensajes/chats').length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Dashboard · polling con la pestaña del navegador oculta (DT-33)', () => {
  test('oculta no refresca mis-rutas ni chats; al volver refresca enseguida y retoma cada 10 s', async () => {
    stubApi();
    render(<DashboardPage />);
    await act(async () => {});
    const alMontar = pedidos();

    setOculta(true);
    pasarSegundos(60);
    expect(pedidos()).toBe(alMontar);

    setOculta(false);
    expect(pedidos()).toBe(alMontar + 2);
    pasarSegundos(10);
    expect(pedidos()).toBe(alMontar + 4);
  });

  test('el chat abierto deja de pedir el historial mientras la pestaña está oculta', async () => {
    stubApi({ '/api/mensajes/chats': [{ chatId: 9, nombre: 'LUIS', ruta: 'BOGOTA → TUNJA', fecha: '2026-10-01' }] });
    render(<DashboardPage />);
    clickNav('Mensajes');
    fireEvent.click(await screen.findByText('LUIS'));
    await act(async () => {});
    const historial = () => llamadas('GET', '/api/mensajes?chatId=9').length;
    const alAbrir = historial();

    setOculta(true);
    pasarSegundos(30);
    expect(historial()).toBe(alAbrir);

    setOculta(false);
    expect(historial()).toBe(alAbrir + 1);
    pasarSegundos(3);
    expect(historial()).toBe(alAbrir + 2);
  });
});
