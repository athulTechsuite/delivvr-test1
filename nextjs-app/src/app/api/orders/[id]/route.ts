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

const updateStatusSchema = z.object({
  status: z.literal(OrderStatus.CANCELLED, {
    errorMap: () => ({ message: 'Customers may only cancel orders' }),
  }),
})

interface RouteParams {
  params: { id: string }
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  const { id: orderId } = params

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        agent: { select: { id: true, name: true } },
      },
    })

    if (!order || order.customerId !== auth.userId) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    const serialised = {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
      })),
    }

    return Response.json(serialised, { status: 200 })
  } catch (err) {
    console.error('[GET /api/orders/:id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  const { id: orderId } = params

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

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, status: true },
    })

    if (!order || order.customerId !== auth.userId) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    if (FINALIZED_STATUSES.includes(order.status)) {
      return Response.json(
        { error: 'Order is already finalized' },
        { status: 422 }
      )
    }

    if (order.status !== OrderStatus.PENDING) {
      return Response.json(
        { error: 'Orders can only be cancelled when in PENDING status' },
        { status: 422 }
      )
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
      select: { id: true, status: true },
    })

    return Response.json(updated, { status: 200 })
  } catch (err) {
    console.error('[PATCH /api/orders/:id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
