import { NextResponse } from 'next/server';
import { getSession, isAuthEnforced } from '@/lib/auth/guard';
import { ROLES } from '@/lib/auth/session';

// Chequeo optimista de páginas; la autorización real vive en cada route handler
export async function proxy(request) {
  if (!isAuthEnforced()) return NextResponse.next();

  const session = await getSession(request);
  const requiresAdmin = request.nextUrl.pathname.startsWith('/admin');
  const allowed = session && (!requiresAdmin || session.role === ROLES.ADMIN);

  return allowed ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
