// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { DELETE, GET, POST, PUT } from '@/app/api/admin/usuarios/route';
import { createFakeConnection, makeRequest, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const RUTA = '/api/admin/usuarios';
const validPost = { nombre: 'ana', apellido: 'pérez', correo: ' Ana@X.CO ', contrasena: 'Secreta1' };
const validPut = { nombre: 'ana', apellido: 'pérez', correo: ' Ana@X.CO ' };
const get = () => GET(makeRequest(RUTA));
const post = (body) => POST(makeRequest(RUTA, { method: 'POST', body }));
const put = (query, body) => PUT(makeRequest(RUTA, { method: 'PUT', query, body }));
const del = (query) => DELETE(makeRequest(RUTA, { method: 'DELETE', query }));

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
});

describe('GET /api/admin/usuarios (caracterización)', () => {
  test('200 con las filas tal cual (comportamiento actual: sin autenticación)', async () => {
    const rows = [{ id: 1, nombre: 'ANA', apellido: 'PÉREZ', correo: 'a@x.co' }];
    const conn = createFakeConnection([{ rows }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 200, body: rows });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 con [] si rows viene undefined', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{}]));
    expect(await readResponse(await get())).toEqual({ status: 200, body: [] });
  });

  test('500 genérico si falla la consulta', async () => {
    const conn = createFakeConnection([new Error('ORA-00942')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await get())).toEqual({ status: 500, body: { error: 'Error al obtener usuarios' } });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('si close() falla igual responde 200 (el error se traga)', async () => {
    const conn = createFakeConnection([{ rows: [] }]);
    conn.close.mockRejectedValue(new Error('close'));
    getConnection.mockResolvedValue(conn);
    expect((await readResponse(await get())).status).toBe(200);
  });
});

describe('POST /api/admin/usuarios (caracterización)', () => {
  test.each(['nombre', 'apellido', 'correo', 'contrasena'])('400 si falta %s', async (campo) => {
    expect(await readResponse(await post({ ...validPost, [campo]: '' }))).toEqual({
      status: 400,
      body: { error: 'Todos los campos son obligatorios' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('201: calcula MAX+1, inserta con perfil 2 y correo sin normalizar (comportamiento actual)', async () => {
    const conn = createFakeConnection([{ rows: [{ nextId: 42 }] }, { rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validPost))).toEqual({
      status: 201,
      body: { message: 'Usuario creado exitosamente', id: 42 },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('409 si el error menciona UN_CORREO_USU', async () => {
    const conn = createFakeConnection([
      { rows: [{ nextId: 1 }] },
      new Error('ORA-00001: unique constraint (BYCAR.UN_CORREO_USU) violated'),
    ]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await post(validPost))).toEqual({
      status: 409,
      body: { error: 'El correo ya está registrado' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con el mensaje de Oracle ante otro error', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{ rows: [{ nextId: 1 }] }, new Error('ORA-00001: PK_USU')]));
    expect(await readResponse(await post(validPost))).toEqual({
      status: 500,
      body: { error: 'Error al crear usuario: ORA-00001: PK_USU' },
    });
  });

  test('500 si el JSON es inválido (req.json dentro del try)', async () => {
    expect((await readResponse(await post('{no json'))).status).toBe(500);
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/usuarios (caracterización)', () => {
  test('400 si falta id', async () => {
    expect(await readResponse(await put({}, validPut))).toEqual({ status: 400, body: { error: 'ID requerido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(['nombre', 'apellido', 'correo'])('400 si falta %s', async (campo) => {
    expect(await readResponse(await put({ id: '1' }, { ...validPut, [campo]: '' }))).toEqual({
      status: 400,
      body: { error: 'Todos los campos son obligatorios' },
    });
  });

  test('500 si el JSON es inválido aunque falte id (se parsea antes de validar)', async () => {
    expect(await readResponse(await put({}, '{no json'))).toEqual({
      status: 500,
      body: { error: 'Error al actualizar usuario' },
    });
  });

  test('200: actualiza con id string y nombres en mayúsculas', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: '7' }, validPut))).toEqual({
      status: 200,
      body: { message: 'Usuario actualizado exitosamente' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('200 aunque el usuario no exista (no se revisa rowsAffected)', async () => {
    getConnection.mockResolvedValue(createFakeConnection([{ rowsAffected: 0 }]));
    expect((await readResponse(await put({ id: '999' }, validPut))).status).toBe(200);
  });

  test('500 genérico si falla el UPDATE', async () => {
    const conn = createFakeConnection([new Error('ORA-00001')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await put({ id: '7' }, validPut))).toEqual({
      status: 500,
      body: { error: 'Error al actualizar usuario' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});

describe('DELETE /api/admin/usuarios (caracterización)', () => {
  test('400 si falta id', async () => {
    expect(await readResponse(await del({}))).toEqual({ status: 400, body: { error: 'ID requerido' } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('200: borra con id string y autoCommit', async () => {
    const conn = createFakeConnection([{ rowsAffected: 1 }]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '7' }))).toEqual({
      status: 200,
      body: { message: 'Usuario eliminado correctamente' },
    });
    expect(conn.calls).toMatchSnapshot();
    expect(conn.close).toHaveBeenCalledOnce();
  });

  test('500 con el mensaje de Oracle', async () => {
    const conn = createFakeConnection([new Error('ORA-02292')]);
    getConnection.mockResolvedValue(conn);
    expect(await readResponse(await del({ id: '7' }))).toEqual({
      status: 500,
      body: { error: 'Error al eliminar usuario: ORA-02292' },
    });
    expect(conn.close).toHaveBeenCalledOnce();
  });
});
