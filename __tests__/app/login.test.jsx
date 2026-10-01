import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import LoginPage from '@/app/login/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
}));

const USUARIO = { ID_USU: 7, NOMBRE_USU: 'ANA', APELLIDO_USU: 'PEREZ', CORREO_USU: 'ana@x.co' };

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function completar(correo, contrasena) {
  fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: correo } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: contrasena } });
}

const botonIngresar = () => screen.getByRole('button', { name: /Iniciar sesión|Iniciando/ });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LoginPage (caracterización)', () => {
  test('con campos vacíos avisa y no llama a la API', () => {
    render(<LoginPage />);
    completar('ana@x.co', '');
    fireEvent.click(botonIngresar());

    expect(toast.error).toHaveBeenCalledWith('Completa todos los campos');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('envía correo (recortado por el input type=email, sin pasar a minúsculas) y contraseña, con fetch directo', async () => {
    fetch.mockResolvedValue(jsonResponse({ message: 'Login exitoso', user: USUARIO, redirect: '/dashboard' }));
    render(<LoginPage />);
    completar('  Ana@X.co ', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'Ana@X.co', contrasena: 'secreta' }),
    });
  });

  test('login de usuario: guarda la fila del usuario en localStorage y navega al redirect', async () => {
    fetch.mockResolvedValue(jsonResponse({ message: 'Login exitoso', user: USUARIO, redirect: '/dashboard' }));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(USUARIO);
    expect(toast.success).toHaveBeenCalledWith('¡Bienvenido!');
  });

  test('el login del admin no trae user y borra el usuario anterior de localStorage (F33)', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    fetch.mockResolvedValue(jsonResponse({ message: 'Login exitoso', redirect: '/admin' }));
    render(<LoginPage />);
    completar('admin@bycar.co', 'admin');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('un login de usuario reemplaza el usuario anterior', async () => {
    localStorage.setItem('user', JSON.stringify({ ID_USU: 1, NOMBRE_USU: 'OTRO' }));
    fetch.mockResolvedValue(jsonResponse({ message: 'Login exitoso', user: USUARIO, redirect: '/dashboard' }));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(USUARIO);
  });

  test('credenciales inválidas no tocan el usuario guardado', async () => {
    localStorage.setItem('user', JSON.stringify(USUARIO));
    fetch.mockResolvedValue(jsonResponse({ error: 'Credenciales incorrectas' }, 401));
    render(<LoginPage />);
    completar('ana@x.co', 'mala');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(USUARIO);
  });

  test('comportamiento actual: un 200 sin redirect navega a undefined', async () => {
    fetch.mockResolvedValue(jsonResponse({ user: USUARIO }));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(push).toHaveBeenCalledWith(undefined));
  });

  test('credenciales inválidas: muestra el error de la API, no guarda nada ni navega', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'Credenciales incorrectas' }, 401));
    render(<LoginPage />);
    completar('ana@x.co', 'mala');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Credenciales incorrectas'));
    expect(localStorage.getItem('user')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  test('error sin mensaje: usa el texto genérico', async () => {
    fetch.mockResolvedValue(jsonResponse({}, 500));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al iniciar sesión'));
  });

  test('falla de red o respuesta que no es JSON: "Error de conexión con el servidor"', async () => {
    fetch.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión con el servidor'));
    expect(botonIngresar().disabled).toBe(false);
  });

  test('mientras espera la respuesta el botón queda deshabilitado con "Iniciando..."', async () => {
    let responder;
    fetch.mockReturnValue(new Promise((resolve) => { responder = resolve; }));
    render(<LoginPage />);
    completar('ana@x.co', 'secreta');
    fireEvent.click(botonIngresar());

    await waitFor(() => expect(botonIngresar().textContent).toBe('Iniciando...'));
    expect(botonIngresar().disabled).toBe(true);

    responder(jsonResponse({ error: 'Credenciales incorrectas' }, 401));
    await waitFor(() => expect(botonIngresar().textContent).toBe('Iniciar sesión'));
  });

  test('el logo lleva a la landing y el enlace a /register', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Bycar'));
    fireEvent.click(screen.getByText('Regístrate gratis'));

    expect(push.mock.calls).toEqual([['/'], ['/register']]);
  });
});
