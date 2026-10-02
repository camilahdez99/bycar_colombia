// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getConnection } from '@/lib/db';
import { POST as registrar } from '@/app/api/auth/register/route';
import { POST as verificar } from '@/app/api/auth/register/verificar/route';
import { POST as reenviar } from '@/app/api/auth/register/reenviar/route';
import { hashCodigo } from '@/lib/auth/codigoVerificacion';
import { createFakeConnection, makeRequest, oracleError, readResponse, silenceConsole } from '../../../helpers/api';

vi.mock('@/lib/db', () => ({ getConnection: vi.fn() }));

const NOW = 1_760_000_000_000;
const datosRegistro = { nombre: 'ana', apellido: 'pérez', correo: '  Ana@X.CO ', contrasena: 'Secreta1' };
const llamar = (handler, ruta, body) => handler(makeRequest(ruta, { method: 'POST', body }));

let brevo;
let conn;
const usarConexion = (respuestas) => {
  conn = createFakeConnection(respuestas);
  getConnection.mockResolvedValue(conn);
  return conn;
};
const sqls = () => conn.calls.map((c) => c.sql.replace(/\s+/g, ' ').trim());
const codigoEnviado = () => JSON.parse(brevo.mock.calls.at(-1)[1].body).subject.slice(0, 6);

/** Fila de REGISTROS_PENDIENTES como la devuelve buscarPendiente. */
const pendiente = (extra) => ({
  rows: [{
    id: 5, nombre: 'ana', apellido: 'pérez', correo: 'ana@x.co', contrasena: 'Secreta1',
    codigoHash: hashCodigo('ana@x.co', '123456'), intentos: 0, reenvios: 0, vencido: 0, segundosDesdeEnvio: 120,
    ...extra,
  }],
});

