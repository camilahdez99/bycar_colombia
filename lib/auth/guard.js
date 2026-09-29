import { NextResponse } from 'next/server';
import { SESSION_COOKIE, decodeSession } from './session';

// Feature flag: mientras esté apagado la API responde igual que antes de tener auth
export function isAuthEnforced() {
  return process.env.AUTH_ENFORCED === 'true';
}

export async function getSession(req) {
  return decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export const unauthenticated = () => NextResponse.json({ error: 'No autenticado' }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 });

/**
 * Devuelve una respuesta 401/403 si la request no cumple, o null si puede seguir.
 * Con el flag apagado siempre devuelve null.
 */
export async function authorize(req, { role } = {}) {
  if (!isAuthEnforced()) return null;
  const session = await getSession(req);
  if (!session) return unauthenticated();
  if (role && session.role !== role) return forbidden();
  return null;
}
