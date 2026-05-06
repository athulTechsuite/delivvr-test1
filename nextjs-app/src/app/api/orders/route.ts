import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

const orderItemSchema = z.object({
  menuItemId: z.string().min(1, 'Menu item ID is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1'),
})

const placeOrderSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
  deliveryAddress: z
    .string()
    .min(5, 'Delivery address must be at least 5 characters')
    .max(500, 'Delivery address must be at most 500 characters'),
})

export async function GET(): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  try {
    const orders = await prisma.order.findMany({
      where: { customerId: auth.userId },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        agent: { select: { id: true, name: true } },
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
    console.error('[GET /api/orders] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireRole(Role.CUSTOMER)
  if (isResponse(auth)) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = placeOrderSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { restaurantId, items, deliveryAddress } = result.data

  try {
    // Validate restaurant is active
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, isActive: true },
    })

    if (!restaurant || !restaurant.isActive) {
      return Response.json(
        { error: 'Restaurant is not available' },
        { status: 422 }
      )
    }

    // Validate all menu items exist, belong to restaurant, and are available
    const menuItemIds = items.map((i) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
      select: { id: true, price: true, available: true },
    })

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]))

    const invalidItemIds: string[] = []
    for (const item of items) {
      const mi = menuItemMap.get(item.menuItemId)
      if (!mi || !mi.available) {
        invalidItemIds.push(item.menuItemId)
      }
    }

    if (invalidItemIds.length > 0) {
      return Response.json(
        {
          error: 'Some menu items are unavailable or do not belong to this restaurant',
          invalidItemIds,
        },
        { status: 422 }
      )
    }

    // Calculate total
    let total = 0
    for (const item of items) {
      const mi = menuItemMap.get(item.menuItemId)!
      total += Number(mi.price) * item.quantity
    }

    const totalDecimal = Math.round(total * 100) / 100

    // Create order and items in a single transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId: auth.userId,
          restaurantId,
          deliveryAddress,
          totalPrice: totalDecimal,
          items: {
            create: items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: Number(menuItemMap.get(item.menuItemId)!.price),
            })),
          },
        },
        include: {
          items: true,
        },
      })
      return newOrder
    })

    return Response.json({ ok: true, orderId: order.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/orders] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
