import { describe, expect, test } from 'vitest';
import { COORDENADAS_MUNICIPIOS } from '@/lib/domain/coordenadasMunicipios';
import {
  TIEMPO_MAX_MINUTOS, TIEMPO_MIN_MINUTOS, distanciaKm, estimarTiempoViajeMin,
} from '@/lib/domain/tiempoViaje';

// IDs reales (DIVIPOLA): Bogotá 11001, Medellín 5001, Bello 5088, Abejorral 5002
describe('distanciaKm', () => {
  test('0 entre el mismo punto', () => {
    expect(distanciaKm([6.25, -75.56], [6.25, -75.56])).toBe(0);
  });

  test('Bogotá–Medellín ≈ 240 km en línea recta (±20)', () => {
    const km = distanciaKm(COORDENADAS_MUNICIPIOS[11001], COORDENADAS_MUNICIPIOS[5001]);
    expect(km).toBeGreaterThan(220);
    expect(km).toBeLessThan(260);
  });
});

describe('estimarTiempoViajeMin', () => {
  test('devuelve un múltiplo de 5 dentro del rango para una ruta larga', () => {
    const min = estimarTiempoViajeMin(11001, 5001); // Bogotá → Medellín
    expect(min % 5).toBe(0);
    expect(min).toBeGreaterThanOrEqual(TIEMPO_MIN_MINUTOS);
    expect(min).toBeLessThanOrEqual(TIEMPO_MAX_MINUTOS);
    expect(min).toBeGreaterThan(200); // ~240km * 1.3 / 60 * 60
  });

  test('una ruta corta (Medellín → Bello) da pocos minutos, nunca menos del mínimo', () => {
    const min = estimarTiempoViajeMin(5001, 5088);
    expect(min).toBeGreaterThanOrEqual(TIEMPO_MIN_MINUTOS);
    expect(min).toBeLessThanOrEqual(30);
  });

  test('el mismo municipio da el mínimo', () => {
    expect(estimarTiempoViajeMin(5001, 5001)).toBe(TIEMPO_MIN_MINUTOS);
  });

  test('null si falta la coordenada de alguno (el llamador usa el valor por defecto)', () => {
    expect(estimarTiempoViajeMin(11001, 999999)).toBeNull();
    expect(estimarTiempoViajeMin(999999, 11001)).toBeNull();
  });

  test('el dataset trae los 1122 municipios', () => {
    expect(Object.keys(COORDENADAS_MUNICIPIOS).length).toBe(1122);
  });
});
