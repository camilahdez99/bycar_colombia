import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
