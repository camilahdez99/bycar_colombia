import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSessionFetch, expireSession } from '@/lib/client/sessionFetch';

const responseWith = (status) => new Response('{}', { status });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('createSessionFetch', () => {
  test('pasa input e init tal cual y devuelve la misma respuesta', async () => {
    const original = responseWith(200);
    const fetchImpl = vi.fn(async () => original);
    const onExpired = vi.fn();
    const init = { method: 'POST', body: '{"a":1}' };

    const response = await createSessionFetch({ fetchImpl, onExpired })('/api/x', init);

    expect(fetchImpl).toHaveBeenCalledWith('/api/x', init);
    expect(response).toBe(original);
    expect(onExpired).not.toHaveBeenCalled();
  });

  test.each([400, 403, 404, 500])('%i no dispara la expiración', async (status) => {
    const onExpired = vi.fn();
    await createSessionFetch({ fetchImpl: async () => responseWith(status), onExpired })('/api/x');
    expect(onExpired).not.toHaveBeenCalled();
  });

  test('401 dispara la expiración y devuelve la respuesta igual', async () => {
    const onExpired = vi.fn();
    const response = await createSessionFetch({ fetchImpl: async () => responseWith(401), onExpired })('/api/x');
    expect(onExpired).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
  });

  test('varios 401 en paralelo expiran una sola vez', async () => {
    const onExpired = vi.fn();
    const fetchConSesion = createSessionFetch({ fetchImpl: async () => responseWith(401), onExpired });
    await Promise.all([fetchConSesion('/a'), fetchConSesion('/b'), fetchConSesion('/c')]);
    expect(onExpired).toHaveBeenCalledOnce();
  });

  test('un error de red se propaga sin expirar la sesión', async () => {
    const onExpired = vi.fn();
    const fetchConSesion = createSessionFetch({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
      onExpired,
    });
    await expect(fetchConSesion('/api/x')).rejects.toThrow('Failed to fetch');
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('expireSession', () => {
  test('borra el usuario de localStorage y navega a /login', () => {
    localStorage.setItem('user', '{"ID_USU":7}');
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ assign });

    expireSession();

    expect(localStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });
});
