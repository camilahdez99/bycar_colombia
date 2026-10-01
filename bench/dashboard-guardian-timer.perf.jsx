// DT-35 · Temporizador del guardián: costo de render por segundo y desfase en segundo plano.
// Corre con: npm run perf:dashboard
import { afterAll, afterEach, beforeEach, describe, test, vi } from 'vitest';
import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { normalizar } from '@/lib/client/formato';
import { clickNav, iniciarSesion, stubApi } from '@/__tests__/helpers/dashboard';
import { MUNICIPIOS } from './fixtures';
import { reportar } from './reporte';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));
// Mismo normalizar, envuelto para contar cuántas veces filtra el Autocomplete
vi.mock('@/lib/client/formato', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, normalizar: vi.fn(real.normalizar) };
});

const SEGUNDOS = 60;
const resultados = [];

/** "YYYY-MM-DD HH:mm:ss" local, como lo devuelve la API del guardián. */
function fechaApi(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Monta el dashboard con un guardián activo de 30 min recién iniciado. */
async function montarConGuardian(onRender) {
  stubApi({
    '/api/municipios': MUNICIPIOS,
    '/api/guardian?usuarioId': {
      id: 77, viajeId: 40, email: 'MAMA@X.CO', tiempoMin: 30, estado: 'Activo', inicio: fechaApi(new Date()),
      origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', placa: 'ABC123', carro: 'MAZDA',
    },
  });
  render(<Profiler id="dashboard" onRender={onRender}><DashboardPage /></Profiler>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => {});
}

async function medirTicks(nombre, preparar) {
  let commits = 0;
  let msRender = 0;
  let medir = false;
  await montarConGuardian((_id, _fase, actualDuration) => {
    if (!medir) return;
    commits += 1;
    msRender += actualDuration;
  });
  await preparar();
  // Polling (cada 10 s) apagado del cálculo: se mide solo el tick del temporizador
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });

  normalizar.mockClear();
  medir = true;
  const inicio = performance.now();
  for (let s = 0; s < SEGUNDOS; s++) {
    await act(async () => { vi.advanceTimersByTime(1000); });
  }
  const msTotal = performance.now() - inicio;
  medir = false;

  resultados.push({
    escenario: nombre,
    'commits/s': +(commits / SEGUNDOS).toFixed(2),
    'ms render/s (Profiler)': +(msRender / SEGUNDOS).toFixed(2),
    'ms CPU/s (pared)': +(msTotal / SEGUNDOS).toFixed(2),
    'normalizar()/s': Math.round(normalizar.mock.calls.length / SEGUNDOS),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-10-01T10:00:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(() => reportar('DT-35 · Temporizador del guardián', resultados));

describe('DT-35 · temporizador del guardián', () => {
  test('guardián activo, usuario en Inicio buscando un municipio', async () => {
    await medirTicks('Inicio + Autocomplete con texto', async () => {
      fireEvent.change(screen.getAllByPlaceholderText('Origen')[0], { target: { value: 'MUNICIPIO 00' } });
    });
  });

  test('guardián activo, usuario mirando el contador', async () => {
    await medirTicks('Pestaña Guardián', async () => { clickNav('Guardian'); });
  });

  test('desfase tras 5 min en segundo plano (el navegador dispara 1 tick por minuto)', async () => {
    await montarConGuardian(() => {});
    clickNav('Guardian');
    for (let min = 0; min < 5; min++) {
      vi.setSystemTime(Date.now() + 59000);
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    const mostrado = screen.getByText(/^\d\d:\d\d$/).textContent;
    const [m, s] = mostrado.split(':').map(Number);
    const esperado = 30 * 60 - 5 * 60;
    resultados.push({
      escenario: 'Desfase tras 5 min oculto',
      mostrado,
      esperado: '25:00',
      'error (s)': m * 60 + s - esperado,
    });
  });
});
