import { describe, expect, test, vi } from 'vitest';
import { crearCuentaRegresiva } from '@/lib/client/cuentaRegresiva';

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
