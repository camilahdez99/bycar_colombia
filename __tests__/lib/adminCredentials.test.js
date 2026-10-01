// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isAdminCredentials, isAdminLoginConfigured } from '@/lib/auth/adminCredentials';

afterEach(() => vi.unstubAllEnvs());

const configure = (email, password) => {
  vi.stubEnv('ADMIN_EMAIL', email);
  vi.stubEnv('ADMIN_PASSWORD', password);
};

describe('isAdminLoginConfigured', () => {
  test.each([
    ['', ''],
    ['admin@x.co', ''],
    ['', 'clave'],
  ])('false si falta alguna variable: %j / %j', (email, password) => {
    configure(email, password);
    expect(isAdminLoginConfigured()).toBe(false);
  });

  test('true con las dos variables', () => {
    configure('admin@x.co', 'clave');
    expect(isAdminLoginConfigured()).toBe(true);
  });
});

describe('isAdminCredentials', () => {
  test('sin configurar nunca acepta, ni siquiera el admin histórico', () => {
    configure('', '');
    expect(isAdminCredentials('admin@bycar.co', 'admin')).toBe(false);
  });

  test('acepta solo la coincidencia exacta', () => {
    configure('admin@x.co', 'clave');
    expect(isAdminCredentials('admin@x.co', 'clave')).toBe(true);
    expect(isAdminCredentials('ADMIN@x.co', 'clave')).toBe(false);
    expect(isAdminCredentials('admin@x.co', 'clave ')).toBe(false);
    expect(isAdminCredentials('otro@x.co', 'clave')).toBe(false);
  });
});
