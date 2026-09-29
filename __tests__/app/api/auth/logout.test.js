// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { makeRequest, readResponse } from '../../../helpers/api';

describe('POST /api/auth/logout', () => {
  test('200 y expira la cookie de sesión', async () => {
    const req = makeRequest('/api/auth/logout', { method: 'POST' });
    req.cookies.set(SESSION_COOKIE, 'cualquier-token');

    const response = await POST(req);

    expect(await readResponse(response)).toEqual({ status: 200, body: { ok: true } });
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Expires=Thu, 01 Jan 1970`));
  });

  test('funciona aunque no haya sesión', async () => {
    const response = await POST(makeRequest('/api/auth/logout', { method: 'POST' }));
    expect(response.status).toBe(200);
  });
});
