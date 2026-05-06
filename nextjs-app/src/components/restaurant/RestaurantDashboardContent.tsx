'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/StatusBadge'

const POLL_INTERVAL_MS = 15_000

interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
}

interface AgentOption {
  id: string
  name: string
}

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
  customer: { id: string; name: string; email: string }
  agent: { id: string; name: string } | null
  items: OrderItem[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Allowed next statuses for restaurant
const RESTAURANT_NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP'],
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirm',
  PREPARING: 'Start Preparing',
  READY_FOR_PICKUP: 'Mark Ready',
  CANCELLED: 'Cancel',
}

export function RestaurantDashboardContent() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('orders')

  // Menu state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [menuError, setMenuError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    available: true,
  })

  // Order state
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)
  const [agentIdInput, setAgentIdInput] = useState('')
  const [orderActionError, setOrderActionError] = useState<
    Record<string, string>
  >({})

  const { data: menuItems, isLoading: loadingMenu, error: menuLoadError } =
    useQuery<MenuItem[]>({
      queryKey: ['restaurant-menu'],
      queryFn: () => fetchJson<MenuItem[]>('/api/restaurant/menu'),
    })

  const { data: orders, isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ['restaurant-orders'],
    queryFn: () => fetchJson<Order[]>('/api/restaurant/orders'),
    refetchInterval: POLL_INTERVAL_MS,
  })

  // Menu CRUD mutations
  const createMenuItem = useMutation({
    mutationFn: async (data: Omit<MenuItem, 'id'>) => {
      const res = await fetch('/api/restaurant/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create item')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] })
      setShowAddForm(false)
      resetForm()
      setMenuError('')
    },
    onError: (err: Error) => setMenuError(err.message),
  })

  const updateMenuItem = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<MenuItem, 'id'>>
    }) => {
      const res = await fetch(`/api/restaurant/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to update item')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] })
      setEditingItem(null)
      resetForm()
      setMenuError('')
    },
    onError: (err: Error) => setMenuError(err.message),
  })

  const deleteMenuItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/restaurant/menu/${id}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete item')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] })
    },
  })

  // Order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string
      status: string
    }) => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to update status')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] })
      setOrderActionError({})
    },
    onError: (err: Error, vars) => {
      setOrderActionError((prev) => ({ ...prev, [vars.orderId]: err.message }))
    },
  })

  // Assign agent mutation
  const assignAgent = useMutation({
    mutationFn: async ({
      orderId,
      agentId,
    }: {
      orderId: string
      agentId: string
    }) => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign agent')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] })
      setAssigningOrderId(null)
      setAgentIdInput('')
    },
    onError: (err: Error, vars) => {
      setOrderActionError((prev) => ({
        ...prev,
        [vars.orderId]: err.message,
      }))
    },
  })

  function resetForm() {
    setForm({ name: '', description: '', price: '', available: true })
  }

  function startEditing(item: MenuItem) {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      available: item.available,
    })
    setShowAddForm(false)
  }

  function handleMenuSubmit() {
    const price = parseFloat(form.price)
    if (!form.name.trim()) {
      setMenuError('Name is required')
      return
    }
    if (isNaN(price) || price <= 0) {
      setMenuError('Price must be a positive number')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      available: form.available,
    }

    if (editingItem) {
      updateMenuItem.mutate({ id: editingItem.id, data: payload })
    } else {
      createMenuItem.mutate(payload)
    }
  }

  // Check for 404 (no restaurant profile)
  const noRestaurantProfile =
    menuLoadError instanceof Error &&
    menuLoadError.message.includes('Restaurant profile not found')

  if (noRestaurantProfile) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-amber-800">
          Complete your restaurant profile
        </h2>
        <p className="mt-2 text-sm text-amber-700">
          Your restaurant profile is not set up yet. Please register again to
          complete your profile setup.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <nav className="mb-6 flex gap-2">
        {(['orders', 'menu'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
              activeTab === tab
                ? 'bg-amber-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'orders' ? 'Incoming Orders' : 'Menu Management'}
          </button>
        ))}
      </nav>

      {/* Menu management */}
      {activeTab === 'menu' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Menu Items
            </h2>
            <button
              onClick={() => {
                setShowAddForm(true)
                setEditingItem(null)
                resetForm()
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              + Add item
            </button>
          </div>

          {/* Add/Edit form */}
          {(showAddForm || editingItem) && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">
                {editingItem ? 'Edit menu item' : 'Add new menu item'}
              </h3>
              {menuError && (
                <p role="alert" className="mb-3 text-sm text-red-600">
                  {menuError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    rows={2}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="available"
                    type="checkbox"
                    checked={form.available}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, available: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label
                    htmlFor="available"
                    className="text-sm font-medium text-gray-700"
                  >
                    Available
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleMenuSubmit}
                  disabled={
                    createMenuItem.isPending || updateMenuItem.isPending
                  }
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {editingItem ? 'Save changes' : 'Add item'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingItem(null)
                    resetForm()
                    setMenuError('')
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loadingMenu ? (
            <MenuSkeleton />
          ) : !menuItems?.length ? (
            <EmptyState message="No menu items yet. Add your first item!" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {menuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.name}
                        {item.description && (
                          <p className="text-xs font-normal text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.available
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEditing(item)}
                          className="mr-2 text-amber-600 hover:text-amber-800 focus:outline-none focus:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMenuItem.mutate(item.id)}
                          disabled={deleteMenuItem.isPending}
                          className="text-red-500 hover:text-red-700 focus:outline-none focus:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Incoming orders */}
      {activeTab === 'orders' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Incoming Orders
            <span className="ml-2 text-xs font-normal text-gray-400">
              (auto-refreshes every 15s)
            </span>
          </h2>

          {loadingOrders ? (
            <OrderSkeleton />
          ) : !orders?.length ? (
            <EmptyState message="No orders yet." />
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => {
                const nextStatuses =
                  RESTAURANT_NEXT_STATUSES[order.status] ?? []
                const errMsg = orderActionError[order.id]

                return (
                  <li
                    key={order.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Order from {order.customer.name}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {order.deliveryAddress}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString(
                            undefined,
                            { dateStyle: 'medium' }
                          )}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <ul className="mt-3 space-y-0.5 text-sm text-gray-600">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.menuItem.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>

                    {order.agent && (
                      <p className="mt-2 text-xs text-gray-500">
                        Agent: {order.agent.name}
                      </p>
                    )}

                    {errMsg && (
                      <p role="alert" className="mt-2 text-sm text-red-600">
                        {errMsg}
                      </p>
                    )}

                    {/* Status action buttons */}
                    {nextStatuses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStatuses.map((ns) => (
                          <button
                            key={ns}
                            onClick={() =>
                              updateOrderStatus.mutate({
                                orderId: order.id,
                                status: ns,
                              })
                            }
                            disabled={updateOrderStatus.isPending}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 ${
                              ns === 'CANCELLED'
                                ? 'border border-red-300 text-red-600 hover:bg-red-50 focus:ring-red-400'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-400'
                            }`}
                          >
                            {STATUS_ACTION_LABELS[ns] ?? ns}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Assign agent */}
                    {order.status === 'READY_FOR_PICKUP' && !order.agent && (
                      <div className="mt-3">
                        {assigningOrderId === order.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={agentIdInput}
                              onChange={(e) =>
                                setAgentIdInput(e.target.value)
                              }
                              placeholder="Agent user ID"
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              onClick={() =>
                                assignAgent.mutate({
                                  orderId: order.id,
                                  agentId: agentIdInput.trim(),
                                })
                              }
                              disabled={
                                assignAgent.isPending ||
                                !agentIdInput.trim()
                              }
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setAssigningOrderId(null)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 focus:outline-none"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningOrderId(order.id)}
                            className="text-xs text-green-600 underline hover:text-green-800 focus:outline-none"
                          >
                            Assign delivery agent
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-12 animate-pulse rounded-lg bg-gray-200" />
      ))}
    </div>
  )
}

function OrderSkeleton() {
  return (
    <ul className="space-y-4">
      {[1, 2].map((n) => (
        <li key={n} className="h-28 animate-pulse rounded-xl bg-gray-200" />
      ))}
    </ul>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
