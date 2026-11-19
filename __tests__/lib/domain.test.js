import { describe, expect, test } from 'vitest';
import { canChangeSolicitud, resolverEstadoSolicitud } from '@/lib/domain/solicitudes';
import { idDeCatalogo, limpiarDatosViaje, validarDatosViaje } from '@/lib/domain/viajes';
import { calcularParticipantesMensaje, unirChats } from '@/lib/domain/mensajes';
import { esContactoPropio } from '@/lib/domain/guardian';

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

  test('los números del catálogo pasan; los de fuera del catálogo dan null (BUGS F20)', () => {
    expect(resolverEstadoSolicitud('2')).toBe(2);
    expect(resolverEstadoSolicitud(3)).toBe(3);
    expect(resolverEstadoSolicitud('99')).toBeNull();
    expect(resolverEstadoSolicitud(0)).toBeNull();
    expect(resolverEstadoSolicitud('2.5')).toBeNull();
    expect(resolverEstadoSolicitud(-1)).toBeNull();
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

  test('no valida por sí sola: los datos inválidos los frena antes validarDatosViaje', () => {
    const datos = limpiarDatosViaje({ placa: 'A', puestos: 'dos', valor: 'mucho' });
    expect(datos.numPuestos).toBeNaN();
    expect(datos.valorNum).toBeNaN();
  });
});

describe('validarDatosViaje (BUGS F23)', () => {
  const validos = { placa: 'abc-123', fecha: '2026-10-01', puestos: '3', valor: '5,000.50' };

  test('datos válidos → null', () => {
    expect(validarDatosViaje(validos)).toBeNull();
    expect(validarDatosViaje({ ...validos, puestos: 4, valor: 12000 })).toBeNull();
  });

  test.each([
    [{ placa: 123 }, 'La placa debe ser un texto'],
    [{ placa: '- -' }, 'La placa debe tener entre 1 y 6 letras o números'],
    [{ placa: 'ABC1234' }, 'La placa debe tener entre 1 y 6 letras o números'],
    [{ fecha: '2026-1-1' }, 'La fecha debe tener el formato AAAA-MM-DD'],
    [{ fecha: 20261001 }, 'La fecha debe tener el formato AAAA-MM-DD'],
    [{ puestos: '0' }, 'Los puestos deben ser un número entero mayor a 0'],
    [{ puestos: '3 puestos' }, 'Los puestos deben ser un número entero mayor a 0'],
    [{ valor: '-100' }, 'El valor debe ser un número mayor a 0'],
    [{ valor: 'gratis' }, 'El valor debe ser un número mayor a 0'],
  ])('%j → %s', (cambio, mensaje) => {
    expect(validarDatosViaje({ ...validos, ...cambio })).toBe(mensaje);
  });

  test('placas que se distinguen en el 7º carácter ya no colisionan: se rechazan', () => {
    expect(validarDatosViaje({ ...validos, placa: 'ABC1234' })).not.toBeNull();
    expect(validarDatosViaje({ ...validos, placa: 'ABC1235' })).not.toBeNull();
  });
});

describe('idDeCatalogo (BUGS F6)', () => {
  test.each([['5', 5], [' 12 ', 12], [8, 8]])('%j → %j', (entrada, esperado) => {
    expect(idDeCatalogo(entrada)).toBe(esperado);
  });

  test.each(['2024 Mazda', 'MEDELLIN', '0', '', 1.5])('%j no es un ID → null', (entrada) => {
    expect(idDeCatalogo(entrada)).toBeNull();
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

describe('esContactoPropio', () => {
  test.each([
    ['ana@x.co', 'ana@x.co', true],
    ['  ANA@x.co ', 'ana@X.CO', true],
    ['otra@x.co', 'ana@x.co', false],
    ['', '', false],
    ['ana@x.co', undefined, false],
    [undefined, 'ana@x.co', false],
  ])('%j vs %j → %s', (contacto, usuario, esperado) => {
    expect(esContactoPropio(contacto, usuario)).toBe(esperado);
  });
});

describe('unirChats', () => {
  test('guardianes primero, después viajes, con tipo y clave única', () => {
    expect(unirChats([{ chatId: 9 }], [{ guardianId: 77 }])).toEqual([
      { guardianId: 77, tipo: 'guardian', clave: 'guardian-77' },
      { chatId: 9, tipo: 'viaje', clave: 'viaje-9' },
    ]);
  });

  test('sin chats devuelve []', () => {
    expect(unirChats([], [])).toEqual([]);
  });
});
