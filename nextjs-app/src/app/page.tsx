import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Hero */}
      <div className="mx-auto max-w-5xl px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          <span className="text-primary-600">Delivvr</span>
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Fresh food delivered fast. Order from the best local restaurants.
        </p>
        <p className="mt-2 text-base text-gray-500">
          Choose your role to get started
        </p>
      </div>

      {/* Role cards */}
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Customer */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Customer</h2>
            <p className="mt-2 text-sm text-gray-500">
              Browse restaurants, place orders, and track deliveries in real time.
            </p>
            <Link
              href="/login/customer"
              className="mt-6 block w-full rounded-lg bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Sign in as Customer
            </Link>
          </div>

          {/* Restaurant */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Restaurant</h2>
            <p className="mt-2 text-sm text-gray-500">
              Manage your menu, track incoming orders, and assign delivery agents.
            </p>
            <Link
              href="/login/restaurant"
              className="mt-6 block w-full rounded-lg bg-amber-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Sign in as Restaurant
            </Link>
          </div>

          {/* Delivery Agent */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Delivery Agent</h2>
            <p className="mt-2 text-sm text-gray-500">
              View assigned pickups, update delivery status, and complete orders.
            </p>
            <Link
              href="/login/agent"
              className="mt-6 block w-full rounded-lg bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Sign in as Agent
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Delivvr. All rights reserved.
      </footer>
    </main>
  )
}
