import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, hoy, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const VIAJE_HOY = { id: 5, viajeId: 40, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', placa: 'ABC123', carro: 'MAZDA', estado: 'Aceptada', fecha: hoy() };

function misRutas(solicitadas) {
  return { '/api/viajes/mis-rutas': { publicadas: [], solicitadas } };
}

async function abrirConfiguracion(rutas = {}) {
  stubApi({ ...misRutas([VIAJE_HOY]), 'POST /api/guardian': { id: 77 }, 'PUT /api/guardian': { message: 'ok' }, ...rutas });
  render(<DashboardPage />);
  clickNav('Guardian');
  fireEvent.click(await screen.findByText('Activar'));
  await screen.findByText('🛡️ Configurar Guardián');
}

function configurar({ email, minutos }) {
  if (email !== undefined) fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), { target: { value: email } });
  if (minutos !== undefined) fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: minutos } });
}

const iniciar = () => fireEvent.click(screen.getByText('🛡️ Iniciar Viaje Seguro'));
const pasarSegundos = (segundos) => act(() => { vi.advanceTimersByTime(segundos * 1000); });

/** Fecha "YYYY-MM-DD HH:mm:ss" local, como la devuelve la API del guardián. */
function haceSegundos(segundos) {
  const d = new Date(Date.now() - segundos * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const guardianGuardado = (extra) => ({
  id: 77, viajeId: 40, email: 'MAMA@X.CO', tiempoMin: 30, estado: 'Activo',
  origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', placa: 'ABC123', carro: 'MAZDA', ...extra,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · guardián: viajes de hoy (caracterización)', () => {
  test('solo ofrece las rutas solicitadas aceptadas con fecha de hoy', async () => {
    stubApi(misRutas([
      VIAJE_HOY,
      { ...VIAJE_HOY, id: 6, destino: 'PASTO', estado: 'ACEPTADO' },
      { ...VIAJE_HOY, id: 7, destino: 'CALI', estado: 'Pendiente' },
      { ...VIAJE_HOY, id: 8, destino: 'NEIVA', fecha: '2020-01-01' },
      { ...VIAJE_HOY, id: 9, destino: 'IBAGUE', estado: null },
    ]));
    render(<DashboardPage />);
    clickNav('Guardian');

    await waitFor(() => expect(screen.getAllByText('Activar')).toHaveLength(2));
    expect(screen.getByText('BOGOTA → TUNJA')).toBeTruthy();
    expect(screen.getByText('BOGOTA → PASTO')).toBeTruthy();
  });

  test('sin viajes de hoy muestra el aviso', async () => {
    stubApi();
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('No tienes viajes aceptados para el día de hoy.')).toBeTruthy();
  });

  test('el modal de configuración muestra los datos del vehículo y arranca con 30 minutos', async () => {
    await abrirConfiguracion();
    const modal = screen.getByText('🛡️ Configurar Guardián').parentElement;

    expect(modal.textContent).toContain('Vehículo: MAZDA');
    expect(modal.textContent).toContain('Placa: ABC123');
    expect(modal.textContent).toContain(`📅 ${hoy()}`);
    expect(screen.getByPlaceholderText('30').value).toBe('30');
    expect(screen.getByPlaceholderText('ejemplo@correo.com').value).toBe('');

    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('🛡️ Configurar Guardián')).toBeNull();
  });
});

describe('Dashboard · guardián: activar y finalizar (caracterización)', () => {
  test('sin correo, o con un tiempo que no es número (queda en 0), no llama a la API', async () => {
    await abrirConfiguracion();
    iniciar();
    configurar({ email: 'mama@x.co', minutos: 'abc' });
    iniciar();

    expect(toast.error.mock.calls).toEqual([['Configura el correo y tiempo estimado'], ['Configura el correo y tiempo estimado']]);
    expect(llamadas('POST', '/api/guardian')).toEqual([]);
  });

  test('activar: POST con viajeId (antes que id), correo recortado en mayúsculas y tiempo; muestra el viaje en curso', async () => {
    await abrirConfiguracion();
    configurar({ email: '  mama@x.co ', minutos: '45' });
    iniciar();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('🛡️ Guardián activado en base de datos. ¡Buen viaje!'));
    expect(llamadas('POST', '/api/guardian').map((c) => c.body)).toEqual([
      { viajeId: 40, usuarioId: 7, email: 'MAMA@X.CO', tiempo: 45 },
    ]);
    expect(screen.queryByText('🛡️ Configurar Guardián')).toBeNull();
    expect(screen.getByText('Viaje en Curso')).toBeTruthy();
    expect(screen.getByText('45:00')).toBeTruthy();
    expect(screen.getByText('✅ EN CAMINO')).toBeTruthy();
    // El panel muestra el correo tal como se escribió; a la API va normalizado
    expect(screen.getByText('mama@x.co')).toBeTruthy();
  });

  test('error de la API: muestra el ID del viaje y el error, y el modal sigue abierto', async () => {
    await abrirConfiguracion({ 'POST /api/guardian': () => new Response('{"error":"Viaje no encontrado"}', { status: 404 }) });
    configurar({ email: 'mama@x.co' });
    iniciar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error (ID: 40): Viaje no encontrado'));
    expect(screen.getByText('🛡️ Configurar Guardián')).toBeTruthy();
  });

  test('falla de red: "Error de conexión con el servidor"', async () => {
    await abrirConfiguracion({ 'POST /api/guardian': () => { throw new TypeError('Failed to fetch'); } });
    configurar({ email: 'mama@x.co' });
    iniciar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión con el servidor'));
  });

  test('"He llegado": PUT con estado Inactivo y vuelve a la lista de viajes', async () => {
    await abrirConfiguracion();
    configurar({ email: 'mama@x.co' });
    iniciar();
    fireEvent.click(await screen.findByText('✅ He llegado a mi destino'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('✅ ¡Llegaste bien! Guardián desactivado.'));
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, estado: 'Inactivo' }]);
    expect(screen.queryByText('Viaje en Curso')).toBeNull();
    expect(screen.getByText('Activar')).toBeTruthy();
  });

  test('si la API no devolvió id, finalizar desactiva en pantalla pero avisa que no quedó registrado (F36)', async () => {
    await abrirConfiguracion({ 'POST /api/guardian': { message: 'ok' } });
    configurar({ email: 'mama@x.co' });
    iniciar();
    fireEvent.click(await screen.findByText('✅ He llegado a mi destino'));

    await waitFor(() => expect(screen.queryByText('Viaje en Curso')).toBeNull());
    expect(toast.error).toHaveBeenCalledWith('El guardián se desactivó en este dispositivo, pero no se pudo registrar tu llegada.');
    expect(toast.success).not.toHaveBeenCalledWith('✅ ¡Llegaste bien! Guardián desactivado.');
    expect(llamadas('PUT', '/api/guardian')).toEqual([]);
  });

  test.each([
    ['la API responde error', () => new Response('{"error":"Error interno del servidor"}', { status: 500 })],
    ['falla la red', () => { throw new TypeError('Failed to fetch'); }],
  ])('si al finalizar %s, el guardián sigue activo y se pide reintentar (F38)', async (_caso, respuestaPut) => {
    await abrirConfiguracion({ 'PUT /api/guardian': respuestaPut });
    configurar({ email: 'mama@x.co' });
    iniciar();
    fireEvent.click(await screen.findByText('✅ He llegado a mi destino'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo registrar tu llegada. Intenta de nuevo.'));
    expect(toast.success).not.toHaveBeenCalledWith('✅ ¡Llegaste bien! Guardián desactivado.');
    expect(screen.getByText('Viaje en Curso')).toBeTruthy();
  });
});

