// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST } from '@/app/api/viajes/iniciar/route';
import { enviarAvisoGuardian } from '@/lib/email';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));
vi.mock('@/lib/email', () => ({ enviarAvisoGuardian: vi.fn(async () => true) }));

const NOW = 1_760_000_000_000;
const post = (body) => POST(makeRequest('/api/viajes/iniciar', { method: 'POST', body }));

// Fila de un pasajero con guardián elegido, como la devuelve la consulta de pendientes
const pasajero = (over = {}) => ({
  protegidoId: 42, contactoId: 55, tiempo: 40, contactoEmail: 'mama@x.co',
  protegido: 'ANA PÉREZ', origen: 'BELLO', destino: 'ENVIGADO', conductor: 'LUIS ROJAS',
  placa: 'ABC123', carro: 'MAZDA', salida: '2026-11-18 08:00', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/viajes/iniciar', () => {
  test('400 si viajeId no es un entero positivo, sin abrir conexión', async () => {
    expect(await readResponse(await post({ viajeId: 'x' }))).toEqual({
      status: 400,
      body: { error: 'ID de viaje inválido' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('409 si el viaje no existe o ya estaba iniciado (0 filas), con rollback', async () => {
    // dueño del viaje (checkOwnership sin flag devuelve null y no consulta), luego UPDATE 0 filas
    const conn = createFakeConnection([{ rowsAffected: 0 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5 }))).toEqual({
      status: 409,
      body: { error: 'El viaje no existe o ya fue iniciado' },
    });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200: pone el viaje En Curso y crea un guardián por pasajero con contacto', async () => {
    const conn = createFakeConnection([
      { rowsAffected: 1 },                       // UPDATE viaje → En Curso
      { rows: [pasajero(), pasajero({ protegidoId: 43, contactoId: 56, contactoEmail: 'papa@x.co' })] }, // pendientes
      { rowsAffected: 1 },                       // INSERT guardián 1
      { rowsAffected: 1 },                       // INSERT guardián 2
      { rowsAffected: 1 },                       // UPDATE notificado 1
      { rowsAffected: 1 },                       // UPDATE notificado 2
    ]);
    getConnection.mockResolvedValue(conn);

    expect(await readResponse(await post({ viajeId: 5 }))).toEqual({
      status: 200,
      body: { message: 'Viaje iniciado', guardianesActivados: 2 },
    });

    const inserts = conn.calls.filter((c) => /INSERT INTO GUARDIANES/.test(c.sql));
    expect(inserts).toHaveLength(2);
    expect(inserts[0].binds).toMatchObject({ idGua: NOW, protegidoId: 42, contactoId: 55, tiempo: 40, email: 'mama@x.co' });
    expect(inserts[1].binds).toMatchObject({ idGua: NOW + 1, protegidoId: 43, contactoId: 56 });
    expect(conn.commit).toHaveBeenCalled();
    expect(enviarAvisoGuardian).toHaveBeenCalledTimes(2);
    expect(enviarAvisoGuardian.mock.calls[0][0]).toMatchObject({ correo: 'mama@x.co', tipo: 'inicio' });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con 0 guardianes si ningún pasajero eligió contacto', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }, { rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post({ viajeId: 5 }))).toEqual({
      status: 200,
      body: { message: 'Viaje iniciado', guardianesActivados: 0 },
    });
    expect(enviarAvisoGuardian).not.toHaveBeenCalled();
  });

  test('usa el tiempo por defecto (30) cuando la solicitud no guardó uno', async () => {
    const conn = createFakeConnection([
      { rowsAffected: 1 },
      { rows: [pasajero({ tiempo: null })] },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ viajeId: 5 });
    const insert = conn.calls.find((c) => /INSERT INTO GUARDIANES/.test(c.sql));
    expect(insert.binds.tiempo).toBe(30);
  });

  test('si el correo falla, igual responde 200 y no marca NOTIFICADO', async () => {
    enviarAvisoGuardian.mockResolvedValueOnce(false);
    const conn = createFakeConnection([{ rowsAffected: 1 }, { rows: [pasajero()] }, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ viajeId: 5 }))).status).toBe(200);
    expect(conn.calls.some((c) => /NOTIFICADO_INICIO_GUA/.test(c.sql))).toBe(false);
  });

  test('500 si falla un INSERT, con rollback', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }, { rows: [pasajero()] }, new Error('ORA-00001')]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ viajeId: 5 }))).status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
