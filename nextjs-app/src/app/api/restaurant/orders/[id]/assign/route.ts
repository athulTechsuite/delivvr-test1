import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, isResponse } from '@/lib/requireRole'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

const assignAgentSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
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

  const result = assignAgentSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return Response.json({ error: firstError.message }, { status: 400 })
  }

  const { agentId } = result.data

  try {
    // Verify the order belongs to this restaurant
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, restaurantId: true },
    })

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.restaurantId !== restaurant.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the agent exists and has the AGENT role
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, role: true },
    })

    if (!agent || agent.role !== Role.AGENT) {
      return Response.json(
        { error: 'The specified user is not a delivery agent' },
        { status: 422 }
      )
    }

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: { agentId },
      select: { id: true, agentId: true, status: true, updatedAt: true },
    })

    return Response.json(updated, { status: 200 })
  } catch (err) {
    console.error('[PATCH /api/restaurant/orders/:id/assign] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
