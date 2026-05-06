import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
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

  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
    console.error('[GET /api/restaurant/orders] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
