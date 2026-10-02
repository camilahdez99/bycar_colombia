import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { JSON_INVALIDO, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { correoValido } from '@/lib/domain/validadores';
import { RESULTADO_VERIFICACION, VERIFICACION, permisoDeReenvio } from '@/lib/domain/verificacionRegistro';
import { generarCodigo, hashCodigo } from '@/lib/auth/codigoVerificacion';
import { enviarCodigoVerificacion, verificacionDeCorreoActiva } from '@/lib/email';
import { MENSAJE_ENVIO_FALLIDO, borrarPendiente, buscarPendiente, renovarCodigo } from '@/lib/api/registro';

// Ruta pública, como register: quien pide el reenvío todavía no tiene cuenta ni sesión
const RUTA = 'POST /api/auth/register/reenviar';

const respuesta = (status, codigo, error, extra = {}) => NextResponse.json({ error, codigo, ...extra }, { status });

/** Envía un código nuevo al registro pendiente: reinicia los 5 minutos y los intentos (máximo 3 reenvíos). */
export async function POST(req) {
  if (!verificacionDeCorreoActiva()) {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  }

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const correo = correoValido(body?.correo);
    if (!correo) return NextResponse.json({ error: 'Ingresa un correo electrónico válido' }, { status: 400 });

    connection = await getConnection();

    const pendiente = await buscarPendiente(connection, correo);
    if (!pendiente) {
      return respuesta(404, RESULTADO_VERIFICACION.NO_ENCONTRADO,
        'No hay un registro pendiente para ese correo, o ya se descartó. Regístrate de nuevo.');
    }
    if (Number(pendiente.vencido) === 1) {
      await borrarPendiente(connection, correo);
      await connection.commit();
      return respuesta(410, RESULTADO_VERIFICACION.VENCIDO, 'El código venció y tu registro se descartó. Regístrate de nuevo.');
    }

    const permiso = permisoDeReenvio(pendiente);
    if (permiso.motivo === 'limite') {
      return respuesta(429, RESULTADO_VERIFICACION.SIN_REENVIOS,
        `Ya pediste ${VERIFICACION.MAX_REENVIOS} códigos nuevos. Usa el último o regístrate de nuevo cuando venza.`);
    }
    if (permiso.motivo === 'espera') {
      return respuesta(429, RESULTADO_VERIFICACION.ESPERA,
        `Espera ${permiso.segundos} s para pedir otro código.`, { segundos: permiso.segundos });
    }

    const codigo = generarCodigo();
    await renovarCodigo(connection, pendiente.id, hashCodigo(correo, codigo));

    if (!(await enviarCodigoVerificacion({ correo, nombre: pendiente.nombre, codigo }))) {
      await connection.rollback();
      return NextResponse.json({ error: MENSAJE_ENVIO_FALLIDO }, { status: 502 });
    }

    await connection.commit();
    return NextResponse.json({
      codigo: RESULTADO_VERIFICACION.PENDIENTE,
      mensaje: 'Te enviamos un código nuevo.',
      vigenciaSegundos: VERIFICACION.VIGENCIA_SEG,
      intentos: VERIFICACION.MAX_INTENTOS,
      reenviosRestantes: VERIFICACION.MAX_REENVIOS - Number(pendiente.reenvios) - 1,
    }, { status: 200 });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError('db_rollback_failed', rollbackError, { route: RUTA });
      }
    }
    logError('api_error', error, { route: RUTA, mensaje: 'Error al reenviar el código' });
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    await closeConnection(connection, RUTA);
  }
}
