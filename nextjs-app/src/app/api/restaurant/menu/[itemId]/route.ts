import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

const MAX_PRICE = 9999.99

const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(MAX_PRICE)
    .optional(),
  available: z.boolean().optional(),
})

interface RouteParams {
  params: { itemId: string }
}

async function getRestaurantForUser(userId: string) {
  return prisma.restaurant.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  })
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.RESTAURANT)
  if (isResponse(auth)) return auth

  const restaurant = await getRestaurantForUser(auth.userId)
  if (!restaurant) {
    return Response.json(
      { error: 'Restaurant profile not found' },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = updateMenuItemSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  try {
    const existing = await prisma.menuItem.findUnique({
      where: { id: params.itemId },
      select: { id: true, restaurantId: true },
    })

    if (!existing || existing.restaurantId !== restaurant.id) {
      return Response.json({ error: 'Menu item not found' }, { status: 404 })
    }

    const updated = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: result.data,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        available: true,
        restaurantId: true,
        updatedAt: true,
      },
    })

    return Response.json(
      { ...updated, price: Number(updated.price) },
      { status: 200 }
    )
  } catch (err) {
    console.error('[PUT /api/restaurant/menu/:itemId] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.RESTAURANT)
  if (isResponse(auth)) return auth

  const restaurant = await getRestaurantForUser(auth.userId)
  if (!restaurant) {
    return Response.json(
      { error: 'Restaurant profile not found' },
      { status: 404 }
    )
  }

  try {
    const existing = await prisma.menuItem.findUnique({
      where: { id: params.itemId },
      select: { id: true, restaurantId: true },
    })

    if (!existing || existing.restaurantId !== restaurant.id) {
      return Response.json({ error: 'Menu item not found' }, { status: 404 })
    }

    await prisma.menuItem.delete({ where: { id: params.itemId } })

    return Response.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/restaurant/menu/:itemId] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
