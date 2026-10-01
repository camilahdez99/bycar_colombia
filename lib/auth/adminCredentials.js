import { createHash, timingSafeEqual } from 'node:crypto';

// El atajo de admin del login solo existe si ADMIN_EMAIL y ADMIN_PASSWORD están configurados (S5)
export function isAdminLoginConfigured() {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

// Compara por digest para que el tiempo no dependa del largo ni del contenido
function safeEqual(a, b) {
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** true si correo y contraseña coinciden exactamente con las credenciales de admin configuradas. */
export function isAdminCredentials(correo, contrasena) {
  if (!isAdminLoginConfigured()) return false;
  const emailOk = safeEqual(correo, process.env.ADMIN_EMAIL);
  const passwordOk = safeEqual(contrasena, process.env.ADMIN_PASSWORD);
  return emailOk && passwordOk;
}
