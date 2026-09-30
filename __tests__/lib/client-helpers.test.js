import { describe, expect, test } from 'vitest';
import { formatCurrency, formatTiempo, normalizar } from '@/lib/client/formato';
import { getUserId } from '@/lib/client/usuario';
import { getBadgeCount } from '@/lib/client/badges';

describe('normalizar', () => {
  test('quita tildes y diéresis y pasa a mayúsculas', () => {
    expect(normalizar('Bogotá')).toBe('BOGOTA');
    expect(normalizar('güepsa')).toBe('GUEPSA');
  });

  test('conserva la ñ como N con tilde removida (comportamiento actual)', () => {
    expect(normalizar('Nariño')).toBe('NARINO');
  });
});

describe('formatTiempo', () => {
  test.each([
    [0, '00:00'],
    [59, '00:59'],
    [60, '01:00'],
    [2700, '45:00'],
    [6000, '100:00'],
  ])('%i segundos → %s', (segundos, esperado) => {
    expect(formatTiempo(segundos)).toBe(esperado);
  });
});

describe('formatCurrency', () => {
  test('deja solo dígitos con separador de miles', () => {
    expect(formatCurrency('$1234567abc')).toBe('1,234,567');
    expect(formatCurrency('999')).toBe('999');
    expect(formatCurrency('')).toBe('');
  });

  test('con null lanza error (comportamiento actual, BUGS F8)', () => {
    expect(() => formatCurrency(null)).toThrow(TypeError);
  });
});

describe('getUserId', () => {
  test('prioriza ID_USU, después id_usu y por último id', () => {
    expect(getUserId({ ID_USU: 7, id_usu: 8, id: 9 })).toBe(7);
    expect(getUserId({ id_usu: 8, id: 9 })).toBe(8);
    expect(getUserId({ id: 9 })).toBe(9);
  });

  test('sin usuario devuelve undefined (no null: el body JSON omite la clave)', () => {
    expect(getUserId(null)).toBeUndefined();
    expect(getUserId(undefined)).toBeUndefined();
    expect(getUserId({})).toBeUndefined();
  });
});

describe('getBadgeCount', () => {
  const base = {
    activePage: 'inicio',
    solicitudesRecibidas: [],
    rutasSolicitadas: [],
    rutasSolicitadasLeidas: {},
    mensajes: [],
    mensajesLeidos: 0,
    alertasRecibidas: [],
  };

  test('solicitudes: cantidad de solicitudes recibidas', () => {
    expect(getBadgeCount('/solicitudes', { ...base, solicitudesRecibidas: [{}, {}] })).toBe(2);
  });

  test('mis-rutas: cuenta aceptadas/rechazadas no leídas, y 0 estando en la pestaña', () => {
    const rutasSolicitadas = [
      { id: 1, estado: 'Aceptada' },
      { id: 2, estado: 'Rechazado' },
      { id: 3, estado: 'Pendiente' },
      { id: 4, estado: 'Aceptada' },
    ];
    const estado = { ...base, rutasSolicitadas, rutasSolicitadasLeidas: { 4: 'Aceptada' } };
    expect(getBadgeCount('/mis-rutas', estado)).toBe(2);
    expect(getBadgeCount('/mis-rutas', { ...estado, activePage: 'mis-rutas' })).toBe(0);
  });

  test('mensajes: chats nuevos fuera de la pestaña, nunca negativo', () => {
    expect(getBadgeCount('/mensajes', { ...base, mensajes: [{}, {}, {}], mensajesLeidos: 1 })).toBe(2);
    expect(getBadgeCount('/mensajes', { ...base, mensajes: [{}], mensajesLeidos: 3 })).toBe(0);
    expect(getBadgeCount('/mensajes', { ...base, activePage: 'mensajes', mensajes: [{}, {}] })).toBe(0);
  });

  test('guardian: alertas en estado ALERTA sin distinguir mayúsculas', () => {
    const alertasRecibidas = [{ estado: 'Alerta' }, { estado: 'ALERTA' }, { estado: 'Activo' }, {}];
    expect(getBadgeCount('/guardian', { ...base, alertasRecibidas })).toBe(2);
  });

  test('otras URLs: 0', () => {
    expect(getBadgeCount('/inicio', base)).toBe(0);
    expect(getBadgeCount(undefined, base)).toBe(0);
  });
});
