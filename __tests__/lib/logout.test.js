import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { logout } from '@/lib/client/logout';

let assign;

beforeEach(() => {
  assign = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ assign });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('user', '{"ID_USU":7}');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('logout', () => {
  test('llama al endpoint, limpia el usuario local y vuelve al inicio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));

    await logout();

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(localStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
  });

  test('si la red falla, igual cierra la sesión local y vuelve al inicio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await logout();

    expect(localStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
    expect(console.error).toHaveBeenCalled();
  });
});
