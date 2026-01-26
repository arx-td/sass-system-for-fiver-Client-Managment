import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/forgot-password', '/reset-password'];

// Role-based route access
const roleRoutes: Record<string, string[]> = {
  ADMIN: ['/', '/admin'],
  MANAGER: ['/', '/manager'],
  TEAM_LEAD: ['/', '/team-lead'],
  DEVELOPER: ['/', '/developer'],
  DESIGNER: ['/', '/designer'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow exact root path (landing page)
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Allow other public routes
  if (publicRoutes.some((route) => route !== '/' && pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth token in cookies or localStorage equivalent
  const token = request.cookies.get('access_token')?.value;

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Note: Full role-based access control is handled client-side
  // because we need to decode the JWT to get the user's role
  // Server-side middleware only handles basic auth check

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * - public files
     * - static assets (.png, .jpg, .svg, .ico, .json, .js in public)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
