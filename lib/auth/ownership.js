import { forbidden, getSession, isAuthEnforced, unauthenticated } from './guard';
import { ROLES } from './session';
import { logWarn } from '@/lib/log';

export function sameUser(a, b) {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
}

/**
 * Verifica que el usuario de la sesión sea dueño del recurso (IDOR, BUGS S6).
 * `isOwner(userId)` puede ser async y consultar la BD: solo se invoca con AUTH_ENFORCED
 * prendido y para usuarios no admin, así que con el flag apagado no se ejecuta nada nuevo.
 * Devuelve una respuesta 401/403, o null si puede seguir.
 */
export async function checkOwnership(req, isOwner) {
  if (!isAuthEnforced()) return null;
  const session = await getSession(req);
  if (!session) return unauthenticated();
  if (session.role === ROLES.ADMIN) return null;
  if (await isOwner(session.userId)) return null;
  logWarn('ownership_denied', { path: new URL(req.url).pathname, userId: session.userId });
  return forbidden();
}

/** Atajo para rutas que reciben el ID del propio usuario (query o body). */
export function requireSelf(req, usuarioId) {
  return checkOwnership(req, (userId) => sameUser(userId, usuarioId));
}