describe('Dashboard · guardián: temporizador (caracterización)', () => {
  // Date también es falso: el contador se calcula contra el reloj (F39) y avanza con advanceTimersByTime
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));

  async function activarCon(minutos) {
    await abrirConfiguracion();
    configurar({ email: 'mama@x.co', minutos: String(minutos) });
    iniciar();
    await screen.findByText('Viaje en Curso');
    // El intervalo se crea en un efecto pasivo: vaciar los efectos antes de adelantar el reloj
    await act(async () => {});
  }

  test('cada segundo el contador baja un segundo', async () => {
    await activarCon(6);
    expect(screen.getByText('06:00')).toBeTruthy();

    pasarSegundos(59);
    expect(screen.getByText('05:01')).toBeTruthy();
    expect(screen.getByText('✅ EN CAMINO')).toBeTruthy();
  });

  test('a los 5 minutos restantes: aviso, modal de "¿Has llegado?" y estado "POR EXPIRAR"', async () => {
    await activarCon(6);
    pasarSegundos(60);

    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getByText('⚠️ POR EXPIRAR')).toBeTruthy();
    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
    expect(screen.getByText('⚠️ Tu viaje está por finalizar')).toBeTruthy();
    expect(toast).toHaveBeenCalledWith('⚠️ ¿Has llegado? Tu tiempo está por terminar.', { duration: 10000, icon: '🔔' });
    expect(llamadas('PUT', '/api/guardian')).toEqual([]);
  });

  test('con un tiempo de 5 minutos o menos la pre-alerta sale en el primer tick, una sola vez (F35)', async () => {
    await activarCon(5);
    pasarSegundos(1);

    expect(screen.getByText('04:59')).toBeTruthy();
    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
    pasarSegundos(30);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(llamadas('PUT', '/api/guardian')).toEqual([]);
  });

  test('al recargar con menos de 5 minutos restantes, la pre-alerta sale en el primer tick (F35)', async () => {
    stubApi({ '/api/guardian?usuarioId': guardianGuardado({ inicio: haceSegundos(26 * 60) }) });
    render(<DashboardPage />);
    clickNav('Guardian');
    await screen.findByText('Viaje en Curso');
    await act(async () => {});

    pasarSegundos(1);
    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('tras extender el tiempo, la pre-alerta vuelve a salir al bajar de nuevo a 5 minutos', async () => {
    await activarCon(6);
    pasarSegundos(60);
    fireEvent.click(screen.getByText('🕒 No, hay retraso (+15 min)'));
    await waitFor(() => expect(screen.getByText('20:00')).toBeTruthy());

    pasarSegundos(15 * 60);
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
    expect(toast).toHaveBeenCalledTimes(2);
  });

  test('"No, hay retraso": PUT con extraTiempo 15 y suma 15 minutos al contador', async () => {
    await activarCon(6);
    pasarSegundos(60);
    fireEvent.click(screen.getByText('🕒 No, hay retraso (+15 min)'));

    await waitFor(() => expect(screen.getByText('20:00')).toBeTruthy());
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, extraTiempo: 15 }]);
    expect(toast.success).toHaveBeenCalledWith('⏱️ Tiempo extendido 15 minutos');
    expect(screen.queryByText('¿Has llegado a tu destino?')).toBeNull();
    expect(screen.getByText('✅ EN CAMINO')).toBeTruthy();
  });

  test('si el PUT de "No, hay retraso" falla, no suma tiempo, el modal sigue abierto y se pide reintentar (F38)', async () => {
    await abrirConfiguracion({ 'PUT /api/guardian': () => new Response('{"error":"x"}', { status: 500 }) });
    configurar({ email: 'mama@x.co', minutos: '6' });
    iniciar();
    await screen.findByText('Viaje en Curso');
    await act(async () => {});
    pasarSegundos(60);
    fireEvent.click(screen.getByText('🕒 No, hay retraso (+15 min)'));

    // Con setInterval falso, el waitFor de Testing Library solo reintenta si cambia el DOM, y acá no cambia
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo extender el tiempo. Intenta de nuevo.'));
    expect(toast.success).not.toHaveBeenCalledWith('⏱️ Tiempo extendido 15 minutos');
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
  });

  test('"Sí, he llegado" desde el modal finaliza el guardián', async () => {
    await activarCon(6);
    pasarSegundos(60);
    fireEvent.click(screen.getByText('✅ Sí, he llegado'));

    await waitFor(() => expect(screen.queryByText('Viaje en Curso')).toBeNull());
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, estado: 'Inactivo' }]);
  });

  test('tras finalizar desde el modal de pre-alerta, el modal se cierra (F36)', async () => {
    await activarCon(6);
    pasarSegundos(60);
    fireEvent.click(screen.getByText('✅ Sí, he llegado'));

    await waitFor(() => expect(screen.queryByText('Viaje en Curso')).toBeNull());
    expect(screen.queryByText('¿Has llegado a tu destino?')).toBeNull();
  });

  test('un guardián nuevo después de finalizar con pre-alerta vuelve a avisar a los 5 minutos', async () => {
    await activarCon(6);
    pasarSegundos(60);
    fireEvent.click(screen.getByText('✅ Sí, he llegado'));
    await waitFor(() => expect(screen.queryByText('Viaje en Curso')).toBeNull());

    fireEvent.click(screen.getByText('Activar'));
    configurar({ email: 'mama@x.co', minutos: '6' });
    iniciar();
    await screen.findByText('Viaje en Curso');
    await act(async () => {});
    pasarSegundos(60);

    expect(screen.getByText('¿Has llegado a tu destino?')).toBeTruthy();
    expect(toast).toHaveBeenCalledTimes(2);
  });

  /** Pestaña en segundo plano: el navegador espacia los ticks y el reloj avanza sin ellos. */
  const pasarSegundosOculta = (segundos) => act(() => {
    vi.setSystemTime(Date.now() + (segundos - 1) * 1000);
    vi.advanceTimersByTime(1000);
  });

  test('con la pestaña en segundo plano el contador no se atrasa: calcula contra el reloj (F39)', async () => {
    await activarCon(30);
    for (let min = 0; min < 5; min++) pasarSegundosOculta(60);

    expect(screen.getByText('25:00')).toBeTruthy();
  });

  test('si el tiempo vence con la pestaña en segundo plano, la alerta sale en el siguiente tick (F39)', async () => {
    await activarCon(6);
    pasarSegundosOculta(7 * 60);

    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText('🚨 ALERTA ENVIADA')).toBeTruthy();
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, estado: 'Alerta' }]);
  });

  test('al llegar a 0: PUT con estado Alerta una sola vez, aviso y "ALERTA ENVIADA" en pantalla', async () => {
    await activarCon(6);
    pasarSegundos(360);

    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText('⚠️ TIEMPO AGOTADO')).toBeTruthy();
    expect(screen.getByText('🚨 ALERTA ENVIADA')).toBeTruthy();
    expect(screen.getByText(/Se envió una alerta a mama@x\.co con los detalles: Ruta BOGOTA → TUNJA, Placa ABC123, Conductor LUIS/)).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('🚨 TIEMPO AGOTADO. Alerta activada para tu contacto.', { duration: 15000 });
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, estado: 'Alerta' }]);

    pasarSegundos(120);
    expect(llamadas('PUT', '/api/guardian')).toHaveLength(1);
    expect(screen.getByText('00:00')).toBeTruthy();
  });
});

