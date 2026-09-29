// Archivo propio: fetchConSesion guarda estado a nivel de módulo (expira una sola vez por carga de página)
import { Component } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';

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

  // Comportamiento actual (BUGS F27): el panel guarda el body de error como lista de tablas y el render falla
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0].message).toBe('tablesList.map is not a function');
});
