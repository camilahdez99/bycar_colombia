import { describe, expect, test, vi } from 'vitest';
import { crearCuentaRegresiva, finDelGuardian, segundosHasta } from '@/lib/client/cuentaRegresiva';

describe('crearCuentaRegresiva', () => {
  test('arranca en 0 y devuelve el último valor fijado', () => {
    const cuenta = crearCuentaRegresiva();
    expect(cuenta.leer()).toBe(0);

    cuenta.fijar(90);
    expect(cuenta.leer()).toBe(90);
  });

  test('avisa a los suscriptores en cada cambio y deja de avisar al desuscribirse', () => {
    const cuenta = crearCuentaRegresiva();
    const oyente = vi.fn();
    const desuscribir = cuenta.suscribir(oyente);

    cuenta.fijar(10);
    cuenta.fijar(9);
    expect(oyente).toHaveBeenCalledTimes(2);

    desuscribir();
    cuenta.fijar(8);
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  test('fijar el mismo valor no avisa', () => {
    const cuenta = crearCuentaRegresiva();
    const oyente = vi.fn();
    cuenta.suscribir(oyente);

    cuenta.fijar(0);
    expect(oyente).not.toHaveBeenCalled();
  });

  test('cada cuenta es independiente', () => {
    const a = crearCuentaRegresiva();
    const b = crearCuentaRegresiva();
    a.fijar(5);
    expect(b.leer()).toBe(0);
  });
});

describe('segundosHasta', () => {
  const FIN = 1_000_000;

  test('segundos enteros que faltan, redondeando hacia arriba', () => {
    expect(segundosHasta(FIN, FIN - 60_000)).toBe(60);
    expect(segundosHasta(FIN, FIN - 59_001)).toBe(60);
    expect(segundosHasta(FIN, FIN - 59_000)).toBe(59);
  });

  test('vencido devuelve 0, nunca negativo', () => {
    expect(segundosHasta(FIN, FIN)).toBe(0);
    expect(segundosHasta(FIN, FIN + 5_000)).toBe(0);
  });
});

describe('finDelGuardian', () => {
  test('inicio en hora local más los minutos estimados', () => {
    const inicio = new Date(2026, 9, 1, 8, 0, 0).getTime();
    expect(finDelGuardian('2026-10-01 08:00:00', 45)).toBe(inicio + 45 * 60 * 1000);
  });

  test('acepta los minutos como texto (NUMERIC de la BD)', () => {
    expect(finDelGuardian('2026-10-01 08:00:00', '30')).toBe(finDelGuardian('2026-10-01 08:00:00', 30));
  });
});
