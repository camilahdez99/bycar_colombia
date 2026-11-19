import { describe, expect, test } from 'vitest';
import { ESTADO_XPRESS } from '@/lib/domain/constantes';
import {
  esCargaRutaPropia,
  puedeAceptarRutaPropia,
  puedeCambiarEstado,
  puedeCancelarCarga,
  puedeEditarCarga,
  puedeVerCarga,
  resolverEstadoXpress,
  resolverModoCarga,
  rolesEnCarga,
  tieneRolParaEstado,
  transicionValida,
  validarDatosCarga,
  validarFechaXp,
} from '@/lib/domain/xpress';

const EMISOR = 1;
const CONDUCTOR = 2;
const RECEPTOR = 3;
const AJENO = 4;
const carga = (estadoId) => ({ emisorId: EMISOR, conductorId: CONDUCTOR, receptorId: RECEPTOR, estadoId });
const { PENDIENTE, ACEPTADA, RECHAZADA, EN_CAMINO, ENTREGADA, CANCELADA } = ESTADO_XPRESS;

describe('resolverEstadoXpress', () => {
  test.each([
    ['Pendiente', 1], ['Aceptada', 2], ['Rechazada', 3], ['En camino', 4], ['Entregada', 5], ['Cancelada', 6],
    [4, 4], ['5', 5],
  ])('%j → %j', (entrada, esperado) => expect(resolverEstadoXpress(entrada)).toBe(esperado));

  test.each([['Volando'], [0], [7], [2.5], [undefined], [null], ['']])('%j → null', (entrada) =>
    expect(resolverEstadoXpress(entrada)).toBeNull());
});

describe('rolesEnCarga / puedeVerCarga', () => {
  test('cada participante tiene su rol; un ajeno ninguno', () => {
    expect(rolesEnCarga(EMISOR, carga(PENDIENTE))).toEqual(['emisor']);
    expect(rolesEnCarga(String(CONDUCTOR), carga(PENDIENTE))).toEqual(['conductor']);
    expect(rolesEnCarga(RECEPTOR, carga(PENDIENTE))).toEqual(['receptor']);
    expect(rolesEnCarga(AJENO, carga(PENDIENTE))).toEqual([]);
    expect(rolesEnCarga(EMISOR, null)).toEqual([]);
  });

  test('quien es emisor y conductor a la vez tiene los dos roles', () => {
    expect(rolesEnCarga(1, { emisorId: 1, conductorId: 1, receptorId: 3 })).toEqual(['emisor', 'conductor']);
  });

  test('ven la carga el emisor, el conductor y el receptor; nadie más', () => {
    expect([EMISOR, CONDUCTOR, RECEPTOR].map((u) => puedeVerCarga(u, carga(PENDIENTE)))).toEqual([true, true, true]);
    expect(puedeVerCarga(AJENO, carga(PENDIENTE))).toBe(false);
  });
});

describe('transiciones de estado', () => {
  const PERMITIDAS = [
    [PENDIENTE, ACEPTADA, CONDUCTOR],
    [PENDIENTE, RECHAZADA, CONDUCTOR],
    [PENDIENTE, CANCELADA, EMISOR],
    [ACEPTADA, EN_CAMINO, CONDUCTOR],
    [ACEPTADA, CANCELADA, EMISOR],
    [EN_CAMINO, ENTREGADA, CONDUCTOR],
  ];

  test.each(PERMITIDAS)('de %i a %i: la hace el usuario %i', (desde, hasta, quien) => {
    expect(transicionValida(desde, hasta)).toBe(true);
    expect(puedeCambiarEstado(quien, carga(desde), hasta)).toBe(true);
  });

  test.each(PERMITIDAS)('de %i a %i: los demás roles no pueden', (desde, hasta, quien) => {
    for (const otro of [EMISOR, CONDUCTOR, RECEPTOR, AJENO].filter((u) => u !== quien)) {
      expect(puedeCambiarEstado(otro, carga(desde), hasta)).toBe(false);
    }
  });

  test('no se puede saltar ni volver atrás ni salir de un estado final', () => {
    expect(transicionValida(PENDIENTE, EN_CAMINO)).toBe(false);
    expect(transicionValida(PENDIENTE, ENTREGADA)).toBe(false);
    expect(transicionValida(EN_CAMINO, CANCELADA)).toBe(false);
    for (const final of [RECHAZADA, ENTREGADA, CANCELADA]) {
      for (const destino of Object.values(ESTADO_XPRESS)) expect(transicionValida(final, destino)).toBe(false);
    }
    expect(puedeCambiarEstado(CONDUCTOR, carga(EN_CAMINO), PENDIENTE)).toBe(false);
  });

  test('sin carga nadie cambia nada', () => {
    expect(puedeCambiarEstado(CONDUCTOR, null, ACEPTADA)).toBe(false);
  });
});

