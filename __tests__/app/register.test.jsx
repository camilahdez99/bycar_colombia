import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RegisterPage from '@/app/register/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Nombre y apellido no tienen placeholder: se ubican por orden en el formulario
function campos() {
  const [nombre, apellido] = screen.getAllByRole('textbox').filter((input) => input.type === 'text');
  return {
    nombre,
    apellido,
    correo: screen.getByPlaceholderText('tu@correo.com'),
    contrasena: screen.getByPlaceholderText('••••••••'),
  };
}

function completar(valores) {
  const inputs = campos();
  for (const [campo, valor] of Object.entries(valores)) fireEvent.change(inputs[campo], { target: { value: valor } });
}

const COMPLETO = { nombre: 'ana maría', apellido: 'pérez', correo: ' Ana@X.co ', contrasena: '1' };
const botonCrear = () => screen.getByRole('button', { name: /Crear cuenta|Creando/ });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RegisterPage (caracterización)', () => {
  test('nombre y apellido se pasan a mayúsculas al escribir (conservan tildes); el correo solo lo recorta el input type=email', () => {
    render(<RegisterPage />);
    completar(COMPLETO);

    const { nombre, apellido, correo, contrasena } = campos();
    expect([nombre.value, apellido.value, correo.value, contrasena.value]).toEqual(['ANA MARÍA', 'PÉREZ', 'Ana@X.co', '1']);
  });

  test.each(['nombre', 'apellido', 'correo', 'contrasena'])('si falta %s avisa y no llama a la API', (faltante) => {
    render(<RegisterPage />);
    completar({ ...COMPLETO, [faltante]: '' });
    fireEvent.click(botonCrear());

    expect(toast.error).toHaveBeenCalledWith('Completa todos los campos');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('comportamiento actual: un nombre de solo espacios pasa la validación del cliente', async () => {
    fetch.mockResolvedValue(jsonResponse({ message: 'ok' }, 201));
    render(<RegisterPage />);
    completar({ ...COMPLETO, nombre: '   ' });
    fireEvent.click(botonCrear());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  test('alta correcta: envía el correo sin pasarlo a minúsculas, avisa y lleva a /login', async () => {
    fetch.mockResolvedValue(jsonResponse({ message: 'Usuario registrado exitosamente' }, 201));
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'ANA MARÍA', apellido: 'PÉREZ', correo: 'Ana@X.co', contrasena: '1' }),
    });
    expect(toast.success).toHaveBeenCalledWith('¡Registro exitoso! Ya puedes iniciar sesión.');
  });

  test('error de la API (correo repetido): muestra su mensaje y no navega', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'El correo ya está registrado' }, 409));
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('El correo ya está registrado'));
    expect(push).not.toHaveBeenCalled();
  });

  test('error sin mensaje: usa el texto genérico', async () => {
    fetch.mockResolvedValue(jsonResponse({}, 500));
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al registrarse'));
  });

  test('falla de red: "Error de conexión" y el botón vuelve a habilitarse', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión'));
    expect(botonCrear().disabled).toBe(false);
    expect(botonCrear().textContent).toBe('Crear cuenta gratis');
  });

  test('mientras espera la respuesta el botón queda deshabilitado con "Creando cuenta..."', async () => {
    fetch.mockReturnValue(new Promise(() => {}));
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());

    await waitFor(() => expect(botonCrear().textContent).toBe('Creando cuenta...'));
    expect(botonCrear().disabled).toBe(true);
  });

  test('el logo lleva a la landing y el enlace a /login', () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByText('Bycar'));
    fireEvent.click(screen.getByText('Inicia sesión'));

    expect(push.mock.calls).toEqual([['/'], ['/login']]);
  });
});

