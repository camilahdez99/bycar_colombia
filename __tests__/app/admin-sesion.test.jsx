// Archivo propio: fetchConSesion guarda estado a nivel de módulo (expira una sola vez por carga de página)
import { Component } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));

class CapturarError extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('si la API responde 401, redirige a /login una sola vez', async () => {
  const assign = vi.fn();
  const onError = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ assign });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 })),
  );

  render(
    <CapturarError onError={onError}>
      <AdminPage />
    </CapturarError>,
  );

  await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
  expect(assign).toHaveBeenCalledOnce();

  // F27 corregido: el body de error no se guarda como lista y el render no falla
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al obtener lista de tablas'));
  expect(onError).not.toHaveBeenCalled();
});
