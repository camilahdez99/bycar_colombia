import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

let assign;

beforeEach(() => {
  assign = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ assign, origin: 'http://localhost' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('user', JSON.stringify({ ID_USU: 7 }));
  vi.stubGlobal('fetch', vi.fn(async (url) =>
    new Response(JSON.stringify(String(url).startsWith('/api/viajes/mis-rutas') ? { publicadas: [], solicitadas: [] } : []), { status: 200 }),
  ));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  push.mockClear();
});

test('cerrar sesión usa el logout compartido: POST al endpoint, limpia el usuario y navega al inicio (DT-11)', async () => {
  render(<DashboardPage />);
  fireEvent.click(await screen.findByText('Cerrar Sesión'));

  await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  expect(localStorage.getItem('user')).toBeNull();
  expect(push).not.toHaveBeenCalled();
});
