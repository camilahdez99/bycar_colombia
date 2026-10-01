// DT-33 · Polling del dashboard: requests y bytes por minuto en régimen estable.
// Corre con: npm run perf:dashboard
import { afterAll, afterEach, beforeEach, describe, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, rutaDe, stubApi } from '@/__tests__/helpers/dashboard';
import { CHATS, HISTORIAL_CHAT, MIS_RUTAS, MUNICIPIOS, RECIBIDAS } from './fixtures';
import { reportar } from './reporte';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const MINUTOS = 10;

const RUTAS = {
  '/api/municipios': MUNICIPIOS,
  '/api/viajes/mis-rutas': MIS_RUTAS,
  '/api/mensajes/chats': CHATS,
  '/api/mensajes?chatId': HISTORIAL_CHAT,
  '/api/solicitudes/recibidas': RECIBIDAS,
};

/** Bytes del body JSON que devuelve el stub para una URL (lo que viajaría por la red). */
function bytesDe(url) {
  const clave = Object.keys(RUTAS).find((k) => url.startsWith(k));
  return clave ? JSON.stringify(RUTAS[clave]).length : 2;
}

function setVisibilidad(estado) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => estado === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Avanza el reloj de a un segundo, dejando resolver las promesas de cada fetch. */
async function pasarMinutos(minutos) {
  for (let s = 0; s < minutos * 60; s++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  }
}

/** Mide solo el régimen estable: descarta la carga inicial y los efectos de navegación. */
async function medir(nombre, preparar) {
  const fetchMock = stubApi(RUTAS);
  render(<DashboardPage />);
  await act(async () => {});
  await preparar();
  await pasarMinutos(0.5);

  const desde = fetchMock.mock.calls.length;
  await pasarMinutos(MINUTOS);
  const urls = fetchMock.mock.calls.slice(desde).map(([input]) => rutaDe(input));

  const porEndpoint = {};
  for (const url of urls) {
    const endpoint = url.split('?')[0] + (url.includes('chatId') ? '?chatId' : '');
    porEndpoint[endpoint] = (porEndpoint[endpoint] || 0) + 1;
  }
  const bytes = urls.reduce((total, url) => total + bytesDe(url), 0);
  resultados.push({
    escenario: nombre,
    'requests/min': +(urls.length / MINUTOS).toFixed(1),
    'KB/min': +(bytes / 1024 / MINUTOS).toFixed(1),
    detalle: Object.entries(porEndpoint).map(([e, n]) => `${e}: ${(n / MINUTOS).toFixed(1)}/min`).join(', '),
  });
}

const resultados = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
  setVisibilidad('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(() => reportar('DT-33 · Polling del dashboard', resultados));

describe('DT-33 · polling del dashboard', () => {
  test('pestaña Inicio, visible', async () => {
    await medir('Inicio, pestaña visible', async () => {});
  });

  test('pestaña Inicio, navegador en otra pestaña', async () => {
    await medir('Inicio, pestaña oculta', async () => { setVisibilidad('hidden'); });
  });

  test('pestaña Mensajes con un chat abierto', async () => {
    await medir('Mensajes, chat abierto (40 msjs)', async () => {
      clickNav('Mensajes');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByText('CONTACTO 1'));
    });
  });

  test('pestaña Mensajes con un chat abierto, navegador en otra pestaña', async () => {
    await medir('Mensajes, chat abierto, pestaña oculta', async () => {
      clickNav('Mensajes');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByText('CONTACTO 1'));
      setVisibilidad('hidden');
    });
  });
});
