import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return Response.json(restaurants, { status: 200 })
  } catch (err) {
    console.error('[GET /api/restaurants] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
