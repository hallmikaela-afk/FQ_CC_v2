import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/login';

  // Check all possible Supabase auth cookie names
  const cookies = req.cookies.getAll();
  const hasAuth = cookies.some(c => 
    c.name.startsWith('sb-') && 
    (c.name.endsWith('-auth-token') || c.name.endsWith('-access-token') || c.name.endsWith('-refresh-token'))
  );

  if (!hasAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (hasAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
