import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas (no requieren sesión)
const publicPaths = ['/login', '/register', '/favicon.ico', '/api/auth/callback'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Permitir archivos estáticos y public paths
  if (publicPaths.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Leer cookie de supabase (auth) - supabase usa 'sb:token' variantes; simplificamos tomando 'sb' prefix
  const hasAuthCookie = Array.from(req.cookies.getAll()).some(c => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  if (!hasAuthCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
};
