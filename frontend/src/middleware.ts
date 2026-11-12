import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add the paths that require authentication here
const protectedPaths = [
  '/dashboard',
  '/profile',
  '/settings',
  '/wallet',
  '/vouch/create',
  '/vouch/join',
  // The admin panel was not listed, so a signed-out visitor got the page
  // shell and a client-side error rather than the login screen. The real
  // authorisation still happens server-side on every /disputes call — this
  // only stops an unauthenticated request rendering the panel at all.
  '/admin',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current path is in our protected paths
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    const token = request.cookies.get('vouchit_token')?.value;
    
    // If no token exists, redirect to login
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      // Optional: pass the original URL so they can be redirected back after login
      // loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If authenticated or path is public, let the request proceed
  return NextResponse.next();
}

export const config = {
  // Only run middleware on the paths we care about protecting
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/wallet/:path*',
    '/vouch/create/:path*',
    '/vouch/join/:path*',
    '/admin/:path*',
  ],
};
