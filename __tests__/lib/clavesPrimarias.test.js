import { describe, expect, test } from 'vitest';
import { CLAVE_PRIMARIA, getRowId } from '@/lib/client/clavesPrimarias';

describe('getRowId (BUGS F31)', () => {
  test('SOLICITUDES usa ID_SOL aunque la primera columna sea otra', () => {
    const columnas = [{ COLUMN_NAME: 'FECHA_SOL' }, { COLUMN_NAME: 'ID_SOL' }];
    expect(getRowId('SOLICITUDES', { FECHA_SOL: '2026-10-01', ID_SOL: 55, USUARIOS_ID_USU: 7 }, columnas)).toBe(55);
  });

  test('ESTADOS_VIA usa ID_EST_VIA', () => {
    expect(getRowId('ESTADOS_VIA', { ESTADO_EST_VIA: 'Disponible', ID_EST_VIA: 1 })).toBe(1);
  });

  test('una PK con valor 0 se respeta', () => {
    expect(getRowId('MARCAS', { ID_MAR: 0, NOMBRE_MAR: 'X' })).toBe(0);
  });

  test('VEHICULOS usa la placa, no el ID del conductor', () => {
    expect(getRowId('VEHICULOS', { CONDUCTOR_ID_USU: 7, PLACA_VEH: 'ABC123' })).toBe('ABC123');
  });

  test('cada tabla del DDL con PK simple tiene su columna', () => {
    expect(Object.keys(CLAVE_PRIMARIA)).toHaveLength(15);
    expect(CLAVE_PRIMARIA).not.toHaveProperty('PERMISOS');
  });

  test('una tabla desconocida usa la búsqueda anterior y, si no hay coincidencia, la primera columna', () => {
    expect(getRowId('OTRA', { ID_USU: 4, X: 1 })).toBe(4);
    expect(getRowId('OTRA', { CODIGO: 'A1' }, [{ COLUMN_NAME: 'CODIGO' }])).toBe('A1');
  });
});
