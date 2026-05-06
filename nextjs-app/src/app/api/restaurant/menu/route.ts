import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

const MAX_PRICE = 9999.99

const createMenuItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(MAX_PRICE, `Price must be at most ${MAX_PRICE}`)
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(String(Math.round(v * 100) / 100)),
      'Price may have at most 2 decimal places'
    ),
  available: z.boolean().default(true),
})

async function getRestaurantForUser(
  userId: string
): Promise<{ id: string } | null> {
  return prisma.restaurant.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  })
}

export async function GET(): Promise<Response> {
  const auth = await requireRole(Role.RESTAURANT)
  if (isResponse(auth)) return auth

  const restaurant = await getRestaurantForUser(auth.userId)
  if (!restaurant) {
    return Response.json(
      { error: 'Restaurant profile not found. Please complete your setup.' },
      { status: 404 }
    )
  }

  try {
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        available: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })

    const serialised = items.map((item) => ({
      ...item,
      price: Number(item.price),
    }))

    return Response.json(serialised, { status: 200 })
  } catch (err) {
    console.error('[GET /api/restaurant/menu] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireRole(Role.RESTAURANT)
  if (isResponse(auth)) return auth

  const restaurant = await getRestaurantForUser(auth.userId)
  if (!restaurant) {
    return Response.json(
      { error: 'Restaurant profile not found. Please complete your setup.' },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = createMenuItemSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { name, description, price, available } = result.data

  try {
    const item = await prisma.menuItem.create({
      data: {
        name,
        description: description ?? null,
        price,
        available,
        restaurantId: restaurant.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        available: true,
        restaurantId: true,
        createdAt: true,
      },
    })

    return Response.json({ ...item, price: Number(item.price) }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/restaurant/menu] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
