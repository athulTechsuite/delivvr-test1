import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'delivvr_token'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return new TextEncoder().encode(secret)
}

function getLoginRedirectPath(role?: string): string {
  switch (role) {
    case 'RESTAURANT':
      return '/login/restaurant'
    case 'AGENT':
      return '/login/agent'
    default:
      return '/login/customer'
  }
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

function redirectOrUnauthorized(req: NextRequest, role?: string): NextResponse {
  if (isApiRequest(req.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const loginPath = getLoginRedirectPath(role)
  return NextResponse.redirect(new URL(loginPath, req.url))
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // Skip auth for public auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return redirectOrUnauthorized(req)
  }

  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)

    const userId = payload.sub as string
    const email = payload.email as string
    const role = payload.role as string

    if (!userId || !email || !role) {
      return redirectOrUnauthorized(req)
    }

    // Inject user context into request headers for downstream Route Handlers
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', userId)
    requestHeaders.set('x-user-email', email)
    requestHeaders.set('x-user-role', role)

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  } catch {
    return redirectOrUnauthorized(req)
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