beforeEach(() => {
  vi.clearAllMocks();
  silenceConsole();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.stubEnv('EMAIL_VERIFICATION', 'true');
  vi.stubEnv('SESSION_SECRET', 'v'.repeat(32));
  vi.stubEnv('BREVO_API_KEY', 'clave-de-prueba');
  vi.stubEnv('EMAIL_REMITENTE', 'bycar@x.co');
  brevo = vi.fn(async () => new Response('{"messageId":"m1"}', { status: 201 }));
  vi.stubGlobal('fetch', brevo);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/auth/register con EMAIL_VERIFICATION', () => {
  const post = (body = datosRegistro) => llamar(registrar, '/api/auth/register', body);

  test('202: guarda el pendiente con el hash del código (no el código), lo envía al correo y confirma', async () => {
    usarConexion([{ rowsAffected: 0 }, { rows: [{ total: 0 }] }, { rows: [] }, { rowsAffected: 1 }]);

    expect(await readResponse(await post())).toEqual({
      status: 202,
      body: {
        codigo: 'VERIFICACION_PENDIENTE',
        mensaje: 'Te enviamos un código de verificación a tu correo.',
        correo: 'ana@x.co',
        vigenciaSegundos: 300,
        intentos: 2,
      },
    });
    expect(sqls()[0]).toBe('DELETE FROM REGISTROS_PENDIENTES WHERE EXPIRA_REG <= CURRENT_TIMESTAMP');
    const insert = conn.calls[3];
    expect(insert.sql).toContain('INSERT INTO REGISTROS_PENDIENTES');
    expect(insert.sql).toContain("CURRENT_TIMESTAMP + INTERVAL '300 seconds'");
    expect(insert.binds).toMatchObject({ id: NOW, correo: 'ana@x.co', nombre: 'ana', contrasena: 'Secreta1' });
    expect(JSON.stringify(insert.binds)).not.toContain(codigoEnviado());
    expect(insert.binds.codigoHash).toBe(hashCodigo('ana@x.co', codigoEnviado()));
    expect(JSON.parse(brevo.mock.calls[0][1].body).to).toEqual([{ email: 'ana@x.co' }]);
    expect(conn.commit).toHaveBeenCalledOnce();
    // Ningún usuario se crea todavía
    expect(sqls().some((s) => s.includes('INSERT INTO USUARIOS'))).toBe(false);
  });

  test('400 con un correo sin forma válida, sin abrir conexión ni enviar nada', async () => {
    expect(await readResponse(await post({ ...datosRegistro, correo: 'ana@x' }))).toEqual({
      status: 400,
      body: { error: 'Ingresa un correo electrónico válido' },
    });
    expect(getConnection).not.toHaveBeenCalled();
    expect(brevo).not.toHaveBeenCalled();
  });

  test('409 si el correo ya es de un usuario, sin crear pendiente ni enviar', async () => {
    usarConexion([{ rowsAffected: 0 }, { rows: [{ total: 1 }] }]);
    expect(await readResponse(await post())).toEqual({ status: 409, body: { error: 'El correo ya está registrado' } });
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(brevo).not.toHaveBeenCalled();
  });

  test('429 si se envió un código a ese correo hace menos de 60 s', async () => {
    usarConexion([{ rowsAffected: 0 }, { rows: [{ total: 0 }] }, pendiente({ segundosDesdeEnvio: 10 })]);
    expect(await readResponse(await post())).toEqual({
      status: 429,
      body: { error: 'Ya te enviamos un código. Espera 50 s para pedir otro.', codigo: 'REENVIO_EN_ESPERA', segundos: 50 },
    });
    expect(brevo).not.toHaveBeenCalled();
  });

  test('con un pendiente anterior de hace más de 60 s, lo reemplaza', async () => {
    usarConexion([{ rowsAffected: 0 }, { rows: [{ total: 0 }] }, pendiente(), { rowsAffected: 1 }, { rowsAffected: 1 }]);
    expect((await post()).status).toBe(202);
    expect(sqls()[3]).toBe('DELETE FROM REGISTROS_PENDIENTES WHERE CORREO_REG = :correo');
    expect(sqls()[4]).toContain('INSERT INTO REGISTROS_PENDIENTES');
  });

  test('502 si Brevo no envía el correo: rollback, no queda pendiente', async () => {
    brevo.mockResolvedValue(new Response('{}', { status: 400 }));
    usarConexion([{ rowsAffected: 0 }, { rows: [{ total: 0 }] }, { rows: [] }, { rowsAffected: 1 }]);
    expect(await readResponse(await post())).toEqual({
      status: 502,
      body: { error: 'No pudimos enviar el código a ese correo. Revisa que esté bien escrito e intenta de nuevo.' },
    });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/register/verificar', () => {
  const post = (body) => llamar(verificar, '/api/auth/register/verificar', body);

  test('404 con el flag apagado, sin abrir conexión', async () => {
    vi.stubEnv('EMAIL_VERIFICATION', '');
    expect(await readResponse(await post({ correo: 'ana@x.co', codigo: '123456' }))).toEqual({
      status: 404, body: { error: 'No disponible' },
    });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each([
    [{ correo: 'ana@x.co', codigo: '12345' }, 'El código tiene 6 dígitos'],
    [{ correo: 'ana', codigo: '123456' }, 'Ingresa un correo electrónico válido'],
  ])('400 con %j, sin abrir conexión', async (body, error) => {
    expect(await readResponse(await post(body))).toEqual({ status: 400, body: { error } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('404 si no hay pendiente para ese correo', async () => {
    usarConexion([{ rows: [] }]);
    const res = await readResponse(await post({ correo: 'ana@x.co', codigo: '123456' }));
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('REGISTRO_NO_ENCONTRADO');
  });

  test('201 con el código correcto: crea el usuario con sus permisos, borra el pendiente y confirma', async () => {
    usarConexion([pendiente(), { rowsAffected: 1 }, { rows: [{ ID_ENU: 1 }, { ID_ENU: 2 }] }, {}, {}, { rowsAffected: 1 }]);

    expect(await readResponse(await post({ correo: ' ANA@x.co ', codigo: '123 456' }))).toEqual({
      status: 201, body: { message: 'Usuario registrado correctamente', id: NOW },
    });
    expect(conn.calls[1].sql).toContain('INSERT INTO USUARIOS');
    expect(conn.calls[1].binds).toMatchObject({ nombre: 'ANA', apellido: 'PÉREZ', correo: 'ana@x.co', contrasena: 'Secreta1' });
    expect(sqls().filter((s) => s.startsWith('INSERT INTO PERMISOS'))).toHaveLength(2);
    expect(sqls().at(-1)).toBe('DELETE FROM REGISTROS_PENDIENTES WHERE CORREO_REG = :correo');
    expect(conn.commit).toHaveBeenCalled();
  });

  test('primer error: suma el intento y avisa que queda 1', async () => {
    usarConexion([pendiente(), { rowsAffected: 1 }]);
    expect(await readResponse(await post({ correo: 'ana@x.co', codigo: '000000' }))).toEqual({
      status: 400,
      body: { error: 'Código incorrecto. Te queda 1 intento.', codigo: 'CODIGO_INCORRECTO', intentosRestantes: 1 },
    });
    expect(conn.calls[1].sql).toContain('SET INTENTOS_REG = INTENTOS_REG + 1');
    expect(conn.calls[1].binds).toEqual({ id: 5, intentosPrevios: 0 });
    expect(conn.commit).toHaveBeenCalledOnce();
  });

  test('segundo error: descarta el registro, sin crear el usuario', async () => {
    usarConexion([pendiente({ intentos: 1 }), { rowsAffected: 1 }]);
    const res = await readResponse(await post({ correo: 'ana@x.co', codigo: '000000' }));
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe('REGISTRO_DESCARTADO');
    expect(sqls()[1]).toBe('DELETE FROM REGISTROS_PENDIENTES WHERE CORREO_REG = :correo');
    expect(sqls().some((s) => s.includes('INSERT INTO USUARIOS'))).toBe(false);
  });

  test('vencido: descarta aunque el código sea correcto', async () => {
    usarConexion([pendiente({ vencido: 1 }), { rowsAffected: 1 }]);
    const res = await readResponse(await post({ correo: 'ana@x.co', codigo: '123456' }));
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe('CODIGO_VENCIDO');
    expect(sqls().some((s) => s.includes('INSERT INTO USUARIOS'))).toBe(false);
  });

  test('dos errores a la vez: si otro intento ya sumó, este descarta el registro', async () => {
    usarConexion([pendiente(), { rowsAffected: 0 }, { rowsAffected: 1 }]);
    const res = await readResponse(await post({ correo: 'ana@x.co', codigo: '000000' }));
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe('REGISTRO_DESCARTADO');
  });

  test('409 si el correo se registró mientras tanto (ORA-00001): rollback', async () => {
    usarConexion([pendiente(), oracleError(1)]);
    expect(await readResponse(await post({ correo: 'ana@x.co', codigo: '123456' }))).toEqual({
      status: 409, body: { error: 'El correo ya está registrado' },
    });
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('rutas públicas, como register', () => {
  test.each([
    ['verificar', verificar, '/api/auth/register/verificar', { correo: 'ana@x.co', codigo: '123456' }],
    ['reenviar', reenviar, '/api/auth/register/reenviar', { correo: 'ana@x.co' }],
  ])('%s responde sin sesión con AUTH_ENFORCED=true', async (_nombre, handler, ruta, body) => {
    vi.stubEnv('AUTH_ENFORCED', 'true');
    usarConexion([{ rows: [] }]);
    expect((await llamar(handler, ruta, body)).status).toBe(404);
    expect(getConnection).toHaveBeenCalled();
  });
});

describe('POST /api/auth/register/reenviar', () => {
  const post = (body = { correo: 'ana@x.co' }) => llamar(reenviar, '/api/auth/register/reenviar', body);

  test('200: código nuevo con 5 minutos e intentos reiniciados, y lo envía', async () => {
    usarConexion([pendiente({ reenvios: 1, intentos: 1 }), { rowsAffected: 1 }]);
    expect(await readResponse(await post())).toEqual({
      status: 200,
      body: {
        codigo: 'VERIFICACION_PENDIENTE', mensaje: 'Te enviamos un código nuevo.',
        vigenciaSegundos: 300, intentos: 2, reenviosRestantes: 1,
      },
    });
    const update = conn.calls[1];
    expect(update.sql).toContain('INTENTOS_REG = 0');
    expect(update.sql).toContain('REENVIOS_REG = REENVIOS_REG + 1');
    expect(update.binds.codigoHash).toBe(hashCodigo('ana@x.co', codigoEnviado()));
    expect(conn.commit).toHaveBeenCalledOnce();
  });

  test('429 antes de 60 s desde el último envío', async () => {
    usarConexion([pendiente({ segundosDesdeEnvio: 30 })]);
    const res = await readResponse(await post());
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ codigo: 'REENVIO_EN_ESPERA', segundos: 30 });
    expect(brevo).not.toHaveBeenCalled();
  });

  test('429 con los 3 reenvíos usados', async () => {
    usarConexion([pendiente({ reenvios: 3 })]);
    const res = await readResponse(await post());
    expect(res.status).toBe(429);
    expect(res.body.codigo).toBe('SIN_REENVIOS');
  });

  test('410 si ya venció: descarta el registro', async () => {
    usarConexion([pendiente({ vencido: 1 }), { rowsAffected: 1 }]);
    expect((await readResponse(await post())).body.codigo).toBe('CODIGO_VENCIDO');
    expect(sqls()[1]).toBe('DELETE FROM REGISTROS_PENDIENTES WHERE CORREO_REG = :correo');
  });

  test('404 sin pendiente', async () => {
    usarConexion([{ rows: [] }]);
    expect((await readResponse(await post())).body.codigo).toBe('REGISTRO_NO_ENCONTRADO');
  });

  test('502 si Brevo falla: rollback, el código anterior sigue valiendo', async () => {
    brevo.mockResolvedValue(new Response('{}', { status: 500 }));
    usarConexion([pendiente(), { rowsAffected: 1 }]);
    expect((await post()).status).toBe(502);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});