describe('Dashboard · guardián guardado al recargar (caracterización)', () => {
  test('un guardián activo se retoma con el tiempo restante calculado desde el inicio', async () => {
    stubApi({ '/api/guardian?usuarioId': guardianGuardado({ inicio: haceSegundos(10 * 60) }) });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText(/^(20:00|19:59)$/)).toBeTruthy();
    expect(screen.getByText('MAMA@X.CO')).toBeTruthy();
    expect(screen.getByText('BOGOTA → TUNJA')).toBeTruthy();
  });

  test('vencido y sin estado Alerta: registra la alerta con un PUT al recargar, una sola vez (F28)', async () => {
    stubApi({ '/api/guardian?usuarioId': guardianGuardado({ inicio: haceSegundos(60 * 60) }) });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('🚨 ALERTA ENVIADA')).toBeTruthy();
    expect(screen.getByText('00:00')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(llamadas('PUT', '/api/guardian').map((c) => c.body)).toEqual([{ id: 77, estado: 'Alerta' }]);
  });

  test('vencido con estado Alerta en la BD: muestra "ALERTA ENVIADA" sin repetir el PUT (F28)', async () => {
    stubApi({ '/api/guardian?usuarioId': guardianGuardado({ inicio: haceSegundos(60 * 60), estado: 'Alerta' }) });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('🚨 ALERTA ENVIADA')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(llamadas('PUT', '/api/guardian')).toEqual([]);
  });

  test('una respuesta sin id se ignora', async () => {
    stubApi({ '/api/guardian?usuarioId': { message: 'Sin guardián activo' } });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('No tienes viajes aceptados para el día de hoy.')).toBeTruthy();
    expect(screen.queryByText('Viaje en Curso')).toBeNull();
  });
});

