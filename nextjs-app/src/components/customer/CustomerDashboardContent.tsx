'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/StatusBadge'

const POLL_INTERVAL_MS = 15_000

interface Restaurant {
  id: string
  name: string
  address: string
  isActive: boolean
}

interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
}

interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

interface OrderItem {
  id: string
  menuItemId: string
  menuItem: { id: string; name: string }
  quantity: number
  unitPrice: number
}

interface Order {
  id: string
  status: string
  deliveryAddress: string
  createdAt: string
  restaurant: { id: string; name: string }
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

export function CustomerDashboardContent() {
  const queryClient = useQueryClient()
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [orderError, setOrderError] = useState('')
  const [view, setView] = useState<'restaurants' | 'menu' | 'orders'>(
    'restaurants'
  )

  // Restaurants list
  const { data: restaurants, isLoading: loadingRestaurants } = useQuery<
    Restaurant[]
  >({
    queryKey: ['restaurants'],
    queryFn: () => fetchJson<Restaurant[]>('/api/restaurants'),
  })

  // Menu for selected restaurant
  const { data: menuItems, isLoading: loadingMenu } = useQuery<MenuItem[]>({
    queryKey: ['menu', selectedRestaurant?.id],
    queryFn: () =>
      fetchJson<MenuItem[]>(
        `/api/restaurants/${selectedRestaurant!.id}/menu`
      ),
    enabled: !!selectedRestaurant,
  })

  // Customer orders with polling
  const { data: orders, isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ['customer-orders'],
    queryFn: () => fetchJson<Order[]>('/api/orders'),
    refetchInterval: POLL_INTERVAL_MS,
  })

  // Place order mutation
  const placeOrder = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: selectedRestaurant!.id,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
          })),
          deliveryAddress,
        }),
      })
      const data = (await res.json()) as { orderId?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to place order')
      return data
    },
    onSuccess: () => {
      setCart([])
      setDeliveryAddress('')
      setOrderError('')
      void queryClient.invalidateQueries({ queryKey: ['customer-orders'] })
      setView('orders')
    },
    onError: (err: Error) => {
      setOrderError(err.message)
    },
  })

  // Cancel order mutation
  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel order')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-orders'] })
    },
  })

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id)
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 },
      ]
    })
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId))
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    )
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)

  return (
    <div>
      {/* Tab navigation */}
      <nav className="mb-6 flex gap-2">
        {(
          [
            { key: 'restaurants', label: 'Restaurants' },
            { key: 'orders', label: 'My Orders' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              view === tab.key || (view === 'menu' && tab.key === 'restaurants')
                ? 'bg-primary-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Restaurants list */}
      {(view === 'restaurants' || view === 'menu') && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Restaurant cards */}
          <div className="lg:col-span-1">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Active Restaurants
            </h2>
            {loadingRestaurants ? (
              <RestaurantSkeleton />
            ) : !restaurants?.length ? (
              <EmptyState message="No restaurants available right now." />
            ) : (
              <ul className="space-y-3">
                {restaurants.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        setSelectedRestaurant(r)
                        setCart([])
                        setView('menu')
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        selectedRestaurant?.id === r.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{r.name}</p>
                      <p className="mt-1 text-sm text-gray-500">{r.address}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Menu */}
          {selectedRestaurant && view === 'menu' && (
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedRestaurant.name} — Menu
                </h2>
                <button
                  onClick={() => setView('restaurants')}
                  className="text-sm text-primary-600 hover:underline focus:outline-none"
                >
                  Back to restaurants
                </button>
              </div>

              {loadingMenu ? (
                <MenuSkeleton />
              ) : !menuItems?.length ? (
                <EmptyState message="No menu items available." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 text-sm text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="ml-3 shrink-0 font-bold text-primary-600">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        className="mt-3 w-full rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                      >
                        Add to cart
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 && (
                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Your Cart
                  </h3>
                  <ul className="space-y-2">
                    {cart.map((item) => (
                      <li
                        key={item.menuItemId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.menuItemId, -1)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.menuItemId, 1)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                          <span className="w-16 text-right font-semibold text-gray-900">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.menuItemId)}
                            className="text-red-500 hover:text-red-700 focus:outline-none"
                            aria-label={`Remove ${item.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-gray-200 pt-3 text-right text-sm font-bold text-gray-900">
                    Total: ${cartTotal.toFixed(2)}
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="deliveryAddress"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Delivery address
                    </label>
                    <input
                      id="deliveryAddress"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your full delivery address"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {orderError && (
                    <p
                      role="alert"
                      className="mt-2 text-sm text-red-600"
                    >
                      {orderError}
                    </p>
                  )}

                  <button
                    onClick={() => placeOrder.mutate()}
                    disabled={
                      placeOrder.isPending ||
                      deliveryAddress.trim().length < 5
                    }
                    className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {placeOrder.isPending ? 'Placing order…' : 'Place order'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders list */}
      {view === 'orders' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Orders
              <span className="ml-2 text-xs font-normal text-gray-400">
                (auto-refreshes every 15s)
              </span>
            </h2>
          </div>
          {loadingOrders ? (
            <OrderSkeleton />
          ) : !orders?.length ? (
            <EmptyState message="You have no orders yet. Browse restaurants to get started!" />
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
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
                        {order.deliveryAddress}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Placed{' '}
                        {new Date(order.createdAt).toLocaleDateString(
                          undefined,
                          { dateStyle: 'medium' }
                        )}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.menuItem.name} × {item.quantity}
                        </span>
                        <span>
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.status === 'PENDING' && (
                    <button
                      onClick={() => cancelOrder.mutate(order.id)}
                      disabled={cancelOrder.isPending}
                      className="mt-4 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-60"
                    >
                      Cancel order
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function RestaurantSkeleton() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map((n) => (
        <li key={n} className="h-16 animate-pulse rounded-xl bg-gray-200" />
      ))}
    </ul>
  )
}

function MenuSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-24 animate-pulse rounded-xl bg-gray-200" />
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
