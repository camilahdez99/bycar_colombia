// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { badRequest } from '@/lib/api/validacion';
import { enteroPositivo, numeroPositivo, textoNoVacio } from '@/lib/domain/validadores';

describe('enteroPositivo', () => {
  test.each([[1, 1], [42, 42], ['7', 7], [' 15 ', 15], ['2024', 2024]])('%j → %j', (entrada, esperado) => {
    expect(enteroPositivo(entrada)).toBe(esperado);
  });

  test.each([0, -3, 1.5, NaN, Infinity, '0', '-2', '1.5', '2024 Mazda', 'abc', '', ' ', null, undefined, {}, [], true])(
    '%j → null',
    (entrada) => {
      expect(enteroPositivo(entrada)).toBeNull();
    },
  );
});

describe('numeroPositivo', () => {
  test.each([[25000, 25000], [0.5, 0.5], ['25000', 25000], ['25,000', 25000], ['1,234,567', 1234567], ['12.5', 12.5]])(
    '%j → %j',
    (entrada, esperado) => {
      expect(numeroPositivo(entrada)).toBe(esperado);
    },
  );

  test.each([0, -1, NaN, Infinity, '0', '-5', 'mucho', '1e3', '$100', '', null, undefined, {}])('%j → null', (entrada) => {
    expect(numeroPositivo(entrada)).toBeNull();
  });
});

describe('textoNoVacio', () => {
  test('recorta y devuelve el texto', () => {
    expect(textoNoVacio('  ABC123 ')).toBe('ABC123');
  });

  test.each(['', '   ', 123, null, undefined, {}])('%j → null', (entrada) => {
    expect(textoNoVacio(entrada)).toBeNull();
  });
});

describe('badRequest', () => {
  test('400 con el mensaje en { error }', async () => {
    const respuesta = badRequest('Dato inválido');
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: 'Dato inválido' });
  });
});
