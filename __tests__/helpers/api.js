import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Conexión Oracle falsa. Cada `execute` consume la siguiente respuesta de la cola:
 * un objeto resultado ({ rows, rowsAffected, ... }), un Error (se lanza) o una
 * función (sql, binds) => resultado. Con la cola vacía devuelve { rows: [] }.
 * Registra cada llamada en `calls` para fijar SQL y binds por snapshot.
 */
export function createFakeConnection(responses = []) {
  const queue = [...responses];
  const calls = [];
  return {
    calls,
    execute: vi.fn(async (sql, binds, options) => {
      calls.push({ sql, binds, options });
      const next = queue.length ? queue.shift() : { rows: [] };
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next(sql, binds) : next;
    }),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

export function oracleError(errorNum, message = `ORA-${errorNum}`) {
  return Object.assign(new Error(message), { errorNum });
}

export function makeRequest(path, { method = 'GET', query, body } = {}) {
  const url = new URL(path, 'http://localhost');
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const init = { method };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  return new NextRequest(url, init);
}

export async function readResponse(response) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

export function silenceConsole() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}
