// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  findSolicitudParticipants,
  findUserEmail,
  isGuardianParticipant,
  isViajeParticipant,
} from '@/lib/auth/ownershipQueries';
import { createFakeConnection } from '../helpers/api';

describe('findSolicitudParticipants', () => {
  test('devuelve pasajero y conductor; fija el SQL', async () => {
    const conn = createFakeConnection([{ rows: [{ passengerId: 7, driverId: 9 }] }]);
    expect(await findSolicitudParticipants(conn, '55')).toEqual({ passengerId: 7, driverId: 9 });
    expect(conn.calls).toMatchSnapshot();
  });

  test.each([[{ rows: [] }], [{}]])('sin filas → null (%j)', async (respuesta) => {
    expect(await findSolicitudParticipants(createFakeConnection([respuesta]), 55)).toBeNull();
  });
});

describe.each([
  ['isViajeParticipant', isViajeParticipant, 'viajeId'],
  ['isGuardianParticipant', isGuardianParticipant, 'guardianId'],
])('%s', (_nombre, fn, clave) => {
  test('total > 0 → true; fija SQL y binds numéricos', async () => {
    const conn = createFakeConnection([{ rows: [{ total: 1 }] }]);
    expect(await fn(conn, '5', '7')).toBe(true);
    expect(conn.calls[0].binds).toEqual({ [clave]: 5, userId: 7, aceptada: 2 });
    expect(conn.calls).toMatchSnapshot();
  });

  test.each([[{ rows: [{ total: 0 }] }], [{ rows: [] }], [{}]])('sin coincidencias → false (%j)', async (respuesta) => {
    expect(await fn(createFakeConnection([respuesta]), 5, 7)).toBe(false);
  });

  test('ID ausente se bindea como NaN y no coincide con nada', async () => {
    const conn = createFakeConnection([{ rows: [{ total: 0 }] }]);
    expect(await fn(conn, undefined, 7)).toBe(false);
    expect(conn.calls[0].binds[clave]).toBeNaN();
  });
});

describe('findUserEmail', () => {
  test('devuelve el correo; fija el SQL', async () => {
    const conn = createFakeConnection([{ rows: [{ correo: 'ana@x.co' }] }]);
    expect(await findUserEmail(conn, '7')).toBe('ana@x.co');
    expect(conn.calls).toMatchSnapshot();
  });

  test('usuario inexistente → null', async () => {
    expect(await findUserEmail(createFakeConnection([{ rows: [] }]), 7)).toBeNull();
  });
});
