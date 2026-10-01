import { NextResponse } from 'next/server';
import { SESSION_COOKIE, decodeSession, isSessionConfigured } from './session';
import { logAlerta } from '@/lib/log';

// Feature flag: mientras esté apagado la API responde igual que antes de tener auth
export function isAuthEnforced() {
  return process.env.AUTH_ENFORCED === 'true';
}

let misconfigurationReported = false;

// Flag prendido sin secreto: ninguna sesión es válida (falla cerrado). Se avisa una vez por proceso.
function reportMisconfiguration() {
  if (misconfigurationReported || !isAuthEnforced() || isSessionConfigured()) return;
  misconfigurationReported = true;
  logAlerta('auth_misconfigured', {
    reason: 'AUTH_ENFORCED=true sin SESSION_SECRET válido (≥ 32 caracteres): todas las requests protegidas reciben 401',
  });
}

export async function getSession(req) {
  reportMisconfiguration();
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
