import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role, OrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const AGENT_VISIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.OUT_FOR_DELIVERY,
]

export async function GET(): Promise<Response> {
  const auth = await requireRole(Role.AGENT)
  if (isResponse(auth)) return auth

  try {
    const orders = await prisma.order.findMany({
      where: {
        agentId: auth.userId,
        status: { in: AGENT_VISIBLE_STATUSES },
      },
      include: {
        customer: { select: { id: true, name: true } },
        restaurant: { select: { id: true, name: true, address: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const serialised = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
      })),
    }))

    return Response.json(serialised, { status: 200 })
  } catch (err) {
    console.error('[GET /api/agent/orders] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
