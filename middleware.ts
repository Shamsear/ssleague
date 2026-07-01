import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Allow internal Next.js assets, static files, and images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images') ||
    pathname.includes('.') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // 2. Redirect all other requests to "/" and clear session cookies
  const url = request.nextUrl.clone()
  url.pathname = '/'
  
  const response = NextResponse.redirect(url)

  // Force logout by deleting all authentication cookies
  response.cookies.delete('token')
  response.cookies.delete('auth_token')
  response.cookies.delete('session')

  return response
}

export const config = {
  matcher: [
    // Match all paths except favicon.ico
    '/((?!favicon.ico).*)',
  ],
}
