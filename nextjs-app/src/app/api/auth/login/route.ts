import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, setAuthCookie } from '@/lib/auth'
import { Role } from '@prisma/client'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Invalid role' }),
  }),
})

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = loginSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { email, password, role } = result.data

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Always run bcrypt compare to prevent timing attacks
    const dummyHash =
      '$2b$12$invalidhashfortimingnormalizationXXXXXXXXXXXXXXXXXXXXXX'
    const passwordMatch = await bcrypt.compare(
      password,
      user?.passwordHash ?? dummyHash
    )

    if (!user || user.role !== role || !passwordMatch) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    await setAuthCookie(token)

    return Response.json({ ok: true, role: user.role }, { status: 200 })
  } catch (err) {
    console.error('[login] unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
