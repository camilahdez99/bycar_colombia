// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST } from '@/app/api/auth/register/route';
import {
  createFakeConnection,
  makeRequest,
  oracleError,
  readResponse,
  silenceConsole,
} from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;
const validBody = { nombre: 'ana', apellido: 'pérez', correo: '  Ana@X.CO ', contrasena: 'Secreta1' };
const post = (body) => POST(makeRequest('/api/auth/register', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/auth/register (caracterización)', () => {
  test.each(['nombre', 'apellido', 'correo', 'contrasena'])('400 si falta %s', async (campo) => {
    const body = { ...validBody, [campo]: '' };
    expect(await readResponse(await post(body))).toEqual({
      status: 400,
      body: { error: 'Faltan campos obligatorios' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: inserta usuario normalizado, un permiso por menú y hace commit', async () => {
    const conn = createFakeConnection([
      { rowsAffected: 1 },
      { rows: [{ ID_ENU: 1 }, { ID_ENU: 2 }, { ID_ENU: 5 }] },
    ]);
    getConnection.mockResolvedValue(conn);

    const res = await readResponse(await post(validBody));

    expect(res).toEqual({ status: 201, body: { message: 'Usuario registrado correctamente', id: NOW } });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.commit).toHaveBeenCalledOnce();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('201 sin menús: solo inserta el usuario', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }, { rows: [] }]);
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await post(validBody))).status).toBe(201);
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.commit).toHaveBeenCalledOnce();
  });

  test('409 si el correo ya existe (ORA-00001) y hace rollback', async () => {
    const conn = createFakeConnection([oracleError(1)]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({
      status: 409,
      body: { error: 'El correo ya está registrado' },
    });
    expect(conn.rollback).toHaveBeenCalledOnce();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('400 si falla una FK (ORA-02291)', async () => {
    const conn = createFakeConnection([oracleError(2291)]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({
      status: 400,
      body: { error: 'Perfil no válido o datos faltantes' },
    });
  });

  test('500 ante cualquier otro error, con rollback', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }, new Error('boom')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validBody))).toEqual({
      status: 500,
      body: { error: 'Error interno del servidor' },
    });
    expect(conn.rollback).toHaveBeenCalledOnce();
  });

  test('500 si no hay conexión (sin rollback posible)', async () => {
    getConnection.mockRejectedValue(new Error('sin red'));
    expect((await readResponse(await post(validBody))).status).toBe(500);
  });
});