describe('tieneRolParaEstado', () => {
  test('el conductor pide los estados del viaje y el emisor cancela, sin importar el estado actual', () => {
    for (const estado of [ACEPTADA, RECHAZADA, EN_CAMINO, ENTREGADA]) {
      expect(tieneRolParaEstado(CONDUCTOR, carga(ENTREGADA), estado)).toBe(true);
      expect(tieneRolParaEstado(EMISOR, carga(PENDIENTE), estado)).toBe(false);
      expect(tieneRolParaEstado(RECEPTOR, carga(PENDIENTE), estado)).toBe(false);
    }
    expect(tieneRolParaEstado(EMISOR, carga(ENTREGADA), CANCELADA)).toBe(true);
    expect(tieneRolParaEstado(CONDUCTOR, carga(PENDIENTE), CANCELADA)).toBe(false);
  });

  test('nadie pide Pendiente; sin carga, tampoco', () => {
    expect(tieneRolParaEstado(EMISOR, carga(ACEPTADA), PENDIENTE)).toBe(false);
    expect(tieneRolParaEstado(CONDUCTOR, null, ACEPTADA)).toBe(false);
  });
});

describe('puedeEditarCarga / puedeCancelarCarga', () => {
  test('el emisor edita solo mientras está Pendiente', () => {
    expect(puedeEditarCarga(EMISOR, carga(PENDIENTE))).toBe(true);
    expect(puedeEditarCarga(EMISOR, carga(ACEPTADA))).toBe(false);
    expect(puedeEditarCarga(CONDUCTOR, carga(PENDIENTE))).toBe(false);
    expect(puedeEditarCarga(RECEPTOR, carga(PENDIENTE))).toBe(false);
    expect(puedeEditarCarga(EMISOR, null)).toBe(false);
  });

  test('el emisor cancela hasta que el conductor la recoge', () => {
    expect(puedeCancelarCarga(EMISOR, carga(PENDIENTE))).toBe(true);
    expect(puedeCancelarCarga(EMISOR, carga(ACEPTADA))).toBe(true);
    expect(puedeCancelarCarga(EMISOR, carga(EN_CAMINO))).toBe(false);
    expect(puedeCancelarCarga(CONDUCTOR, carga(PENDIENTE))).toBe(false);
    expect(puedeCancelarCarga(RECEPTOR, carga(PENDIENTE))).toBe(false);
  });
});

describe('validarDatosCarga', () => {
  test('descripción recortada; peso opcional', () => {
    expect(validarDatosCarga({ descripcion: '  Caja con libros ' })).toEqual({ descripcion: 'Caja con libros', peso: null });
    expect(validarDatosCarga({ descripcion: 'x', peso: '' })).toEqual({ descripcion: 'x', peso: null });
    expect(validarDatosCarga({ descripcion: 'x', peso: null })).toEqual({ descripcion: 'x', peso: null });
  });

  test('peso numérico o en texto', () => {
    expect(validarDatosCarga({ descripcion: 'x', peso: 2.5 }).peso).toBe(2.5);
    expect(validarDatosCarga({ descripcion: 'x', peso: '3' }).peso).toBe(3);
  });

  test.each([[undefined], [''], ['   '], [5], [null]])('descripción %j → error', (descripcion) => {
    expect(validarDatosCarga({ descripcion })).toHaveProperty('error');
  });

  test('descripción de más de 300 caracteres → error', () => {
    expect(validarDatosCarga({ descripcion: 'a'.repeat(301) })).toHaveProperty('error');
    expect(validarDatosCarga({ descripcion: 'a'.repeat(300) })).not.toHaveProperty('error');
  });

  test.each([[0], [-1], ['abc'], [1001], [{}]])('peso %j → error', (peso) => {
    expect(validarDatosCarga({ descripcion: 'x', peso })).toHaveProperty('error');
  });
});

