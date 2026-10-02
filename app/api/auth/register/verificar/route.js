import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { JSON_INVALIDO, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { correoValido } from '@/lib/domain/validadores';
import { RESULTADO_VERIFICACION, codigoConFormato, resultadoDelIntento } from '@/lib/domain/verificacionRegistro';
import { hashCodigo, mismoHash } from '@/lib/auth/codigoVerificacion';
import { verificacionDeCorreoActiva } from '@/lib/email';
import { borrarPendiente, buscarPendiente, crearUsuario, sumarIntentoFallido } from '@/lib/api/registro';

// Ruta pública, como register: quien verifica todavía no tiene cuenta ni sesión
const RUTA = 'POST /api/auth/register/verificar';

const respuesta = (status, codigo, error, extra = {}) => NextResponse.json({ error, codigo, ...extra }, { status });

/** Comprueba el código del correo. Si es correcto crea el usuario; si vence o falla dos veces, descarta el registro. */
export async function POST(req) {
  if (!verificacionDeCorreoActiva()) {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  }

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const correo = correoValido(body?.correo);
    const codigo = codigoConFormato(body?.codigo);
    if (!correo) return NextResponse.json({ error: 'Ingresa un correo electrónico válido' }, { status: 400 });
    if (!codigo) return NextResponse.json({ error: 'El código tiene 6 dígitos' }, { status: 400 });

    connection = await getConnection();

    const pendiente = await buscarPendiente(connection, correo);
    if (!pendiente) {
      return respuesta(404, RESULTADO_VERIFICACION.NO_ENCONTRADO,
        'No hay un registro pendiente para ese correo, o ya se descartó. Regístrate de nuevo.');
    }

    const resultado = resultadoDelIntento({
      vencido: Number(pendiente.vencido) === 1,
      intentosPrevios: pendiente.intentos,
      correcto: mismoHash(hashCodigo(correo, codigo), pendiente.codigoHash),
    });

    // Si otro intento llegó a la vez, este cuenta como el segundo error
    if (resultado.estado === 'incorrecto' && !(await sumarIntentoFallido(connection, pendiente.id, pendiente.intentos))) {
      resultado.estado = 'descartado';
    }

    if (resultado.estado === 'incorrecto') {
      await connection.commit();
      const { intentosRestantes } = resultado;
      return respuesta(400, RESULTADO_VERIFICACION.INCORRECTO,
        `Código incorrecto. Te queda ${intentosRestantes} ${intentosRestantes === 1 ? 'intento' : 'intentos'}.`,
        { intentosRestantes });
    }

    if (resultado.estado === 'vencido' || resultado.estado === 'descartado') {
      await borrarPendiente(connection, correo);
      await connection.commit();
      return resultado.estado === 'vencido'
        ? respuesta(410, RESULTADO_VERIFICACION.VENCIDO, 'El código venció y tu registro se descartó. Regístrate de nuevo.')
        : respuesta(410, RESULTADO_VERIFICACION.DESCARTADO,
          'Código incorrecto. Te equivocaste 2 veces y tu registro se descartó. Regístrate de nuevo.');
    }

    // Verificado: recién ahora se crea el usuario, con los datos que esperaban en el pendiente
    const idUsu = await crearUsuario(connection, pendiente);
    await borrarPendiente(connection, correo);
    await connection.commit();
    return NextResponse.json({ message: 'Usuario registrado correctamente', id: idUsu }, { status: 201 });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError('db_rollback_failed', rollbackError, { route: RUTA });
      }
    }
    // Alguien registró el mismo correo mientras tanto (ORA-00001)
    if (error?.errorNum === 1) {
      return NextResponse.json({ error: 'El correo ya está registrado' }, { status: 409 });
    }
    logError('api_error', error, { route: RUTA, mensaje: 'Error al verificar el código' });
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    await closeConnection(connection, RUTA);
  }
}
