import { createTransport } from 'nodemailer';
import { logError, logInfo } from '@/lib/log';
import { VERIFICACION } from '@/lib/domain/verificacionRegistro';

// Envío de correos. Dos proveedores, según las variables de entorno:
// - Gmail (SMTP con nodemailer): GMAIL_USER y GMAIL_APP_PASSWORD (contraseña de aplicación de Google).
//   Tiene prioridad: Google firma el correo como @gmail.com y llega a la bandeja de entrada.
// - Brevo (API HTTP): BREVO_API_KEY y EMAIL_REMITENTE (remitente verificado en Brevo). Sin un dominio
//   propio autenticado, los correos suelen llegar a spam.
// Opcional para los dos: EMAIL_REMITENTE_NOMBRE (por defecto "Bycar").
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const GMAIL_SMTP = { host: 'smtp.gmail.com', port: 465, secure: true };

/** Feature flag: con `true`, registrarse exige el código que llega al correo. Apagado por defecto. */
export function verificacionDeCorreoActiva() {
  return process.env.EMAIL_VERIFICATION === 'true';
}

/** 'gmail', 'brevo' o null, según qué variables estén configuradas. Gmail tiene prioridad. */
export function proveedorDeCorreo() {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.BREVO_API_KEY && process.env.EMAIL_REMITENTE) return 'brevo';
  return null;
}

/** true si hay un proveedor configurado para enviar correos. */
export function envioDeCorreoConfigurado() {
  return proveedorDeCorreo() !== null;
}

const nombreRemitente = () => process.env.EMAIL_REMITENTE_NOMBRE || 'Bycar';

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

/** Asunto y cuerpo (HTML y texto) del aviso al guardián. `tipo`: 'inicio' o 'alerta'. */
export function mensajeDeGuardian(tipo, { protegido, origen, destino, conductor, placa, carro, salida, tiempo }) {
  const ruta = `${origen} → ${destino}`;
  const detalle = [
    `Pasajero: ${protegido}`,
    `Ruta: ${ruta}`,
    `Conductor: ${conductor}`,
    `Vehículo: ${carro || 'N/D'} (placa ${placa || 'N/D'})`,
    salida ? `Salida: ${salida}` : null,
    tiempo ? `Tiempo estimado: ${tiempo} min` : null,
  ].filter(Boolean);

  const esAlerta = tipo === 'alerta';
  const subject = esAlerta
    ? `⚠️ ${protegido} no confirmó su llegada (${ruta})`
    : `🛡️ ${protegido} te eligió como guardián de su viaje (${ruta})`;
  const intro = esAlerta
    ? `${protegido} activó el Guardián de Bycar para este viaje y el tiempo estimado venció sin que confirmara su llegada. Te compartimos los datos del viaje para que puedas comunicarte.`
    : `${protegido} está por iniciar un viaje y te eligió como su contacto de confianza en Bycar. Si no confirma su llegada en el tiempo estimado, te avisaremos.`;

  const textContent = `${intro}\n\n${detalle.join('\n')}\n\nIngresa a Bycar para ver el seguimiento y escribirle.\n`;
  const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#E52222">Bycar</h2>
  <p>${escaparHtml(intro)}</p>
  <ul style="line-height:1.6">${detalle.map((d) => `<li>${escaparHtml(d)}</li>`).join('')}</ul>
  <p>Ingresa a Bycar para ver el seguimiento y escribirle.</p>
</div>`;
  return { subject, textContent, htmlContent };
}

/**
 * Gmail obliga a que el remitente sea la propia cuenta. La contraseña de aplicación se muestra
 * en grupos de 4 letras: se le quitan los espacios por si se pegó así.
 */
async function enviarPorGmail(correo, mensaje) {
  const transporte = createTransport({
    ...GMAIL_SMTP,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
  });
  try {
    await transporte.sendMail({
      from: { name: nombreRemitente(), address: process.env.GMAIL_USER },
      to: correo,
      subject: mensaje.subject,
      text: mensaje.textContent,
      html: mensaje.htmlContent,
    });
    return true;
  } catch (error) {
    // El mensaje de error de SMTP puede incluir el destinatario: al log van solo los códigos
    logError('email_rechazado', new Error(`Gmail: ${error.code ?? 'error'} ${error.responseCode ?? ''}`.trim()), {
      proveedor: 'gmail',
    });
    return false;
  } finally {
    transporte.close();
  }
}

async function enviarPorBrevo(correo, mensaje) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: nombreRemitente(), email: process.env.EMAIL_REMITENTE },
      to: [{ email: correo }],
      ...mensaje,
    }),
  });
  if (!res.ok) {
    logError('email_rechazado', new Error(`Brevo respondió ${res.status}`), { proveedor: 'brevo', status: res.status });
    return false;
  }
  return true;
}

/**
 * Envía un mensaje ({ subject, textContent, htmlContent }) al correo con el proveedor configurado.
 * Devuelve true si lo aceptó. No registra en el log el correo (dato sensible). `evento` es la
 * etiqueta del log de éxito.
 */
async function enviarMensaje(correo, mensaje, evento) {
  const proveedor = proveedorDeCorreo();
  if (!proveedor) {
    logError('email_no_configurado', new Error('Faltan GMAIL_USER y GMAIL_APP_PASSWORD, o BREVO_API_KEY y EMAIL_REMITENTE'));
    return false;
  }
  try {
    const enviado = proveedor === 'gmail' ? await enviarPorGmail(correo, mensaje) : await enviarPorBrevo(correo, mensaje);
    if (enviado) logInfo(evento, { proveedor });
    return enviado;
  } catch (error) {
    logError('email_fallido', error, { proveedor });
    return false;
  }
}

/**
 * Envía el código al correo con el proveedor configurado. Devuelve true si lo aceptó.
 * No registra en el log el correo ni el código (datos sensibles).
 */
export async function enviarCodigoVerificacion({ correo, nombre, codigo }) {
  return enviarMensaje(correo, mensajeDeVerificacion({ nombre, codigo }), 'email_codigo_enviado');
}

/**
 * Avisa por correo al contacto de confianza. `tipo` es 'inicio' (el viaje empezó) o 'alerta'
 * (venció el tiempo sin confirmar la llegada). Devuelve true si el proveedor aceptó el correo.
 * Un envío fallido no corta el viaje: el llamador solo lo usa para no repetir el aviso.
 */
export async function enviarAvisoGuardian({ correo, tipo, datos }) {
  return enviarMensaje(correo, mensajeDeGuardian(tipo, datos), `email_guardian_${tipo}`);
}
