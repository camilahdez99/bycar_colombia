// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  enviarCodigoVerificacion,
  envioDeCorreoConfigurado,
  mensajeDeVerificacion,
  verificacionDeCorreoActiva,
} from '@/lib/email';
import { generarCodigo, hashCodigo, mismoHash } from '@/lib/auth/codigoVerificacion';
import { silenceConsole } from '../helpers/api';

beforeEach(() => {
  silenceConsole();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('flag y configuración', () => {
  test('EMAIL_VERIFICATION apagado por defecto; solo "true" lo prende', () => {
    expect(verificacionDeCorreoActiva()).toBe(false);
    vi.stubEnv('EMAIL_VERIFICATION', '1');
    expect(verificacionDeCorreoActiva()).toBe(false);
    vi.stubEnv('EMAIL_VERIFICATION', 'true');
    expect(verificacionDeCorreoActiva()).toBe(true);
  });

  test('el envío necesita BREVO_API_KEY y EMAIL_REMITENTE', () => {
    vi.stubEnv('BREVO_API_KEY', '');
    vi.stubEnv('EMAIL_REMITENTE', 'bycar@x.co');
    expect(envioDeCorreoConfigurado()).toBe(false);
    vi.stubEnv('BREVO_API_KEY', 'clave-de-prueba');
    expect(envioDeCorreoConfigurado()).toBe(true);
  });
});

describe('mensajeDeVerificacion', () => {
  test('el asunto y el texto llevan el código y los 5 minutos', () => {
    const { subject, textContent, htmlContent } = mensajeDeVerificacion({ nombre: 'ANA', codigo: '042317' });
    expect(subject).toBe('042317 es tu código de verificación de Bycar');
    expect(textContent).toContain('042317');
    expect(textContent).toContain('5 minutos');
    expect(htmlContent).toContain('042317');
  });

  test('escapa el nombre en el HTML', () => {
    const { htmlContent } = mensajeDeVerificacion({ nombre: '<script>x</script>', codigo: '123456' });
    expect(htmlContent).not.toContain('<script>');
    expect(htmlContent).toContain('&lt;script&gt;');
  });
});

describe('enviarCodigoVerificacion', () => {
  const datos = { correo: 'ana@x.co', nombre: 'ANA', codigo: '123456' };

  beforeEach(() => {
    vi.stubEnv('BREVO_API_KEY', 'clave-de-prueba');
    vi.stubEnv('EMAIL_REMITENTE', 'bycar@x.co');
  });

  test('POST a Brevo con la API key, el remitente y el destinatario; true si responde 201', async () => {
    const fetchMock = vi.fn(async () => new Response('{"messageId":"m1"}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await enviarCodigoVerificacion(datos)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('clave-de-prueba');
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: 'Bycar', email: 'bycar@x.co' });
    expect(body.to).toEqual([{ email: 'ana@x.co' }]);
    expect(body.subject).toContain('123456');
  });

  test('false si Brevo rechaza el envío', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect(await enviarCodigoVerificacion(datos)).toBe(false);
  });

  test('false si falla la red', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await enviarCodigoVerificacion(datos)).toBe(false);
  });

  test('false sin configuración, sin llamar a Brevo', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await enviarCodigoVerificacion(datos)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('código de verificación', () => {
  test('6 dígitos, con ceros a la izquierda', () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
  });

  test('hash estable por correo y código, distinto si cambia cualquiera', () => {
    vi.stubEnv('SESSION_SECRET', 's'.repeat(32));
    const hash = hashCodigo('ana@x.co', '123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(mismoHash(hash, hashCodigo('ana@x.co', '123456'))).toBe(true);
    expect(mismoHash(hash, hashCodigo('ana@x.co', '123457'))).toBe(false);
    expect(mismoHash(hash, hashCodigo('eva@x.co', '123456'))).toBe(false);
  });

  test('sin SESSION_SECRET no se puede hashear', () => {
    vi.stubEnv('SESSION_SECRET', '');
    expect(() => hashCodigo('ana@x.co', '123456')).toThrow('SESSION_SECRET');
  });

  test('mismoHash con valores vacíos o de distinto largo → false', () => {
    expect(mismoHash('', '')).toBe(false);
    expect(mismoHash('ab', 'abcd')).toBe(false);
  });
});
