import { describe, expect, test } from 'vitest';
import { MUNICIPIOS } from '@/lib/municipios';

describe('MUNICIPIOS (caracterización)', () => {
  test('contiene 1021 municipios únicos', () => {
    expect(MUNICIPIOS).toHaveLength(1021);
    expect(new Set(MUNICIPIOS).size).toBe(1021);
  });

  test('está ordenada alfabéticamente y en mayúsculas', () => {
    expect([...MUNICIPIOS].sort()).toEqual(MUNICIPIOS);
    expect(MUNICIPIOS.every((m) => m === m.toUpperCase())).toBe(true);
  });

  test('empieza en ABEJORRAL, termina en ZONA BANANERA e incluye capitales', () => {
    expect(MUNICIPIOS[0]).toBe('ABEJORRAL');
    expect(MUNICIPIOS.at(-1)).toBe('ZONA BANANERA');
    expect(MUNICIPIOS).toEqual(expect.arrayContaining(['BOGOTA', 'MEDELLIN', 'CALI']));
  });
});