describe('encomiendas de ruta propia', () => {
  const rutaPropia = (estadoId, conductorId = null) => ({ emisorId: EMISOR, receptorId: RECEPTOR, conductorId, viajeId: null, estadoId });
  const enViaje = (estadoId) => ({ ...carga(estadoId), viajeId: 5 });

  test('es de ruta propia solo si viajeId es null', () => {
    expect(esCargaRutaPropia(rutaPropia(PENDIENTE))).toBe(true);
    expect(esCargaRutaPropia(enViaje(PENDIENTE))).toBe(false);
    expect(esCargaRutaPropia(null)).toBe(false);
  });

  test('cualquier usuario menos el emisor y el receptor acepta una Pendiente sin conductor', () => {
    expect(puedeAceptarRutaPropia(AJENO, rutaPropia(PENDIENTE))).toBe(true);
    expect(puedeAceptarRutaPropia(String(AJENO), rutaPropia(PENDIENTE))).toBe(true);
    expect(puedeAceptarRutaPropia(EMISOR, rutaPropia(PENDIENTE))).toBe(false);
    expect(puedeAceptarRutaPropia(RECEPTOR, rutaPropia(PENDIENTE))).toBe(false);
    expect(puedeAceptarRutaPropia(null, rutaPropia(PENDIENTE))).toBe(false);
  });

  test('no se acepta si ya tiene conductor, ya no está Pendiente, es de un viaje o no existe', () => {
    expect(puedeAceptarRutaPropia(AJENO, rutaPropia(PENDIENTE, CONDUCTOR))).toBe(false);
    expect(puedeAceptarRutaPropia(AJENO, rutaPropia(ACEPTADA))).toBe(false);
    expect(puedeAceptarRutaPropia(AJENO, rutaPropia(CANCELADA))).toBe(false);
    expect(puedeAceptarRutaPropia(AJENO, enViaje(PENDIENTE))).toBe(false);
    expect(puedeAceptarRutaPropia(AJENO, null)).toBe(false);
  });

  test('sin conductor, nadie tiene el rol de conductor; el emisor sigue cancelando', () => {
    expect(rolesEnCarga(AJENO, rutaPropia(PENDIENTE))).toEqual([]);
    expect(tieneRolParaEstado(AJENO, rutaPropia(PENDIENTE), ACEPTADA)).toBe(false);
    expect(puedeCancelarCarga(EMISOR, rutaPropia(PENDIENTE))).toBe(true);
  });

  test('con el conductor que la aceptó, el ciclo sigue como en un viaje', () => {
    const aceptada = rutaPropia(ACEPTADA, CONDUCTOR);
    expect(rolesEnCarga(CONDUCTOR, aceptada)).toEqual(['conductor']);
    expect(puedeCambiarEstado(CONDUCTOR, aceptada, EN_CAMINO)).toBe(true);
    expect(puedeCambiarEstado(CONDUCTOR, rutaPropia(EN_CAMINO, CONDUCTOR), ENTREGADA)).toBe(true);
    expect(puedeCambiarEstado(AJENO, aceptada, EN_CAMINO)).toBe(false);
    expect(puedeCancelarCarga(EMISOR, aceptada)).toBe(true);
    expect(puedeCancelarCarga(EMISOR, rutaPropia(EN_CAMINO, CONDUCTOR))).toBe(false);
  });
});

describe('resolverModoCarga', () => {
  test('viajeId solo → modo viaje', () => {
    expect(resolverModoCarga({ viajeId: 5 })).toEqual({ modo: 'viaje' });
    expect(resolverModoCarga({ viajeId: '5', origenId: '', destinoId: null })).toEqual({ modo: 'viaje' });
  });

  test('origen y destino → modo ruta', () => {
    expect(resolverModoCarga({ origenId: 1, destinoId: '2' })).toEqual({ modo: 'ruta' });
  });

  test.each([
    [{}, 'Viaje, remitente y receptor son requeridos'],
    [{ viajeId: 5, origenId: 1, destinoId: 2 }, 'Elige un viaje o una ruta propia, no las dos cosas'],
    [{ viajeId: 5, origenId: 1 }, 'Elige un viaje o una ruta propia, no las dos cosas'],
    [{ viajeId: 'x' }, 'ID de viaje inválido'],
    [{ origenId: 1 }, 'El origen y el destino son requeridos'],
    [{ destinoId: 2 }, 'El origen y el destino son requeridos'],
    [{ origenId: 'x', destinoId: 2 }, 'Origen o destino inválido'],
    [{ origenId: 1, destinoId: -3 }, 'Origen o destino inválido'],
    [{ origenId: 4, destinoId: '4' }, 'El origen y el destino no pueden ser el mismo'],
  ])('%j → error', (entrada, error) => expect(resolverModoCarga(entrada)).toEqual({ error }));
});

describe('validarFechaXp', () => {
  const HOY = '2026-11-19';

  test.each([[undefined], [null], ['']])('%j → sin fecha', (fecha) => {
    expect(validarFechaXp(fecha, HOY)).toEqual({ fecha: null });
  });

  test('hoy y fechas futuras valen', () => {
    expect(validarFechaXp('2026-11-19', HOY)).toEqual({ fecha: '2026-11-19' });
    expect(validarFechaXp('2027-01-05', HOY)).toEqual({ fecha: '2027-01-05' });
  });

  test.each([['2026-11-18'], ['19/11/2026'], ['2026-13-01'], ['2026-02-30'], ['mañana'], [20261119]])('%j → error', (fecha) => {
    expect(validarFechaXp(fecha, HOY)).toHaveProperty('error');
  });
});
