import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'

export interface AuthContext {
  userId: string
  email: string
  role: Role
}

/**
 * Reads x-user-* headers injected by middleware and validates the caller's role
 * against the live database. Returns AuthContext on success, or a Response on
 * failure (403 Forbidden). Route Handlers check the return type to bail early.
 */
export async function requireRole(
  requiredRole: Role
): Promise<AuthContext | Response> {
  const h = await headers()
  const userId = h.get('x-user-id')
  const email = h.get('x-user-email')
  const headerRole = h.get('x-user-role')

  if (!userId || !email || !headerRole) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Live DB role lookup — never trust JWT payload role alone
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || user.role !== requiredRole) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId, email, role: user.role }
}

/** Convenience helper that accepts any of the provided roles */
export async function requireAnyRole(
  ...roles: Role[]
): Promise<AuthContext | Response> {
  const h = await headers()
  const userId = h.get('x-user-id')
  const email = h.get('x-user-email')

  if (!userId || !email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || !roles.includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId, email, role: user.role }
}

/** Type guard to distinguish AuthContext from Response */
export function isResponse(value: AuthContext | Response): value is Response {
  return value instanceof Response
}
