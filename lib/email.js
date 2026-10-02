import { logError, logInfo } from '@/lib/log';
import { VERIFICACION } from '@/lib/domain/verificacionRegistro';

// Envío de correos con la API HTTP de Brevo (sin dependencias). Variables de entorno:
// BREVO_API_KEY, EMAIL_REMITENTE (un remitente verificado en Brevo) y, opcional, EMAIL_REMITENTE_NOMBRE.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Feature flag: con `true`, registrarse exige el código que llega al correo. Apagado por defecto. */
export function verificacionDeCorreoActiva() {
  return process.env.EMAIL_VERIFICATION === 'true';
}

/** true si están las variables para enviar correos. */
export function envioDeCorreoConfigurado() {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_REMITENTE);
}

// El nombre lo escribe la persona: se escapa antes de ponerlo en el HTML
const escaparHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Asunto y cuerpo (HTML y texto) del correo con el código. */
export function mensajeDeVerificacion({ nombre, codigo }) {
  const minutos = VERIFICACION.VIGENCIA_SEG / 60;
  const saludo = `Hola, ${nombre}:`;
  return {
    subject: `${codigo} es tu código de verificación de Bycar`,
    textContent: `${saludo}\n\nTu código para terminar el registro en Bycar es ${codigo}.\n`
      + `Vence en ${minutos} minutos. Si no fuiste tú, ignora este correo: la cuenta no se crea.\n`,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#E52222">Bycar</h2>
  <p>${escaparHtml(saludo)}</p>
  <p>Tu código para terminar el registro es:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px">${codigo}</p>
  <p>Vence en ${minutos} minutos. Si no fuiste tú, ignora este correo: la cuenta no se crea.</p>
</div>`,
  };
}

/**
 * Envía el código al correo. Devuelve true si Brevo lo aceptó.
 * No registra en el log el correo ni el código (datos sensibles).
 */
export async function enviarCodigoVerificacion({ correo, nombre, codigo }) {
  if (!envioDeCorreoConfigurado()) {
    logError('email_no_configurado', new Error('Faltan BREVO_API_KEY o EMAIL_REMITENTE'));
    return false;
  }
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: process.env.EMAIL_REMITENTE_NOMBRE || 'Bycar', email: process.env.EMAIL_REMITENTE },
        to: [{ email: correo }],
        ...mensajeDeVerificacion({ nombre, codigo }),
      }),
    });
    if (!res.ok) {
      logError('email_rechazado', new Error(`Brevo respondió ${res.status}`), { status: res.status });
      return false;
    }
    logInfo('email_codigo_enviado');
    return true;
  } catch (error) {
    logError('email_fallido', error);
    return false;
  }
}
