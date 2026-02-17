import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Intercept root URL with code param → redirect to mode landing page
  if (pathname === '/' && searchParams.has('code')) {
    const code = searchParams.get('code')!;
    const mode = searchParams.get('mode') || 'bible';
    const url = req.nextUrl.clone();
    url.pathname = mode === 'positivity' ? '/positivity' : '/bible';
    url.searchParams.delete('mode');
    url.searchParams.set('code', code);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
