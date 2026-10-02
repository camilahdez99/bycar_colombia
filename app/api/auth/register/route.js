import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { correoValido } from '@/lib/domain/validadores';
import { RESULTADO_VERIFICACION, VERIFICACION } from '@/lib/domain/verificacionRegistro';
import { generarCodigo, hashCodigo } from '@/lib/auth/codigoVerificacion';
import { enviarCodigoVerificacion, verificacionDeCorreoActiva } from '@/lib/email';
import {
  MENSAJE_ENVIO_FALLIDO, borrarPendiente, buscarPendiente, correoYaRegistrado, crearPendiente, crearUsuario,
  limpiarPendientesVencidos,
} from '@/lib/api/registro';

const MENSAJE_CORREO_DUPLICADO = 'El correo ya está registrado';

export async function POST(req) {
  let connection;
  try {
    const { nombre, apellido, correo, contrasena } = await req.json();

    if (!nombre || !apellido || !correo || !contrasena) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Con EMAIL_VERIFICATION el usuario recién se crea al verificar el código (register/verificar)
    if (verificacionDeCorreoActiva()) {
      const correoNormalizado = correoValido(correo);
      if (!correoNormalizado) {
        return NextResponse.json({ error: 'Ingresa un correo electrónico válido' }, { status: 400 });
      }
      connection = await getConnection();
      return await iniciarVerificacion(connection, { nombre, apellido, correo: correoNormalizado, contrasena });
    }

    connection = await getConnection();

    const idUsu = await crearUsuario(connection, { nombre, apellido, correo, contrasena });

    // Confirmar la transacción
    await connection.commit();

    return NextResponse.json({ message: 'Usuario registrado correctamente', id: idUsu }, { status: 201 });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError('db_rollback_failed', rollbackError, { route: 'POST /api/auth/register' });
      }
    }
    // Detect duplicate email (unique‑constraint violation)
    if (error && error.errorNum === 1) {
      // ORA‑00001: unique constraint (email) violated
      return NextResponse.json({ error: MENSAJE_CORREO_DUPLICADO }, { status: 409 });
    }
    // Detect foreign‑key violation (e.g., perfil no existe)
    if (error && error.errorNum === 2291) {
      // ORA‑02291: integrity constraint (FK) violated
      return NextResponse.json({ error: 'Perfil no válido o datos faltantes' }, { status: 400 });
    }
    logError('api_error', error, { route: 'POST /api/auth/register', mensaje: 'Error al registrar usuario' });
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/auth/register');
  }
}

/**
 * Guarda el registro como pendiente y envía el código al correo. Si el envío falla, no queda
 * nada guardado. Volver a registrarse con el mismo correo reemplaza el pendiente anterior,
 * pero no antes de la espera entre envíos (para no usarlo como reenvío sin límite).
 */
async function iniciarVerificacion(connection, datos) {
  await limpiarPendientesVencidos(connection);

  if (await correoYaRegistrado(connection, datos.correo)) {
    return NextResponse.json({ error: MENSAJE_CORREO_DUPLICADO }, { status: 409 });
  }

  const anterior = await buscarPendiente(connection, datos.correo);
  const espera = Math.ceil(VERIFICACION.ESPERA_REENVIO_SEG - Number(anterior?.segundosDesdeEnvio ?? Infinity));
  if (espera > 0) {
    return NextResponse.json({
      error: `Ya te enviamos un código. Espera ${espera} s para pedir otro.`,
      codigo: RESULTADO_VERIFICACION.ESPERA,
      segundos: espera,
    }, { status: 429 });
  }
  if (anterior) await borrarPendiente(connection, datos.correo);

  const codigo = generarCodigo();
  await crearPendiente(connection, { ...datos, codigoHash: hashCodigo(datos.correo, codigo) });

  if (!(await enviarCodigoVerificacion({ correo: datos.correo, nombre: datos.nombre, codigo }))) {
    await connection.rollback();
    return NextResponse.json({ error: MENSAJE_ENVIO_FALLIDO }, { status: 502 });
  }

  await connection.commit();
  return NextResponse.json({
    codigo: RESULTADO_VERIFICACION.PENDIENTE,
    mensaje: 'Te enviamos un código de verificación a tu correo.',
    correo: datos.correo,
    vigenciaSegundos: VERIFICACION.VIGENCIA_SEG,
    intentos: VERIFICACION.MAX_INTENTOS,
  }, { status: 202 });
}
