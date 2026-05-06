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

// Valid transitions for the agent role
const AGENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.READY_FOR_PICKUP]: OrderStatus.OUT_FOR_DELIVERY,
  [OrderStatus.OUT_FOR_DELIVERY]: OrderStatus.DELIVERED,
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
  const auth = await requireRole(Role.AGENT)
  if (isResponse(auth)) return auth

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
      select: { id: true, agentId: true, status: true },
    })

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // Agent must be assigned to this order
    if (order.agentId !== auth.userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (FINALIZED_STATUSES.includes(order.status)) {
      return Response.json(
        { error: 'Order is already finalized' },
        { status: 422 }
      )
    }

    const allowedNextStatus = AGENT_TRANSITIONS[order.status]
    if (!allowedNextStatus || allowedNextStatus !== newStatus) {
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
    console.error('[PATCH /api/agent/orders/:id/status] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
