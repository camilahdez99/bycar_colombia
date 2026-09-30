import { describe, expect, test } from 'vitest';
import { canChangeSolicitud, resolverEstadoSolicitud } from '@/lib/domain/solicitudes';
import { limpiarDatosViaje } from '@/lib/domain/viajes';
import { calcularParticipantesMensaje } from '@/lib/domain/mensajes';

describe('resolverEstadoSolicitud', () => {
  test.each([
    ['Pendiente', 1], ['Aceptado', 2], ['Aceptada', 2], ['Rechazado', 3],
    ['Rechazada', 3], ['Cancelado', 4], ['Cancelada', 4],
  ])('%s → %i', (texto, id) => {
    expect(resolverEstadoSolicitud(texto)).toBe(id);
  });

  test('distingue mayúsculas: un texto desconocido da null', () => {
    expect(resolverEstadoSolicitud('ACEPTADO')).toBeNull();
    expect(resolverEstadoSolicitud('Otro')).toBeNull();
  });

  test('los números pasan sin validar rango (comportamiento actual, BUGS F20)', () => {
    expect(resolverEstadoSolicitud('2')).toBe(2);
    expect(resolverEstadoSolicitud(3)).toBe(3);
    expect(resolverEstadoSolicitud('99')).toBe(99);
  });
});

describe('canChangeSolicitud', () => {
  const participants = { passengerId: 10, driverId: 20 };

  test('el conductor acepta o rechaza', () => {
    expect(canChangeSolicitud(20, 2, participants)).toBe(true);
    expect(canChangeSolicitud('20', 3, participants)).toBe(true);
    expect(canChangeSolicitud(10, 2, participants)).toBe(false);
  });

  test('el pasajero cancela', () => {
    expect(canChangeSolicitud(10, 4, participants)).toBe(true);
    expect(canChangeSolicitud(20, 4, participants)).toBe(false);
  });

  test('Pendiente u otros estados: nadie; sin participantes: nadie', () => {
    expect(canChangeSolicitud(20, 1, participants)).toBe(false);
    expect(canChangeSolicitud(20, 99, participants)).toBe(false);
    expect(canChangeSolicitud(20, 2, null)).toBe(false);
  });
});

describe('limpiarDatosViaje', () => {
  test('normaliza placa, puestos, valor y comentarios', () => {
    expect(limpiarDatosViaje({ placa: 'abc-123x', puestos: '3', valor: '25,000', comentarios: 'Sin mascotas' })).toEqual({
      cleanPlaca: 'ABC123',
      numPuestos: 3,
      cleanComentarios: 'Sin mascotas',
      valorNum: 25000,
    });
  });

  test('comentarios vacíos → null; largos → 500 caracteres', () => {
    expect(limpiarDatosViaje({ placa: 'A', puestos: 1, valor: 1, comentarios: '' }).cleanComentarios).toBeNull();
    expect(limpiarDatosViaje({ placa: 'A', puestos: 1, valor: 1, comentarios: 'x'.repeat(600) }).cleanComentarios).toHaveLength(500);
  });

  test('sin validar: NaN en puestos y valor (comportamiento actual, BUGS F23)', () => {
    const datos = limpiarDatosViaje({ placa: 'A', puestos: 'dos', valor: 'mucho' });
    expect(datos.numPuestos).toBeNaN();
    expect(datos.valorNum).toBeNaN();
  });

  test('placas distintas pueden colisionar al recortar a 6 (BUGS F23)', () => {
    expect(limpiarDatosViaje({ placa: 'ABC1234', puestos: 1, valor: 1 }).cleanPlaca)
      .toBe(limpiarDatosViaje({ placa: 'ABC1235', puestos: 1, valor: 1 }).cleanPlaca);
  });

  test('una placa que no es texto lanza (BUGS F23)', () => {
    expect(() => limpiarDatosViaje({ placa: 123, puestos: 1, valor: 1 })).toThrow(TypeError);
  });
});

describe('calcularParticipantesMensaje', () => {
  test('el pasajero le escribe al conductor', () => {
    expect(calcularParticipantesMensaje('10', 10, 20)).toEqual({ emisorId: 10, receptorId: 20 });
  });

  test('el conductor le escribe al pasajero', () => {
    expect(calcularParticipantesMensaje(20, '10', '20')).toEqual({ emisorId: 20, receptorId: 10 });
  });

  test('cualquier otro emisor le escribe al pasajero', () => {
    expect(calcularParticipantesMensaje(99, 10, 20)).toEqual({ emisorId: 99, receptorId: 10 });
  });
});
