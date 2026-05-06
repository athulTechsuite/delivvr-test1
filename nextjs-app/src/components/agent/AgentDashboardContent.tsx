'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/StatusBadge'

const POLL_INTERVAL_MS = 15_000

interface OrderItem {
  id: string
  menuItem: { id: string; name: string }
  quantity: number
  unitPrice: number
}

interface Order {
  id: string
  status: string
  deliveryAddress: string
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string }
  restaurant: { id: string; name: string; address: string }
  items: OrderItem[]
}

const AGENT_ACTION_MAP: Partial<Record<string, { nextStatus: string; label: string }>> = {
  READY_FOR_PICKUP: { nextStatus: 'OUT_FOR_DELIVERY', label: 'Pick Up' },
  OUT_FOR_DELIVERY: { nextStatus: 'DELIVERED', label: 'Mark Delivered' },
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function AgentDashboardContent() {
  const queryClient = useQueryClient()

  const {
    data: orders,
    isLoading,
    error,
  } = useQuery<Order[]>({
    queryKey: ['agent-orders'],
    queryFn: () => fetchJson<Order[]>('/api/agent/orders'),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const updateStatus = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string
      status: string
    }) => {
      const res = await fetch(`/api/agent/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-orders'] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-32 animate-pulse rounded-xl bg-gray-200"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"
      >
        Failed to load orders. Please refresh the page.
      </div>
    )
  }

  if (!orders?.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-gray-500">No active deliveries assigned to you.</p>
        <p className="mt-1 text-xs text-gray-400">
          This page auto-refreshes every 15 seconds.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Your Active Deliveries
          <span className="ml-2 text-xs font-normal text-gray-400">
            (auto-refreshes every 15s)
          </span>
        </h2>
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="space-y-4">
        {orders.map((order) => {
          const action = AGENT_ACTION_MAP[order.status]

          return (
            <li
              key={order.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {order.restaurant.name}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Pickup: {order.restaurant.address}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Deliver to: {order.deliveryAddress}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Customer: {order.customer.name}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Order items */}
              <ul className="mt-3 space-y-0.5 text-sm text-gray-600">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.menuItem.name} × {item.quantity}
                  </li>
                ))}
              </ul>

              {updateStatus.isError &&
                updateStatus.variables?.orderId === order.id && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {updateStatus.error instanceof Error
                      ? updateStatus.error.message
                      : 'Failed to update status'}
                  </p>
                )}

              {action && (
                <button
                  onClick={() =>
                    updateStatus.mutate({
                      orderId: order.id,
                      status: action.nextStatus,
                    })
                  }
                  disabled={
                    updateStatus.isPending &&
                    updateStatus.variables?.orderId === order.id
                  }
                  className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateStatus.isPending &&
                  updateStatus.variables?.orderId === order.id
                    ? 'Updating…'
                    : action.label}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