describe('RegisterPage · verificación del correo (EMAIL_VERIFICATION)', () => {
  const PENDIENTE = {
    codigo: 'VERIFICACION_PENDIENTE', mensaje: 'Te enviamos un código de verificación a tu correo.',
    correo: 'ana@x.co', vigenciaSegundos: 300, intentos: 2,
  };

  /** Responde según la URL: el registro siempre deja el pendiente; el resto lo decide cada test. */
  function api(respuestas = {}) {
    fetch.mockImplementation(async (url) => {
      if (url === '/api/auth/register') return jsonResponse(PENDIENTE, 202);
      const [body, status] = respuestas[url] ?? [{}, 500];
      return jsonResponse(body, status);
    });
  }

  async function llegarAlCodigo() {
    render(<RegisterPage />);
    completar(COMPLETO);
    fireEvent.click(botonCrear());
    await screen.findByText('Verifica tu correo', {}, ESPERA);
  }

  const escribirCodigo = (codigo) =>
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: codigo } });
  const botonVerificar = () => screen.getByRole('button', { name: /Verificar/ });
  // Con setInterval falso, waitFor no puede hacer polling: depende de que el DOM cambie
  const ESPERA = { timeout: 3000 };
  const pasar = (ms) => act(async () => { vi.advanceTimersByTime(ms); });

  afterEach(() => vi.useRealTimers());

  test('con 202 pide el código: muestra el correo, el contador de 5:00 y los 2 intentos', async () => {
    api();
    await llegarAlCodigo();

    expect(toast.success).toHaveBeenCalledWith('Te enviamos un código de verificación a tu correo.');
    expect(screen.getByText('ana@x.co')).toBeTruthy();
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getByText('Tienes 2 intentos. Si te equivocas 2 veces, el registro se descarta.')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  test('el campo solo acepta dígitos', async () => {
    api();
    await llegarAlCodigo();
    escribirCodigo('12a 34-56');
    expect(screen.getByLabelText('Código de verificación').value).toBe('123456');
  });

  test('menos de 6 dígitos: avisa sin llamar a la API', async () => {
    api();
    await llegarAlCodigo();
    escribirCodigo('123');
    fireEvent.click(botonVerificar());

    expect(screen.getByRole('alert').textContent).toBe('El código tiene 6 dígitos.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('código correcto: verifica con el correo normalizado de la API y lleva a /login', async () => {
    api({ '/api/auth/register/verificar': [{ message: 'Usuario registrado correctamente', id: 1 }, 201] });
    await llegarAlCodigo();
    escribirCodigo('123456');
    fireEvent.click(botonVerificar());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(toast.success).toHaveBeenCalledWith('¡Correo verificado! Ya puedes iniciar sesión.');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ correo: 'ana@x.co', codigo: '123456' });
  });

  test('primer error: lo muestra debajo del campo y sigue en el paso del código', async () => {
    api({ '/api/auth/register/verificar': [{ error: 'Código incorrecto. Te queda 1 intento.', codigo: 'CODIGO_INCORRECTO', intentosRestantes: 1 }, 400] });
    await llegarAlCodigo();
    escribirCodigo('000000');
    fireEvent.click(botonVerificar());

    expect((await screen.findByRole('alert')).textContent).toBe('Código incorrecto. Te queda 1 intento.');
    expect(screen.getByText('Verifica tu correo')).toBeTruthy();
    expect(screen.getByLabelText('Código de verificación').value).toBe('');
  });

  test('segundo error: el registro se descarta y vuelve al formulario', async () => {
    api({ '/api/auth/register/verificar': [{ error: 'Te equivocaste 2 veces y tu registro se descartó.', codigo: 'REGISTRO_DESCARTADO' }, 410] });
    await llegarAlCodigo();
    escribirCodigo('000000');
    fireEvent.click(botonVerificar());

    await screen.findByText('Únete a Bycar');
    expect(toast.error).toHaveBeenCalledWith('Te equivocaste 2 veces y tu registro se descartó.');
    expect(push).not.toHaveBeenCalled();
  });

  test('a los 5 minutos el código vence y vuelve al formulario', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    api();
    await llegarAlCodigo();

    await pasar(300 * 1000);

    await screen.findByText('Únete a Bycar', {}, ESPERA);
    expect(toast.error).toHaveBeenCalledWith('El código venció y tu registro se descartó. Regístrate de nuevo.');
  });

  test('reenviar: disponible a los 60 s; pide un código nuevo y reinicia el contador', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    api({ '/api/auth/register/reenviar': [{ codigo: 'VERIFICACION_PENDIENTE', vigenciaSegundos: 300, intentos: 2, reenviosRestantes: 2 }, 200] });
    await llegarAlCodigo();
    expect(screen.getByText(/Puedes pedir otro en \d+ s/)).toBeTruthy();

    await pasar(61 * 1000);
    fireEvent.click(await screen.findByText('Reenviar código', {}, ESPERA));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Te enviamos un código nuevo. Te quedan 2 reenvíos.'), ESPERA);
    expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toEqual({ correo: 'ana@x.co' });
    await pasar(1000);
    expect(await screen.findByText(/^0[45]:\d\d$/, {}, ESPERA)).toBeTruthy();
    expect(screen.queryByText('03:58')).toBeNull();
  });

  test('"Cambiar correo" vuelve al formulario con los datos cargados', async () => {
    api();
    await llegarAlCodigo();
    fireEvent.click(screen.getByText('Cambiar correo'));

    await screen.findByText('Únete a Bycar');
    expect(campos().correo.value).toBe('Ana@X.co');
  });
});
