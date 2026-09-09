import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE } from '@/lib/constantes';

/**
 * Corta el paso antes de renderizar nada. Solo mira que exista la cookie: si
 * es vieja o el usuario quedo deshabilitado, la pagina lo verifica contra la
 * base y manda a /entrar. Por eso aqui NO se redirige de /entrar a inicio,
 * que armaria un ciclo con una cookie invalida.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/entrar') return NextResponse.next();
  if (req.cookies.has(COOKIE)) return NextResponse.next();

  return NextResponse.redirect(new URL('/entrar', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
