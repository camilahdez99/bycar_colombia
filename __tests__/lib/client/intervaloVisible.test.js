import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { iniciarIntervaloVisible } from '@/lib/client/intervaloVisible';

function setOculta(oculta) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculta });
  document.dispatchEvent(new Event('visibilitychange'));
}

let limpiar;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  limpiar?.();
  limpiar = undefined;
  vi.useRealTimers();
});

describe('iniciarIntervaloVisible', () => {
  test('con la pestaña visible ejecuta la tarea en cada intervalo, sin llamada inicial', () => {
    const tarea = vi.fn();
    limpiar = iniciarIntervaloVisible(tarea, 1000);

    expect(tarea).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(tarea).toHaveBeenCalledTimes(3);
  });

  test('oculta no ejecuta; al volver ejecuta enseguida y retoma el intervalo', () => {
    const tarea = vi.fn();
    limpiar = iniciarIntervaloVisible(tarea, 1000);

    setOculta(true);
    vi.advanceTimersByTime(10000);
    expect(tarea).not.toHaveBeenCalled();

    setOculta(false);
    expect(tarea).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(tarea).toHaveBeenCalledTimes(2);
  });

  test('si arranca con la pestaña oculta, espera a que vuelva', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    const tarea = vi.fn();
    limpiar = iniciarIntervaloVisible(tarea, 1000);

    vi.advanceTimersByTime(5000);
    expect(tarea).not.toHaveBeenCalled();
    setOculta(false);
    expect(tarea).toHaveBeenCalledTimes(1);
  });

  test('un visibilitychange estando visible no duplica el intervalo ni ejecuta de más', () => {
    const tarea = vi.fn();
    limpiar = iniciarIntervaloVisible(tarea, 1000);

    setOculta(false);
    expect(tarea).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(tarea).toHaveBeenCalledTimes(2);
  });

  test('la limpieza detiene el intervalo y deja de escuchar la visibilidad', () => {
    const tarea = vi.fn();
    iniciarIntervaloVisible(tarea, 1000)();

    vi.advanceTimersByTime(3000);
    setOculta(true);
    setOculta(false);
    expect(tarea).not.toHaveBeenCalled();
  });
});
