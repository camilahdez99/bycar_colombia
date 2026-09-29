// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { GET, POST } from '@/app/api/viajes/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/viajes (caracterización)', () => {
  const get = (query) => GET(makeRequest('/api/viajes', { query }));
  const rows = [{ id: 1, origen: 'BELLO', destino: 'ENVIGADO', hora: '2026-10-01', valor: 5000 }];

  test('200 sin filtros: solo viajes disponibles desde hoy', async () => {
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con origen y destino numéricos: filtra por ID', async () => {
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ origen: '3', destino: '7' }))).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ origenId: 3, destinoId: 7 });
    expect(conn.calls).toMatchSnapshot();
  });

  test('200 con origen y destino por nombre: filtra por nombre (trim)', async () => {
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get({ origen: ' Bello ', destino: 'Envigado' }))).status).toBe(200);
    expect(conn.calls[0].binds).toEqual({ origenName: 'Bello', destinoName: 'Envigado' });
    expect(conn.calls).toMatchSnapshot();
  });

  test('origen de solo espacios cuenta como numérico (comportamiento actual: filtra por ID 0)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    getConnection.mockResolvedValue(conn);
    await get({ origen: ' ' });
    expect(conn.calls[0].binds).toEqual({ origenId: 0 });
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get())).toEqual({ status: 200, body: [] });
  });

  test('500 si falla la consulta, y cierra la conexión', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 500, body: { error: 'Error interno del servidor' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get())).status).toBe(200);
  });
});