describe('Dashboard · guardián: alertas recibidas (caracterización)', () => {
  test('pide las alertas con el correo del usuario codificado (F9) y distingue ALERTA de EN RUTA', async () => {
    iniciarSesion({ ID_USU: 7, NOMBRE_USU: 'ANA', CORREO_USU: 'ana+viajes@x.co' });
    stubApi({
      '/api/guardian?email': [
        { id: 1, estado: 'Alerta', pasajero: 'PEDRO', inicio: '2026-09-30 08:00', origen: 'A', destino: 'B', carro: 'MAZDA', placa: 'AAA111', conductor: 'LUIS', tiempo: 30 },
        { id: 2, estado: 'Activo', pasajero: 'SOFIA', inicio: '2026-09-30 09:00', origen: 'C', destino: 'D', carro: 'KIA', placa: 'BBB222', conductor: 'EVA', tiempo: 45 },
      ],
    });
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('⚠️ ALERTA: PEDRO')).toBeTruthy();
    expect(screen.getByText('✅ EN RUTA: SOFIA')).toBeTruthy();
    expect(screen.getByText('⏱️ Tiempo: 45 min')).toBeTruthy();
    expect(llamadas('GET', '/api/guardian?email').map((c) => c.url)).toEqual(['/api/guardian?email=ana%2Bviajes%40x.co']);
  });

  test('sin alertas muestra el aviso; sin correo en el usuario no las pide', async () => {
    iniciarSesion({ ID_USU: 7, NOMBRE_USU: 'ANA' });
    stubApi();
    render(<DashboardPage />);
    clickNav('Guardian');

    expect(await screen.findByText('No tienes alertas de seguridad activas de tus contactos.')).toBeTruthy();
    await waitFor(() => expect(llamadas('GET', '/api/viajes/mis-rutas').length).toBeGreaterThanOrEqual(2));
    expect(llamadas('GET', '/api/guardian?email')).toEqual([]);
  });
});
