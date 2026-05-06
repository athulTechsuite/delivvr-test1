import { NextRequest } from 'next/server'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  const { id: restaurantId } = params

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, isActive: true },
    })

    if (!restaurant || !restaurant.isActive) {
      return Response.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, available: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        available: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    // Convert Decimal to number for JSON serialisation
    const items = menuItems.map((item) => ({
      ...item,
      price: Number(item.price),
    }))

    return Response.json(items, { status: 200 })
  } catch (err) {
    console.error('[GET /api/restaurants/:id/menu] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
