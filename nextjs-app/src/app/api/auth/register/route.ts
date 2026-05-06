import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

const BCRYPT_SALT_ROUNDS = 12

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name may only contain letters and spaces'),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  role: z.nativeEnum(Role, {
    errorMap: () => ({
      message: 'Role must be CUSTOMER, RESTAURANT, or AGENT',
    }),
  }),
  restaurantName: z.string().min(1).max(100).optional(),
  restaurantAddress: z.string().min(1).max(500).optional(),
})

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = registerSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { name, email, password, role, restaurantName, restaurantAddress } =
    result.data

  // Validate restaurant fields when role is RESTAURANT
  if (role === Role.RESTAURANT) {
    if (!restaurantName || restaurantName.trim().length === 0) {
      return Response.json(
        { error: 'Restaurant name is required for restaurant accounts' },
        { status: 400 }
      )
    }
    if (!restaurantAddress || restaurantAddress.trim().length === 0) {
      return Response.json(
        { error: 'Restaurant address is required for restaurant accounts' },
        { status: 400 }
      )
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name, email, passwordHash, role },
      })

      if (role === Role.RESTAURANT && restaurantName && restaurantAddress) {
        await tx.restaurant.create({
          data: {
            name: restaurantName.trim(),
            address: restaurantAddress.trim(),
            ownerId: newUser.id,
          },
        })
      }

      return newUser
    })

    return Response.json({ ok: true, id: user.id }, { status: 201 })
  } catch (err: unknown) {
    // Prisma unique constraint violation (P2002)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return Response.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }
    console.error('[register] unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
