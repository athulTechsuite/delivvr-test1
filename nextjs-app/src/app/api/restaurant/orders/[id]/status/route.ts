import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role, OrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const FINALIZED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
]

// Valid transitions for restaurant role
const RESTAURANT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP],
}

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
})

interface RouteParams {
  params: { id: string }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.RESTAURANT)
  if (isResponse(auth)) return auth

  const restaurant = await prisma.restaurant.findUnique({
    where: { ownerId: auth.userId },
    select: { id: true },
  })

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

  const result = updateStatusSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { status: newStatus } = result.data

  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, restaurantId: true, status: true },
    })

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // Enforce restaurant scoping
    if (order.restaurantId !== restaurant.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (FINALIZED_STATUSES.includes(order.status)) {
      return Response.json(
        { error: 'Order is already finalized' },
        { status: 422 }
      )
    }

    const allowedTransitions = RESTAURANT_TRANSITIONS[order.status] ?? []
    if (!allowedTransitions.includes(newStatus)) {
      return Response.json(
        { error: 'Invalid status transition' },
        { status: 422 }
      )
    }

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: { status: newStatus },
      select: { id: true, status: true, updatedAt: true },
    })

    return Response.json(updated, { status: 200 })
  } catch (err) {
    console.error('[PATCH /api/restaurant/orders/:id/status] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