describe('POST /api/viajes (caracterización)', () => {
  const post = (body) => POST(makeRequest('/api/viajes', { method: 'POST', body }));
  const validBody = {
    origen: 'Bello',
    destino: 'Envigado',
    carro: 'Mazda 3',
    placa: 'abc-123',
    fecha: '2026-10-01',
    puestos: '3',
    valor: '5,000.50',
    comentarios: 'Salgo puntual',
    usuarioId: 42,
  };

  test.each(['origen', 'destino', 'placa', 'fecha', 'puestos', 'valor', 'usuarioId'])(
    '400 si falta %s',
    async (campo) => {
      expect(await readResponse(await post({ ...validBody, [campo]: '' }))).toEqual({
        status: 400,
        body: { error: 'Faltan campos obligatorios' },
      });
      expect(getConnection).not.toHaveBeenCalled();
    },
  );

  test('201: municipios, marca y vehículo ya existen → solo inserta el viaje', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] }, // origen
      { rows: [{ ID_MUN: 20 }] }, // destino
      { rows: [{ ID_MAR: 3 }] }, // marca por primera palabra
      { rows: [{ PLACA_VEH: 'ABC123' }] }, // vehículo
      { rowsAffected: 1 }, // insert viaje
    ]);
    getConnection.mockResolvedValue(conn);

    expect(await readResponse(await post(validBody))).toEqual({
      status: 201,
      body: { message: 'Viaje publicado correctamente', id: NOW },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.execute).toHaveBeenCalledTimes(5);
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('201: crea municipios, marca y vehículo cuando no existen (cada insert con autoCommit)', async () => {
    const conn = createFakeConnection([
      { rows: [] }, // origen no existe
      { rows: [{ nextId: 100 }] },
      { rowsAffected: 1 },
      { rows: [] }, // destino no existe
      { rows: [{ nextId: 101 }] },
      { rowsAffected: 1 },
      { rows: [] }, // marca por primera palabra
      { rows: [] }, // marca por texto completo
      { rows: [{ nextId: 7 }] },
      { rowsAffected: 1 },
      { rows: [] }, // vehículo no existe
      { rowsAffected: 1 },
      { rowsAffected: 1 }, // insert viaje
    ]);
    getConnection.mockResolvedValue(conn);

    const body = { ...validBody, origen: ' medellín ', carro: 'renault logan' };
    expect(await readResponse(await post(body))).toEqual({
      status: 201,
      body: { message: 'Viaje publicado correctamente', id: NOW },
    });
    expect(conn.calls).toMatchSnapshot();
    // municipio nuevo: nombre sin pasar a mayúsculas; marca nueva: "Renault"
    expect(conn.calls[2].binds).toEqual({ nextId: 100, name: 'medellín' });
    expect(conn.calls[9].binds).toEqual({ nextId: 7, formattedBrand: 'Renault' });
    expect(conn.calls[11].binds).toEqual({ cleanPlaca: 'ABC123', capacidad: 3, usuarioId: 42, marcaId: 7 });
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('marca encontrada por el texto completo (segunda búsqueda)', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [] },
      { rows: [{ ID_MAR: 9 }] },
      { rows: [] },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, carro: 'Land Rover' });
    expect(conn.calls[2].binds).toEqual({ brandName: 'LAND' });
    expect(conn.calls[3].binds).toEqual({ fullInput: 'LAND ROVER' });
    expect(conn.calls[5].binds.marcaId).toBe(9);
  });

  test('nextId falsy en MAX+1 cae a 1', async () => {
    const conn = createFakeConnection([
      { rows: [] },
      { rows: [{ nextId: 0 }] },
      { rowsAffected: 1 },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [{ PLACA_VEH: 'ABC123' }] },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, carro: undefined });
    expect(conn.calls[2].binds).toEqual({ nextId: 1, name: 'Bello' });
  });

  test('IDs numéricos y "2024 Mazda" se usan directo sin consultar (comportamiento actual: parseInt de texto mixto)', async () => {
    const conn = createFakeConnection([{ rows: [] }, { rowsAffected: 1 }, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, origen: '5', destino: 8, carro: '2024 Mazda' });
    expect(conn.execute).toHaveBeenCalledTimes(3);
    expect(conn.calls[1].binds.marcaId).toBe(2024);
    expect(conn.calls[2].binds).toMatchObject({ origenId: 5, destinoId: 8 });
  });

  test('sin carro usa la marca 1 sin consultar', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [] },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, carro: '' });
    expect(conn.calls[3].binds.marcaId).toBe(1);
  });

  test('placa de otro usuario: publica el viaje con ese vehículo (comportamiento actual: no verifica dueño)', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [{ ID_MAR: 3 }] },
      { rows: [{ PLACA_VEH: 'ABC123' }] }, // pertenece a otro conductor
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ ...validBody, usuarioId: 99 }))).status).toBe(201);
    expect(conn.calls[4].binds).toMatchObject({ usuarioId: 99, cleanPlaca: 'ABC123' });
  });

  test('normaliza placa, valor y comentarios (comentarios truncados a 500)', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [{ ID_MAR: 3 }] },
      { rows: [{ PLACA_VEH: 'XYZ987' }] },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, placa: 'xyz-98 7 extra', valor: '1,234,567.5', comentarios: 'a'.repeat(600) });
    const binds = conn.calls[4].binds;
    expect(binds.cleanPlaca).toBe('XYZ987');
    expect(binds.valorNum).toBe(1234567.5);
    expect(binds.cleanComentarios).toHaveLength(500);
  });

  test('sin comentarios inserta null', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [{ ID_MAR: 3 }] },
      { rows: [{ PLACA_VEH: 'ABC123' }] },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    await post({ ...validBody, comentarios: undefined });
    expect(conn.calls[4].binds.cleanComentarios).toBeNull();
  });

  test('puestos y valor no numéricos pasan como NaN (comportamiento actual: no valida números)', async () => {
    const conn = createFakeConnection([
      { rows: [{ ID_MUN: 10 }] },
      { rows: [{ ID_MUN: 20 }] },
      { rows: [{ ID_MAR: 3 }] },
      { rows: [{ PLACA_VEH: 'ABC123' }] },
      { rowsAffected: 1 },
    ]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post({ ...validBody, puestos: 'muchos', valor: 'gratis' }))).status).toBe(201);
    expect(conn.calls[4].binds.numPuestos).toBeNaN();
    expect(conn.calls[4].binds.valorNum).toBeNaN();
  });

  test('500 expone error.message; lo creado antes (municipio con autoCommit) no se revierte (comportamiento actual)', async () => {
    const conn = createFakeConnection([
      { rows: [] },
      { rows: [{ nextId: 100 }] },
      { rowsAffected: 1 },
      new Error('ORA-02291: integrity constraint violated'),
    ]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({
      status: 500,
      body: { error: 'Error BD: ORA-02291: integrity constraint violated' },
    });
    expect(conn.calls[2].options).toEqual({ autoCommit: true });
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 si no hay conexión', async () => {
    getConnection.mockRejectedValue(new Error('sin red'));
    expect(await readResponse(await post(validBody))).toEqual({ status: 500, body: { error: 'Error BD: sin red' } });
  });

  test('500 si la placa no es string (placa.replace lanza)', async () => {
    expect((await readResponse(await post({ ...validBody, placa: 123456 }))).status).toBe(500);
    expect(getConnection).not.toHaveBeenCalled();
  });
});
